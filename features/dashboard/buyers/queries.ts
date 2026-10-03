import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/app/types/supabase";
import {
  compareMatches,
  demandFromLead,
  scoreMatch,
  toUsd,
  type BuyerDemand,
  type MatchableProperty,
  type MatchResult,
} from "./matching";

type Client = SupabaseClient<Database>;

const DEMAND_COLUMNS =
  "search_operation, search_type_ids, search_locations, search_budget_min, search_budget_max, search_currency, search_bedrooms_min, search_bathrooms_min, search_financing, search_urgency, search_confirmed_at";

export type BuyerMatch = {
  lead: { id: string; name: string; phone: string | null; agent_id: string | null; created_at: string };
  demand: BuyerDemand;
  result: MatchResult;
  score: number;
  urgency: string | null;
};

async function usdToArs(supabase: Client) {
  const { data } = await supabase.from("exchange_rates").select("usd_to_ars").eq("id", 1).single();
  return data?.usd_to_ars ?? null;
}

// Compradores de la base que encajan con una propiedad, mejores primero.
// Con el cliente de sesión, RLS recorta a los leads del usuario; con
// service_role (notificaciones) ve toda la base.
export async function findBuyerMatches(supabase: Client, property: MatchableProperty): Promise<BuyerMatch[]> {
  const operation = (property.operation_type ?? "").toLowerCase();
  if (!operation) return [];

  const [{ data: leads }, rate] = await Promise.all([
    supabase
      .from("leads")
      .select(`id, name, phone, agent_id, created_at, ${DEMAND_COLUMNS}`)
      .eq("search_operation", operation)
      .not("status", "in", '("CERRADO","DESCARTADO")'),
    usdToArs(supabase),
  ]);

  return (leads ?? [])
    .map((lead) => {
      const demand = demandFromLead(lead);
      const result = scoreMatch(property, demand, { usdToArs: rate });
      return { lead, demand, result, score: result.score, urgency: demand.urgency };
    })
    .filter((m) => m.result.eligible)
    .sort(compareMatches);
}

export type PropertyMatch = {
  property: { id: string; title: string; city: string | null; price: number | null; currency: string | null };
  result: MatchResult;
};

// La vista inversa: propiedades disponibles que encajan con la búsqueda de un lead.
export async function findPropertyMatches(supabase: Client, demand: BuyerDemand, limit = 5): Promise<PropertyMatch[]> {
  if (!demand.operation) return [];
  const status = demand.operation === "venta" ? "EN_VENTA" : "EN_ALQUILER";

  const [{ data: properties }, rate] = await Promise.all([
    supabase
      .from("properties")
      .select("id, title, city, neighborhood, price, currency, operation_type, property_type_id, bedrooms, bathrooms")
      .eq("status", status),
    usdToArs(supabase),
  ]);

  return (properties ?? [])
    .map((property) => ({ property, result: scoreMatch(property, demand, { usdToArs: rate }) }))
    .filter((m) => m.result.eligible)
    .sort((a, b) => b.result.score - a.result.score)
    .slice(0, limit);
}

export type DemandGap = {
  operation: "venta" | "alquiler";
  zone: string; // "" = compradores sin zona definida
  buyers: number; // compradores sin ninguna propiedad que encaje
  urgent: number; // de ellos, con urgencia alta
  financed: number; // de ellos, con financiación
  budgetMedianUsd: number | null;
  supply: number; // propiedades disponibles hoy en esa zona y operación
};

const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();

// Demanda sin oferta: compradores a los que hoy no les encaja ninguna
// propiedad disponible, agrupados por operación y zona. Es lo que conviene
// salir a captar. Con el cliente de sesión, RLS limita a los leads del
// usuario; un admin ve toda la base.
export async function findDemandGaps(supabase: Client, limit = 8): Promise<DemandGap[]> {
  const [{ data: leads }, { data: properties }, rate] = await Promise.all([
    supabase
      .from("leads")
      .select(DEMAND_COLUMNS)
      .not("search_operation", "is", null)
      .not("status", "in", '("CERRADO","DESCARTADO")'),
    supabase
      .from("properties")
      .select("operation_type, property_type_id, city, neighborhood, price, currency, bedrooms, bathrooms")
      .in("status", ["EN_VENTA", "EN_ALQUILER"]),
    usdToArs(supabase),
  ]);

  const available = properties ?? [];
  const groups = new Map<string, { operation: "venta" | "alquiler"; zone: string; budgets: number[]; buyers: number; urgent: number; financed: number }>();

  for (const lead of leads ?? []) {
    const demand = demandFromLead(lead);
    const covered = available.some((p) => scoreMatch(p, demand, { usdToArs: rate }).eligible);
    if (covered) continue;

    const operation = demand.operation as "venta" | "alquiler";
    const budget = demand.budgetMax ? toUsd(demand.budgetMax, demand.currency, rate) : null;
    const zones = demand.locations.length ? demand.locations : [""];
    for (const zone of zones) {
      const key = `${operation}|${norm(zone)}`;
      const g = groups.get(key) ?? { operation, zone, budgets: [], buyers: 0, urgent: 0, financed: 0 };
      g.buyers++;
      if (demand.urgency === "alta") g.urgent++;
      if (demand.financing) g.financed++;
      if (budget) g.budgets.push(budget);
      groups.set(key, g);
    }
  }

  return [...groups.values()]
    .map((g) => {
      const sorted = [...g.budgets].sort((a, b) => a - b);
      const zoneKey = norm(g.zone);
      return {
        operation: g.operation,
        zone: g.zone,
        buyers: g.buyers,
        urgent: g.urgent,
        financed: g.financed,
        budgetMedianUsd: sorted.length ? Math.round(sorted[Math.floor(sorted.length / 2)]) : null,
        supply: available.filter(
          (p) =>
            (p.operation_type ?? "").toLowerCase() === g.operation &&
            (!zoneKey || [p.city, p.neighborhood].some((x) => x && norm(x).includes(zoneKey))),
        ).length,
      };
    })
    .sort((a, b) => b.buyers - a.buyers || b.urgent - a.urgent)
    .slice(0, limit);
}
