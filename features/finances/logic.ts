import { format } from "date-fns";
import { es } from "date-fns/locale";

export type Direction = "INGRESO" | "EGRESO";

export type Nature = "FIJO" | "VARIABLE";

// Categorías finas (lo que se carga) → grupos (lo que se grafica).
// `manual: false` = la genera el sistema (liquidación o cierre de venta),
// no se ofrece en la carga manual. `nature` = sugerencia por defecto para
// egresos; el usuario la puede cambiar.
export const CATEGORIES = {
  COMISION_ALQUILER: { direction: "INGRESO", label: "Comisión de alquiler", group: "alquileres", manual: false },
  COMISION_VENTA: { direction: "INGRESO", label: "Comisión de venta", group: "ventas", manual: false },
  VENTA_PROPIEDAD: { direction: "INGRESO", label: "Venta de propiedad propia", group: "ventas", manual: true },
  HONORARIOS: { direction: "INGRESO", label: "Honorarios (tasaciones, administración)", group: "otrosIngresos", manual: true },
  OTRO_INGRESO: { direction: "INGRESO", label: "Otro ingreso", group: "otrosIngresos", manual: true },
  SUELDOS: { direction: "EGRESO", label: "Sueldos", group: "variables", manual: true, nature: "FIJO" },
  OFICINA: { direction: "EGRESO", label: "Oficina y servicios", group: "variables", manual: true, nature: "FIJO" },
  MARKETING: { direction: "EGRESO", label: "Marketing y portales", group: "variables", manual: true, nature: "VARIABLE" },
  IMPUESTOS: { direction: "EGRESO", label: "Impuestos", group: "variables", manual: true, nature: "VARIABLE" },
  COMISION_AGENTE: { direction: "EGRESO", label: "Comisiones a agentes", group: "comisiones", manual: true, nature: "VARIABLE" },
  COMPRA_PROPIEDAD: { direction: "EGRESO", label: "Compra de propiedad", group: "inversion", manual: true, nature: "VARIABLE" },
  OBRA: { direction: "EGRESO", label: "Obra y refacciones", group: "inversion", manual: true, nature: "VARIABLE" },
  // Reclamos de alquiler a cargo de la inmobiliaria (trigger sobre rental_maintenance).
  MANTENIMIENTO: { direction: "EGRESO", label: "Mantenimiento de alquileres", group: "variables", manual: false, nature: "VARIABLE" },
  OTRO_EGRESO: { direction: "EGRESO", label: "Otro egreso", group: "variables", manual: true, nature: "VARIABLE" },
} as const satisfies Record<string, { direction: Direction; label: string; group: string; manual: boolean; nature?: Nature }>;

export type Category = keyof typeof CATEGORIES;
export const CATEGORY_KEYS = Object.keys(CATEGORIES) as Category[];
export const EXPENSE_CATEGORIES = CATEGORY_KEYS.filter((key) => CATEGORIES[key].direction === "EGRESO");

/** Categorías ofrecidas en la carga manual. */
export function categoriesFor(direction: Direction) {
  return CATEGORY_KEYS.filter((key) => CATEGORIES[key].direction === direction && CATEGORIES[key].manual);
}

export function defaultNature(category: Category): Nature {
  const meta = CATEGORIES[category];
  return "nature" in meta ? meta.nature : "VARIABLE";
}

// Ingresos en tonos de --chart-4 (jade), egresos en tonos de --chart-1
// (coral): el signo se lee por el color antes que por la posición. Los
// egresos fijos van pegados al cero y en el tono más fuerte: son el piso
// que hay que cubrir todos los meses.
const tint = (token: string, pct: number) =>
  pct === 100 ? `var(${token})` : `color-mix(in oklab, var(${token}) ${pct}%, var(--card))`;

export const GROUPS = [
  { key: "alquileres", direction: "INGRESO", label: "Alquileres", color: tint("--chart-4", 100) },
  { key: "ventas", direction: "INGRESO", label: "Ventas", color: tint("--chart-4", 65) },
  { key: "otrosIngresos", direction: "INGRESO", label: "Otros ingresos", color: tint("--chart-4", 35) },
  { key: "fijos", direction: "EGRESO", label: "Gastos fijos", color: tint("--chart-1", 100) },
  { key: "comisiones", direction: "EGRESO", label: "Comisiones", color: tint("--chart-1", 70) },
  { key: "inversion", direction: "EGRESO", label: "Compra y obra", color: tint("--chart-1", 48) },
  { key: "variables", direction: "EGRESO", label: "Otros variables", color: tint("--chart-1", 28) },
] as const;

export type GroupKey = (typeof GROUPS)[number]["key"];

export function groupOf(category: Category, nature: string | null): GroupKey {
  if (CATEGORIES[category].direction === "EGRESO" && nature === "FIJO") return "fijos";
  return CATEGORIES[category].group;
}

export type CashFlowPoint = {
  /** Primer día del mes, YYYY-MM-DD. */
  period: string;
  label: string;
  income: number;
  expense: number;
  net: number;
  groups: Record<GroupKey, number>;
};

export type MovementRow = {
  occurred_on: string;
  category: string;
  nature: string | null;
  amount: number;
  currency: string;
};

export function toArs(amount: number, currency: string, usdToArs: number) {
  return currency === "USD" ? amount * usdToArs : amount;
}

// Serie mensual en ARS. Los meses sin movimientos quedan en 0.
export function buildCashFlowSeries(
  movements: MovementRow[],
  periods: string[],
  usdToArs: number,
): CashFlowPoint[] {
  const points: CashFlowPoint[] = periods.map((period) => ({
    period,
    label: format(new Date(`${period}T12:00:00`), "MMM", { locale: es }),
    income: 0,
    expense: 0,
    net: 0,
    groups: Object.fromEntries(GROUPS.map((g) => [g.key, 0])) as Record<GroupKey, number>,
  }));
  const idx = new Map(periods.map((p, i) => [p, i]));

  for (const m of movements) {
    const i = idx.get(`${m.occurred_on.slice(0, 7)}-01`);
    const meta = CATEGORIES[m.category as Category];
    if (i === undefined || !meta) continue;
    const amount = toArs(m.amount, m.currency, usdToArs);
    const point = points[i];
    point.groups[groupOf(m.category as Category, m.nature)] += amount;
    if (meta.direction === "INGRESO") point.income += amount;
    else point.expense += amount;
  }
  for (const point of points) point.net = point.income - point.expense;

  return points;
}

export function lastPeriods(monthStart: string, months: number) {
  const [y, m] = monthStart.split("-").map(Number);
  return Array.from({ length: months }, (_, i) => {
    const d = new Date(Date.UTC(y, m - 1 - (months - 1 - i), 1));
    return d.toISOString().slice(0, 10);
  });
}

// "$ 1,2 M" / "$ 850 k" para ejes; con signo cuando hace falta.
export function compactArs(n: number) {
  const sign = n < 0 ? "−" : "";
  const a = Math.abs(n);
  if (a >= 1_000_000) return `${sign}$ ${(a / 1_000_000).toLocaleString("es-AR", { maximumFractionDigits: 1 })} M`;
  if (a >= 1_000) return `${sign}$ ${Math.round(a / 1_000).toLocaleString("es-AR")} k`;
  return `${sign}$ ${Math.round(a).toLocaleString("es-AR")}`;
}

export function fullArs(n: number) {
  const sign = n < 0 ? "−" : "";
  return `${sign}$ ${Math.round(Math.abs(n)).toLocaleString("es-AR")}`;
}
