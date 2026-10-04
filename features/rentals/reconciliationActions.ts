"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { createClientServer } from "@/lib/supabase";
import { ymdInAppTz } from "@/lib/dates";
import type { ActionResult } from "@/features/rentals/actions";
import { notifyReceipt } from "@/features/rentals/notifications";
import { allocate } from "@/features/rentals/reconciliation";
import { loadReconciliationCandidates } from "@/features/rentals/reconciliationData";

// Conciliación bancaria: el navegador propone, el servidor vuelve a calcular
// el reparto con los saldos del momento y registra los cobros.

const ymd = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const movementSchema = z.object({
  hash: z.string().min(10).max(400),
  date: ymd,
  description: z.string().trim().min(1).max(300),
  amount: z.number().positive().max(1e12),
});
const batchSchema = z.object({
  account: z.string().trim().min(1, "Indicá la cuenta bancaria.").max(100),
  currency: z.enum(["ARS", "USD"]),
});

async function currentUser() {
  const supabase = await createClientServer();
  const { data: { user } } = await supabase.auth.getUser();
  return { supabase, user };
}

// Cuáles de estos movimientos ya se resolvieron antes (por cualquier agente).
export async function knownMovementsAction(hashes: string[]): Promise<ActionResult<Record<string, string>>> {
  const parsed = z.array(z.string().max(400)).max(2000).safeParse(hashes);
  if (!parsed.success) return { success: false, message: "Extracto inválido." };
  const { supabase, user } = await currentUser();
  if (!user) return { success: false, message: "No autenticado" };
  const known: Record<string, string> = {};
  for (let i = 0; i < parsed.data.length; i += 200) {
    const { data } = await supabase.from("rental_bank_movements").select("hash, status").in("hash", parsed.data.slice(i, i + 200));
    for (const row of data ?? []) known[row.hash] = row.status;
  }
  return { success: true, message: "ok", data: known };
}

const confirmSchema = batchSchema.extend({
  items: z.array(movementSchema.extend({ contract_id: z.string().uuid() })).min(1).max(300),
});

export type ConfirmResult = { registered: number; payments: number; skipped: string[]; leftovers: string[] };

export async function confirmReconciliationAction(input: z.input<typeof confirmSchema>): Promise<ActionResult<ConfirmResult>> {
  const parsed = confirmSchema.safeParse(input);
  if (!parsed.success) return { success: false, message: parsed.error.issues[0]?.message ?? "Datos inválidos." };
  const { supabase, user } = await currentUser();
  if (!user) return { success: false, message: "No autenticado" };
  const { account, currency, items } = parsed.data;

  const candidates = await loadReconciliationCandidates(supabase, ymdInAppTz(), [...new Set(items.map((i) => i.contract_id))]);
  const byId = new Map(candidates.map((c) => [c.id, c]));
  const used = new Map<string, number>();
  const result: ConfirmResult = { registered: 0, payments: 0, skipped: [], leftovers: [] };
  const entryIds: string[] = [];
  const touched = new Set<string>();

  for (const item of items) {
    const contract = byId.get(item.contract_id);
    const label = `${item.date} ${item.description.slice(0, 40)}`;
    if (!contract || contract.currency !== currency) { result.skipped.push(`${label}: el contrato no tiene deuda en ${currency}`); continue; }

    const { allocations, leftover } = allocate(contract.open, item.amount, item.date, used);
    if (!allocations.length) { result.skipped.push(`${label}: el contrato no tiene deuda pendiente`); continue; }

    const { data: movement, error: movementError } = await supabase.from("rental_bank_movements").insert({
      hash: item.hash, movement_date: item.date, description: item.description, amount: item.amount,
      currency, account, status: "CONCILIADO", contract_id: contract.id,
    }).select("id").single();
    if (movementError || !movement) {
      // Lo que se reservó para este movimiento vuelve a estar disponible.
      for (const a of allocations) used.set(a.charge.id, Math.round(((used.get(a.charge.id) ?? 0) - a.amount) * 100) / 100);
      result.skipped.push(`${label}: ${movementError?.code === "23505" ? "ya estaba conciliado" : movementError?.message ?? "error"}`);
      continue;
    }

    const { data: entries, error: entriesError } = await supabase.from("rental_payment_entries").insert(allocations.map((a) => ({
      charge_id: a.charge.id,
      paid_at: item.date,
      amount: a.amount,
      method: "TRANSFERENCIA",
      account,
      notes: `Conciliación bancaria: ${item.description}`.slice(0, 500),
      bank_movement_id: movement.id,
    }))).select("id");
    if (entriesError || !entries) {
      await supabase.from("rental_bank_movements").delete().eq("id", movement.id);
      for (const a of allocations) used.set(a.charge.id, Math.round(((used.get(a.charge.id) ?? 0) - a.amount) * 100) / 100);
      result.skipped.push(`${label}: ${entriesError?.message ?? "no se pudieron registrar los cobros"}`);
      continue;
    }

    result.registered += 1;
    result.payments += entries.length;
    entryIds.push(...entries.map((e) => e.id));
    touched.add(contract.id);
    if (leftover > 0) result.leftovers.push(`${label}: sobran ${leftover.toLocaleString("es-AR")} ${currency} sin deuda a la cual aplicar`);
  }

  for (const id of touched) revalidatePath(`/dashboard/alquileres/${id}`);
  revalidatePath("/dashboard/alquileres", "layout");
  // Recibos por WhatsApp (si están activados) después de responder.
  after(async () => { for (const id of entryIds) await notifyReceipt(id).catch(() => {}); });

  const message = result.registered
    ? `${result.registered} ${result.registered === 1 ? "transferencia conciliada" : "transferencias conciliadas"} (${result.payments} ${result.payments === 1 ? "cobro" : "cobros"}).`
    : "No se registró ningún cobro.";
  return { success: result.registered > 0 || items.length === 0, message, data: result };
}

const ignoreSchema = batchSchema.extend({ items: z.array(movementSchema).min(1).max(1000) });

// Marca movimientos que no son alquileres para que no vuelvan a aparecer.
export async function ignoreMovementsAction(input: z.input<typeof ignoreSchema>): Promise<ActionResult> {
  const parsed = ignoreSchema.safeParse(input);
  if (!parsed.success) return { success: false, message: parsed.error.issues[0]?.message ?? "Datos inválidos." };
  const { supabase, user } = await currentUser();
  if (!user) return { success: false, message: "No autenticado" };
  const { account, currency, items } = parsed.data;
  const { error } = await supabase.from("rental_bank_movements").upsert(items.map((m) => ({
    hash: m.hash, movement_date: m.date, description: m.description, amount: m.amount,
    currency, account, status: "IGNORADO", contract_id: null,
  })), { onConflict: "hash", ignoreDuplicates: true });
  if (error) return { success: false, message: error.message };
  return { success: true, message: `${items.length} ${items.length === 1 ? "movimiento ignorado" : "movimientos ignorados"}.` };
}
