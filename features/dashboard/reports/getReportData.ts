import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { startOfMonth, subMonths } from "date-fns";
import type { Database } from "@/app/types/supabase";

// Vista analítica (E1.3 / E1.5 / E1.6 / E1.7). Todo se calcula a partir de
// status_history (E0.2), no de created_at -- created_at dice cuándo se
// cargó la entidad, no cuándo cambió de estado.

export type FunnelStage = { key: string; label: string; count: number };

export type MoneyByCurrency = Record<string, number>;

export type MonthRevenue = {
  label: string;
  deals: number;
  byCurrency: MoneyByCurrency;
};

export type LowRatioProperty = {
  id: string;
  title: string;
  views: number;
  leads: number;
  ratio: number; // leads / views
};

export type ReportData = {
  funnel: FunnelStage[];
  revenue: { current: MonthRevenue; previous: MonthRevenue };
  lowRatio: LowRatioProperty[];
  totals: {
    activeProperties: number;
    openLeads: number;
    closedDealsAllTime: number;
  };
};

// E1.7: umbrales para señalar posible problema de precio/fotos. Con menos
// de MIN_VIEWS vistas no hay muestra suficiente para opinar.
const MIN_VIEWS = 20;
const LOW_RATIO = 0.02; // 2 % = menos de 1 lead cada 50 vistas

const CLOSING_STATUSES = ["VENDIDO", "ALQUILADO"];
// Etapas del funnel de leads en orden. "Visita" cuenta cualquier lead que
// llegó a VISITA PROGRAMADA o más allá (aunque haya saltado la etapa).
const VISIT_OR_LATER = ["VISITA PROGRAMADA", "NEGOCIACIÓN", "CERRADO"];

export async function getReportData(
  supabase: SupabaseClient<Database>,
  opts: { isAdmin: boolean; userId: string }
): Promise<ReportData> {
  const { isAdmin, userId } = opts;
  const now = new Date();
  const thisMonthStart = startOfMonth(now);
  const prevMonthStart = startOfMonth(subMonths(now, 1));

  let propQuery = supabase
    .from("properties")
    .select("id, title, status, price, currency, views_count");
  let leadQuery = supabase.from("leads").select("id, property_id, status");
  if (!isAdmin) {
    propQuery = propQuery.eq("agent_id", userId);
    leadQuery = leadQuery.eq("agent_id", userId);
  }

  const [{ data: properties }, { data: leads }] = await Promise.all([
    propQuery,
    leadQuery,
  ]);
  const props = properties ?? [];
  const leadRows = leads ?? [];
  const leadIds = leadRows.map((l) => l.id);
  const propIds = props.map((p) => p.id);

  // Historial de leads (funnel) y de properties (ingresos). RLS ya limita
  // a dueño/admin; el .in() acota al mismo conjunto que las queries de
  // arriba para que agente y admin vean números consistentes.
  const [{ data: leadHistory }, { data: propHistory }] = await Promise.all([
    leadIds.length
      ? supabase
          .from("status_history")
          .select("entity_id, status")
          .eq("entity_type", "lead")
          .in("entity_id", leadIds)
      : Promise.resolve({ data: [] as { entity_id: string; status: string }[] }),
    propIds.length
      ? supabase
          .from("status_history")
          .select("entity_id, status, changed_at")
          .eq("entity_type", "property")
          .in("entity_id", propIds)
          .in("status", CLOSING_STATUSES)
          .gte("changed_at", prevMonthStart.toISOString())
      : Promise.resolve({
          data: [] as { entity_id: string; status: string; changed_at: string }[],
        }),
  ]);

  // === E1.5 Funnel ===
  const reachedVisit = new Set<string>();
  const reachedClosed = new Set<string>();
  for (const h of leadHistory ?? []) {
    if (VISIT_OR_LATER.includes(h.status)) reachedVisit.add(h.entity_id);
    if (h.status === "CERRADO") reachedClosed.add(h.entity_id);
  }
  const totalViews = props.reduce((acc, p) => acc + (p.views_count ?? 0), 0);
  const funnel: FunnelStage[] = [
    { key: "views", label: "Vistas", count: totalViews },
    { key: "leads", label: "Leads", count: leadRows.length },
    { key: "visit", label: "Visita agendada", count: reachedVisit.size },
    { key: "closed", label: "Cerrados", count: reachedClosed.size },
  ];

  // === E1.6 Ingresos mes vs. mes anterior ===
  const propById = new Map(props.map((p) => [p.id, p]));
  const emptyMonth = (label: string): MonthRevenue => ({
    label,
    deals: 0,
    byCurrency: {},
  });
  const current = emptyMonth("Este mes");
  const previous = emptyMonth("Mes anterior");
  for (const h of propHistory ?? []) {
    const p = propById.get(h.entity_id);
    if (!p) continue;
    const bucket = new Date(h.changed_at) >= thisMonthStart ? current : previous;
    const currency = p.currency ?? "USD";
    bucket.deals += 1;
    bucket.byCurrency[currency] =
      (bucket.byCurrency[currency] ?? 0) + (p.price ?? 0);
  }

  // === E1.7 Ratio vistas/leads ===
  const leadsByProp = new Map<string, number>();
  for (const l of leadRows) {
    if (l.property_id)
      leadsByProp.set(l.property_id, (leadsByProp.get(l.property_id) ?? 0) + 1);
  }
  const lowRatio: LowRatioProperty[] = props
    .filter(
      (p) =>
        (p.status === "EN_VENTA" || p.status === "EN_ALQUILER") &&
        (p.views_count ?? 0) >= MIN_VIEWS
    )
    .map((p) => {
      const views = p.views_count ?? 0;
      const count = leadsByProp.get(p.id) ?? 0;
      return { id: p.id, title: p.title, views, leads: count, ratio: count / views };
    })
    .filter((p) => p.ratio < LOW_RATIO)
    .sort((a, b) => a.ratio - b.ratio || b.views - a.views);

  return {
    funnel,
    revenue: { current, previous },
    lowRatio,
    totals: {
      activeProperties: props.filter(
        (p) => p.status === "EN_VENTA" || p.status === "EN_ALQUILER"
      ).length,
      openLeads: leadRows.filter(
        (l) => l.status !== "CERRADO" && l.status !== "DESCARTADO"
      ).length,
      closedDealsAllTime: props.filter((p) => CLOSING_STATUSES.includes(p.status))
        .length,
    },
  };
}

export const REPORT_THRESHOLDS = { MIN_VIEWS, LOW_RATIO };
