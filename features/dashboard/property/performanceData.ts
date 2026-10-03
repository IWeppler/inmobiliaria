import "server-only";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { phoneKey } from "@/features/dashboard/buyers/duplicates";
import { toUsd } from "@/features/dashboard/buyers/matching";
import {
  BENCHMARK_DAYS,
  EFFECT_DAYS,
  buildPriceChanges,
  type PriceChange,
  type PriceChangeEffect,
  MIN_COHORT_INQUIRIES,
  MIN_COMPARABLES,
  areaFor,
  buildFunnel,
  diagnose,
  diffPct,
  median,
  periodStart,
  rate,
  type AreaBasis,
  type Diagnosis,
  type Funnel,
  type LeadSignal,
  type Period,
} from "./performance";

// Todo se calcula con service_role y se devuelve agregado (conteos y
// medianas): no expone leads de otros asesores. Quien llama ya validó la
// sesión del usuario.

const DAY = 86_400_000;
const CHUNK = 100; // ids por request (el límite es el largo de la URL)

export type PerfProperty = {
  id: string;
  operation_type: string | null;
  property_type_id: number | null;
  city: string | null;
  price: number | null;
  currency: string | null;
  covered_area: number | null;
  total_area: number | null;
  created_at: string;
  status: string;
  views_count: number | null;
};

type Signals = {
  leads: { id: string; property_id: string; created_at: string; signal: LeadSignal }[];
  events: { lead_id: string | null; property_id: string; created_at: string }[];
};

async function loadSignals(propertyIds: string[]): Promise<Signals> {
  if (propertyIds.length === 0) return { leads: [], events: [] };

  const leadRows: { id: string; property_id: string | null; phone: string | null; email: string | null; status: string | null; created_at: string }[] = [];
  const events: Signals["events"] = [];
  for (let i = 0; i < propertyIds.length; i += CHUNK) {
    const chunk = propertyIds.slice(i, i + CHUNK);
    const [{ data: l }, { data: e }] = await Promise.all([
      supabaseAdmin.from("leads").select("id, property_id, phone, email, status, created_at").in("property_id", chunk),
      supabaseAdmin.from("events").select("lead_id, property_id, created_at").eq("type", "visita").in("property_id", chunk),
    ]);
    leadRows.push(...(l ?? []));
    for (const ev of e ?? []) if (ev.property_id) events.push({ lead_id: ev.lead_id, property_id: ev.property_id, created_at: ev.created_at });
  }

  const history = new Map<string, string[]>();
  const leadIds = leadRows.map((l) => l.id);
  for (let i = 0; i < leadIds.length; i += CHUNK) {
    const { data } = await supabaseAdmin
      .from("status_history")
      .select("entity_id, status")
      .eq("entity_type", "lead")
      .in("entity_id", leadIds.slice(i, i + CHUNK));
    for (const h of data ?? []) history.set(h.entity_id, [...(history.get(h.entity_id) ?? []), h.status]);
  }

  const visitLeads = new Set(events.map((e) => e.lead_id).filter(Boolean));
  return {
    events,
    leads: leadRows
      .filter((l): l is typeof l & { property_id: string } => !!l.property_id)
      .map((l) => ({
        id: l.id,
        property_id: l.property_id,
        created_at: l.created_at,
        signal: {
          key: phoneKey(l.phone) ?? l.email?.trim().toLowerCase() ?? l.id,
          statuses: [...(history.get(l.id) ?? []), ...(l.status ? [l.status] : [])],
          hasVisitEvent: visitLeads.has(l.id),
        },
      })),
  };
}

// Embudo de una propiedad dentro de [from, to) según la fecha de la consulta.
function funnelFor(s: Signals, propertyId: string, from: Date | null, to: Date | null): Funnel {
  const inWindow = (iso: string) => {
    const t = new Date(iso).getTime();
    return (!from || t >= from.getTime()) && (!to || t < to.getTime());
  };
  const funnel = buildFunnel(s.leads.filter((l) => l.property_id === propertyId && inWindow(l.created_at)).map((l) => l.signal));
  // Visitas agendadas a mano, sin lead: una cada una.
  funnel.visits += s.events.filter((e) => e.property_id === propertyId && !e.lead_id && inWindow(e.created_at)).length;
  return funnel;
}

export type PriceStat = { median: number; n: number; diff: number };
export type Benchmarks = {
  conversion: {
    cohortProperties: number;
    cohortInquiries: number;
    cohortVisitRate: number | null;
    own: { inquiries: number; visits: number; visitRate: number | null } | null;
    note: string | null;
  };
  price: {
    usdPerM2: number;
    basis: AreaBasis;
    active: PriceStat | null;
    closings: PriceStat | null;
  } | null;
};

async function getBenchmarks(p: PerfProperty, signals: Signals, usdToArs: number | null, now: Date): Promise<Benchmarks> {
  const empty: Benchmarks = {
    conversion: { cohortProperties: 0, cohortInquiries: 0, cohortVisitRate: null, own: null, note: null },
    price: null,
  };
  if (!p.operation_type || !p.property_type_id || !p.city) return empty;

  const { data: cohort } = await supabaseAdmin
    .from("properties")
    .select("id, price, currency, covered_area, total_area, status, created_at")
    .ilike("operation_type", p.operation_type)
    .eq("property_type_id", p.property_type_id)
    .ilike("city", p.city)
    .neq("id", p.id);
  const comps = cohort ?? [];

  // ── Conversión: primeros 30 días de cada propiedad similar (±25% de precio),
  // solo las que ya cumplieron los 30 días para que la ventana esté completa.
  const ownUsd = p.price ? toUsd(p.price, p.currency, usdToArs) : null;
  const similar = comps.filter((c) => {
    if (!ownUsd || !c.price) return false;
    const usd = toUsd(c.price, c.currency, usdToArs);
    return usd !== null && usd >= ownUsd * 0.75 && usd <= ownUsd * 1.25;
  });
  const matured = similar.filter((c) => now.getTime() - new Date(c.created_at).getTime() >= BENCHMARK_DAYS * DAY);
  const cohortSignals = await loadSignals(matured.map((c) => c.id));
  let cInq = 0;
  let cVis = 0;
  for (const c of matured) {
    const start = new Date(c.created_at);
    const f = funnelFor(cohortSignals, c.id, start, new Date(start.getTime() + BENCHMARK_DAYS * DAY));
    cInq += f.inquiries;
    cVis += f.visits;
  }
  const cohortVisitRate = matured.length >= MIN_COMPARABLES && cInq >= MIN_COHORT_INQUIRIES ? (cVis / cInq) * 100 : null;

  let own: Benchmarks["conversion"]["own"] = null;
  let note: string | null = null;
  const age = now.getTime() - new Date(p.created_at).getTime();
  if (age < BENCHMARK_DAYS * DAY) {
    note = `Esta propiedad todavía no cumplió ${BENCHMARK_DAYS} días: se compara cuando complete la ventana.`;
  } else {
    const start = new Date(p.created_at);
    const f = funnelFor(signals, p.id, start, new Date(start.getTime() + BENCHMARK_DAYS * DAY));
    own = { inquiries: f.inquiries, visits: f.visits, visitRate: rate(f.visits, f.inquiries) };
  }
  if (!note && cohortVisitRate === null) {
    note = `Faltan propiedades similares con consultas suficientes (hay ${matured.length}, ${cInq} consultas).`;
  }

  // ── Precio por m²: mismo tipo, ciudad y operación, superficie ±40% y medida igual.
  let price: Benchmarks["price"] = null;
  const target = areaFor(p);
  if (target && ownUsd) {
    const usdPerM2 = ownUsd / target.area;
    const comparable = comps
      .map((c) => ({ c, a: areaFor(c) }))
      .filter(
        (x): x is { c: (typeof comps)[number]; a: NonNullable<ReturnType<typeof areaFor>> } =>
          !!x.a && x.a.basis === target.basis && x.a.area >= target.area * 0.6 && x.a.area <= target.area * 1.4,
      );

    const activeValues = comparable
      .filter((x) => (x.c.status === "EN_VENTA" || x.c.status === "EN_ALQUILER") && x.c.price)
      .map((x) => {
        const usd = toUsd(x.c.price!, x.c.currency, usdToArs);
        return usd === null ? null : usd / x.a.area;
      })
      .filter((v): v is number => v !== null);
    const activeMed = activeValues.length >= MIN_COMPARABLES ? median(activeValues) : null;

    // Cierres reales (solo ventas): precio al que se vendió, no el publicado.
    let closings: PriceStat | null = null;
    if (p.operation_type.toLowerCase() === "venta" && comparable.length) {
      const since = new Date(now.getTime() - 730 * DAY).toISOString().slice(0, 10);
      const { data: sales } = await supabaseAdmin
        .from("property_sales")
        .select("property_id, sale_price, currency, sold_on")
        .in("property_id", comparable.map((x) => x.c.id))
        .gte("sold_on", since);
      const areaById = new Map(comparable.map((x) => [x.c.id, x.a.area]));
      const values = (sales ?? [])
        .map((s) => {
          const usd = toUsd(s.sale_price, s.currency, usdToArs);
          const area = areaById.get(s.property_id);
          return usd === null || !area ? null : usd / area;
        })
        .filter((v): v is number => v !== null);
      const med = values.length >= MIN_COMPARABLES ? median(values) : null;
      if (med) closings = { median: med, n: values.length, diff: diffPct(usdPerM2, med) };
    }

    price = {
      usdPerM2,
      basis: target.basis,
      active: activeMed ? { median: activeMed, n: activeValues.length, diff: diffPct(usdPerM2, activeMed) } : null,
      closings,
    };
  }

  return {
    conversion: { cohortProperties: matured.length, cohortInquiries: cInq, cohortVisitRate, own, note },
    price,
  };
}

export type PropertyPerformance = {
  period: Period;
  funnel: Funnel;
  views: number | null;
  viewsNote: string | null;
  windowDays: number;
  daysOnMarket: number;
  benchmarks: Benchmarks;
  diagnosis: Diagnosis[] | null; // null si la propiedad no está activa
  priceChanges: (PriceChange & { effect: PriceChangeEffect | null })[];
};

const dateAR = (iso: string) => new Date(`${iso}T12:00:00`).toLocaleDateString("es-AR", { day: "numeric", month: "short" });

export async function getPropertyPerformance(p: PerfProperty, period: Period): Promise<PropertyPerformance> {
  const now = new Date();
  const start = periodStart(period, now);

  const [signals, { data: daily }, { data: rateRow }, { data: priceRows }] = await Promise.all([
    loadSignals([p.id]),
    supabaseAdmin.from("property_views_daily").select("day, views").eq("property_id", p.id).order("day", { ascending: true }),
    supabaseAdmin.from("exchange_rates").select("usd_to_ars").eq("id", 1).single(),
    supabaseAdmin.from("property_price_history").select("price, currency, changed_at").eq("property_id", p.id),
  ]);
  const usdToArs = rateRow?.usd_to_ars ?? null;

  const funnel = funnelFor(signals, p.id, start, null);

  // Vistas: "Todo" usa el acumulado; por período, la serie diaria, que
  // empieza cuando se activó el registro por día.
  const trackedSince = daily?.[0]?.day ?? null;
  let views: number | null = p.views_count ?? 0;
  let viewsNote: string | null = null;
  if (start) {
    const startDay = start.toISOString().slice(0, 10);
    views = (daily ?? []).filter((d) => d.day >= startDay).reduce((sum, d) => sum + d.views, 0);
    if (!trackedSince) {
      views = null;
      viewsNote = "El registro por día todavía no tiene datos.";
    } else if (trackedSince > startDay) {
      viewsNote = `Vistas medidas desde el ${dateAR(trackedSince)}.`;
    }
  }

  const daysOnMarket = Math.floor((now.getTime() - new Date(p.created_at).getTime()) / DAY);
  const windowDays = period === "todo" ? daysOnMarket : Math.min(Number(period), daysOnMarket);
  const benchmarks = await getBenchmarks(p, signals, usdToArs, now);
  const active = p.status === "EN_VENTA" || p.status === "EN_ALQUILER";

  // Efecto de cada cambio: consultas y vistas EFFECT_DAYS antes y después.
  // Solo cuando ya pasaron los días de la ventana posterior.
  const span = EFFECT_DAYS * DAY;
  const peopleIn = (from: number, to: number) =>
    new Set(
      signals.leads
        .filter((l) => l.property_id === p.id && new Date(l.created_at).getTime() >= from && new Date(l.created_at).getTime() < to)
        .map((l) => l.signal.key),
    ).size;
  const viewsIn = (from: number, to: number) => {
    if (!trackedSince || trackedSince > new Date(from).toISOString().slice(0, 10)) return null;
    const a = new Date(from).toISOString().slice(0, 10);
    const b = new Date(to).toISOString().slice(0, 10);
    return (daily ?? []).filter((d) => d.day >= a && d.day < b).reduce((sum, d) => sum + d.views, 0);
  };
  const priceChanges = buildPriceChanges(priceRows ?? [])
    .map((c) => {
      const t = new Date(c.at).getTime();
      const effect: PriceChangeEffect | null =
        t + span > now.getTime()
          ? null
          : {
              days: EFFECT_DAYS,
              inquiriesBefore: peopleIn(t - span, t),
              inquiriesAfter: peopleIn(t, t + span),
              viewsBefore: viewsIn(t - span, t),
              viewsAfter: viewsIn(t, t + span),
            };
      return { ...c, effect };
    })
    .reverse();

  return {
    period,
    funnel,
    views,
    viewsNote,
    windowDays,
    daysOnMarket,
    benchmarks,
    priceChanges,
    diagnosis: active
      ? diagnose({
          windowDays,
          views,
          funnel,
          cohortVisitRate: benchmarks.conversion.cohortVisitRate,
          activePriceDiff: benchmarks.price?.active?.diff ?? null,
          closingPriceDiff: benchmarks.price?.closings?.diff ?? null,
        })
      : null,
  };
}
