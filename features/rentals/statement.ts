import { round2 } from "@/features/rentals/logic";

// Estado de cuenta: movimientos con saldo acumulado, separados por moneda
// (un mismo contacto puede tener contratos en ARS y en USD). Sin I/O: la
// página arma los movimientos y esto ordena, filtra por año y acumula.
//
// Convención de signos por tipo de cuenta:
//   inquilino   → debe = cargo, haber = cobro; saldo > 0 = lo que debe.
//   propietario → haber = liquidación a su favor, debe = transferencia;
//                 saldo > 0 = lo que la inmobiliaria le debe.

export type StatementMovement = {
  id: string;
  date: string; // YYYY-MM-DD
  currency: string;
  description: string;
  detail?: string;
  /** Aumenta el saldo (cargo al inquilino / liquidación al propietario). */
  increase: number;
  /** Disminuye el saldo (cobro al inquilino / transferencia al propietario). */
  decrease: number;
  href?: string;
  /** El link abre un PDF (portal): ancla común en otra pestaña, no navegación de la app. */
  pdf?: boolean;
};

export type StatementRow = StatementMovement & { balance: number };

export type CurrencyStatement = {
  currency: string;
  opening: number;
  rows: StatementRow[];
  increases: number;
  decreases: number;
  closing: number;
};

// year = null: todo el historial (sin saldo inicial).
export function buildStatement(movements: StatementMovement[], year: number | null): CurrencyStatement[] {
  const from = year ? `${year}-01-01` : null;
  const to = year ? `${year}-12-31` : null;
  const currencies = [...new Set(movements.map((m) => m.currency))].sort();

  return currencies.map((currency) => {
    const own = movements
      .filter((m) => m.currency === currency)
      // Mismo día: primero lo que aumenta (el cargo antes que su cobro).
      .sort((a, b) => a.date.localeCompare(b.date) || b.increase - a.increase);
    const before = from ? own.filter((m) => m.date < from) : [];
    const inRange = own.filter((m) => (!from || m.date >= from) && (!to || m.date <= to));
    const opening = round2(before.reduce((sum, m) => sum + m.increase - m.decrease, 0));

    let balance = opening;
    const rows = inRange.map((m) => {
      balance = round2(balance + m.increase - m.decrease);
      return { ...m, balance };
    });
    return {
      currency,
      opening,
      rows,
      increases: round2(inRange.reduce((sum, m) => sum + m.increase, 0)),
      decreases: round2(inRange.reduce((sum, m) => sum + m.decrease, 0)),
      closing: balance,
    };
  });
}

// Años con movimientos, del más reciente al más viejo (para el filtro).
export function statementYears(movements: StatementMovement[]): number[] {
  return [...new Set(movements.map((m) => Number(m.date.slice(0, 4))))].sort((a, b) => b - a);
}
