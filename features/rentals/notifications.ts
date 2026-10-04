import "server-only";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { addDays, ymdInAppTz } from "@/lib/dates";
import { normalizeArPhone, sendTemplate, whatsappEnabled } from "@/lib/whatsapp";
import {
  computeAdjustment, formatDate, indexPeriods, money, periodOf, usesIndexValues,
} from "@/features/rentals/logic";
import { RENTAL_TEMPLATES, type NoticeKind } from "@/features/rentals/noticeTemplates";

// Avisos automáticos de alquileres por WhatsApp (plantillas aprobadas).
// Cada envío queda en rental_notifications; un aviso ENVIADO no se repite.
// Si WhatsApp no está configurado no se registra nada: cuando se configure,
// los avisos programados que sigan en su ventana salen en la próxima corrida.

type Contact = { id: string; full_name: string; phone: string | null };
type DeliveryStatus = "ENVIADO" | "FALLIDO" | "OMITIDO" | "YA_ENVIADO" | "SIN_WHATSAPP";

// Ventana de reintento de deudas: no se avisan atrasos de hace meses al
// activar el aviso por primera vez.
const OVERDUE_WINDOW_DAYS = 30;
// Un ajuste ya aplicado se avisa hasta 15 días después.
const APPLIED_ADJUSTMENT_WINDOW_DAYS = 15;

async function loadSettings() {
  const { data } = await supabaseAdmin.from("rental_settings").select("*").eq("id", 1).maybeSingle();
  return data;
}

async function deliver(input: {
  kind: NoticeKind; reference: string; contractId: string; contact: Contact | null; params: string[];
}): Promise<DeliveryStatus> {
  if (!whatsappEnabled) return "SIN_WHATSAPP";
  if (!input.contact) return "OMITIDO";
  const { data: existing } = await supabaseAdmin.from("rental_notifications")
    .select("status").eq("kind", input.kind).eq("reference", input.reference).eq("contact_id", input.contact.id).maybeSingle();
  if (existing?.status === "ENVIADO") return "YA_ENVIADO";

  const to = input.contact.phone ? normalizeArPhone(input.contact.phone) : null;
  const result = to
    ? await sendTemplate(to, RENTAL_TEMPLATES[input.kind].name, input.params).catch((error: unknown) => ({
      ok: false as const, error: error instanceof Error ? error.message : "Error de red",
    }))
    : null;
  const status: DeliveryStatus = !to ? "OMITIDO" : result?.ok ? "ENVIADO" : "FALLIDO";
  await supabaseAdmin.from("rental_notifications").upsert({
    kind: input.kind,
    reference: input.reference,
    contract_id: input.contractId,
    contact_id: input.contact.id,
    phone: to,
    status,
    detail: !to ? "Sin teléfono válido" : result?.ok ? result.id : result?.error ?? null,
    created_at: new Date().toISOString(),
  }, { onConflict: "kind,reference,contact_id" });
  return status;
}

function adjustmentBasis(index: string, pct: number | null) {
  switch (index) {
    case "ICL": return "el ICL del BCRA";
    case "IPC": return "el IPC del INDEC";
    case "CASA_PROPIA": return "el coeficiente Casa Propia";
    case "FIJO": return `un ${pct ?? 0} % fijo`;
    default: return "acuerdo entre las partes";
  }
}

// === Recibo: se llama después de registrar un cobro ===
export async function notifyReceipt(entryId: string) {
  const settings = await loadSettings();
  if (!settings?.notify_receipts || !whatsappEnabled) return;
  const { data } = await supabaseAdmin.from("rental_payment_entries")
    .select("id, amount, receipt_number, charge:rental_charges(description, currency, contract_id, contract:rental_contracts(property:properties(title), tenant:rental_contacts!rental_contracts_tenant_id_fkey(id, full_name, phone)))")
    .eq("id", entryId).maybeSingle();
  const row = data as unknown as {
    id: string; amount: number; receipt_number: number;
    charge: { description: string; currency: string; contract_id: string;
      contract: { property: { title: string } | null; tenant: Contact | null } | null } | null;
  } | null;
  if (!row?.charge) return;
  const tenant = row.charge.contract?.tenant ?? null;
  await deliver({
    kind: "RECIBO", reference: row.id, contractId: row.charge.contract_id, contact: tenant,
    params: [
      tenant?.full_name ?? "", money(row.amount, row.charge.currency), row.charge.description,
      row.charge.contract?.property?.title ?? "tu alquiler", String(row.receipt_number),
    ],
  });
}

type ChargeRow = {
  id: string; contract_id: string; due_date: string; description: string; amount: number; currency: string;
  entries: { amount: number }[];
  contract: { status: string; property: { title: string } | null; tenant: Contact | null } | null;
};
const CHARGE_SELECT = "id, contract_id, due_date, description, amount, currency, entries:rental_payment_entries(amount), contract:rental_contracts!inner(status, property:properties(title), tenant:rental_contacts!rental_contracts_tenant_id_fkey(id, full_name, phone))";
const balanceOf = (charge: ChargeRow) => charge.amount - charge.entries.reduce((sum, entry) => sum + entry.amount, 0);

// === Avisos programados: los corre el cron diario ===
export async function runScheduledNotices() {
  const settings = await loadSettings();
  const summary = { vencimiento: 0, deuda: 0, aumento: 0 };
  if (!settings || !whatsappEnabled) return summary;
  const today = ymdInAppTz();
  const count = (status: DeliveryStatus, key: keyof typeof summary) => { if (status === "ENVIADO") summary[key]++; };

  // Vencimiento: cuotas impagas que vencen dentro de los próximos N días.
  if (settings.notify_due) {
    const { data } = await supabaseAdmin.from("rental_charges").select(CHARGE_SELECT)
      .eq("kind", "ALQUILER").eq("contract.status", "ACTIVO")
      .gte("due_date", today).lte("due_date", addDays(today, settings.due_reminder_days));
    for (const charge of (data ?? []) as unknown as ChargeRow[]) {
      const balance = balanceOf(charge);
      if (balance <= 0.005) continue;
      const tenant = charge.contract?.tenant ?? null;
      count(await deliver({
        kind: "VENCIMIENTO", reference: charge.id, contractId: charge.contract_id, contact: tenant,
        params: [tenant?.full_name ?? "", formatDate(charge.due_date), charge.description,
          charge.contract?.property?.title ?? "tu alquiler", money(balance, charge.currency)],
      }), "vencimiento");
    }
  }

  // Deuda: cuotas que siguen impagas N días después del vencimiento.
  if (settings.notify_overdue) {
    const threshold = addDays(today, -settings.overdue_reminder_days);
    const { data } = await supabaseAdmin.from("rental_charges").select(CHARGE_SELECT)
      .eq("kind", "ALQUILER")
      .lte("due_date", threshold).gte("due_date", addDays(threshold, -OVERDUE_WINDOW_DAYS));
    for (const charge of (data ?? []) as unknown as ChargeRow[]) {
      const balance = balanceOf(charge);
      if (balance <= 0.005) continue;
      const tenant = charge.contract?.tenant ?? null;
      count(await deliver({
        kind: "DEUDA", reference: charge.id, contractId: charge.contract_id, contact: tenant,
        params: [tenant?.full_name ?? "", money(balance, charge.currency), charge.description,
          charge.contract?.property?.title ?? "tu alquiler", formatDate(charge.due_date)],
      }), "deuda");
    }
  }

  if (settings.notify_adjustments) {
    type AdjustmentContract = {
      id: string; adjustment_index: string; adjustment_pct: number | null; base_rent_amount: number; base_period: string;
      index_lag_months: number; next_adjustment_date: string | null; currency: string;
      property: { title: string } | null; tenant: Contact | null; owner: Contact | null;
    };
    const CONTRACT_SELECT = "id, adjustment_index, adjustment_pct, base_rent_amount, base_period, index_lag_months, next_adjustment_date, currency, property:properties(title), tenant:rental_contacts!rental_contracts_tenant_id_fkey(id, full_name, phone), owner:rental_contacts!rental_contracts_owner_id_fkey(id, full_name, phone)";
    const notifyBoth = async (contract: AdjustmentContract, effectiveDate: string, amount: number) => {
      for (const contact of [contract.tenant, contract.owner]) {
        count(await deliver({
          kind: "AUMENTO", reference: `${contract.id}|${effectiveDate}`, contractId: contract.id, contact,
          params: [contact?.full_name ?? "", formatDate(effectiveDate), contract.property?.title ?? "la propiedad",
            money(amount, contract.currency), adjustmentBasis(contract.adjustment_index, contract.adjustment_pct)],
        }), "aumento");
      }
    };

    // Antes del ajuste: solo si el monto ya se puede calcular.
    const { data: upcoming } = await supabaseAdmin.from("rental_contracts").select(CONTRACT_SELECT)
      .eq("status", "ACTIVO").gt("next_adjustment_date", today)
      .lte("next_adjustment_date", addDays(today, settings.adjustment_notice_days));
    const contracts = (upcoming ?? []) as unknown as AdjustmentContract[];
    const periods = contracts.filter((c) => usesIndexValues(c.adjustment_index) && c.next_adjustment_date)
      .flatMap((c) => Object.values(indexPeriods(c.base_period, periodOf(c.next_adjustment_date!), c.index_lag_months)));
    const { data: indexValues } = periods.length
      ? await supabaseAdmin.from("index_values").select("index_code, period, value").in("period", [...new Set(periods)])
      : { data: [] };
    for (const contract of contracts) {
      const preview = computeAdjustment(contract, periodOf(contract.next_adjustment_date!), indexValues ?? []);
      if ("amount" in preview) await notifyBoth(contract, contract.next_adjustment_date!, preview.amount);
    }

    // Ajustes ya aplicados que no se pudieron avisar antes (índice publicado
    // el mismo día, ajuste manual): se avisan con el monto aplicado.
    const { data: applied } = await supabaseAdmin.from("rental_adjustments")
      .select(`effective_date, new_amount, contract:rental_contracts!inner(${CONTRACT_SELECT})`)
      .gte("effective_date", addDays(today, -APPLIED_ADJUSTMENT_WINDOW_DAYS)).lte("effective_date", today);
    for (const row of (applied ?? []) as unknown as { effective_date: string; new_amount: number; contract: AdjustmentContract }[]) {
      await notifyBoth(row.contract, row.effective_date, row.new_amount);
    }
  }

  return summary;
}
