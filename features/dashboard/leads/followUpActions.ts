"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { createClientServer } from "@/lib/supabase";
import { ymdInAppTz } from "@/lib/dates";
import { OUTCOME_LABELS, type VisitOutcome } from "@/features/dashboard/leads/followUp";

// Próximo paso del lead y resultado de visitas. Con la sesión del agente:
// RLS limita a sus leads y sus eventos (admin, todos).

type Result = { success: true; message: string } | { success: false; message: string };

const uuid = z.string().uuid();
const ymd = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

async function session() {
  const supabase = await createClientServer();
  const { data: { user } } = await supabase.auth.getUser();
  return { supabase, user };
}

function revalidateLead(leadId: string) {
  revalidatePath(`/dashboard/leads/${leadId}`);
  revalidatePath("/dashboard/leads");
  revalidatePath("/dashboard", "layout");
}

const nextSchema = z.object({
  lead_id: uuid,
  action: z.string().trim().min(2, "Escribí qué hay que hacer.").max(200),
  at: ymd,
});

export async function setNextActionAction(input: z.input<typeof nextSchema>): Promise<Result> {
  const parsed = nextSchema.safeParse(input);
  if (!parsed.success) return { success: false, message: parsed.error.issues[0]?.message ?? "Datos inválidos." };
  const { supabase, user } = await session();
  if (!user) return { success: false, message: "No autenticado" };
  const { lead_id, action, at } = parsed.data;
  const { data, error } = await supabase.from("leads").update({ next_action: action, next_action_at: at }).eq("id", lead_id).select("id");
  if (error || !data?.length) return { success: false, message: error?.message ?? "No se pudo guardar." };
  revalidateLead(lead_id);
  return { success: true, message: "Próximo paso guardado." };
}

// Marca el paso como hecho: queda en el historial y se limpia para
// definir el siguiente.
export async function completeNextActionAction(input: { lead_id: string; note?: string }): Promise<Result> {
  const parsed = z.object({ lead_id: uuid, note: z.string().trim().max(1000).optional() }).safeParse(input);
  if (!parsed.success) return { success: false, message: "Datos inválidos." };
  const { supabase, user } = await session();
  if (!user) return { success: false, message: "No autenticado" };
  const { lead_id, note } = parsed.data;
  const { data: lead } = await supabase.from("leads").select("next_action").eq("id", lead_id).maybeSingle();
  if (!lead) return { success: false, message: "Lead no encontrado." };
  if (lead.next_action) {
    await supabase.from("lead_notes").insert({
      lead_id, user_id: user.id, content: `Hecho: ${lead.next_action}${note ? `. ${note}` : ""}`,
    });
  }
  const { error } = await supabase.from("leads").update({ next_action: null, next_action_at: null }).eq("id", lead_id);
  if (error) return { success: false, message: error.message };
  revalidateLead(lead_id);
  return { success: true, message: "Listo. Definí el próximo paso." };
}

const outcomeSchema = z.object({
  event_id: uuid,
  outcome: z.enum(["INTERESADO", "SEGUNDA_VISITA", "CARO", "NO_LE_GUSTO", "NO_ASISTIO", "OTRO"]),
  note: z.string().trim().max(500).optional(),
  next: z.object({ action: z.string().trim().min(2).max(200), at: ymd }).optional(),
});

// Registra cómo salió la visita; deja el resultado en el historial del lead
// y, si viene, el próximo paso sugerido.
export async function recordVisitOutcomeAction(input: z.input<typeof outcomeSchema>): Promise<Result> {
  const parsed = outcomeSchema.safeParse(input);
  if (!parsed.success) return { success: false, message: "Datos inválidos." };
  const { supabase, user } = await session();
  if (!user) return { success: false, message: "No autenticado" };
  const { event_id, outcome, note, next } = parsed.data;

  const { data: event } = await supabase.from("events").select("id, date, lead_id, property_id").eq("id", event_id).maybeSingle();
  if (!event) return { success: false, message: "Visita no encontrada." };
  const day = ymdInAppTz(new Date(event.date));
  if (day > ymdInAppTz()) return { success: false, message: "La visita todavía no ocurrió." };

  const { data: updated, error } = await supabase.from("events")
    .update({ outcome, outcome_note: note || null, outcome_at: new Date().toISOString() }).eq("id", event_id).select("id");
  if (error || !updated?.length) return { success: false, message: error?.message ?? "Solo quien agendó la visita puede registrar el resultado." };

  if (event.lead_id) {
    const [y, m, d] = day.split("-");
    await supabase.from("lead_notes").insert({
      lead_id: event.lead_id, user_id: user.id,
      content: `Visita del ${d}/${m}/${y}: ${OUTCOME_LABELS[outcome as VisitOutcome]}${note ? `. ${note}` : ""}`,
    });
    if (next) await supabase.from("leads").update({ next_action: next.action, next_action_at: next.at }).eq("id", event.lead_id);
    revalidateLead(event.lead_id);
  }
  if (event.property_id) revalidatePath(`/dashboard/propiedades/${event.property_id}`);
  return { success: true, message: "Resultado de la visita guardado." };
}
