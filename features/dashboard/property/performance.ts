// Embudo comercial de una propiedad: vistas → consultas → calificados →
// visitas → negociación. Las definiciones son fijas y se muestran en la UI:
//   Consulta     contacto único (mismo teléfono/email = una persona) que
//                preguntó por la propiedad.
//   Calificado   consulta que pasó de "Nuevo" (Contactado o más, o con visita
//                o negociación) y no quedó solo en "Descartado".
//   Visita       consulta con una visita agendada para esta propiedad
//                (evento tipo "visita" o estado "Visita programada").
//   Negociación  consulta que llegó a "Negociación" o "Cerrado".

export type Period = "30" | "90" | "todo";

// Por debajo de este número de consultas el porcentaje es ruido.
export const MIN_SAMPLE = 5;

export type LeadSignal = {
  key: string; // identidad del contacto (dedupe)
  statuses: string[]; // estado actual + historial
  hasVisitEvent: boolean;
};

export type Funnel = {
  inquiries: number;
  qualified: number;
  visits: number;
  negotiation: number;
};

const QUALIFIED = new Set([
  "CONTACTADO",
  "VISITA PROGRAMADA",
  "NEGOCIACIÓN",
  "CERRADO",
]);
const NEGOTIATION = new Set(["NEGOCIACIÓN", "CERRADO"]);

// Agrupa por contacto: una persona con dos consultas cuenta una vez, y
// alcanzó una etapa si cualquiera de sus consultas la alcanzó.
export function buildFunnel(signals: LeadSignal[]): Funnel {
  const people = new Map<string, { statuses: Set<string>; visit: boolean }>();
  for (const s of signals) {
    const p = people.get(s.key) ?? {
      statuses: new Set<string>(),
      visit: false,
    };
    s.statuses.forEach((st) => p.statuses.add(st));
    p.visit ||= s.hasVisitEvent;
    people.set(s.key, p);
  }

  const out: Funnel = {
    inquiries: people.size,
    qualified: 0,
    visits: 0,
    negotiation: 0,
  };
  for (const p of people.values()) {
    const has = (set: Set<string>) => [...p.statuses].some((st) => set.has(st));
    const negotiation = has(NEGOTIATION);
    const visit = p.visit || p.statuses.has("VISITA PROGRAMADA");
    // Haber visitado o negociado implica que hubo contacto.
    if (has(QUALIFIED) || visit || negotiation) out.qualified++;
    if (visit) out.visits++;
    if (negotiation) out.negotiation++;
  }
  return out;
}

// Porcentaje solo con muestra suficiente; si no, null (la UI muestra "—").
export function rate(part: number, whole: number): number | null {
  if (whole < MIN_SAMPLE) return null;
  return (part / whole) * 100;
}

export function periodStart(period: Period, now = new Date()): Date | null {
  if (period === "todo") return null;
  return new Date(now.getTime() - Number(period) * 86_400_000);
}

// ───────────── Benchmarks ─────────────

export function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const s = [...values].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

// Comparables mínimos para mostrar una mediana de precio por m².
export const MIN_COMPARABLES = 3;
// Ventana común para comparar conversión entre propiedades de distinta edad.
export const BENCHMARK_DAYS = 30;
// Consultas mínimas acumuladas del grupo para que su conversión valga.
export const MIN_COHORT_INQUIRIES = 10;

export type AreaBasis = "covered" | "total";

// Superficie para precio/m²: la cubierta si existe, si no la total. La base
// se guarda para comparar solo contra propiedades medidas igual.
export function areaFor(p: {
  covered_area: number | null;
  total_area: number | null;
}): { area: number; basis: AreaBasis } | null {
  if (p.covered_area && p.covered_area > 0)
    return { area: p.covered_area, basis: "covered" };
  if (p.total_area && p.total_area > 0)
    return { area: p.total_area, basis: "total" };
  return null;
}

export function diffPct(value: number, reference: number): number {
  return (value / reference - 1) * 100;
}

// ───────────── Diagnóstico ─────────────

export type Diagnosis = {
  severity: "alta" | "media" | "info";
  title: string;
  detail: string;
  // Pertenece a la gestión interna: no va en el informe al propietario.
  internal?: boolean;
};

export type DiagnosisInput = {
  windowDays: number; // días efectivos de la ventana medida
  views: number | null;
  funnel: Funnel;
  // Conversión consulta → visita de propiedades similares (null si no hay muestra).
  cohortVisitRate: number | null;
  // Diferencia % del precio/m² contra publicadas similares / cierres reales.
  activePriceDiff: number | null;
  closingPriceDiff: number | null;
};

export const MIN_WINDOW_DAYS = 14;
// "Muchas vistas y pocas consultas": desde HIGH_VIEWS vistas, menos de una
// consulta cada 1 / LOW_INQUIRY_RATE vistas (0,5 % = 1 cada 200).
export const HIGH_VIEWS = 100;
export const LOW_INQUIRY_RATE = 0.005;

// Reglas fijas y explícitas: cada alerta dice qué número la disparó. Sin
// datos suficientes no se diagnostica (mejor callar que adivinar).
export function diagnose(i: DiagnosisInput): Diagnosis[] {
  if (i.windowDays < MIN_WINDOW_DAYS) {
    return [
      {
        severity: "info",
        title: "Muy poco tiempo publicada",
        detail: `Con menos de ${MIN_WINDOW_DAYS} días no hay datos suficientes para sacar conclusiones.`,
      },
    ];
  }

  const out: Diagnosis[] = [];
  const { inquiries, visits, negotiation } = i.funnel;

  if (inquiries === 0) {
    out.push({
      severity: "alta",
      title: `Sin consultas en ${i.windowDays} días`,
      detail:
        i.views !== null && i.views >= HIGH_VIEWS
          ? `Tuvo ${i.views} vistas y ninguna consulta: conviene revisar el precio, el título y que el contacto sea visible.`
          : "Conviene revisar el precio, las fotos y el título, y reforzar la difusión.",
    });
  } else if (
    i.views !== null &&
    i.views >= HIGH_VIEWS &&
    inquiries / i.views < LOW_INQUIRY_RATE
  ) {
    out.push({
      severity: "media",
      title: "Muchas vistas y pocas consultas",
      detail: `Una consulta cada ${Math.round(i.views / inquiries)} vistas. Suele indicar precio alto, fotos o título que no convencen.`,
    });
  }

  if (inquiries >= MIN_SAMPLE && visits / inquiries < 0.1) {
    out.push({
      severity: "media",
      title: "Las consultas no llegan a visita",
      internal: true,
      detail: `${visits} visitas de ${inquiries} consultas. Conviene revisar el tiempo de respuesta y el seguimiento de cada consulta.`,
    });
  }

  if (visits >= 4 && negotiation === 0) {
    out.push({
      severity: "alta",
      title: "Visitas sin negociación",
      detail: `${visits} visitas y ninguna llegó a negociar: el precio o las expectativas pueden no estar alineados con lo que se ve en la visita.`,
    });
  }

  if (i.activePriceDiff !== null && i.activePriceDiff > 15) {
    out.push({
      severity: "media",
      title: "Precio por m² por encima de similares",
      detail: `${i.activePriceDiff.toFixed(0)}% sobre la mediana de propiedades similares publicadas.`,
    });
  }
  if (i.closingPriceDiff !== null && i.closingPriceDiff > 10) {
    out.push({
      severity: "alta",
      title: "Precio por m² por encima de cierres reales",
      detail: `${i.closingPriceDiff.toFixed(0)}% sobre lo que se cerró en la zona para propiedades similares.`,
    });
  }

  const ownRate = rate(visits, inquiries);
  if (
    ownRate !== null &&
    i.cohortVisitRate !== null &&
    ownRate < i.cohortVisitRate - 5
  ) {
    out.push({
      severity: "media",
      title: "Convierte menos que propiedades similares",
      detail: `${ownRate.toFixed(1).replace(".", ",")}% de consulta a visita contra ${i.cohortVisitRate.toFixed(1).replace(".", ",")}% de similares.`,
    });
  }

  if (out.length === 0) {
    out.push({
      severity: "info",
      title: "Sin alertas",
      detail:
        "Los números están dentro de lo esperado para el tiempo que lleva publicada.",
    });
  }
  return out;
}

// ───────────── Cambios de precio ─────────────

export type PriceChange = {
  at: string;
  from: number;
  to: number;
  currency: string | null;
  fromCurrency: string | null;
  // Variación %; null si cambió la moneda (no son comparables sin convertir).
  pct: number | null;
};

// Qué pasó en los N días antes y después de un cambio, con la misma
// duración a cada lado. Son conteos, no porcentajes: con pocas consultas un
// porcentaje engaña.
export type PriceChangeEffect = {
  days: number;
  inquiriesBefore: number;
  inquiriesAfter: number;
  viewsBefore: number | null;
  viewsAfter: number | null;
};

export const EFFECT_DAYS = 14;

// Del historial ordenado por fecha: la primera fila es el precio inicial y
// las siguientes que difieren de la anterior son cambios.
export function buildPriceChanges(
  rows: { price: number; currency: string | null; changed_at: string }[],
): PriceChange[] {
  const sorted = [...rows].sort((a, b) =>
    a.changed_at.localeCompare(b.changed_at),
  );
  const out: PriceChange[] = [];
  for (let i = 1; i < sorted.length; i++) {
    const prev = sorted[i - 1];
    const cur = sorted[i];
    if (prev.price === cur.price && prev.currency === cur.currency) continue;
    out.push({
      at: cur.changed_at,
      from: prev.price,
      to: cur.price,
      currency: cur.currency,
      fromCurrency: prev.currency,
      pct:
        prev.currency === cur.currency ? diffPct(cur.price, prev.price) : null,
    });
  }
  return out;
}
