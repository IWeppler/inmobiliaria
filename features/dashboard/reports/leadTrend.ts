// Evolución de leads captados en el período, agrupados por día, semana o mes
// según el largo del período. Cada lead cuenta en el tramo de su alta y se
// clasifica por su estado actual (misma cohorte que el resto de Reportes).

export type TrendGrain = "day" | "week" | "month";

export const GRAIN_NOUN: Record<TrendGrain, string> = {
  day: "día",
  week: "semana",
  month: "mes",
};

export type TrendPoint = {
  key: string;
  // Etiqueta corta del eje ("29 sep", "oct 26") y larga del tooltip.
  label: string;
  longLabel: string;
  captured: number;
  closed: number;
  discarded: number;
};

export type LeadTrend = { grain: TrendGrain; points: TrendPoint[] };

const TIME_ZONE = "America/Argentina/Buenos_Aires";
const DAY_MS = 86400000;

// Fecha calendario en Argentina como UTC a medianoche: los tramos no se
// corren por la diferencia horaria del servidor.
function localDay(date: Date) {
  const [year, month, day] = new Intl.DateTimeFormat("en-CA", {
    timeZone: TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  })
    .format(date)
    .split("-")
    .map(Number);
  return new Date(Date.UTC(year, month - 1, day));
}

function bucketStart(day: Date, grain: TrendGrain) {
  if (grain === "day") return day;
  if (grain === "month")
    return new Date(Date.UTC(day.getUTCFullYear(), day.getUTCMonth(), 1));
  // Semanas de lunes a domingo.
  const weekday = (day.getUTCDay() + 6) % 7;
  return new Date(day.getTime() - weekday * DAY_MS);
}

function nextBucket(start: Date, grain: TrendGrain) {
  if (grain === "day") return new Date(start.getTime() + DAY_MS);
  if (grain === "week") return new Date(start.getTime() + 7 * DAY_MS);
  return new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + 1, 1));
}

const format = (date: Date, options: Intl.DateTimeFormatOptions) =>
  new Intl.DateTimeFormat("es-AR", { timeZone: "UTC", ...options })
    .format(date)
    .replace(".", "");

function labels(start: Date, grain: TrendGrain) {
  if (grain === "month")
    return {
      label: format(start, { month: "short", year: "2-digit" }),
      longLabel: format(start, { month: "long", year: "numeric" }),
    };
  const short = format(start, { day: "numeric", month: "short" });
  return grain === "week"
    ? { label: short, longLabel: `Semana del ${short}` }
    : {
        label: short,
        longLabel: format(start, {
          weekday: "long",
          day: "numeric",
          month: "long",
        }),
      };
}

export function grainFor(periodDays: number | null): TrendGrain {
  if (periodDays === null || periodDays > 120) return "month";
  return periodDays > 31 ? "week" : "day";
}

export function buildLeadTrend(
  leads: { created_at: string; status: string | null }[],
  opts: { periodDays: number | null; periodStart: Date | null; asOf: Date },
): LeadTrend {
  const grain = grainFor(opts.periodDays);
  const earliest = leads.reduce<Date | null>((min, lead) => {
    const created = new Date(lead.created_at);
    return !min || created < min ? created : min;
  }, null);
  const from = opts.periodStart ?? earliest;
  if (!from) return { grain, points: [] };

  const points = new Map<string, TrendPoint>();
  const last = bucketStart(localDay(opts.asOf), grain);
  for (
    let start = bucketStart(localDay(from), grain);
    start <= last;
    start = nextBucket(start, grain)
  ) {
    const key = start.toISOString().slice(0, 10);
    points.set(key, {
      key,
      ...labels(start, grain),
      captured: 0,
      closed: 0,
      discarded: 0,
    });
  }

  for (const lead of leads) {
    const key = bucketStart(localDay(new Date(lead.created_at)), grain)
      .toISOString()
      .slice(0, 10);
    const point = points.get(key);
    if (!point) continue;
    point.captured += 1;
    if (lead.status === "CERRADO") point.closed += 1;
    if (lead.status === "DESCARTADO") point.discarded += 1;
  }

  return { grain, points: [...points.values()] };
}
