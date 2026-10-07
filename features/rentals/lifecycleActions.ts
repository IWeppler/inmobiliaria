"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { createClientServer } from "@/lib/supabase";
import { ymdInAppTz } from "@/lib/dates";
import type { ActionResult } from "@/features/rentals/actions";

// Alquileres, fase 2 — ciclo de vida del contrato: cierre, edición, partes,
// depósito, pago al propietario, mantenimiento y documentos. Misma regla
// que actions.ts: sesión del agente, RLS decide qué puede tocar.

const ymdSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const uuidSchema = z.string().uuid();

async function currentUser() {
  const supabase = await createClientServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return { supabase, user };
}

function revalidateContract(contractId: string) {
  revalidatePath(`/dashboard/alquileres/${contractId}`);
  revalidatePath("/dashboard/alquileres");
}

// === Cierre / rescisión ===
const closeSchema = z.object({
  contract_id: uuidSchema,
  status: z.enum(["FINALIZADO", "RESCINDIDO"]),
  end_date: ymdSchema.optional(),
  penalty: z.coerce.number().min(0).default(0),
});

export async function closeContractAction(
  input: z.input<typeof closeSchema>,
): Promise<ActionResult<{ removed: number; keptWithPayments: number }>> {
  const parsed = closeSchema.safeParse(input);
  if (!parsed.success) return { success: false, message: "Datos de cierre inválidos." };
  const { supabase, user } = await currentUser();
  if (!user) return { success: false, message: "No autenticado" };
  const v = parsed.data;
  const { data, error } = await supabase.rpc("rental_close_contract", {
    p_contract_id: v.contract_id,
    p_status: v.status,
    p_end_date: v.end_date,
    p_penalty: v.penalty,
  });
  if (error || !data || typeof data !== "object" || Array.isArray(data)) {
    return { success: false, message: error?.message ?? "No se pudo cerrar el contrato." };
  }
  const result = data as { removed: number; kept_with_payments: number };
  revalidateContract(v.contract_id);
  const kept = result.kept_with_payments > 0
    ? ` Quedan ${result.kept_with_payments} cuotas posteriores con cobros: revisalas.`
    : "";
  return {
    success: true,
    message: `Contrato ${v.status === "RESCINDIDO" ? "rescindido" : "finalizado"}. Se anularon ${result.removed} cuotas futuras.${kept}`,
    data: { removed: result.removed, keptWithPayments: result.kept_with_payments },
  };
}

// === Edición de condiciones no financieras ===
// Canon, fechas, moneda y ajuste no se editan: cambian cuotas ya generadas.
// Para eso está el ajuste manual o la renovación.
const termsSchema = z.object({
  contract_id: uuidSchema,
  owner_id: uuidSchema,
  tenant_id: uuidSchema,
  commission_pct: z.coerce.number().min(0).max(100),
  late_fee_pct_daily: z.coerce.number().min(0).max(10),
  late_fee_fixed: z.coerce.number().min(0),
  late_fee_mode: z.enum(["AUTO", "MANUAL"]),
  late_fee_grace_days: z.coerce.number().int().min(0).max(30),
  guarantee_type: z.enum(["NINGUNA", "GARANTE", "CAUCION"]),
  guarantee_detail: z.string().max(200).optional(),
  notes: z.string().max(2000).optional(),
});

export async function updateContractTermsAction(input: z.input<typeof termsSchema>): Promise<ActionResult> {
  const parsed = termsSchema.safeParse(input);
  if (!parsed.success) return { success: false, message: "Datos del contrato inválidos." };
  const { supabase, user } = await currentUser();
  if (!user) return { success: false, message: "No autenticado" };
  const { contract_id, ...v } = parsed.data;
  const { error } = await supabase.from("rental_contracts").update({
    ...v,
    guarantee_detail: v.guarantee_type === "NINGUNA" ? null : v.guarantee_detail || null,
    notes: v.notes || null,
  }).eq("id", contract_id);
  if (error) return { success: false, message: error.message };
  revalidateContract(contract_id);
  return { success: true, message: "Contrato actualizado." };
}

// === Contactos ===
const contactUpdateSchema = z.object({
  id: uuidSchema,
  full_name: z.string().trim().min(3).max(120),
  document: z.string().max(40).optional(),
  phone: z.string().max(40).optional(),
  email: z.string().email().optional().or(z.literal("")),
  address: z.string().max(200).optional(),
  notes: z.string().max(1000).optional(),
  // Para facturar honorarios. Sin valor no se toca.
  iva_condition: z.enum(["RI", "MONOTRIBUTO", "EXENTO", "CONSUMIDOR_FINAL"]).optional(),
});

export async function updateContactAction(
  input: z.input<typeof contactUpdateSchema>,
  contractId?: string,
): Promise<ActionResult> {
  const parsed = contactUpdateSchema.safeParse(input);
  if (!parsed.success) return { success: false, message: "Datos de contacto inválidos." };
  const { supabase, user } = await currentUser();
  if (!user) return { success: false, message: "No autenticado" };
  const { id, ...v } = parsed.data;
  const { error } = await supabase.from("rental_contacts").update({
    full_name: v.full_name,
    document: v.document || null,
    phone: v.phone || null,
    email: v.email || null,
    address: v.address || null,
    notes: v.notes || null,
    ...(v.iva_condition ? { iva_condition: v.iva_condition } : {}),
  }).eq("id", id);
  if (error) return { success: false, message: error.message };
  if (contractId) revalidateContract(contractId);
  revalidatePath("/dashboard/alquileres/contactos");
  return { success: true, message: "Contacto actualizado." };
}

// === Partes adicionales ===
const partySchema = z.object({
  contract_id: uuidSchema,
  role: z.enum(["CO_INQUILINO", "CO_PROPIETARIO", "GARANTE"]),
  contact_id: uuidSchema.optional(),
  // Alta inline cuando el contacto no existe.
  new_contact: z.object({
    full_name: z.string().trim().min(3).max(120),
    document: z.string().max(40).optional(),
    phone: z.string().max(40).optional(),
  }).optional(),
  share_pct: z.coerce.number().min(0).max(100).optional(),
}).refine((v) => v.role !== "CO_PROPIETARIO" || (v.share_pct !== undefined && v.share_pct > 0 && v.share_pct < 100), {
  message: "Indicá el porcentaje del co-propietario (mayor a 0 y menor a 100).",
});

const ROLE_KIND = { CO_INQUILINO: "tenant", CO_PROPIETARIO: "owner", GARANTE: "guarantor" } as const;

export async function addContractPartyAction(input: z.input<typeof partySchema>): Promise<ActionResult> {
  const parsed = partySchema.safeParse(input);
  if (!parsed.success) return { success: false, message: parsed.error.issues[0]?.message ?? "Datos inválidos." };
  if (!parsed.data.contact_id && !parsed.data.new_contact) {
    return { success: false, message: "Elegí o cargá un contacto." };
  }
  const { supabase, user } = await currentUser();
  if (!user) return { success: false, message: "No autenticado" };
  const v = parsed.data;

  // Se valida la suma antes de crear el contacto, para no dejar uno huérfano.
  // (El trigger rental_validate_owner_shares es la garantía final.)
  if (v.role === "CO_PROPIETARIO") {
    const { data: current } = await supabase.from("rental_contract_parties")
      .select("share_pct").eq("contract_id", v.contract_id).eq("role", "CO_PROPIETARIO");
    const total = (current ?? []).reduce((sum, p) => sum + (p.share_pct ?? 0), 0) + (v.share_pct ?? 0);
    if (total >= 100) {
      return { success: false, message: `Los co-propietarios sumarían ${total} %: el propietario principal tiene que conservar una parte.` };
    }
  }

  let contactId = v.contact_id;
  if (!contactId && v.new_contact) {
    const { data, error } = await supabase.from("rental_contacts").insert({
      kind: ROLE_KIND[v.role],
      full_name: v.new_contact.full_name,
      document: v.new_contact.document || null,
      phone: v.new_contact.phone || null,
    }).select("id").single();
    if (error || !data) return { success: false, message: error?.message ?? "No se pudo crear el contacto." };
    contactId = data.id;
  }

  const { error } = await supabase.from("rental_contract_parties").insert({
    contract_id: v.contract_id,
    contact_id: contactId!,
    role: v.role,
    share_pct: v.role === "CO_PROPIETARIO" ? v.share_pct ?? null : null,
  });
  if (error) {
    return { success: false, message: error.code === "23505" ? "Ese contacto ya figura con ese rol." : error.message };
  }
  revalidateContract(v.contract_id);
  return { success: true, message: "Parte agregada." };
}

export async function removeContractPartyAction(partyId: string, contractId: string): Promise<ActionResult> {
  if (!uuidSchema.safeParse(partyId).success) return { success: false, message: "Parte inválida." };
  const { supabase, user } = await currentUser();
  if (!user) return { success: false, message: "No autenticado" };
  const { error } = await supabase.from("rental_contract_parties").delete().eq("id", partyId);
  if (error) return { success: false, message: error.message };
  revalidateContract(contractId);
  return { success: true, message: "Parte quitada." };
}

// === Depósito en garantía ===
const depositSchema = z.object({
  contract_id: uuidSchema,
  deposit_received_at: ymdSchema.nullable(),
  deposit_returned_at: ymdSchema.nullable(),
  deposit_deductions: z.array(z.object({
    description: z.string().trim().min(1).max(120),
    amount: z.coerce.number().min(0),
  })).max(30),
});

export async function updateDepositAction(input: z.input<typeof depositSchema>): Promise<ActionResult> {
  const parsed = depositSchema.safeParse(input);
  if (!parsed.success) return { success: false, message: "Datos del depósito inválidos." };
  const { supabase, user } = await currentUser();
  if (!user) return { success: false, message: "No autenticado" };
  const v = parsed.data;
  const { data: contract } = await supabase.from("rental_contracts")
    .select("deposit_amount").eq("id", v.contract_id).single();
  if (!contract) return { success: false, message: "Contrato no encontrado." };
  const deducted = v.deposit_deductions.reduce((sum, item) => sum + item.amount, 0);
  if (deducted > contract.deposit_amount + 0.005) {
    return { success: false, message: "Los descuentos superan el depósito." };
  }
  const { error } = await supabase.from("rental_contracts").update({
    deposit_received_at: v.deposit_received_at,
    deposit_returned_at: v.deposit_returned_at,
    deposit_deductions: v.deposit_deductions,
    // El monto devuelto se deriva: depósito − descuentos, solo si ya se devolvió.
    deposit_returned_amount: v.deposit_returned_at
      ? Math.round((contract.deposit_amount - deducted) * 100) / 100
      : null,
  }).eq("id", v.contract_id);
  if (error) return { success: false, message: error.message };
  revalidateContract(v.contract_id);
  return { success: true, message: "Depósito actualizado." };
}

// === Pago de una parte de la liquidación a su propietario ===
// Cada titular cobra su parte por separado. La liquidación figura
// transferida cuando se pagaron todas (trigger rental_sync_settlement_paid).
const payoutSchema = z.object({
  share_id: uuidSchema,
  paid_to_owner_at: ymdSchema.nullable(),
  payout_method: z.enum(["TRANSFERENCIA", "EFECTIVO", "OTRO"]).nullable(),
  payout_reference: z.string().max(120).optional(),
});

export async function markSharePaidAction(input: z.input<typeof payoutSchema>): Promise<ActionResult> {
  const parsed = payoutSchema.safeParse(input);
  if (!parsed.success) return { success: false, message: "Datos del pago inválidos." };
  const { supabase, user } = await currentUser();
  if (!user) return { success: false, message: "No autenticado" };
  const v = parsed.data;
  const { data, error } = await supabase.from("rental_settlement_shares").update({
    paid_to_owner_at: v.paid_to_owner_at,
    payout_method: v.paid_to_owner_at ? v.payout_method : null,
    payout_reference: v.paid_to_owner_at ? v.payout_reference || null : null,
  }).eq("id", v.share_id).select("settlement_id").single();
  if (error || !data) return { success: false, message: error?.message ?? "Parte de la liquidación no encontrada." };
  const { data: settlement } = await supabase.from("rental_settlements")
    .select("contract_id").eq("id", data.settlement_id).single();
  if (settlement) revalidateContract(settlement.contract_id);
  revalidatePath("/dashboard/alquileres/propietarios");
  return { success: true, message: v.paid_to_owner_at ? "Transferencia registrada." : "Transferencia anulada." };
}

// === Mantenimiento ===
const maintenanceSchema = z.object({
  id: uuidSchema.optional(),
  contract_id: uuidSchema,
  title: z.string().trim().min(3).max(120),
  description: z.string().max(2000).optional(),
  priority: z.enum(["BAJA", "MEDIA", "ALTA", "URGENTE"]),
  status: z.enum(["ABIERTO", "EN_CURSO", "RESUELTO", "CANCELADO"]),
  payer: z.enum(["INQUILINO", "PROPIETARIO", "INMOBILIARIA"]).nullable(),
  provider: z.string().max(120).optional(),
  cost: z.coerce.number().min(0).nullable(),
  reported_at: ymdSchema,
});

export async function saveMaintenanceAction(input: z.input<typeof maintenanceSchema>): Promise<ActionResult> {
  const parsed = maintenanceSchema.safeParse(input);
  if (!parsed.success) return { success: false, message: parsed.error.issues[0]?.message ?? "Datos del reclamo inválidos." };
  const { supabase, user } = await currentUser();
  if (!user) return { success: false, message: "No autenticado" };
  const { id, ...v } = parsed.data;
  const { data: contract } = await supabase.from("rental_contracts")
    .select("currency").eq("id", v.contract_id).single();
  if (!contract) return { success: false, message: "Contrato no encontrado." };

  const done = v.status === "RESUELTO" || v.status === "CANCELADO";
  const row = {
    ...v,
    description: v.description || null,
    provider: v.provider || null,
    currency: v.cost != null ? contract.currency : null,
    resolved_at: done ? ymdInAppTz() : null,
  };
  const { error } = id
    ? await supabase.from("rental_maintenance").update(row).eq("id", id)
    : await supabase.from("rental_maintenance").insert(row);
  if (error) return { success: false, message: error.message };
  revalidateContract(v.contract_id);
  return { success: true, message: id ? "Reclamo actualizado." : "Reclamo cargado." };
}

// Un reclamo a cargo del inquilino se cobra como cargo REPARACIONES en su
// cuenta corriente; queda enlazado para no facturarlo dos veces.
export async function billMaintenanceToTenantAction(maintenanceId: string): Promise<ActionResult> {
  if (!uuidSchema.safeParse(maintenanceId).success) return { success: false, message: "Reclamo inválido." };
  const { supabase, user } = await currentUser();
  if (!user) return { success: false, message: "No autenticado" };
  const { data: item } = await supabase.from("rental_maintenance")
    .select("id, contract_id, title, cost, payer, charge_id")
    .eq("id", maintenanceId).single();
  if (!item) return { success: false, message: "Reclamo no encontrado." };
  if (item.payer !== "INQUILINO" || !item.cost || item.cost <= 0) {
    return { success: false, message: "Solo se facturan reclamos a cargo del inquilino con costo." };
  }
  if (item.charge_id) return { success: false, message: "El reclamo ya fue cargado al inquilino." };
  const { data: contract } = await supabase.from("rental_contracts")
    .select("currency").eq("id", item.contract_id).single();
  if (!contract) return { success: false, message: "Contrato no encontrado." };
  const today = ymdInAppTz();
  const { data: charge, error } = await supabase.from("rental_charges").insert({
    contract_id: item.contract_id,
    period: `${today.slice(0, 7)}-01`,
    due_date: today,
    kind: "REPARACIONES",
    description: item.title,
    amount: item.cost,
    currency: contract.currency,
  }).select("id").single();
  if (error || !charge) return { success: false, message: error?.message ?? "No se pudo crear el cargo." };
  await supabase.from("rental_maintenance").update({ charge_id: charge.id }).eq("id", item.id);
  revalidateContract(item.contract_id);
  return { success: true, message: "Cargo agregado a la cuenta del inquilino." };
}

// === Documentos ===
// El archivo lo sube el navegador directo a storage (policy por contrato);
// acá solo se registra / borra la fila y se firman las URLs de lectura.
const documentSchema = z.object({
  contract_id: uuidSchema,
  kind: z.enum(["CONTRATO", "INVENTARIO_ENTRADA", "INVENTARIO_SALIDA", "GARANTIA", "OTRO"]),
  path: z.string().min(1).max(300),
  file_name: z.string().min(1).max(200),
});

export async function registerDocumentAction(input: z.input<typeof documentSchema>): Promise<ActionResult> {
  const parsed = documentSchema.safeParse(input);
  if (!parsed.success || !parsed.data.path.startsWith(`${parsed.data.contract_id}/`)) {
    return { success: false, message: "Documento inválido." };
  }
  const { supabase, user } = await currentUser();
  if (!user) return { success: false, message: "No autenticado" };
  const { error } = await supabase.from("rental_documents").insert(parsed.data);
  if (error) {
    await supabase.storage.from("rental-docs").remove([parsed.data.path]);
    return { success: false, message: error.message };
  }
  revalidateContract(parsed.data.contract_id);
  return { success: true, message: "Documento guardado." };
}

export async function deleteDocumentAction(documentId: string): Promise<ActionResult> {
  if (!uuidSchema.safeParse(documentId).success) return { success: false, message: "Documento inválido." };
  const { supabase, user } = await currentUser();
  if (!user) return { success: false, message: "No autenticado" };
  const { data: doc } = await supabase.from("rental_documents")
    .select("contract_id, path").eq("id", documentId).single();
  if (!doc) return { success: false, message: "Documento no encontrado." };
  const { error: storageError } = await supabase.storage.from("rental-docs").remove([doc.path]);
  if (storageError) return { success: false, message: storageError.message };
  const { error } = await supabase.from("rental_documents").delete().eq("id", documentId);
  if (error) return { success: false, message: error.message };
  revalidateContract(doc.contract_id);
  return { success: true, message: "Documento eliminado." };
}

export async function documentUrlAction(documentId: string): Promise<ActionResult<{ url: string }>> {
  if (!uuidSchema.safeParse(documentId).success) return { success: false, message: "Documento inválido." };
  const { supabase, user } = await currentUser();
  if (!user) return { success: false, message: "No autenticado" };
  const { data: doc } = await supabase.from("rental_documents").select("path").eq("id", documentId).single();
  if (!doc) return { success: false, message: "Documento no encontrado." };
  const { data, error } = await supabase.storage.from("rental-docs").createSignedUrl(doc.path, 60 * 5);
  if (error || !data) return { success: false, message: error?.message ?? "No se pudo abrir el documento." };
  return { success: true, message: "", data: { url: data.signedUrl } };
}
