import { daysBetween, money } from "@/features/rentals/logic";

// Bandeja "Hoy": tipos, riesgo del inquilino y mensajes. Lógica pura (sin
// I/O): la arma taskData.ts y la muestra TodayInbox.

export type TaskCategory = "mensajes" | "cobranzas" | "ajustes" | "liquidaciones" | "contratos" | "mantenimiento";
export type TaskUrgency = "alta" | "media" | "baja";
export type RiskLevel = "ALTO" | "MEDIO" | "BAJO" | "NUEVO";

export type TaskAction =
  | { type: "whatsapp"; label: string; phone: string; text: string; snoozeDays: number }
  | { type: "link"; label: string; href: string }
  | { type: "payout"; shareId: string; ownerName: string; amount: number; currency: string };

export type RentalTask = {
  key: string;
  category: TaskCategory;
  urgency: TaskUrgency;
  /** Mayor = más arriba en la lista. */
  score: number;
  title: string;
  detail: string;
  contractId: string;
  risk?: RiskLevel;
  actions: TaskAction[];
};

export const CATEGORY_LABELS: Record<TaskCategory, string> = {
  mensajes: "Mensajes",
  cobranzas: "Cobranzas",
  ajustes: "Ajustes",
  liquidaciones: "Liquidaciones",
  contratos: "Contratos",
  mantenimiento: "Mantenimiento",
};

export const RISK_LABELS: Record<RiskLevel, string> = {
  ALTO: "Riesgo alto",
  MEDIO: "Suele atrasarse",
  BAJO: "Paga a tiempo",
  NUEVO: "Sin historial",
};

// === Riesgo de mora por contrato ===
// Mira las últimas 6 cuotas de alquiler vencidas: cuántos días tardó en
// pagarlas (o cuántos lleva, si siguen impagas). Sin IA: un promedio y un
// conteo de atrasos alcanzan para ordenar la bandeja y anticiparse.
export type RentHistoryCharge = { due_date: string; amount: number; entries: { amount: number; paid_at: string }[] };

export function paymentRisk(charges: RentHistoryCharge[], today: string): { level: RiskLevel; avgDaysLate: number } {
  const recent = charges.filter((c) => c.due_date < today).sort((a, b) => b.due_date.localeCompare(a.due_date)).slice(0, 6);
  if (recent.length < 2) return { level: "NUEVO", avgDaysLate: 0 };

  const lateness = recent.map((charge) => {
    // Fecha en la que se completó el pago: el cobro que cubre el total.
    let paid = 0;
    let settledOn: string | null = null;
    for (const entry of [...charge.entries].sort((a, b) => a.paid_at.localeCompare(b.paid_at))) {
      paid += entry.amount;
      if (paid + 0.005 >= charge.amount) { settledOn = entry.paid_at; break; }
    }
    return Math.max(0, daysBetween(charge.due_date, settledOn ?? today));
  });
  const avgDaysLate = Math.round(lateness.reduce((sum, d) => sum + d, 0) / lateness.length);
  const lateCount = lateness.filter((d) => d > 5).length;
  const openLongOverdue = lateness.some((d, i) => d > 30 && !recent[i].entries.length);

  const level: RiskLevel = openLongOverdue || avgDaysLate > 15 ? "ALTO" : avgDaysLate > 3 || lateCount >= 2 ? "MEDIO" : "BAJO";
  return { level, avgDaysLate };
}

// === Mensajes sugeridos ===
// El tono depende de la situación: recordatorio amable, reclamo cordial o
// reclamo firme. El agente puede editarlo en WhatsApp antes de enviar.
export function debtMessage(input: {
  tenantName: string; propertyTitle: string; amounts: [string, number][]; oldestDue: string; daysLate: number; risk: RiskLevel;
}) {
  const total = input.amounts.map(([currency, amount]) => money(amount, currency)).join(" + ");
  const firstName = input.tenantName.split(" ")[0] ?? input.tenantName;
  if (input.daysLate > 30 || input.risk === "ALTO") {
    return `Hola ${firstName}, te escribimos por el alquiler de ${input.propertyTitle}: hay un saldo vencido de ${total}, el más antiguo del ${formatShort(input.oldestDue)}. Necesitamos regularizarlo esta semana para evitar más punitorios. ¿Cuándo podés hacer el pago? Si hay algún inconveniente, contanos y lo vemos.`;
  }
  if (input.daysLate > 7) {
    return `Hola ${firstName}, ¿cómo estás? Te recordamos que quedó pendiente ${total} del alquiler de ${input.propertyTitle} (venció el ${formatShort(input.oldestDue)}). ¿Nos confirmás cuándo podés transferir? ¡Gracias!`;
  }
  return `Hola ${firstName}, ¿cómo estás? Te escribimos porque todavía no registramos el pago de ${total} del alquiler de ${input.propertyTitle}, que venció el ${formatShort(input.oldestDue)}. Si ya lo hiciste, mandanos el comprobante y lo imputamos. ¡Gracias!`;
}

export function upcomingMessage(input: { tenantName: string; propertyTitle: string; amount: number; currency: string; dueDate: string }) {
  const firstName = input.tenantName.split(" ")[0] ?? input.tenantName;
  return `Hola ${firstName}, ¿cómo estás? Te recordamos que el ${formatShort(input.dueDate)} vence el alquiler de ${input.propertyTitle} por ${money(input.amount, input.currency)}. Cualquier consulta, escribinos. ¡Gracias!`;
}

export function adjustmentMessage(input: { name: string; propertyTitle: string; effectiveDate: string; amount: number; currency: string }) {
  const firstName = input.name.split(" ")[0] ?? input.name;
  return `Hola ${firstName}, te informamos que desde el ${formatShort(input.effectiveDate)} el alquiler de ${input.propertyTitle} pasa a ser de ${money(input.amount, input.currency)}, según el ajuste pactado en el contrato. Cualquier consulta, escribinos.`;
}

function formatShort(ymd: string) {
  const [y, m, d] = ymd.split("-");
  return `${d}/${m}/${y}`;
}

export function phoneDigits(phone: string | null | undefined) {
  const digits = phone?.replace(/\D/g, "") ?? "";
  return digits.length >= 8 ? digits : null;
}
