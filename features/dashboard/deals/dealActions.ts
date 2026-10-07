"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { createClientServer } from "@/lib/supabase";
import { ymdInAppTz } from "@/lib/dates";
import { DEAL_STAGE_LABELS, nextDealStage, type DealStage } from "@/features/dashboard/deals/deal";

// Postventa. Con la sesión del agente (RLS: sus leads; admin todos). La
// operación son columnas del lead; la propiedad acompaña: Reservada al
// reservar, En venta si se cae. La venta final se registra con el cierre
// de Finanzas (comisión + Vendida).

type Result = { success: true; message: string } | { success: false; message: string };
const uuid = z.string().uuid();
const ymd = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

async function session() {
  const supabase = await createClientServer();
  const { data: { user } } = await supabase.auth.getUser();
  return { supabase, user };
}

async function note(supabase: Awaited<ReturnType<typeof createClientServer>>, leadId: string, userId: string, content: string) {
  await supabase.from("lead_notes").insert({ lead_id: leadId, user_id: userId, content });
}

function revalidateDeal(leadId: string, propertyId?: string | null) {
  revalidatePath(`/dashboard/leads/${leadId}`);
  revalidatePath("/dashboard/operaciones");
  revalidatePath("/dashboard", "layout");
  if (propertyId) revalidatePath(`/dashboard/propiedades/${propertyId}`);
}

const reservaSchema = z.object({
  lead_id: uuid,
  property_id: uuid,
  deal_price: z.number().positive().max(1e12),
  deal_currency: z.enum(["ARS", "USD"]),
  reserva_at: ymd,
  reserva_amount: z.number().min(0).max(1e12),
  reserva_expires_at: ymd,
  deal_financing: z.boolean(),
}).refine((v) => v.reserva_expires_at >= v.reserva_at, { message: "La reserva no puede vencer antes de firmarse." });

// Abre la operación: el lead queda en Negociación y la propiedad Reservada.
export async function startDealAction(input: z.input<typeof reservaSchema>): Promise<Result> {
  const parsed = reservaSchema.safeParse(input);
  if (!parsed.success) return { success: false, message: parsed.error.issues[0]?.message ?? "Datos inválidos." };
  const { supabase, user } = await session();
  if (!user) return { success: false, message: "No autenticado" };
  const { lead_id, property_id, ...deal } = parsed.data;

  const { data: lead } = await supabase.from("leads").select("status, deal_stage").eq("id", lead_id).maybeSingle();
  if (!lead) return { success: false, message: "Lead no encontrado." };
  if (lead.deal_stage && lead.deal_stage !== "CAIDA") return { success: false, message: "Este lead ya tiene una operación en curso." };

  const { error } = await supabase.from("leads").update({
    ...deal, property_id, deal_stage: "RESERVA", deal_checklist: { reserva_firmada: true }, deal_lost_reason: null,
    boleto_at: null, escritura_at: null, escribano: null, deal_bank: null, deal_loan_amount: null, deal_loan_status: null,
    deal_updated_at: new Date().toISOString(),
    ...(lead.status === "CERRADO" ? {} : { status: "NEGOCIACIÓN" as const }),
  }).eq("id", lead_id);
  if (error) return { success: false, message: error.message };

  // La propiedad se marca reservada (si el agente puede editarla).
  await supabase.from("properties").update({ status: "RESERVADO" }).eq("id", property_id).in("status", ["EN_VENTA", "EN_ALQUILER"]);
  await note(supabase, lead_id, user.id, `Reserva firmada: ${deal.deal_currency} ${deal.deal_price.toLocaleString("es-AR")}, vence el ${deal.reserva_expires_at.split("-").reverse().join("/")}.`);
  revalidateDeal(lead_id, property_id);
  return { success: true, message: "Reserva registrada. La propiedad quedó reservada." };
}

const updateSchema = z.object({
  lead_id: uuid,
  boleto_at: ymd.nullable().optional(),
  escritura_at: ymd.nullable().optional(),
  escribano: z.string().trim().max(160).nullable().optional(),
  reserva_expires_at: ymd.optional(),
  deal_financing: z.boolean().optional(),
  deal_bank: z.string().trim().max(120).nullable().optional(),
  deal_loan_amount: z.number().min(0).max(1e12).nullable().optional(),
  deal_loan_status: z.enum(["EN_TRAMITE", "APROBADO", "RECHAZADO"]).nullable().optional(),
  deal_price: z.number().positive().max(1e12).optional(),
});

// Edita fechas y datos de la operación sin cambiar de etapa.
export async function updateDealAction(input: z.input<typeof updateSchema>): Promise<Result> {
  const parsed = updateSchema.safeParse(input);
  if (!parsed.success) return { success: false, message: "Datos inválidos." };
  const { supabase, user } = await session();
  if (!user) return { success: false, message: "No autenticado" };
  const { lead_id, ...patch } = parsed.data;
  const { error } = await supabase.from("leads").update({ ...patch, deal_updated_at: new Date().toISOString() }).eq("id", lead_id);
  if (error) return { success: false, message: error.message };
  revalidateDeal(lead_id);
  return { success: true, message: "Operación actualizada." };
}

export async function toggleDealChecklistAction(input: { lead_id: string; key: string; done: boolean }): Promise<Result> {
  const parsed = z.object({ lead_id: uuid, key: z.string().regex(/^[a-z_]{3,40}$/), done: z.boolean() }).safeParse(input);
  if (!parsed.success) return { success: false, message: "Datos inválidos." };
  const { supabase, user } = await session();
  if (!user) return { success: false, message: "No autenticado" };
  const { data: lead } = await supabase.from("leads").select("deal_checklist").eq("id", parsed.data.lead_id).maybeSingle();
  if (!lead) return { success: false, message: "Lead no encontrado." };
  const checklist = { ...((lead.deal_checklist as Record<string, boolean>) ?? {}), [parsed.data.key]: parsed.data.done };
  const { error } = await supabase.from("leads").update({ deal_checklist: checklist, deal_updated_at: new Date().toISOString() }).eq("id", parsed.data.lead_id);
  if (error) return { success: false, message: error.message };
  revalidateDeal(parsed.data.lead_id);
  return { success: true, message: "" };
}

const advanceSchema = z.object({
  lead_id: uuid,
  // Datos que pide la etapa a la que se pasa.
  boleto_at: ymd.optional(),
  escritura_at: ymd.optional(),
  escribano: z.string().trim().max(160).optional(),
  deal_bank: z.string().trim().max(120).optional(),
});

// Pasa a la etapa siguiente. Al escriturar, el lead queda Cerrado (la venta
// se registra después con el cierre de Finanzas).
export async function advanceDealAction(input: z.input<typeof advanceSchema>): Promise<Result & { stage?: DealStage }> {
  const parsed = advanceSchema.safeParse(input);
  if (!parsed.success) return { success: false, message: "Datos inválidos." };
  const { supabase, user } = await session();
  if (!user) return { success: false, message: "No autenticado" };
  const { lead_id, ...data } = parsed.data;
  const { data: lead } = await supabase.from("leads").select("deal_stage, deal_financing, property_id, boleto_at, escritura_at").eq("id", lead_id).maybeSingle();
  if (!lead?.deal_stage) return { success: false, message: "El lead no tiene una operación." };
  const next = nextDealStage(lead.deal_stage as DealStage, lead.deal_financing);
  if (!next) return { success: false, message: "La operación ya terminó." };

  const today = ymdInAppTz();
  const patch: Record<string, unknown> = { deal_stage: next, deal_updated_at: new Date().toISOString() };
  if (next === "BOLETO") {
    if (!data.boleto_at) return { success: false, message: "Indicá la fecha prevista del boleto." };
    patch.boleto_at = data.boleto_at;
  }
  if (next === "FINANCIACION") {
    patch.deal_loan_status = "EN_TRAMITE";
    if (data.deal_bank) patch.deal_bank = data.deal_bank;
  }
  if (next === "ESCRITURA") {
    if (!data.escritura_at) return { success: false, message: "Indicá la fecha prevista de escritura." };
    patch.escritura_at = data.escritura_at;
    if (data.escribano) patch.escribano = data.escribano;
    if (lead.deal_financing) patch.deal_loan_status = "APROBADO";
  }
  if (next === "ESCRITURADA") {
    patch.status = "CERRADO";
    patch.escritura_at = lead.escritura_at && lead.escritura_at <= today ? lead.escritura_at : today;
  }

  const { error } = await supabase.from("leads").update(patch).eq("id", lead_id);
  if (error) return { success: false, message: error.message };
  await note(supabase, lead_id, user.id, next === "ESCRITURADA" ? "Escritura firmada: operación terminada." : `Operación: pasó a ${DEAL_STAGE_LABELS[next]}.`);
  revalidateDeal(lead_id, lead.property_id);
  return {
    success: true, stage: next,
    message: next === "ESCRITURADA" ? "Escriturada. Registrá la venta para cargar la comisión." : `Pasó a ${DEAL_STAGE_LABELS[next]}.`,
  };
}

// La operación se cae: queda el motivo y la propiedad vuelve a publicarse.
export async function dropDealAction(input: { lead_id: string; reason: string }): Promise<Result> {
  const parsed = z.object({ lead_id: uuid, reason: z.string().trim().min(3, "Contá brevemente qué pasó.").max(500) }).safeParse(input);
  if (!parsed.success) return { success: false, message: parsed.error.issues[0]?.message ?? "Datos inválidos." };
  const { supabase, user } = await session();
  if (!user) return { success: false, message: "No autenticado" };
  const { data: lead } = await supabase.from("leads").select("property_id, deal_stage").eq("id", parsed.data.lead_id).maybeSingle();
  if (!lead?.deal_stage || lead.deal_stage === "ESCRITURADA") return { success: false, message: "No hay una operación en curso." };

  const { error } = await supabase.from("leads").update({
    deal_stage: "CAIDA", deal_lost_reason: parsed.data.reason, deal_updated_at: new Date().toISOString(),
  }).eq("id", parsed.data.lead_id);
  if (error) return { success: false, message: error.message };
  if (lead.property_id) {
    const { data: property } = await supabase.from("properties").select("operation_type").eq("id", lead.property_id).maybeSingle();
    const status = property?.operation_type?.toLowerCase() === "alquiler" ? "EN_ALQUILER" : "EN_VENTA";
    await supabase.from("properties").update({ status }).eq("id", lead.property_id).eq("status", "RESERVADO");
  }
  await note(supabase, parsed.data.lead_id, user.id, `Operación caída: ${parsed.data.reason}`);
  revalidateDeal(parsed.data.lead_id, lead.property_id);
  return { success: true, message: "Operación marcada como caída. La propiedad volvió a estar publicada." };
}
