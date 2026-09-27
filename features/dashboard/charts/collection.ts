import { format } from "date-fns";
import { es } from "date-fns/locale";

export type CollectionPoint = {
  /** Primer día del mes, YYYY-MM-DD. */
  period: string;
  /** Etiqueta corta del eje, ej. "sep". */
  label: string;
  /** Todo en ARS (USD convertidos con la cotización vigente). */
  expected: number;
  collected: number;
  /** Saldo impago con vencimiento ya pasado. */
  overdue: number;
  /** Saldo impago que todavía no venció. */
  pending: number;
};

export type ChargeRow = {
  period: string;
  due_date: string;
  amount: number;
  currency: string;
  rental_payment_entries: { amount: number }[];
};

// Cobranza por período del cargo (no por fecha de pago): así cada mes
// muestra qué parte de lo que se facturó ese mes ya se cobró, y lo que
// quedó impago se lee directamente como morosidad de ese mes.
export function buildCollectionSeries(
  charges: ChargeRow[],
  periods: string[],
  today: string,
  usdToArs: number,
): CollectionPoint[] {
  const points: CollectionPoint[] = periods.map((period) => ({
    period,
    label: format(new Date(`${period}T12:00:00`), "MMM", { locale: es }),
    expected: 0,
    collected: 0,
    overdue: 0,
    pending: 0,
  }));
  const idx = new Map(periods.map((p, i) => [p, i]));

  for (const charge of charges) {
    const i = idx.get(`${charge.period.slice(0, 7)}-01`);
    if (i === undefined) continue;
    const rate = charge.currency === "USD" ? usdToArs : 1;
    const amount = charge.amount * rate;
    const paid = Math.min(
      amount,
      charge.rental_payment_entries.reduce((sum, e) => sum + e.amount, 0) * rate,
    );
    const balance = amount - paid;
    const point = points[i];
    point.expected += amount;
    point.collected += paid;
    if (charge.due_date < today) point.overdue += balance;
    else point.pending += balance;
  }

  return points;
}

