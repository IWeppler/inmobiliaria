import { addDays } from "@/lib/dates";

// Indicadores de la cartera de alquileres, en plata y no en cantidad de
// cuotas: cuánto se emitió en el período y cuánto se cobró (confirmado),
// lo vencido, lo que vence en los próximos días y la ocupación. Puro: lo
// usan la portada de Alquileres y sus pruebas.

export type KpiCharge = {
  contract_id: string; period: string; due_date: string; amount: number; currency: string;
  paid: number;
};

type ByCurrency = Map<string, number>;

const add = (map: ByCurrency, currency: string, amount: number) => map.set(currency, (map.get(currency) ?? 0) + amount);
const toArs = (map: ByCurrency, usdToArs: number) =>
  [...map].reduce((sum, [currency, amount]) => sum + amount * (currency === "USD" ? usdToArs : 1), 0);

export const DUE_SOON_DAYS = 7;

export function portfolioKpis({ charges, today, period, usdToArs, toVerify, occupancy }: {
  charges: KpiCharge[];
  today: string;
  /** Primer día del período en curso, YYYY-MM-01. */
  period: string;
  usdToArs: number;
  /** Pagos informados (portal o WhatsApp) todavía sin confirmar. */
  toVerify: { amount: number | null; currency: string }[];
  occupancy: { rentable: number; occupied: number };
}) {
  const issued: ByCurrency = new Map();
  const collected: ByCurrency = new Map();
  const overdue: ByCurrency = new Map();
  const dueSoon: ByCurrency = new Map();
  const overdueContracts = new Set<string>();
  let dueSoonCount = 0;
  let nextDue: string | null = null;
  const horizon = addDays(today, DUE_SOON_DAYS);

  for (const c of charges) {
    const paid = Math.min(c.paid, c.amount);
    const balance = c.amount - paid;
    if (c.period.slice(0, 7) === period.slice(0, 7)) {
      add(issued, c.currency, c.amount);
      add(collected, c.currency, paid);
    }
    if (balance <= 0.005) continue;
    if (c.due_date < today) {
      add(overdue, c.currency, balance);
      overdueContracts.add(c.contract_id);
    } else if (c.due_date <= horizon) {
      add(dueSoon, c.currency, balance);
      dueSoonCount += 1;
      if (!nextDue || c.due_date < nextDue) nextDue = c.due_date;
    }
  }

  // Efectividad sobre el total en pesos (los USD a la cotización vigente),
  // para que la cartera mixta tenga un solo porcentaje.
  const issuedArs = toArs(issued, usdToArs);
  const verify: ByCurrency = new Map();
  for (const v of toVerify) if (v.amount) add(verify, v.currency, v.amount);

  return {
    period: { issued, collected, rate: issuedArs > 0 ? Math.round((toArs(collected, usdToArs) / issuedArs) * 100) : null },
    overdue: { amounts: overdue, contracts: overdueContracts.size },
    dueSoon: { amounts: dueSoon, count: dueSoonCount, next: nextDue },
    toVerify: { count: toVerify.length, amounts: verify },
    occupancy: {
      ...occupancy,
      available: Math.max(0, occupancy.rentable - occupancy.occupied),
      rate: occupancy.rentable > 0 ? Math.round((occupancy.occupied / occupancy.rentable) * 100) : null,
    },
  };
}
