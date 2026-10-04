"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { notifyReceipt } from "@/features/rentals/notifications";
import { createClientServer } from "@/lib/supabase";
import { ymdInAppTz } from "@/lib/dates";
import { syncIndexValues, type IndexSyncResult } from "@/features/rentals/indexSync";
import { attachDraftPdf } from "@/features/rentals/contractDrafts";
import {
  ADJUSTMENT_INDEXES,
  addMonths,
  computeSettlement,
  DEFAULT_INDEX_LAG,
  contractPeriods,
  dueDateFor,
  MANUAL_CHARGE_KINDS,
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
  kind: z.enum(["owner", "tenant", "guarantor"]),
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
  revalidatePath("/dashboard/alquileres/contactos");
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
    adjustment_index: z.enum(ADJUSTMENT_INDEXES),
    adjustment_months: z.coerce.number().int().min(1, "La frecuencia va de 1 a 36 meses").max(36, "La frecuencia va de 1 a 36 meses"),
    adjustment_pct: z.coerce.number().min(0).max(500).optional(),
    // Meses de rezago del índice (ICL / IPC). Sin valor: IPC 2, ICL 0.
    index_lag_months: z.coerce.number().int().min(0).max(6).optional(),
    guarantee_type: z.enum(["NINGUNA", "GARANTE", "CAUCION"]),
    guarantee_detail: z.string().max(200).optional(),
    deposit_amount: z.coerce.number().min(0),
    commission_pct: z.coerce.number().min(0).max(100),
    late_fee_pct_daily: z.coerce.number().min(0).max(10),
    late_fee_fixed: z.coerce.number().min(0),
    late_fee_mode: z.enum(["AUTO", "MANUAL"]).default("AUTO"),
    late_fee_grace_days: z.coerce.number().int().min(0).max(30).default(0),
    payment_due_day: z.coerce.number().int().min(1).max(28),
    renewed_from_id: z.string().uuid().optional(),
    notes: z.string().max(2000).optional().or(z.literal("")),
    // Carga desde PDF: el borrador subido se adjunta como contrato firmado.
    source_pdf_path: z.string().max(300).optional(),
    source_pdf_name: z.string().max(200).optional(),
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

  const { data: activeContracts } = await supabase.from("rental_contracts")
    .select("id").eq("property_id", v.property_id).eq("status", "ACTIVO");
  if (activeContracts?.length && (!v.renewed_from_id || activeContracts.some((c) => c.id !== v.renewed_from_id))) {
    return { success: false, message: "La propiedad ya tiene un contrato activo." };
  }
  if (v.renewed_from_id) {
    const { data: previous } = await supabase.from("rental_contracts")
      .select("property_id").eq("id", v.renewed_from_id).single();
    if (!previous || previous.property_id !== v.property_id) {
      return { success: false, message: "El contrato a renovar no corresponde a esta propiedad." };
    }
  }

  // Los titulares salen de la propiedad. El contrato guarda la foto (owner_id
  // + co-propietarios) para que no cambie si después se vende. Si la
  // propiedad todavía no tiene dueños, el elegido en el formulario queda
  // registrado como dueño (trigger rental_contracts_property_owners).
  const { data: propertyOwners } = await supabase.from("property_owners")
    .select("contact_id, share_pct, is_primary").eq("property_id", v.property_id);
  const primary = propertyOwners?.find((o) => o.is_primary);
  const coOwners = (propertyOwners ?? []).filter((o) => !o.is_primary);
  if (primary) v.owner_id = primary.contact_id;

  const basePeriod = periodOf(v.start_date);
  const firstAdjustment = addMonths(v.start_date, v.adjustment_months);
  const nextAdjustment = v.adjustment_index === "NINGUNO" || firstAdjustment > v.end_date ? null : firstAdjustment;

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
      ...(v.adjustment_index === "ICL" || v.adjustment_index === "IPC"
        ? { index_lag_months: v.index_lag_months ?? DEFAULT_INDEX_LAG[v.adjustment_index] }
        : { index_lag_months: 0 }), // Casa Propia: el coeficiente ya es del mes del ajuste.
      guarantee_type: v.guarantee_type,
      guarantee_detail: v.guarantee_detail || null,
      deposit_amount: v.deposit_amount,
      base_rent_amount: v.rent_amount,
      base_period: basePeriod,
      next_adjustment_date: nextAdjustment,
      commission_pct: v.commission_pct,
      late_fee_pct_daily: v.late_fee_pct_daily,
      late_fee_fixed: v.late_fee_fixed,
      late_fee_mode: v.late_fee_mode,
      late_fee_grace_days: v.late_fee_grace_days,
      payment_due_day: v.payment_due_day,
      renewed_from_id: v.renewed_from_id ?? null,
      notes: v.notes || null,
    })
    .select("id")
    .single();
  if (error || !contract) return { success: false, message: error?.message ?? "Error" };

  if (coOwners.length) {
    const { error: partiesError } = await supabase.from("rental_contract_parties").insert(coOwners.map((o) => ({
      contract_id: contract.id, contact_id: o.contact_id, role: "CO_PROPIETARIO", share_pct: o.share_pct,
    })));
    if (partiesError) {
      await supabase.from("rental_contracts").delete().eq("id", contract.id);
      return { success: false, message: partiesError.message };
    }
  }

  // E4.3: una fila de pago por período, con el canon vigente. Los
  // ajustes futuros actualizan las cuotas no pagadas.
  const rows = contractPeriods(v.start_date, v.end_date).map((period) => ({
    contract_id: contract.id,
    period,
    due_date: dueDateFor(period, v.payment_due_day),
    amount: v.rent_amount,
    currency: v.currency,
  }));
  const { data: payments, error: payError } = await supabase.from("rental_payments")
    .insert(rows).select("id, period, due_date, amount, currency");
  if (payError || !payments) {
    await supabase.from("rental_contracts").delete().eq("id", contract.id);
    return { success: false, message: payError?.message ?? "No se pudieron generar las cuotas." };
  }
  const { error: chargeError } = await supabase.from("rental_charges").insert(payments.map((payment) => ({
    contract_id: contract.id,
    rent_payment_id: payment.id,
    period: payment.period,
    due_date: payment.due_date,
    kind: "ALQUILER",
    description: `Alquiler ${payment.period.slice(5, 7)}/${payment.period.slice(0, 4)}`,
    amount: payment.amount,
    currency: payment.currency,
  })));
  if (chargeError) {
    await supabase.from("rental_contracts").delete().eq("id", contract.id);
    return { success: false, message: chargeError.message };
  }

  // La propiedad pasa a ALQUILADO (queda en status_history por trigger).
  await supabase.from("properties").update({ status: "ALQUILADO" }).eq("id", v.property_id);

  // Si vino de un PDF, queda adjunto. Un fallo acá no invalida el contrato.
  const attached = v.source_pdf_path
    ? await attachDraftPdf(supabase, user.id, contract.id, v.source_pdf_path, v.source_pdf_name ?? "Contrato.pdf")
    : null;

  revalidatePath("/dashboard/alquileres");
  return {
    success: true,
    message: attached === false ? "Contrato creado. No se pudo adjuntar el PDF: subilo desde Documentos." : "Contrato creado.",
    data: { id: contract.id },
  };
}

// El cierre de contrato vive en lifecycleActions.closeContractAction
// (RPC rental_close_contract): además del estado, anula cuotas futuras.

// === E4.3 — Pagos ===
const chargeSchema = z.object({
  contract_id: z.string().uuid(),
  period: z.string().regex(/^\d{4}-\d{2}-01$/),
  due_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  kind: z.enum(MANUAL_CHARGE_KINDS),
  description: z.string().trim().min(3).max(160),
  amount: z.coerce.number().positive(),
});

export async function addRentalChargeAction(input: z.input<typeof chargeSchema>): Promise<ActionResult> {
  const parsed = chargeSchema.safeParse(input);
  if (!parsed.success) return { success: false, message: "Datos del cargo inválidos." };
  const { supabase, user } = await currentUser();
  if (!user) return { success: false, message: "No autenticado" };
  const { data: contract } = await supabase.from("rental_contracts")
    .select("currency").eq("id", parsed.data.contract_id).single();
  if (!contract) return { success: false, message: "Contrato no encontrado." };
  const { count: settled } = await supabase.from("rental_settlements")
    .select("id", { count: "exact", head: true })
    .eq("contract_id", parsed.data.contract_id).eq("period", parsed.data.period);
  if (settled) return { success: false, message: "El período ya está liquidado." };
  const { error } = await supabase.from("rental_charges")
    .insert({ ...parsed.data, currency: contract.currency });
  if (error) return { success: false, message: error.message };
  revalidatePath(`/dashboard/alquileres/${parsed.data.contract_id}`);
  return { success: true, message: "Cargo agregado." };
}

const collectionSchema = z.object({
  charge_id: z.string().uuid(),
  paid_at: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  amount: z.coerce.number().positive(),
  method: z.enum(["TRANSFERENCIA", "EFECTIVO", "OTRO"]),
  account: z.string().trim().min(1).max(100),
  notes: z.string().max(500).optional(),
});

export async function recordRentalPaymentAction(
  input: z.input<typeof collectionSchema>,
): Promise<ActionResult<{ id: string; receipt_number: number }>> {
  const parsed = collectionSchema.safeParse(input);
  if (!parsed.success) return { success: false, message: "Datos del cobro inválidos." };
  const { supabase, user } = await currentUser();
  if (!user) return { success: false, message: "No autenticado" };
  const { data: charge } = await supabase.from("rental_charges")
    .select("contract_id, period").eq("id", parsed.data.charge_id).single();
  if (!charge) return { success: false, message: "Cargo no encontrado." };
  const { count: settled } = await supabase.from("rental_settlements")
    .select("id", { count: "exact", head: true })
    .eq("contract_id", charge.contract_id).eq("period", charge.period);
  if (settled) return { success: false, message: "El período ya está liquidado." };
  const { data, error } = await supabase.from("rental_payment_entries")
    .insert({ ...parsed.data, notes: parsed.data.notes || null })
    .select("id, receipt_number").single();
  if (error || !data) return { success: false, message: error?.message ?? "No se pudo registrar el cobro." };
  revalidatePath(`/dashboard/alquileres/${charge.contract_id}`);
  revalidatePath("/dashboard/alquileres");
  // Recibo por WhatsApp (si está activado) después de responder: el cobro
  // ya quedó registrado y un fallo de envío no lo afecta.
  after(() => notifyReceipt(data.id).catch(() => {}));
  return { success: true, message: `Cobro registrado. Recibo N.º ${data.receipt_number}.`, data };
}

export async function deleteRentalPaymentAction(entryId: string): Promise<ActionResult> {
  if (!z.string().uuid().safeParse(entryId).success) return { success: false, message: "Cobro inválido." };
  const { supabase, user } = await currentUser();
  if (!user) return { success: false, message: "No autenticado" };
  const { data: entry } = await supabase.from("rental_payment_entries")
    .select("charge_id").eq("id", entryId).single();
  if (!entry) return { success: false, message: "Cobro no encontrado." };
  const { data: charge } = await supabase.from("rental_charges")
    .select("contract_id, period").eq("id", entry.charge_id).single();
  if (!charge) return { success: false, message: "Cargo no encontrado." };
  const contractId = charge.contract_id;
  const { count } = await supabase.from("rental_settlements").select("id", { count: "exact", head: true })
    .eq("contract_id", contractId).eq("period", charge.period);
  if (count) return { success: false, message: "El período ya fue liquidado. No se puede revertir este cobro." };
  const { error } = await supabase.from("rental_payment_entries").delete().eq("id", entryId);
  if (error) return { success: false, message: error.message };
  revalidatePath(`/dashboard/alquileres/${contractId}`);
  revalidatePath("/dashboard/alquileres");
  return { success: true, message: "Cobro revertido." };
}

// === E4.2 — Ajuste ===
// Aplica el ajuste que corresponde a next_adjustment_date: recalcula el
// canon, mueve la base y la próxima fecha, y actualiza las cuotas no
// pagadas desde ese período en adelante.
export async function applyAdjustmentAction(
  contractId: string,
  manualAmount?: number,
): Promise<ActionResult<{ newAmount: number; factor: number }>> {
  const { supabase, user } = await currentUser();
  if (!user) return { success: false, message: "No autenticado" };
  const { data, error } = await supabase.rpc("rental_apply_adjustment", {
    p_contract_id: contractId,
    p_manual_amount: manualAmount ?? null,
  });
  if (error || !data || typeof data !== "object" || Array.isArray(data)) {
    return { success: false, message: error?.message ?? "No se pudo aplicar el ajuste." };
  }
  const result = data as { amount: number; factor: number };

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
    .array(z.object({
      description: z.string().min(1).max(120),
      amount: z.coerce.number().min(0),
      maintenance_id: z.string().uuid().optional(),
    }))
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

  const { data: charges } = await supabase.from("rental_charges")
    .select("amount, kind, rental_payment_entries(amount)")
    .eq("contract_id", v.contract_id).eq("period", v.period);
  if (!charges?.length) return { success: false, message: "El período no tiene cargos." };
  const totals = charges.map((charge) => ({
    kind: charge.kind,
    amount: charge.amount,
    paid: round2(charge.rental_payment_entries.reduce((sum, entry) => sum + entry.amount, 0)),
  }));
  if (totals.some((charge) => charge.paid + 0.005 < charge.amount)) {
    return { success: false, message: "Cobrá todos los cargos del período antes de liquidar." };
  }
  const rent = round2(totals.filter((charge) => charge.kind === "ALQUILER").reduce((sum, charge) => sum + charge.paid, 0));
  const otherCollected = round2(totals.filter((charge) => charge.kind !== "ALQUILER").reduce((sum, charge) => sum + charge.paid, 0));
  const expenses: SettlementExpense[] = v.expenses;
  const calc = computeSettlement(rent + otherCollected, c.commission_pct, expenses, rent);

  const { data, error } = await supabase
    .from("rental_settlements")
    .insert({
      contract_id: v.contract_id,
      period: v.period,
      rent_amount: rent,
      other_collected_amount: otherCollected,
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
  index_code: z.enum(["ICL", "IPC", "CASA_PROPIA"]),
  period: z.string().regex(/^\d{4}-\d{2}$/),
  value: z.coerce.number().positive(),
}).refine((v) => v.index_code !== "CASA_PROPIA" || (v.value >= 0.5 && v.value <= 5), {
  // Un coeficiente fuera de este rango casi siempre es un error de tipeo (ej. 13817 en vez de 1,3817).
  message: "El coeficiente Casa Propia es un factor como 1,0521: revisá el valor.",
});

export async function upsertIndexValueAction(
  input: z.input<typeof indexSchema>
): Promise<ActionResult> {
  const parsed = indexSchema.safeParse(input);
  if (!parsed.success && parsed.error.issues[0]?.message.startsWith("El coeficiente")) {
    return { success: false, message: parsed.error.issues[0].message };
  }
  if (!parsed.success) return { success: false, message: "Valor inválido." };
  const { supabase, user } = await currentUser();
  if (!user) return { success: false, message: "No autenticado" };
  const { error } = await supabase
    .from("index_values")
    .upsert(
      {
        index_code: parsed.data.index_code,
        period: `${parsed.data.period}-01`,
        value: parsed.data.value,
        source: "MANUAL",
        updated_at: new Date().toISOString(),
      },
      { onConflict: "index_code,period" }
    );
  if (error) return { success: false, message: error.message };
  revalidatePath("/dashboard/ajustes");
  return { success: true, message: "Índice guardado." };
}

// Anticipación de las alertas de vencimiento y ajuste (fila única).
const alertSettingsSchema = z.object({
  expiry_alert_days: z.coerce.number().int().min(15).max(365),
  adjustment_alert_days: z.coerce.number().int().min(1).max(90),
});

export async function updateRentalAlertSettingsAction(input: z.input<typeof alertSettingsSchema>): Promise<ActionResult> {
  const parsed = alertSettingsSchema.safeParse(input);
  if (!parsed.success) return { success: false, message: "Vencimientos: de 15 a 365 días. Ajustes: de 1 a 90 días." };
  const { supabase, user } = await currentUser();
  if (!user) return { success: false, message: "No autenticado" };
  const { data, error } = await supabase.from("rental_settings")
    .update({ ...parsed.data, updated_at: new Date().toISOString() }).eq("id", 1).select("id");
  if (error) return { success: false, message: error.message };
  // Sin filas actualizadas = RLS lo bloqueó (no es admin).
  if (!data?.length) return { success: false, message: "Solo un administrador puede cambiar las alertas." };
  revalidatePath("/dashboard/ajustes");
  revalidatePath("/dashboard/alquileres");
  return { success: true, message: "Alertas actualizadas." };
}

// Avisos automáticos por WhatsApp: qué se envía y con cuánta anticipación.
const noticeSettingsSchema = z.object({
  notify_receipts: z.boolean(),
  notify_adjustments: z.boolean(),
  notify_due: z.boolean(),
  notify_overdue: z.boolean(),
  adjustment_notice_days: z.coerce.number().int().min(1).max(60),
  due_reminder_days: z.coerce.number().int().min(1).max(15),
  overdue_reminder_days: z.coerce.number().int().min(1).max(30),
});

export async function updateRentalNoticeSettingsAction(input: z.input<typeof noticeSettingsSchema>): Promise<ActionResult> {
  const parsed = noticeSettingsSchema.safeParse(input);
  if (!parsed.success) return { success: false, message: "Revisá los días: aumento 1 a 60, vencimiento 1 a 15, deuda 1 a 30." };
  const { supabase, user } = await currentUser();
  if (!user) return { success: false, message: "No autenticado" };
  const { data, error } = await supabase.from("rental_settings")
    .update({ ...parsed.data, updated_at: new Date().toISOString() }).eq("id", 1).select("id");
  if (error) return { success: false, message: error.message };
  if (!data?.length) return { success: false, message: "Solo un administrador puede cambiar los avisos." };
  revalidatePath("/dashboard/ajustes");
  return { success: true, message: "Avisos actualizados." };
}

// Trae ICL (BCRA) e IPC (INDEC) en el momento, sin esperar al cron, y
// aplica los ajustes que quedaron destrabados. Solo admin: escribe con
// service_role.
export async function syncIndexValuesAction(): Promise<ActionResult<IndexSyncResult>> {
  const { supabase, user } = await currentUser();
  if (!user) return { success: false, message: "No autenticado" };
  const { data: isAdmin } = await supabase.rpc("is_admin");
  if (!isAdmin) return { success: false, message: "Solo un administrador puede actualizar los índices." };

  const result = await syncIndexValues();
  await supabase.rpc("rental_apply_due_adjustments");
  revalidatePath("/dashboard/ajustes");
  revalidatePath("/dashboard/alquileres");

  const errors = [result.icl.error && `ICL: ${result.icl.error}`, result.ipc.error && `IPC: ${result.ipc.error}`].filter(Boolean);
  const summary = `ICL hasta ${result.icl.latest?.slice(0, 7) ?? "sin datos"}, IPC hasta ${result.ipc.latest?.slice(0, 7) ?? "sin datos"}.`;
  if (errors.length === 2) return { success: false, message: `No se pudo actualizar. ${errors.join(" · ")}` };
  return {
    success: true,
    message: errors.length ? `Actualización parcial. ${summary} ${errors.join(" · ")}` : `Índices actualizados. ${summary}`,
    data: result,
  };
}

export async function deleteIndexValueAction(id: string): Promise<ActionResult> {
  const { supabase, user } = await currentUser();
  if (!user) return { success: false, message: "No autenticado" };
  const { error } = await supabase.from("index_values").delete().eq("id", id);
  if (error) return { success: false, message: error.message };
  revalidatePath("/dashboard/ajustes");
  return { success: true, message: "Índice eliminado." };
}

const importSchema = z.array(z.record(z.string(), z.string())).min(1).max(500);

export async function importRentalContractsAction(input: unknown): Promise<ActionResult<{ count: number }>> {
  const parsed = importSchema.safeParse(input);
  if (!parsed.success) return { success: false, message: "El CSV debe contener entre 1 y 500 filas válidas." };
  const { supabase, user } = await currentUser();
  if (!user) return { success: false, message: "No autenticado" };
  const { data, error } = await supabase.rpc("rental_import_contracts", { p_rows: parsed.data });
  if (error) return { success: false, message: error.message };
  revalidatePath("/dashboard/alquileres");
  return { success: true, message: `${data} contratos importados.`, data: { count: data } };
}
