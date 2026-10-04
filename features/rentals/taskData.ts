import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { addDays } from "@/lib/dates";
import {
  ADJUSTMENT_LABELS, addMonths, daysBetween, formatDate, formatPeriod, money, periodOf, round2,
  type AdjustmentIndex, type RentalAlertSettings,
} from "@/features/rentals/logic";
import {
  adjustmentMessage, debtMessage, paymentRisk, phoneDigits, upcomingMessage,
  type RentalTask, type RiskLevel, type TaskAction, type TaskUrgency,
} from "@/features/rentals/tasks";
import { renewalMessage } from "@/features/rentals/vacancy";

// Arma la bandeja "Hoy" desde los datos. Corre con la sesión del agente:
// RLS limita a sus contratos (admin ve todos). Las tareas no se guardan;
// solo se ocultan las pospuestas (rental_task_snoozes) hasta su fecha.

type Contact = { id: string; full_name: string; phone: string | null };
type Contract = {
  id: string; property_id: string; status: string; start_date: string; end_date: string; currency: string; rent_amount: number;
  adjustment_index: string; next_adjustment_date: string | null; renewed_from_id: string | null; renewal_intent: string | null;
  deposit_amount: number; deposit_received_at: string | null; deposit_returned_at: string | null;
  property: { title: string; status: string | null } | null; tenant: Contact | null; owner: Contact | null;
};
type Charge = {
  id: string; contract_id: string; period: string; due_date: string; kind: string; amount: number; currency: string;
  entries: { amount: number; paid_at: string }[];
};

const UPCOMING_REMINDER_DAYS = 5;
const SETTLEMENT_LOOKBACK_MONTHS = 3;
const ADJUSTMENT_NOTICE_WINDOW_DAYS = 15;
const urgencyFrom = (score: number): TaskUrgency => (score >= 100 ? "alta" : score >= 50 ? "media" : "baja");

export async function buildRentalTasks(
  supabase: SupabaseClient, today: string, alerts: RentalAlertSettings,
): Promise<{ tasks: RentalTask[]; snoozed: number }> {
  const currentPeriod = periodOf(today);
  const [
    { data: contractsRaw }, { data: chargesRaw }, { data: settlementsRaw }, { data: sharesRaw },
    { data: adjustmentsRaw }, { data: noticesRaw }, { data: maintenanceRaw }, { data: casaPropiaRaw }, { data: snoozesRaw },
  ] = await Promise.all([
    supabase.from("rental_contracts").select("id, property_id, status, start_date, end_date, currency, rent_amount, adjustment_index, next_adjustment_date, renewed_from_id, renewal_intent, deposit_amount, deposit_received_at, deposit_returned_at, property:properties(title, status), tenant:rental_contacts!rental_contracts_tenant_id_fkey(id, full_name, phone), owner:rental_contacts!rental_contracts_owner_id_fkey(id, full_name, phone)"),
    supabase.from("rental_charges").select("id, contract_id, period, due_date, kind, amount, currency, entries:rental_payment_entries(amount, paid_at)").lte("period", addDays(currentPeriod, 40)),
    supabase.from("rental_settlements").select("contract_id, period"),
    supabase.from("rental_settlement_shares").select("id, amount, settlement:rental_settlements(contract_id, period, issued_at, currency), contact:rental_contacts(id, full_name)").is("paid_to_owner_at", null),
    supabase.from("rental_adjustments").select("contract_id, effective_date, new_amount").gte("effective_date", addDays(today, -ADJUSTMENT_NOTICE_WINDOW_DAYS)).lte("effective_date", today),
    supabase.from("rental_notifications").select("reference, contact_id").eq("kind", "AUMENTO").eq("status", "ENVIADO"),
    supabase.from("rental_maintenance").select("id, contract_id, title, priority, reported_at").in("status", ["ABIERTO", "EN_CURSO"]),
    supabase.from("index_values").select("period").eq("index_code", "CASA_PROPIA"),
    supabase.from("rental_task_snoozes").select("task_key").gt("snoozed_until", today),
  ]);

  const contracts = (contractsRaw ?? []) as unknown as Contract[];
  const byId = new Map(contracts.map((c) => [c.id, c]));
  const charges = (chargesRaw ?? []) as unknown as Charge[];
  const balanceOf = (c: Charge) => round2(c.amount - c.entries.reduce((s, e) => s + e.amount, 0));
  const settled = new Set((settlementsRaw ?? []).map((s) => `${s.contract_id}|${s.period}`));
  // Sucesor: renovación o un contrato activo posterior (el próximo inquilino).
  const renewed = new Set(contracts.map((c) => c.renewed_from_id).filter(Boolean));
  const hasSuccessor = (c: Contract) => renewed.has(c.id)
    || contracts.some((o) => o.id !== c.id && o.property_id === c.property_id && o.status === "ACTIVO" && o.start_date > c.start_date);
  const sentAdjustmentNotices = new Set((noticesRaw ?? []).map((n) => `${n.reference}|${n.contact_id}`));
  const casaPropiaPeriods = new Set((casaPropiaRaw ?? []).map((v) => v.period));

  // Riesgo por contrato, con su historial de cuotas de alquiler.
  const risk = new Map<string, RiskLevel>();
  for (const contract of contracts) {
    const rents = charges.filter((c) => c.contract_id === contract.id && c.kind === "ALQUILER");
    risk.set(contract.id, paymentRisk(rents, today).level);
  }
  const riskBoost = (contractId: string) => ({ ALTO: 30, MEDIO: 15, BAJO: 0, NUEVO: 5 })[risk.get(contractId) ?? "NUEVO"];

  const tasks: RentalTask[] = [];
  const title = (c: Contract | undefined) => c?.property?.title ?? "Contrato";
  const contractLink = (id: string, tab?: string, label = "Abrir contrato"): TaskAction =>
    ({ type: "link", label, href: `/dashboard/alquileres/${id}${tab ? `?tab=${tab}` : ""}` });

  // --- Cobranzas: deuda vencida, una tarea por contrato ---
  const overdueByContract = new Map<string, Charge[]>();
  for (const charge of charges) {
    if (charge.due_date < today && balanceOf(charge) > 0.005) {
      overdueByContract.set(charge.contract_id, [...(overdueByContract.get(charge.contract_id) ?? []), charge]);
    }
  }
  for (const [contractId, list] of overdueByContract) {
    const contract = byId.get(contractId);
    const oldest = list.reduce((min, c) => (c.due_date < min ? c.due_date : min), list[0].due_date);
    const daysLate = daysBetween(oldest, today);
    const totals = new Map<string, number>();
    for (const c of list) totals.set(c.currency, round2((totals.get(c.currency) ?? 0) + balanceOf(c)));
    const amounts = [...totals.entries()];
    const level = risk.get(contractId) ?? "NUEVO";
    const score = 70 + Math.min(daysLate, 90) + riskBoost(contractId);
    const phone = phoneDigits(contract?.tenant?.phone);
    tasks.push({
      key: `DEUDA:${contractId}:${oldest}:${list.length}`,
      category: "cobranzas", urgency: daysLate > 30 ? "alta" : urgencyFrom(score), score,
      title: `${contract?.tenant?.full_name ?? "Inquilino"} debe ${amounts.map(([cur, amt]) => money(amt, cur)).join(" + ")}`,
      detail: `${title(contract)} · ${list.length} ${list.length === 1 ? "cargo vencido" : "cargos vencidos"}, el más antiguo hace ${daysLate} días`,
      contractId, risk: level,
      actions: [
        ...(phone ? [{
          type: "whatsapp", label: "Reclamar", phone, snoozeDays: 3,
          text: debtMessage({ tenantName: contract?.tenant?.full_name ?? "", propertyTitle: title(contract), amounts, oldestDue: oldest, daysLate, risk: level }),
        } as TaskAction] : []),
        contractLink(contractId, "cuenta", "Registrar pago"),
      ],
    });
  }

  // --- Cobranzas proactivas: cuotas por vencer de inquilinos que suelen atrasarse ---
  for (const charge of charges) {
    if (charge.kind !== "ALQUILER" || charge.due_date < today || charge.due_date > addDays(today, UPCOMING_REMINDER_DAYS)) continue;
    const level = risk.get(charge.contract_id);
    if (level !== "ALTO" && level !== "MEDIO") continue;
    const balance = balanceOf(charge);
    if (balance <= 0.005 || overdueByContract.has(charge.contract_id)) continue;
    const contract = byId.get(charge.contract_id);
    const phone = phoneDigits(contract?.tenant?.phone);
    const daysToDue = daysBetween(today, charge.due_date);
    tasks.push({
      key: `RECORDAR:${charge.id}`,
      category: "cobranzas", urgency: "media", score: 55 + (UPCOMING_REMINDER_DAYS - daysToDue) * 4,
      title: `Recordar a ${contract?.tenant?.full_name ?? "el inquilino"} antes del vencimiento`,
      detail: `${title(contract)} · ${money(balance, charge.currency)} vence ${daysToDue === 0 ? "hoy" : `en ${daysToDue} ${daysToDue === 1 ? "día" : "días"}`} · suele pagar tarde`,
      contractId: charge.contract_id, risk: level,
      actions: phone
        ? [{ type: "whatsapp", label: "Recordar", phone, snoozeDays: 7,
          text: upcomingMessage({ tenantName: contract?.tenant?.full_name ?? "", propertyTitle: title(contract), amount: balance, currency: charge.currency, dueDate: charge.due_date }) }]
        : [contractLink(charge.contract_id, "cuenta")],
    });
  }

  // --- Ajustes trabados: fecha pasada y sin aplicar (falta índice o monto) ---
  for (const contract of contracts) {
    if (contract.status !== "ACTIVO" || !contract.next_adjustment_date) continue;
    const date = contract.next_adjustment_date;
    const label = ADJUSTMENT_LABELS[contract.adjustment_index as AdjustmentIndex] ?? contract.adjustment_index;
    if (date <= today) {
      const daysLate = daysBetween(date, today);
      const reason = contract.adjustment_index === "MANUAL" ? "falta cargar el nuevo canon"
        : contract.adjustment_index === "CASA_PROPIA" ? `falta el coeficiente Casa Propia de ${formatPeriod(periodOf(date))}`
        : `todavía no se publicó el ${label} necesario`;
      tasks.push({
        key: `AJUSTE_TRABADO:${contract.id}:${date}`,
        category: "ajustes", urgency: daysLate > 5 ? "alta" : "media", score: 65 + Math.min(daysLate, 40),
        title: `Ajuste sin aplicar en ${title(contract)}`,
        detail: `Correspondía el ${formatDate(date)}: ${reason}.`,
        contractId: contract.id,
        actions: contract.adjustment_index === "MANUAL" ? [contractLink(contract.id, undefined, "Cargar canon")]
          : contract.adjustment_index === "CASA_PROPIA" ? [{ type: "link", label: "Cargar coeficiente", href: "/dashboard/ajustes" }, contractLink(contract.id)]
          : [contractLink(contract.id)],
      });
    } else if (contract.adjustment_index === "CASA_PROPIA" && date <= addDays(today, 7) && !casaPropiaPeriods.has(periodOf(date))) {
      tasks.push({
        key: `COEFICIENTE:${contract.id}:${date}`,
        category: "ajustes", urgency: "media", score: 58,
        title: `Cargar el coeficiente Casa Propia de ${formatPeriod(periodOf(date))}`,
        detail: `${title(contract)} ajusta el ${formatDate(date)} y el coeficiente todavía no está cargado.`,
        contractId: contract.id,
        actions: [{ type: "link", label: "Cargar coeficiente", href: "/dashboard/ajustes" }],
      });
    }
  }

  // --- Ajustes aplicados sin avisar (inquilino y propietario) ---
  for (const adjustment of adjustmentsRaw ?? []) {
    const contract = byId.get(adjustment.contract_id);
    if (!contract) continue;
    const reference = `${contract.id}|${adjustment.effective_date}`;
    for (const [role, person] of [["inquilino", contract.tenant], ["propietario", contract.owner]] as const) {
      if (!person || sentAdjustmentNotices.has(`${reference}|${person.id}`)) continue;
      const phone = phoneDigits(person.phone);
      tasks.push({
        key: `AJUSTE_AVISO:${contract.id}:${adjustment.effective_date}:${person.id}`,
        category: "ajustes", urgency: "media", score: 52,
        title: `Avisar el aumento al ${role}: ${person.full_name}`,
        detail: `${title(contract)} · desde el ${formatDate(adjustment.effective_date)} el canon es ${money(adjustment.new_amount, contract.currency)}`,
        contractId: contract.id,
        actions: phone
          ? [{ type: "whatsapp", label: "Avisar", phone, snoozeDays: 30,
            text: adjustmentMessage({ name: person.full_name, propertyTitle: title(contract), effectiveDate: adjustment.effective_date, amount: adjustment.new_amount, currency: contract.currency }) }]
          : [contractLink(contract.id)],
      });
    }
  }

  // --- Liquidaciones: meses cobrados completos sin liquidar ---
  // Solo los últimos meses: los anteriores sin liquidar en el sistema casi
  // siempre se liquidaron por fuera, y llenarían la bandeja de ruido.
  const oldestToSettle = addMonths(currentPeriod, -(SETTLEMENT_LOOKBACK_MONTHS - 1));
  const periodsByContract = new Map<string, Map<string, Charge[]>>();
  for (const charge of charges) {
    if (charge.period > currentPeriod || charge.period < oldestToSettle) continue;
    const map = periodsByContract.get(charge.contract_id) ?? new Map<string, Charge[]>();
    map.set(charge.period, [...(map.get(charge.period) ?? []), charge]);
    periodsByContract.set(charge.contract_id, map);
  }
  for (const [contractId, periods] of periodsByContract) {
    const ready = [...periods.entries()]
      .filter(([period, list]) => !settled.has(`${contractId}|${period}`) && list.every((c) => balanceOf(c) <= 0.005))
      .map(([period]) => period).sort();
    if (!ready.length) continue;
    const contract = byId.get(contractId);
    const age = daysBetween(ready[0], today);
    tasks.push({
      key: `LIQUIDAR:${contractId}:${ready.join(",")}`,
      category: "liquidaciones", urgency: age > 45 ? "alta" : "media", score: 50 + Math.min(age, 60),
      title: `Liquidar ${ready.map((p) => formatPeriod(p)).join(" y ")} de ${title(contract)}`,
      detail: `${ready.length === 1 ? "El mes está cobrado" : "Los meses están cobrados"} completo. Propietario: ${contract?.owner?.full_name ?? "sin datos"}.`,
      contractId, actions: [contractLink(contractId, "liquidaciones", "Emitir liquidación")],
    });
  }

  // --- Transferencias pendientes, agrupadas por propietario y moneda ---
  type Share = { id: string; amount: number; settlement: { contract_id: string; period: string; issued_at: string; currency: string } | null; contact: { id: string; full_name: string } | null };
  const sharesByOwner = new Map<string, Share[]>();
  for (const share of (sharesRaw ?? []) as unknown as Share[]) {
    if (!share.settlement || !share.contact) continue;
    const key = `${share.contact.id}|${share.settlement.currency}`;
    sharesByOwner.set(key, [...(sharesByOwner.get(key) ?? []), share]);
  }
  for (const [ownerKey, list] of sharesByOwner) {
    const first = list[0];
    const currency = first.settlement!.currency;
    const total = round2(list.reduce((sum, s) => sum + s.amount, 0));
    const oldest = list.reduce((min, s) => (s.settlement!.issued_at < min ? s.settlement!.issued_at : min), first.settlement!.issued_at);
    const age = daysBetween(oldest, today);
    const single = list.length === 1;
    tasks.push({
      key: `TRANSFERIR:${ownerKey}:${list.map((s) => s.id).sort().join(",")}`,
      category: "liquidaciones", urgency: age > 15 ? "alta" : "media", score: 60 + Math.min(age, 40),
      title: `Transferir ${money(total, currency)} a ${first.contact!.full_name}`,
      detail: single
        ? `${title(byId.get(first.settlement!.contract_id))} · liquidación de ${formatPeriod(first.settlement!.period)}, emitida hace ${age} días`
        : `${list.length} liquidaciones sin pagar, la más antigua emitida hace ${age} días`,
      contractId: first.settlement!.contract_id,
      actions: single
        ? [{ type: "payout", shareId: first.id, ownerName: first.contact!.full_name, amount: first.amount, currency }]
        : [{ type: "link", label: "Registrar pagos", href: `/dashboard/alquileres/contactos/${first.contact!.id}` }],
    });
  }

  // --- Contratos por vencer sin sucesor (vacancia) ---
  // Según la intención registrada: preguntar si renueva, armar la
  // renovación o salir a publicar antes de que se desocupe.
  const vacancyLink: TaskAction = { type: "link", label: "Ver vacancia", href: "/dashboard/alquileres/vacancia" };
  for (const contract of contracts) {
    if (contract.status !== "ACTIVO" || hasSuccessor(contract)) continue;
    const daysLeft = daysBetween(today, contract.end_date);
    if (daysLeft > alerts.expiryAlertDays) continue;
    const when = daysLeft >= 0 ? `vence en ${daysLeft} días` : `venció hace ${-daysLeft} días`;
    const base = {
      category: "contratos" as const, urgency: (daysLeft <= 30 ? "alta" : daysLeft <= 60 ? "media" : "baja") as TaskUrgency,
      score: 40 + Math.max(0, alerts.expiryAlertDays - daysLeft), contractId: contract.id,
      detail: `Inquilino: ${contract.tenant?.full_name ?? "sin datos"} · propietario: ${contract.owner?.full_name ?? "sin datos"}`,
    };
    if (contract.renewal_intent === "NO_RENUEVA") {
      if (contract.property?.status === "EN_ALQUILER") continue; // ya publicada: se sigue en Vacancia
      tasks.push({ ...base, key: `PUBLICAR:${contract.id}`, title: `Publicar ${title(contract)}: se desocupa el ${formatDate(contract.end_date)}`, actions: [vacancyLink] });
    } else if (contract.renewal_intent === "RENUEVA") {
      tasks.push({
        ...base, key: `RENOVAR:${contract.id}`, title: `Renovar ${title(contract)}: ${when}`,
        actions: [{ type: "link", label: "Renovar", href: `/dashboard/alquileres/nuevo?renovar=${contract.id}` }, contractLink(contract.id)],
      });
    } else {
      const phone = phoneDigits(contract.tenant?.phone);
      tasks.push({
        ...base, key: `RENUEVA?:${contract.id}`, title: `¿Renueva ${title(contract)}? ${when[0].toUpperCase()}${when.slice(1)}`,
        actions: [
          ...(phone && contract.tenant ? [{
            type: "whatsapp" as const, label: "Consultar", phone, snoozeDays: 3,
            text: renewalMessage({ tenantName: contract.tenant.full_name, propertyTitle: title(contract), endDate: contract.end_date }),
          }] : []),
          vacancyLink,
        ],
      });
    }
  }

  // --- Propiedades que quedaron vacías sin publicar ---
  const lastClosed = new Map<string, Contract>();
  for (const contract of contracts) {
    if (contract.status === "ACTIVO") continue;
    const current = lastClosed.get(contract.property_id);
    if (!current || contract.end_date > current.end_date) lastClosed.set(contract.property_id, contract);
  }
  for (const contract of lastClosed.values()) {
    const occupied = contracts.some((o) => o.property_id === contract.property_id && o.status === "ACTIVO");
    const listed = contract.property?.status === "EN_ALQUILER" || contract.property?.status === "RESERVADO";
    if (occupied || listed) continue;
    const days = Math.max(0, daysBetween(contract.end_date, today));
    tasks.push({
      key: `VACANTE:${contract.property_id}`,
      category: "contratos", urgency: days > 7 ? "alta" : "media", score: 70 + Math.min(days, 30),
      title: `Publicar ${title(contract)}: vacante hace ${days} días`,
      detail: `Terminó el contrato de ${contract.tenant?.full_name ?? "el inquilino"} el ${formatDate(contract.end_date)} y la propiedad no está publicada.`,
      contractId: contract.id, actions: [vacancyLink],
    });
  }

  // --- Depósitos sin devolver en contratos cerrados ---
  for (const contract of contracts) {
    if (contract.status === "ACTIVO" || contract.deposit_amount <= 0 || !contract.deposit_received_at || contract.deposit_returned_at) continue;
    tasks.push({
      key: `DEPOSITO:${contract.id}`,
      category: "contratos", urgency: "media", score: 55,
      title: `Devolver el depósito de ${title(contract)}`,
      detail: `${money(contract.deposit_amount, contract.currency)} a ${contract.tenant?.full_name ?? "el inquilino"}: el contrato ya terminó.`,
      contractId: contract.id, actions: [contractLink(contract.id, undefined, "Registrar devolución")],
    });
  }

  // --- Reclamos de mantenimiento abiertos ---
  for (const item of maintenanceRaw ?? []) {
    const contract = byId.get(item.contract_id);
    const age = daysBetween(item.reported_at, today);
    const critical = item.priority === "URGENTE" || item.priority === "ALTA";
    tasks.push({
      key: `RECLAMO:${item.id}`,
      category: "mantenimiento", urgency: critical || age > 14 ? "alta" : "media",
      score: (item.priority === "URGENTE" ? 110 : item.priority === "ALTA" ? 85 : 45) + Math.min(age, 30),
      title: `Reclamo: ${item.title}`,
      detail: `${title(contract)} · reportado hace ${age} días · prioridad ${String(item.priority).toLowerCase()}`,
      contractId: item.contract_id, actions: [contractLink(item.contract_id, "mantenimiento", "Ver reclamo")],
    });
  }

  const snoozedKeys = new Set((snoozesRaw ?? []).map((s) => s.task_key));
  const visible = tasks.filter((t) => !snoozedKeys.has(t.key)).sort((a, b) => b.score - a.score);
  return { tasks: visible, snoozed: tasks.length - visible.length };
}
