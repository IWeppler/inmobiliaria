"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { createClientServer } from "@/lib/supabase";
import { ymdInAppTz } from "@/lib/dates";
import { LISTING_STAGE_LABELS, defaultAuthorizationExpiry, type ListingStage } from "@/features/dashboard/listings/listing";

// Captaciones. Con la sesión del agente (RLS: las suyas; admin todas).

type Result = { success: true; message: string; id?: string } | { success: false; message: string };
const uuid = z.string().uuid();
const ymd = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const optText = (max: number) => z.string().trim().max(max).optional().transform((v) => v || null);
const amount = z.number().positive().max(1e12).nullable().optional();

async function session() {
  const supabase = await createClientServer();
  const { data: { user } } = await supabase.auth.getUser();
  return { supabase, user };
}

function revalidateListings() {
  revalidatePath("/dashboard/captaciones");
  revalidatePath("/dashboard", "layout");
}

const fieldsSchema = z.object({
  owner_name: z.string().trim().min(2, "Indicá el nombre del propietario.").max(160),
  owner_phone: optText(40),
  owner_email: z.union([z.string().trim().email("Email inválido."), z.literal("")]).optional().transform((v) => v || null),
  address: optText(200),
  city: optText(120),
  operation: z.enum(["venta", "alquiler"]),
  property_type_id: z.number().int().positive().nullable().optional(),
  source: optText(60),
  owner_price: amount,
  appraisal_value: amount,
  currency: z.enum(["ARS", "USD"]),
  commission_pct: z.number().min(0).max(20).nullable().optional(),
  exclusive: z.boolean().optional(),
  notes: optText(2000),
});

const createSchema = fieldsSchema.extend({
  next_action: optText(120),
  next_action_at: ymd.nullable().optional(),
});

export async function createProspectAction(input: z.input<typeof createSchema>): Promise<Result> {
  const parsed = createSchema.safeParse(input);
  if (!parsed.success) return { success: false, message: parsed.error.issues[0]?.message ?? "Datos inválidos." };
  const { supabase, user } = await session();
  if (!user) return { success: false, message: "No autenticado" };
  const v = parsed.data;
  const { data, error } = await supabase.from("owner_prospects").insert({
    ...v, agent_id: user.id,
    next_action: v.next_action, next_action_at: v.next_action ? v.next_action_at ?? ymdInAppTz() : null,
  }).select("id").single();
  if (error || !data) return { success: false, message: error?.message ?? "No se pudo guardar." };
  revalidateListings();
  return { success: true, message: "Captación cargada.", id: data.id };
}

const updateSchema = fieldsSchema.partial().extend({
  id: uuid,
  next_action: optText(120),
  next_action_at: ymd.nullable().optional(),
  authorization_signed_at: ymd.nullable().optional(),
  authorization_expires_at: ymd.nullable().optional(),
});

export async function updateProspectAction(input: z.input<typeof updateSchema>): Promise<Result> {
  const parsed = updateSchema.safeParse(input);
  if (!parsed.success) return { success: false, message: parsed.error.issues[0]?.message ?? "Datos inválidos." };
  const { supabase, user } = await session();
  if (!user) return { success: false, message: "No autenticado" };
  const { id, ...patch } = parsed.data;
  // Solo los campos enviados (los opcionales vacíos llegan como null).
  const keys = Object.keys(input).filter((k) => k !== "id") as (keyof typeof patch)[];
  const update = Object.fromEntries(keys.map((k) => [k, patch[k]]));
  if ("next_action" in update && !update.next_action) update.next_action_at = null;
  const { error } = await supabase.from("owner_prospects").update(update).eq("id", id);
  if (error) return { success: false, message: error.message };
  revalidateListings();
  return { success: true, message: "Captación actualizada." };
}

const moveSchema = z.object({
  id: uuid,
  stage: z.enum(["CONTACTO", "TASACION", "PROPUESTA", "AUTORIZACION", "PERDIDA"]),
  appraisal_value: z.number().positive().max(1e12).optional(),
  authorization_signed_at: ymd.optional(),
  authorization_expires_at: ymd.optional(),
  exclusive: z.boolean().optional(),
  commission_pct: z.number().min(0).max(20).optional(),
  lost_reason: z.string().trim().max(500).optional(),
});

// Cambia de etapa. Cada etapa pide su dato: la tasación para proponer, la
// firma para la autorización, el motivo para perderla. Publicar es aparte
// (vincula la propiedad).
export async function moveProspectAction(input: z.input<typeof moveSchema>): Promise<Result> {
  const parsed = moveSchema.safeParse(input);
  if (!parsed.success) return { success: false, message: parsed.error.issues[0]?.message ?? "Datos inválidos." };
  const { supabase, user } = await session();
  if (!user) return { success: false, message: "No autenticado" };
  const v = parsed.data;
  const { data: current } = await supabase.from("owner_prospects").select("stage, appraisal_value").eq("id", v.id).maybeSingle();
  if (!current) return { success: false, message: "Captación no encontrada." };
  if (current.stage === v.stage) return { success: true, message: "" };
  if (current.stage === "PUBLICADA") return { success: false, message: "La captación ya está publicada." };

  const patch: Record<string, unknown> = { stage: v.stage, stage_changed_at: new Date().toISOString(), next_action: null, next_action_at: null };
  if (v.stage === "PROPUESTA") {
    const appraisal = v.appraisal_value ?? current.appraisal_value;
    if (!appraisal) return { success: false, message: "Cargá el valor de tasación antes de enviar la propuesta." };
    patch.appraisal_value = appraisal;
  }
  if (v.stage === "AUTORIZACION") {
    if (!v.authorization_signed_at) return { success: false, message: "Indicá la fecha de firma de la autorización." };
    patch.authorization_signed_at = v.authorization_signed_at;
    patch.authorization_expires_at = v.authorization_expires_at ?? defaultAuthorizationExpiry(v.authorization_signed_at);
    if (v.exclusive !== undefined) patch.exclusive = v.exclusive;
    if (v.commission_pct !== undefined) patch.commission_pct = v.commission_pct;
  }
  if (v.stage === "PERDIDA") {
    if (!v.lost_reason || v.lost_reason.length < 3) return { success: false, message: "Contá brevemente por qué se perdió." };
    patch.lost_reason = v.lost_reason;
  } else {
    patch.lost_reason = null;
  }

  const { error } = await supabase.from("owner_prospects").update(patch).eq("id", v.id);
  if (error) return { success: false, message: error.message };
  revalidateListings();
  return { success: true, message: `Pasó a ${LISTING_STAGE_LABELS[v.stage as ListingStage]}.` };
}

// Publica: vincula la propiedad ya cargada, deja al propietario como
// contacto y, si la propiedad no tiene dueños, lo carga como principal.
export async function publishProspectAction(input: { id: string; property_id: string }): Promise<Result> {
  const parsed = z.object({ id: uuid, property_id: uuid }).safeParse(input);
  if (!parsed.success) return { success: false, message: "Elegí la propiedad publicada." };
  const { supabase, user } = await session();
  if (!user) return { success: false, message: "No autenticado" };

  const { data: prospect } = await supabase.from("owner_prospects")
    .select("stage, agent_id, owner_name, owner_phone, owner_email, contact_id").eq("id", parsed.data.id).maybeSingle();
  if (!prospect) return { success: false, message: "Captación no encontrada." };
  if (prospect.stage === "PERDIDA") return { success: false, message: "La captación está marcada como perdida." };
  const { data: property } = await supabase.from("properties").select("id, title, captured_by").eq("id", parsed.data.property_id).maybeSingle();
  if (!property) return { success: false, message: "Propiedad no encontrada." };

  let contactId = prospect.contact_id;
  if (!contactId) {
    const { data, error } = await supabase.from("rental_contacts").insert({
      kind: "owner", full_name: prospect.owner_name, phone: prospect.owner_phone, email: prospect.owner_email,
    }).select("id").single();
    if (error || !data) return { success: false, message: error?.message ?? "No se pudo crear el contacto del propietario." };
    contactId = data.id;
  }

  const { count } = await supabase.from("property_owners").select("contact_id", { count: "exact", head: true }).eq("property_id", property.id);
  let ownerNote = "";
  if (!count) {
    const { error } = await supabase.rpc("set_property_owners", {
      p_property_id: property.id, p_owners: [{ contact_id: contactId, share_pct: 100, is_primary: true }],
    });
    ownerNote = error ? " No se pudo cargar el propietario en la propiedad; hacelo desde su ficha." : " El propietario quedó cargado en la propiedad.";
  }
  if (!property.captured_by && prospect.agent_id) {
    await supabase.from("properties").update({ captured_by: prospect.agent_id }).eq("id", property.id);
  }

  const { error } = await supabase.from("owner_prospects").update({
    stage: "PUBLICADA", property_id: property.id, contact_id: contactId, stage_changed_at: new Date().toISOString(),
    next_action: null, next_action_at: null, lost_reason: null,
  }).eq("id", parsed.data.id);
  if (error) return { success: false, message: error.message };
  revalidateListings();
  revalidatePath(`/dashboard/propiedades/${property.id}`);
  return { success: true, message: `Publicada: ${property.title}.${ownerNote}` };
}

export async function deleteProspectAction(input: { id: string }): Promise<Result> {
  const parsed = z.object({ id: uuid }).safeParse(input);
  if (!parsed.success) return { success: false, message: "Datos inválidos." };
  const { supabase, user } = await session();
  if (!user) return { success: false, message: "No autenticado" };
  const { error } = await supabase.from("owner_prospects").delete().eq("id", parsed.data.id);
  if (error) return { success: false, message: error.message };
  revalidateListings();
  return { success: true, message: "Captación eliminada." };
}
