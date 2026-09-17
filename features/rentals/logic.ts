// Tier 4 — lógica pura de alquileres (sin I/O), compartida entre server
// actions, páginas y PDF. Fechas como "YYYY-MM-DD"; períodos como el
// primer día del mes "YYYY-MM-01".

export type AdjustmentIndex = "ICL" | "IPC" | "FIJO" | "NINGUNO";

export const ADJUSTMENT_LABELS: Record<AdjustmentIndex, string> = {
  ICL: "ICL (BCRA)",
  IPC: "IPC (INDEC)",
  FIJO: "Porcentaje fijo",
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

// Punitorio simple: % diario sobre el canon por cada día de atraso
// (desde el vencimiento hasta hoy o hasta la fecha de pago).
export function lateFee(
  p: { amount: number; due_date: string; paid_at: string | null },
  lateFeePctDaily: number,
  today: string
) {
  if (lateFeePctDaily <= 0) return 0;
  const until = p.paid_at ?? today;
  const days = daysBetween(p.due_date, until);
  if (days <= 0) return 0;
  return Math.round(p.amount * (lateFeePctDaily / 100) * days * 100) / 100;
}

// === E4.2 — Ajuste por índice ===
// Nuevo canon = canon base × (índice del período de ajuste / índice del
// período base). Con FIJO: canon × (1 + pct). Devuelve null y el motivo
// si falta algún valor de índice.
export function computeAdjustment(
  contract: {
    adjustment_index: string;
    adjustment_pct: number | null;
    base_rent_amount: number;
    base_period: string;
  },
  targetPeriod: string,
  indexValues: { index_code: string; period: string; value: number }[]
): { amount: number; factor: number } | { error: string } {
  const idx = contract.adjustment_index as AdjustmentIndex;
  if (idx === "NINGUNO") return { error: "El contrato no tiene ajuste." };
  if (idx === "FIJO") {
    const pct = contract.adjustment_pct ?? 0;
    const factor = 1 + pct / 100;
    return { amount: round2(contract.base_rent_amount * factor), factor };
  }
  const find = (period: string) =>
    indexValues.find((v) => v.index_code === idx && v.period === period)?.value;
  const base = find(contract.base_period);
  const target = find(targetPeriod);
  if (!base)
    return { error: `Falta el valor ${idx} de ${formatPeriod(contract.base_period)}.` };
  if (!target)
    return { error: `Falta el valor ${idx} de ${formatPeriod(targetPeriod)}.` };
  const factor = target / base;
  return { amount: round2(contract.base_rent_amount * factor), factor };
}

export function round2(n: number) {
  return Math.round(n * 100) / 100;
}

// === E4.4 — Liquidación ===
export type SettlementExpense = { description: string; amount: number };

export function computeSettlement(
  rentAmount: number,
  commissionPct: number,
  expenses: SettlementExpense[]
) {
  const commission = round2(rentAmount * (commissionPct / 100));
  const expensesAmount = round2(expenses.reduce((a, e) => a + (e.amount || 0), 0));
  return {
    commission,
    expensesAmount,
    net: round2(rentAmount - commission - expensesAmount),
  };
}

// === E4.1 — Alertas ===
export const EXPIRY_ALERT_DAYS = 60;
export const ADJUSTMENT_ALERT_DAYS = 30;
