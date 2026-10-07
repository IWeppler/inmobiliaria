"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { createClientServer } from "@/lib/supabase";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { ymdInAppTz } from "@/lib/dates";
import type { ActionResult } from "@/features/rentals/actions";
import { money } from "@/features/rentals/logic";
import { notifyReceipt } from "@/features/rentals/notifications";
import { allocate } from "@/features/rentals/reconciliation";
import { loadReconciliationCandidates } from "@/features/rentals/reconciliationData";
import { processInboxItem } from "@/features/rentals/inboxIntake";
import type { InboxKind } from "@/features/rentals/inbox";

// Bandeja de Mensajes (E4.18): el agente confirma lo que propuso la IA.
// Todo corre con su sesión: solo resuelve mensajes de contratos visibles.

const uuid = z.string().uuid();
const ymd = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

async function loadItem(inboxId: string) {
  const supabase = await createClientServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "No autenticado" } as const;
  const { data: item } = await supabase.from("rental_inbox")
    .select("id, status, source, contract_id, media_path, media_mime, received_at, contact:rental_contacts(full_name)")
    .eq("id", inboxId).maybeSingle();
  if (!item) return { error: "Mensaje no encontrado." } as const;
  if (item.status !== "PENDIENTE") return { error: "Este mensaje ya se resolvió." } as const;
  return { supabase, user, item };
}

async function close(supabase: Awaited<ReturnType<typeof createClientServer>>, inboxId: string, userId: string, status: "CONFIRMADO" | "DESCARTADO", note: string, kind?: string) {
  await supabase.from("rental_inbox").update({
    status, result_note: note.slice(0, 500), resolved_by: userId, resolved_at: new Date().toISOString(), ...(kind ? { kind } : {}),
  }).eq("id", inboxId);
  revalidatePath("/dashboard/alquileres", "layout");
}

const paymentSchema = z.object({ inbox_id: uuid, contract_id: uuid, amount: z.number().positive().max(1e12), date: ymd });

// Comprobante: reparte el importe sobre las deudas más viejas, registra los
// cobros (con recibo) y deja el comprobante en los documentos del contrato.
export async function confirmInboxPaymentAction(input: z.input<typeof paymentSchema>): Promise<ActionResult> {
  const parsed = paymentSchema.safeParse(input);
  if (!parsed.success) return { success: false, message: "Revisá importe y fecha." };
  const loaded = await loadItem(parsed.data.inbox_id);
  if ("error" in loaded) return { success: false, message: loaded.error! };
  const { supabase, user, item } = loaded;
  const { contract_id, amount, date } = parsed.data;

  const [contract] = await loadReconciliationCandidates(supabase, ymdInAppTz(), [contract_id]);
  if (!contract) return { success: false, message: "El contrato no tiene deuda pendiente para imputar." };
  const { allocations, leftover } = allocate(contract.open, amount, date);
  if (!allocations.length) return { success: false, message: "El contrato no tiene deuda pendiente para imputar." };

  const contactName = (item.contact as unknown as { full_name: string } | null)?.full_name ?? "inquilino";
  const via = item.source === "PORTAL" ? "el portal" : "WhatsApp";
  // inbox_id liga el cobro con el pago informado: el historial lo muestra
  // como "confirmó e imputó" y el portal le da el recibo al inquilino.
  const { data: entries, error } = await supabase.from("rental_payment_entries").insert(allocations.map((a) => ({
    charge_id: a.charge.id, paid_at: date, amount: a.amount, method: "TRANSFERENCIA", inbox_id: item.id,
    account: `Comprobante por ${via}`, notes: `Comprobante enviado por ${contactName} por ${via}`,
  }))).select("id");
  if (error || !entries) return { success: false, message: error?.message ?? "No se pudo registrar el cobro." };

  // El comprobante pasa a la carpeta del contrato (move con service role:
  // la ruta inbox/ no tiene policy de agentes) y se registra como documento.
  if (item.media_path) {
    const ext = item.media_path.split(".").pop() ?? "bin";
    const path = `${contract_id}/${crypto.randomUUID()}.${ext}`;
    const { error: moveError } = await supabaseAdmin.storage.from("rental-docs").move(item.media_path, path);
    if (!moveError) {
      await supabase.from("rental_documents").insert({
        contract_id, kind: "OTRO", path, file_name: `Comprobante ${via} ${date} - ${contactName}.${ext}`.slice(0, 200),
      });
    }
  }

  const note = `${entries.length} ${entries.length === 1 ? "cobro registrado" : "cobros registrados"} por ${money(amount - leftover, contract.currency)}${leftover > 0 ? `; sobraron ${money(leftover, contract.currency)}` : ""}.`;
  await close(supabase, item.id, user.id, "CONFIRMADO", note, "COMPROBANTE");
  revalidatePath(`/dashboard/alquileres/${contract_id}`);
  after(async () => { for (const e of entries) await notifyReceipt(e.id).catch(() => {}); });
  return { success: true, message: note };
}

const rejectSchema = z.object({ inbox_id: uuid, reason: z.string().trim().min(3, "Indicá el motivo.").max(300) });

// Pago informado que no se puede imputar: el inquilino ve el motivo en su
// portal y el rechazo queda en el historial del contrato.
export async function rejectInboxPaymentAction(input: z.input<typeof rejectSchema>): Promise<ActionResult> {
  const parsed = rejectSchema.safeParse(input);
  if (!parsed.success) return { success: false, message: parsed.error.issues[0]?.message ?? "Datos inválidos." };
  const loaded = await loadItem(parsed.data.inbox_id);
  if ("error" in loaded) return { success: false, message: loaded.error! };
  const { supabase, user, item } = loaded;
  const { error } = await supabase.from("rental_inbox").update({
    status: "RECHAZADO", kind: "COMPROBANTE", reject_reason: parsed.data.reason, result_note: `Rechazado: ${parsed.data.reason}`.slice(0, 500),
    resolved_by: user.id, resolved_at: new Date().toISOString(),
  }).eq("id", item.id);
  if (error) return { success: false, message: error.message };
  revalidatePath("/dashboard/alquileres", "layout");
  return { success: true, message: "Pago rechazado. El inquilino ve el motivo en su portal." };
}

const claimSchema = z.object({
  inbox_id: uuid, contract_id: uuid,
  title: z.string().trim().min(3, "El título es muy corto.").max(160),
  description: z.string().trim().max(2000).optional(),
  priority: z.enum(["BAJA", "MEDIA", "ALTA", "URGENTE"]),
});

export async function createInboxClaimAction(input: z.input<typeof claimSchema>): Promise<ActionResult> {
  const parsed = claimSchema.safeParse(input);
  if (!parsed.success) return { success: false, message: parsed.error.issues[0]?.message ?? "Datos inválidos." };
  const loaded = await loadItem(parsed.data.inbox_id);
  if ("error" in loaded) return { success: false, message: loaded.error! };
  const { supabase, user, item } = loaded;
  const { contract_id, title, description, priority } = parsed.data;
  const { error } = await supabase.from("rental_maintenance").insert({
    contract_id, title, priority, description: description || null, reported_at: item.received_at.slice(0, 10),
  });
  if (error) return { success: false, message: error.message };
  await close(supabase, item.id, user.id, "CONFIRMADO", `Reclamo creado: ${title}`, "RECLAMO");
  revalidatePath(`/dashboard/alquileres/${contract_id}`);
  return { success: true, message: "Reclamo creado en Mantenimiento." };
}

const resolveSchema = z.object({ inbox_id: uuid, status: z.enum(["CONFIRMADO", "DESCARTADO"]), note: z.string().max(500).optional() });

// Consultas respondidas o mensajes que no requieren acción.
export async function resolveInboxAction(input: z.input<typeof resolveSchema>): Promise<ActionResult> {
  const parsed = resolveSchema.safeParse(input);
  if (!parsed.success) return { success: false, message: "Datos inválidos." };
  const loaded = await loadItem(parsed.data.inbox_id);
  if ("error" in loaded) return { success: false, message: loaded.error! };
  const { supabase, user, item } = loaded;
  const resolved = parsed.data.status === "CONFIRMADO";
  await close(supabase, item.id, user.id, parsed.data.status, parsed.data.note || (resolved ? "Respondido" : "Descartado"));
  return { success: true, message: resolved ? "Mensaje resuelto." : "Mensaje descartado." };
}

// Vuelve a pasar el mensaje por la IA (por ejemplo, si antes falló).
export async function retryInboxAiAction(inboxId: string): Promise<ActionResult> {
  if (!uuid.safeParse(inboxId).success) return { success: false, message: "Mensaje inválido." };
  const loaded = await loadItem(inboxId);
  if ("error" in loaded) return { success: false, message: loaded.error! };
  // Lo enviado por el portal ya trae el tipo elegido por el inquilino.
  const { data: meta } = await loaded.supabase.from("rental_inbox").select("source, kind").eq("id", inboxId).single();
  await processInboxItem(inboxId, undefined, meta?.source === "PORTAL" ? { forcedKind: meta.kind as InboxKind } : {});
  revalidatePath("/dashboard/alquileres/mensajes");
  return { success: true, message: "Mensaje reprocesado." };
}
