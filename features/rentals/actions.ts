"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { createClientServer } from "@/lib/supabase";
import { ymdInAppTz } from "@/lib/dates";
import {
  addMonths,
  computeAdjustment,
  computeSettlement,
  contractPeriods,
  dueDateFor,
  periodOf,
  round2,
  type SettlementExpense,
} from "@/features/rentals/logic";

// Tier 4 — server actions de alquileres. Corren con la sesión del agente
// (RLS decide qué contratos puede tocar); nada de service_role acá.

export type ActionResult<T = undefined> =
  | { success: true; message: string; data?: T }
  | { success: false; message: string };

async function currentUser() {
  const supabase = await createClientServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return { supabase, user };
}

// === Contactos ===
const contactSchema = z.object({
  kind: z.enum(["owner", "tenant"]),
  full_name: z.string().min(3).max(120),
  document: z.string().max(40).optional().or(z.literal("")),
  phone: z.string().max(40).optional().or(z.literal("")),
  email: z.string().email().optional().or(z.literal("")),
  address: z.string().max(200).optional().or(z.literal("")),
});

export async function createContactAction(
  input: z.infer<typeof contactSchema>
): Promise<ActionResult<{ id: string; full_name: string }>> {
  const parsed = contactSchema.safeParse(input);
  if (!parsed.success) return { success: false, message: "Datos de contacto inválidos." };
  const { supabase, user } = await currentUser();
  if (!user) return { success: false, message: "No autenticado" };

  const v = parsed.data;
  const { data, error } = await supabase
    .from("rental_contacts")
    .insert({
      kind: v.kind,
      full_name: v.full_name,
      document: v.document || null,
      phone: v.phone || null,
      email: v.email || null,
      address: v.address || null,
    })
    .select("id, full_name")
    .single();
  if (error || !data) return { success: false, message: error?.message ?? "Error" };
  return { success: true, message: "Contacto creado.", data };
}

// === E4.1 — Contratos ===
const contractSchema = z
  .object({
    property_id: z.string().uuid(),
    owner_id: z.string().uuid(),
    tenant_id: z.string().uuid(),
    start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    end_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    rent_amount: z.coerce.number().positive(),
    currency: z.enum(["ARS", "USD"]),
    adjustment_index: z.enum(["ICL", "IPC", "FIJO", "NINGUNO"]),
    adjustment_months: z.coerce.number().int().min(1).max(36),
    adjustment_pct: z.coerce.number().min(0).max(500).optional(),
    commission_pct: z.coerce.number().min(0).max(100),
    late_fee_pct_daily: z.coerce.number().min(0).max(10),
    payment_due_day: z.coerce.number().int().min(1).max(28),
    notes: z.string().max(2000).optional().or(z.literal("")),
  })
  .refine((v) => v.end_date > v.start_date, { message: "Fin debe ser posterior al inicio" });

export type ContractInput = z.infer<typeof contractSchema>;

export async function createContractAction(
  input: ContractInput
): Promise<ActionResult<{ id: string }>> {
  const parsed = contractSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, message: parsed.error.issues[0]?.message ?? "Datos inválidos." };
  }
  const { supabase, user } = await currentUser();
  if (!user) return { success: false, message: "No autenticado" };
  const v = parsed.data;

  const basePeriod = periodOf(v.start_date);
  const nextAdjustment =
    v.adjustment_index === "NINGUNO" ? null : addMonths(v.start_date, v.adjustment_months);

  const { data: contract, error } = await supabase
    .from("rental_contracts")
    .insert({
      property_id: v.property_id,
      owner_id: v.owner_id,
      tenant_id: v.tenant_id,
      agent_id: user.id,
      start_date: v.start_date,
      end_date: v.end_date,
      rent_amount: v.rent_amount,
      currency: v.currency,
      adjustment_index: v.adjustment_index,
      adjustment_months: v.adjustment_months,
      adjustment_pct: v.adjustment_index === "FIJO" ? v.adjustment_pct ?? 0 : null,
      base_rent_amount: v.rent_amount,
      base_period: basePeriod,
      next_adjustment_date: nextAdjustment,
      commission_pct: v.commission_pct,
      late_fee_pct_daily: v.late_fee_pct_daily,
      payment_due_day: v.payment_due_day,
      notes: v.notes || null,
    })
    .select("id")
    .single();
  if (error || !contract) return { success: false, message: error?.message ?? "Error" };

  // E4.3: una fila de pago por período, con el canon vigente. Los
  // ajustes futuros actualizan las cuotas no pagadas.
  const rows = contractPeriods(v.start_date, v.end_date).map((period) => ({
    contract_id: contract.id,
    period,
    due_date: dueDateFor(period, v.payment_due_day),
    amount: v.rent_amount,
    currency: v.currency,
  }));
  const { error: payError } = await supabase.from("rental_payments").insert(rows);
  if (payError) {
    return { success: false, message: `Contrato creado pero sin cuotas: ${payError.message}` };
  }

  // La propiedad pasa a ALQUILADO (queda en status_history por trigger).
  await supabase.from("properties").update({ status: "ALQUILADO" }).eq("id", v.property_id);

  revalidatePath("/dashboard/alquileres");
  return { success: true, message: "Contrato creado.", data: { id: contract.id } };
}

export async function setContractStatusAction(
  contractId: string,
  status: "ACTIVO" | "FINALIZADO" | "RESCINDIDO"
): Promise<ActionResult> {
  const { supabase, user } = await currentUser();
  if (!user) return { success: false, message: "No autenticado" };

  const { data: contract, error } = await supabase
    .from("rental_contracts")
    .update({ status })
    .eq("id", contractId)
    .select("property_id")
    .single();
  if (error || !contract) return { success: false, message: error?.message ?? "Error" };

  // Al cerrar el contrato la propiedad vuelve a estar disponible.
  if (status !== "ACTIVO") {
    await supabase
      .from("properties")
      .update({ status: "EN_ALQUILER" })
      .eq("id", contract.property_id);
  }
  revalidatePath("/dashboard/alquileres");
  revalidatePath(`/dashboard/alquileres/${contractId}`);
  return { success: true, message: "Estado actualizado." };
}

// === E4.3 — Pagos ===
const paymentSchema = z.object({
  payment_id: z.string().uuid(),
  paid_at: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  paid_amount: z.coerce.number().min(0),
  method: z.string().max(40).optional().or(z.literal("")),
  notes: z.string().max(500).optional().or(z.literal("")),
});

export async function registerPaymentAction(
  input: z.input<typeof paymentSchema>
): Promise<ActionResult> {
  const parsed = paymentSchema.safeParse(input);
  if (!parsed.success) return { success: false, message: "Datos de pago inválidos." };
  const { supabase, user } = await currentUser();
  if (!user) return { success: false, message: "No autenticado" };
  const v = parsed.data;

  const { data, error } = await supabase
    .from("rental_payments")
    .update({
      paid_at: v.paid_at,
      paid_amount: v.paid_amount,
      method: v.method || null,
      notes: v.notes || null,
    })
    .eq("id", v.payment_id)
    .select("contract_id")
    .single();
  if (error || !data) return { success: false, message: error?.message ?? "Error" };
  revalidatePath(`/dashboard/alquileres/${data.contract_id}`);
  revalidatePath("/dashboard/alquileres");
  return { success: true, message: "Pago registrado." };
}

export async function undoPaymentAction(paymentId: string): Promise<ActionResult> {
  const { supabase, user } = await currentUser();
  if (!user) return { success: false, message: "No autenticado" };
  const { data, error } = await supabase
    .from("rental_payments")
    .update({ paid_at: null, paid_amount: null, method: null })
    .eq("id", paymentId)
    .select("contract_id")
    .single();
  if (error || !data) return { success: false, message: error?.message ?? "Error" };
  revalidatePath(`/dashboard/alquileres/${data.contract_id}`);
  return { success: true, message: "Pago revertido." };
}

// === E4.2 — Ajuste ===
// Aplica el ajuste que corresponde a next_adjustment_date: recalcula el
// canon, mueve la base y la próxima fecha, y actualiza las cuotas no
// pagadas desde ese período en adelante.
export async function applyAdjustmentAction(
  contractId: string
): Promise<ActionResult<{ newAmount: number; factor: number }>> {
  const { supabase, user } = await currentUser();
  if (!user) return { success: false, message: "No autenticado" };

  const { data: c } = await supabase
    .from("rental_contracts")
    .select("*")
    .eq("id", contractId)
    .single();
  if (!c) return { success: false, message: "Contrato no encontrado." };
  if (!c.next_adjustment_date) return { success: false, message: "El contrato no tiene ajuste pendiente." };

  const targetPeriod = periodOf(c.next_adjustment_date);
  const { data: idx } = await supabase
    .from("index_values")
    .select("index_code, period, value")
    .eq("index_code", c.adjustment_index)
    .in("period", [c.base_period, targetPeriod]);

  const result = computeAdjustment(c, targetPeriod, idx ?? []);
  if ("error" in result) return { success: false, message: result.error };

  const nextDate = addMonths(c.next_adjustment_date, c.adjustment_months);
  const { error } = await supabase
    .from("rental_contracts")
    .update({
      rent_amount: result.amount,
      base_rent_amount: result.amount,
      base_period: targetPeriod,
      next_adjustment_date: nextDate <= c.end_date ? nextDate : null,
    })
    .eq("id", contractId);
  if (error) return { success: false, message: error.message };

  await supabase
    .from("rental_payments")
    .update({ amount: result.amount })
    .eq("contract_id", contractId)
    .is("paid_at", null)
    .gte("period", targetPeriod);

  revalidatePath(`/dashboard/alquileres/${contractId}`);
  revalidatePath("/dashboard/alquileres");
  return {
    success: true,
    message: `Canon ajustado a ${result.amount.toLocaleString("es-AR")} (×${result.factor.toFixed(4)}).`,
    data: { newAmount: result.amount, factor: result.factor },
  };
}

// === E4.4 — Liquidación ===
const settlementSchema = z.object({
  contract_id: z.string().uuid(),
  period: z.string().regex(/^\d{4}-\d{2}-01$/),
  expenses: z
    .array(z.object({ description: z.string().min(1).max(120), amount: z.coerce.number().min(0) }))
    .max(30),
  notes: z.string().max(1000).optional().or(z.literal("")),
});

export async function createSettlementAction(
  input: z.input<typeof settlementSchema>
): Promise<ActionResult<{ id: string }>> {
  const parsed = settlementSchema.safeParse(input);
  if (!parsed.success) return { success: false, message: "Datos de liquidación inválidos." };
  const { supabase, user } = await currentUser();
  if (!user) return { success: false, message: "No autenticado" };
  const v = parsed.data;

  const { data: c } = await supabase
    .from("rental_contracts")
    .select("commission_pct, currency")
    .eq("id", v.contract_id)
    .single();
  if (!c) return { success: false, message: "Contrato no encontrado." };

  // Se liquida lo efectivamente cobrado en el período.
  const { data: p } = await supabase
    .from("rental_payments")
    .select("paid_amount, paid_at, amount")
    .eq("contract_id", v.contract_id)
    .eq("period", v.period)
    .single();
  if (!p?.paid_at) {
    return { success: false, message: "El período todavía no está cobrado." };
  }

  const rent = round2(p.paid_amount ?? p.amount);
  const expenses: SettlementExpense[] = v.expenses;
  const calc = computeSettlement(rent, c.commission_pct, expenses);

  const { data, error } = await supabase
    .from("rental_settlements")
    .insert({
      contract_id: v.contract_id,
      period: v.period,
      rent_amount: rent,
      commission_amount: calc.commission,
      expenses,
      expenses_amount: calc.expensesAmount,
      net_amount: calc.net,
      currency: c.currency,
      issued_at: ymdInAppTz(),
      notes: v.notes || null,
    })
    .select("id")
    .single();
  if (error || !data) {
    return {
      success: false,
      message: error?.code === "23505" ? "Ese período ya está liquidado." : error?.message ?? "Error",
    };
  }
  revalidatePath(`/dashboard/alquileres/${v.contract_id}`);
  return { success: true, message: "Liquidación generada.", data };
}

// === E4.2 — Índices (admin) ===
const indexSchema = z.object({
  index_code: z.enum(["ICL", "IPC"]),
  period: z.string().regex(/^\d{4}-\d{2}$/),
  value: z.coerce.number().positive(),
});

export async function upsertIndexValueAction(
  input: z.input<typeof indexSchema>
): Promise<ActionResult> {
  const parsed = indexSchema.safeParse(input);
  if (!parsed.success) return { success: false, message: "Valor inválido." };
  const { supabase, user } = await currentUser();
  if (!user) return { success: false, message: "No autenticado" };
  const { error } = await supabase
    .from("index_values")
    .upsert(
      { index_code: parsed.data.index_code, period: `${parsed.data.period}-01`, value: parsed.data.value },
      { onConflict: "index_code,period" }
    );
  if (error) return { success: false, message: error.message };
  revalidatePath("/dashboard/ajustes");
  return { success: true, message: "Índice guardado." };
}

export async function deleteIndexValueAction(id: string): Promise<ActionResult> {
  const { supabase, user } = await currentUser();
  if (!user) return { success: false, message: "No autenticado" };
  const { error } = await supabase.from("index_values").delete().eq("id", id);
  if (error) return { success: false, message: error.message };
  revalidatePath("/dashboard/ajustes");
  return { success: true, message: "Índice eliminado." };
}
