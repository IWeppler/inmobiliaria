// Tier 4 — lógica pura de alquileres (sin I/O), compartida entre server
// actions, páginas y PDF. Fechas como "YYYY-MM-DD"; períodos como el
// primer día del mes "YYYY-MM-01".

export type AdjustmentIndex = "ICL" | "IPC" | "CASA_PROPIA" | "FIJO" | "MANUAL" | "NINGUNO";
export const ADJUSTMENT_INDEXES = ["ICL", "IPC", "CASA_PROPIA", "FIJO", "MANUAL", "NINGUNO"] as const;

export const ADJUSTMENT_LABELS: Record<AdjustmentIndex, string> = {
  ICL: "ICL (BCRA)",
  IPC: "IPC (INDEC)",
  CASA_PROPIA: "Casa Propia",
  FIJO: "Porcentaje fijo",
  MANUAL: "Manual",
  NINGUNO: "Sin ajuste",
};

export const CONTRACT_STATUS_LABELS: Record<string, string> = {
  ACTIVO: "Activo",
  FINALIZADO: "Finalizado",
  RESCINDIDO: "Rescindido",
};

// Tono semántico del estado de contrato (ver StatusBadge).
export const CONTRACT_STATUS_TONE: Record<string, "success" | "neutral" | "danger"> = {
  ACTIVO: "success",
  FINALIZADO: "neutral",
  RESCINDIDO: "danger",
};

export const CHARGE_LABELS: Record<string, string> = {
  ALQUILER: "Alquiler", EXPENSAS: "Expensas", SERVICIOS: "Servicios",
  PUNITORIOS: "Punitorios", REPARACIONES: "Reparaciones", PENALIDAD: "Penalidad",
};

// Pestañas del detalle de contrato (?tab= en la URL).
export const CONTRACT_TABS = ["resumen", "cuenta", "liquidaciones", "mantenimiento", "documentos", "historial"] as const;
export type ContractTab = (typeof CONTRACT_TABS)[number];

// Conceptos que se cargan a mano (ALQUILER lo generan las cuotas).
export const MANUAL_CHARGE_KINDS = ["EXPENSAS", "SERVICIOS", "PUNITORIOS", "REPARACIONES", "PENALIDAD"] as const;
export type ManualChargeKind = (typeof MANUAL_CHARGE_KINDS)[number];

export function ymd(d: Date) {
  return d.toISOString().slice(0, 10);
}

export function parseYmd(s: string) {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

export function periodOf(s: string) {
  return `${s.slice(0, 7)}-01`;
}

export function addMonths(s: string, n: number) {
  const d = parseYmd(s);
  const day = d.getUTCDate();
  d.setUTCDate(1);
  d.setUTCMonth(d.getUTCMonth() + n);
  const last = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate();
  d.setUTCDate(Math.min(day, last));
  return ymd(d);
}

export function daysBetween(a: string, b: string) {
  return Math.round((parseYmd(b).getTime() - parseYmd(a).getTime()) / 86400000);
}

export function formatPeriod(period: string) {
  const d = parseYmd(period);
  return new Intl.DateTimeFormat("es-AR", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(d);
}

// "Octubre de 2026" para títulos. CSS `capitalize` sube cada palabra
// ("Octubre De 2026"), por eso se capitaliza solo la primera letra acá.
export function formatPeriodTitle(period: string) {
  const text = formatPeriod(period);
  return text.charAt(0).toUpperCase() + text.slice(1);
}

export function formatDate(s: string | null | undefined) {
  if (!s) return "—";
  return new Intl.DateTimeFormat("es-AR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone: "UTC",
  }).format(parseYmd(s.slice(0, 10)));
}

export function money(amount: number | null | undefined, currency = "ARS") {
  if (amount === null || amount === undefined) return "—";
  return `${currency} ${amount.toLocaleString("es-AR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

// Períodos (meses) cubiertos por el contrato: del mes de inicio al mes
// anterior al de fin si termina el día 1, si no hasta el mes de fin.
export function contractPeriods(startDate: string, endDate: string) {
  const out: string[] = [];
  let p = periodOf(startDate);
  const endPeriod = endDate.endsWith("-01")
    ? addMonths(periodOf(endDate), -1)
    : periodOf(endDate);
  while (p <= endPeriod) {
    out.push(p);
    p = addMonths(p, 1);
  }
  return out;
}

export function dueDateFor(period: string, dueDay: number) {
  return `${period.slice(0, 7)}-${String(dueDay).padStart(2, "0")}`;
}

// === E4.3 — Estado de un pago y mora ===
export type PaymentStatus = "pagado" | "vencido" | "pendiente" | "parcial";

export function paymentStatus(
  p: { paid_at: string | null; paid_amount: number | null; amount: number; due_date: string },
  today: string
): PaymentStatus {
  if (p.paid_at) {
    return (p.paid_amount ?? 0) + 0.005 < p.amount ? "parcial" : "pagado";
  }
  return p.due_date < today ? "vencido" : "pendiente";
}

export const PAYMENT_STATUS_LABELS: Record<PaymentStatus, string> = {
  pagado: "Pagado",
  parcial: "Pago parcial",
  vencido: "Vencido",
  pendiente: "Pendiente",
};

// Punitorio simple: % diario sobre el saldo por cada día de atraso (desde
// el vencimiento hasta hoy o hasta la fecha de pago) + fijo. Dentro de los
// días de gracia no corre. Mismo cálculo que rental_accrue_late_fees().
export function lateFee(
  p: { amount: number; due_date: string; paid_at: string | null; paid_amount?: number | null },
  lateFeePctDaily: number,
  today: string,
  lateFeeFixed = 0,
  graceDays = 0,
) {
  const balance = Math.max(0, p.amount - (p.paid_amount ?? 0));
  const until = balance > 0 ? today : p.paid_at ?? today;
  const days = daysBetween(p.due_date, until);
  if (days <= 0 || days <= graceDays) return 0;
  const basis = balance > 0 ? balance : p.amount;
  return round2(basis * (lateFeePctDaily / 100) * days + lateFeeFixed);
}

// === E4.2 — Ajuste por índice ===
// Nuevo canon = canon base × (índice[ajuste - rezago] / índice[base - rezago]).
// El rezago existe porque el IPC de un mes se publica el mes siguiente.
// Con FIJO: canon × (1 + pct). Misma fórmula que rental_apply_adjustment.
export function indexPeriods(basePeriod: string, adjustmentPeriod: string, lagMonths: number) {
  return { base: addMonths(basePeriod, -lagMonths), target: addMonths(adjustmentPeriod, -lagMonths) };
}

export const DEFAULT_INDEX_LAG: Record<string, number> = { IPC: 2, ICL: 0, CASA_PROPIA: 0 };

// Índices que se leen de index_values (los demás no dependen de datos externos).
export function usesIndexValues(index: string) {
  return index === "ICL" || index === "IPC" || index === "CASA_PROPIA";
}

// Frecuencias habituales; cualquier otra de 1 a 36 meses se carga como personalizada.
export const COMMON_ADJUSTMENT_MONTHS: Record<number, string> = { 3: "Trimestral", 4: "Cuatrimestral", 6: "Semestral", 12: "Anual" };

export function computeAdjustment(
  contract: {
    adjustment_index: string;
    adjustment_pct: number | null;
    base_rent_amount: number;
    base_period: string;
    index_lag_months?: number;
  },
  targetPeriod: string,
  indexValues: { index_code: string; period: string; value: number }[]
): { amount: number; factor: number } | { error: string } {
  const idx = contract.adjustment_index as AdjustmentIndex;
  if (idx === "NINGUNO") return { error: "El contrato no tiene ajuste." };
  if (idx === "MANUAL") return { error: "Ingresá el nuevo canon al aplicar el ajuste manual." };
  if (idx === "FIJO") {
    const pct = contract.adjustment_pct ?? 0;
    const factor = 1 + pct / 100;
    return { amount: round2(contract.base_rent_amount * factor), factor };
  }
  const periods = indexPeriods(contract.base_period, targetPeriod, contract.index_lag_months ?? 0);
  const find = (period: string) =>
    indexValues.find((v) => v.index_code === idx && v.period === period)?.value;
  // Casa Propia publica directamente el coeficiente a aplicar en el mes.
  if (idx === "CASA_PROPIA") {
    const coefficient = find(periods.target);
    if (!coefficient) return { error: `Falta cargar el coeficiente Casa Propia de ${formatPeriod(periods.target)}.` };
    return { amount: round2(contract.base_rent_amount * coefficient), factor: coefficient };
  }
  const base = find(periods.base);
  const target = find(periods.target);
  if (!base)
    return { error: `Falta el valor ${idx} de ${formatPeriod(periods.base)}.` };
  if (!target)
    return { error: `Todavía no se publicó el ${idx} de ${formatPeriod(periods.target)}.` };
  const factor = target / base;
  return { amount: round2(contract.base_rent_amount * factor), factor };
}

export function round2(n: number) {
  return Math.round(n * 100) / 100;
}

// === E4.4 — Liquidación ===
// maintenance_id: el gasto viene de un reclamo a cargo del propietario; al
// emitir la liquidación el reclamo queda enlazado (no se descuenta dos veces).
export type SettlementExpense = { description: string; amount: number; maintenance_id?: string };

export function computeSettlement(
  collectedAmount: number,
  commissionPct: number,
  expenses: SettlementExpense[],
  commissionBase = collectedAmount,
) {
  const commission = round2(commissionBase * (commissionPct / 100));
  const expensesAmount = round2(expenses.reduce((a, e) => a + (e.amount || 0), 0));
  return {
    commission,
    expensesAmount,
    net: round2(collectedAmount - commission - expensesAmount),
  };
}

// === Reparto del neto entre titulares ===
// Misma regla que rental_create_settlement_shares: cada parte se redondea
// a centavos y la diferencia va al principal, así la suma da el neto exacto.
export type OwnerShare = { name: string; pct: number; isPrimary: boolean };

export function splitNet(net: number, owners: OwnerShare[]) {
  const parts = owners.filter((o) => o.pct > 0).map((o) => ({ ...o, amount: round2((net * o.pct) / 100) }));
  const diff = round2(net - parts.reduce((sum, p) => sum + p.amount, 0));
  const primary = parts.find((p) => p.isPrimary);
  if (primary) primary.amount = round2(primary.amount + diff);
  return parts;
}

// === E4.1 — Alertas ===
// Valores por defecto; los vigentes se configuran en Ajustes (rental_settings).
export const EXPIRY_ALERT_DAYS = 90;
export const ADJUSTMENT_ALERT_DAYS = 30;
export type RentalAlertSettings = { expiryAlertDays: number; adjustmentAlertDays: number };
export const DEFAULT_ALERT_SETTINGS: RentalAlertSettings = {
  expiryAlertDays: EXPIRY_ALERT_DAYS,
  adjustmentAlertDays: ADJUSTMENT_ALERT_DAYS,
};

// === Rescisión anticipada: penalidades de referencia ===
// Sugerencias para el diálogo de cierre. Lo que vale es lo pactado en el
// contrato; estas son las reglas más usadas cuando no hay cláusula propia.
export function rescissionPenalties(rent: number, startDate: string, exitDate: string, endDate: string) {
  const firstYear = exitDate < addMonths(startDate, 12);
  // Meses de alquiler que faltaban (fracción incluida) entre la salida y el fin pactado.
  const remainingMonths = Math.max(0, daysBetween(exitDate, endDate) / 30.4375);
  return {
    lawMonths: firstYear ? 1.5 : 1,
    law: round2(rent * (firstYear ? 1.5 : 1)),
    tenPercentRemaining: round2(rent * remainingMonths * 0.1),
    remainingMonths: Math.round(remainingMonths * 10) / 10,
  };
}
