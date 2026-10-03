import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/app/types/supabase";
import {
  SOURCE_LABELS,
  leadJourney,
  sourceKey,
} from "@/features/dashboard/reports/reportMetrics";
import {
  loadResponseInsights,
  type ResponseInsights,
} from "@/features/dashboard/reports/responseTimeData";
import { loadSourceReturn } from "@/features/dashboard/reports/sourceReturnData";
import {
  buildLeadTrend,
  type LeadTrend,
} from "@/features/dashboard/reports/leadTrend";
import {
  buildListingConversion,
  type ListingConversion,
} from "@/features/dashboard/reports/listingConversion";
import { LOST_REASONS } from "@/features/dashboard/leads/lostReasons";

type PropertyRow = Database["public"]["Tables"]["properties"]["Row"];

export type InventoryItem = Pick<
  PropertyRow,
  | "id"
  | "title"
  | "created_at"
  | "status"
  | "operation_type"
  | "price"
  | "currency"
  | "city"
  | "neighborhood"
  | "province"
> & {
  propertyType: string | null;
};

export type SourceMetric = {
  key: string;
  label: string;
  leads: number;
  closed: number;
  conversion: number;
  visits: number;
  negotiations: number;
  // Comisión de ventas atribuidas a esta fuente, en USD.
  revenueUsd: number;
  // Costo cargado en el período, en USD. null si el usuario no es admin.
  costUsd: number | null;
};
export type DemandItem = {
  id: string;
  title: string;
  city: string | null;
  ageDays: number;
  inquiries: number;
  visits: number;
  negotiations: number;
  inquiriesLast30Days: number;
};
export type FunnelStep = {
  key: string;
  label: string;
  count: number;
  dropPercent: number | null;
};

export type ReportInsights = {
  asOf: string;
  periodDays: number | null;
  scope: {
    leads: number;
    closed: number;
    discarded: number;
    missingSteps: number;
  };
  inventory: InventoryItem[];
  sources: SourceMetric[];
  ranking: DemandItem[];
  silent: DemandItem[];
  funnel: FunnelStep[];
  response: ResponseInsights;
  unattributedRevenueUsd: number;
  // Ventana inmediatamente anterior de igual duración. Null en "Histórico".
  previous: { leads: number; closed: number } | null;
  trend: LeadTrend;
  // Motivos de los leads de la cohorte que hoy están descartados.
  lostReasons: LostReasonCount[];
  // Descartados sin motivo (anteriores a que se empezara a registrar).
  lostUnregistered: number;
  // Vistas contra consultas de la cartera activa, desde el alta.
  listings: ListingConversion;
};

export type LostReasonCount = { key: string; label: string; count: number };

const PAGE_SIZE = 1000;
async function fetchAll<T>(
  load: (
    from: number,
    to: number,
  ) => Promise<{ data: T[] | null; error: { message: string } | null }>,
): Promise<T[]> {
  const rows: T[] = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await load(from, from + PAGE_SIZE - 1);
    if (error)
      throw new Error(`No se pudieron cargar los reportes: ${error.message}`);
    rows.push(...(data ?? []));
    if (!data || data.length < PAGE_SIZE) return rows;
  }
}

export async function getReportInsights(
  supabase: SupabaseClient<Database>,
  opts: { isAdmin: boolean; userId: string; periodDays: number | null },
): Promise<ReportInsights> {
  const { isAdmin, userId, periodDays } = opts;
  const asOf = new Date();
  const periodStart =
    periodDays === null
      ? null
      : new Date(asOf.getTime() - periodDays * 86400000);
  const thirtyDaysAgo = new Date(asOf.getTime() - 30 * 86400000).getTime();
  const previousStart =
    periodDays === null || !periodStart
      ? null
      : new Date(periodStart.getTime() - periodDays * 86400000);
  const [properties, leads, propertyTypes, previousLeads] = await Promise.all([
    fetchAll(async (from, to) => {
      let query = supabase
        .from("properties")
        .select(
          "id, title, created_at, status, operation_type, price, currency, city, neighborhood, province, property_type_id, views_count",
        );
      if (!isAdmin) query = query.eq("agent_id", userId);
      const { data, error } = await query.order("id").range(from, to);
      return { data, error };
    }),
    fetchAll(async (from, to) => {
      let query = supabase
        .from("leads")
        .select(
          "id, name, property_id, status, source, created_at, created_by, agent_id, lost_reason",
        );
      if (!isAdmin) query = query.eq("agent_id", userId);
      if (periodStart)
        query = query.gte("created_at", periodStart.toISOString());
      const { data, error } = await query.order("id").range(from, to);
      return { data, error };
    }),
    fetchAll(async (from, to) => {
      const { data, error } = await supabase
        .from("property_types")
        .select("id, name")
        .order("id")
        .range(from, to);
      return { data, error };
    }),
    previousStart && periodStart
      ? fetchAll(async (from, to) => {
          let query = supabase
            .from("leads")
            .select("id, status")
            .gte("created_at", previousStart.toISOString())
            .lt("created_at", periodStart.toISOString());
          if (!isAdmin) query = query.eq("agent_id", userId);
          const { data, error } = await query.order("id").range(from, to);
          return { data, error };
        })
      : Promise.resolve(null),
  ]);

  const history: { entity_id: string; status: string; changed_at: string }[] =
    [];
  for (let offset = 0; offset < leads.length; offset += 100) {
    const ids = leads.slice(offset, offset + 100).map((lead) => lead.id);
    const batch = await fetchAll(async (from, to) => {
      const { data, error } = await supabase
        .from("status_history")
        .select("entity_id, status, changed_at")
        .eq("entity_type", "lead")
        .in("entity_id", ids)
        .order("id")
        .range(from, to);
      return { data, error };
    });
    history.push(...batch);
  }

  const historyByLead = new Map<string, typeof history>();
  for (const entry of history) {
    const entries = historyByLead.get(entry.entity_id) ?? [];
    entries.push(entry);
    historyByLead.set(entry.entity_id, entries);
  }
  const journeyByLead = new Map<string, ReturnType<typeof leadJourney>>();
  for (const lead of leads) {
    journeyByLead.set(
      lead.id,
      leadJourney(historyByLead.get(lead.id) ?? [], lead.status ?? "NUEVO"),
    );
  }

  const typeById = new Map(propertyTypes.map((type) => [type.id, type.name]));
  const inventory: InventoryItem[] = properties
    .filter((property) => ["EN_VENTA", "EN_ALQUILER"].includes(property.status))
    .map((property) => ({
      ...property,
      propertyType: property.property_type_id
        ? (typeById.get(property.property_type_id) ?? null)
        : null,
    }));

  // Vistas contra consultas: todas las consultas de cada propiedad activa
  // desde su alta, no solo las del período (las vistas son acumuladas).
  const activeProperties = properties.filter((property) =>
    ["EN_VENTA", "EN_ALQUILER"].includes(property.status),
  );
  const activeIds = activeProperties.map((property) => property.id);
  const listingLeads: {
    id: string;
    property_id: string | null;
    phone: string | null;
    email: string | null;
  }[] = [];
  for (let offset = 0; offset < activeIds.length; offset += 100) {
    const ids = activeIds.slice(offset, offset + 100);
    listingLeads.push(
      ...(await fetchAll(async (from, to) => {
        const { data, error } = await supabase
          .from("leads")
          .select("id, property_id, phone, email")
          .in("property_id", ids)
          .order("id")
          .range(from, to);
        return { data, error };
      })),
    );
  }
  const listings = buildListingConversion(activeProperties, listingLeads, asOf);

  const { data: rateRow } = await supabase
    .from("exchange_rates")
    .select("usd_to_ars")
    .eq("id", 1)
    .single();
  const sourceReturn = await loadSourceReturn(supabase, {
    isAdmin,
    periodStart,
    usdToArs: rateRow?.usd_to_ars ?? null,
  });

  const sourceCounts = new Map<
    string,
    { leads: number; closed: number; visits: number; negotiations: number }
  >();
  for (const lead of leads) {
    const key = sourceKey(lead.source);
    const current = sourceCounts.get(key) ?? {
      leads: 0,
      closed: 0,
      visits: 0,
      negotiations: 0,
    };
    const journey = journeyByLead.get(lead.id);
    current.leads += 1;
    if (lead.status === "CERRADO") current.closed += 1;
    if (journey?.reachedVisit) current.visits += 1;
    if (journey?.reachedNegotiation) current.negotiations += 1;
    sourceCounts.set(key, current);
  }
  const sources: SourceMetric[] = SOURCE_LABELS.map(([key, label]) => {
    const counts = sourceCounts.get(key) ?? {
      leads: 0,
      closed: 0,
      visits: 0,
      negotiations: 0,
    };
    return {
      key,
      label,
      ...counts,
      conversion: counts.leads ? counts.closed / counts.leads : 0,
      revenueUsd: sourceReturn.revenueBySource.get(key) ?? 0,
      costUsd: sourceReturn.costBySource
        ? (sourceReturn.costBySource.get(key) ?? 0)
        : null,
    };
  })
    .filter(
      (source) =>
        source.leads > 0 || source.revenueUsd > 0 || (source.costUsd ?? 0) > 0,
    )
    .sort((a, b) => b.leads - a.leads || a.label.localeCompare(b.label, "es"));

  const leadsByProperty = new Map<string, DemandItem>();
  for (const property of inventory) {
    leadsByProperty.set(property.id, {
      id: property.id,
      title: property.title,
      city: property.city,
      ageDays: Math.max(
        0,
        Math.floor(
          (asOf.getTime() - new Date(property.created_at).getTime()) / 86400000,
        ),
      ),
      inquiries: 0,
      visits: 0,
      negotiations: 0,
      inquiriesLast30Days: 0,
    });
  }
  for (const lead of leads) {
    if (!lead.property_id) continue;
    const item = leadsByProperty.get(lead.property_id);
    if (!item) continue;
    item.inquiries += 1;
    if (new Date(lead.created_at).getTime() >= thirtyDaysAgo)
      item.inquiriesLast30Days += 1;
    if (journeyByLead.get(lead.id)?.reachedVisit) item.visits += 1;
    if (journeyByLead.get(lead.id)?.reachedNegotiation) item.negotiations += 1;
  }
  const demand = [...leadsByProperty.values()];
  const ranking = demand
    .filter((item) => item.inquiries > 0)
    .sort((a, b) => b.inquiries - a.inquiries || b.visits - a.visits)
    .slice(0, 10);
  const silent = demand
    .filter((item) => item.ageDays >= 30 && item.inquiriesLast30Days === 0)
    .sort(
      (a, b) => b.ageDays - a.ageDays || a.title.localeCompare(b.title, "es"),
    );

  const stageLabels = [
    ["lead", "Lead"],
    ["contacted", "Contactado"],
    ["visit", "Visita programada"],
    ["negotiation", "Negociación"],
    ["closed", "Cierre"],
  ] as const;
  const funnel: FunnelStep[] = stageLabels.map(([key, label], index) => {
    const count =
      index === 0
        ? leads.length
        : leads.filter(
            (lead) => (journeyByLead.get(lead.id)?.progress ?? 0) >= index,
          ).length;
    const previous =
      index === 0
        ? null
        : index === 1
          ? leads.length
          : leads.filter(
              (lead) =>
                (journeyByLead.get(lead.id)?.progress ?? 0) >= index - 1,
            ).length;
    return {
      key,
      label,
      count,
      dropPercent:
        previous && previous > 0 ? (previous - count) / previous : null,
    };
  });

  const response = await loadResponseInsights(
    supabase,
    leads,
    historyByLead,
    asOf,
  );

  const discardedLeads = leads.filter((lead) => lead.status === "DESCARTADO");
  const lostReasons: LostReasonCount[] = LOST_REASONS.map(
    ({ value, label }) => ({
      key: value,
      label,
      count: discardedLeads.filter((lead) => lead.lost_reason === value).length,
    }),
  )
    .filter((reason) => reason.count > 0)
    .sort((a, b) => b.count - a.count);

  return {
    asOf: asOf.toISOString(),
    periodDays,
    scope: {
      leads: leads.length,
      closed: leads.filter((lead) => lead.status === "CERRADO").length,
      discarded: leads.filter((lead) => lead.status === "DESCARTADO").length,
      missingSteps: leads.filter((lead) => {
        const observed = historyByLead.get(lead.id) ?? [];
        const maxObserved = observed.some((entry) => entry.status === "CERRADO")
          ? 4
          : observed.some((entry) => entry.status === "NEGOCIACIÓN")
            ? 3
            : observed.some((entry) => entry.status === "VISITA PROGRAMADA")
              ? 2
              : observed.some((entry) => entry.status === "CONTACTADO")
                ? 1
                : 0;
        const currentStage =
          lead.status === "CERRADO"
            ? 4
            : lead.status === "NEGOCIACIÓN"
              ? 3
              : lead.status === "VISITA PROGRAMADA"
                ? 2
                : lead.status === "CONTACTADO"
                  ? 1
                  : 0;
        return (
          Math.max(maxObserved, currentStage) >
          (journeyByLead.get(lead.id)?.historicalProgress ?? 0)
        );
      }).length,
    },
    inventory,
    sources,
    ranking,
    silent,
    funnel,
    response,
    unattributedRevenueUsd: sourceReturn.unattributedUsd,
    previous: previousLeads
      ? {
          leads: previousLeads.length,
          closed: previousLeads.filter((lead) => lead.status === "CERRADO")
            .length,
        }
      : null,
    trend: buildLeadTrend(leads, { periodDays, periodStart, asOf }),
    lostReasons,
    lostUnregistered: discardedLeads.filter((lead) => !lead.lost_reason).length,
    listings,
  };
}
