import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/app/types/supabase";
import { toUsd } from "@/features/dashboard/buyers/matching";
import { sourceKey } from "./reportMetrics";

const CHUNK = 100;

type Candidate = {
  leadId: string;
  source: string | null;
  closedAt: string | null;
  negotiatedAt: string | null;
};

// A qué lead se le atribuye una venta: el que la cerró (el cierre más
// cercano a la fecha de venta); si ninguno figura cerrado, el que llegó más
// tarde a negociación. Sin evidencia no se atribuye: mejor "sin fuente" que
// regalarle la venta a un portal al azar.
export function attributeSale(
  candidates: Candidate[],
  soldOn: string,
): Candidate | null {
  const sold = new Date(`${soldOn}T12:00:00Z`).getTime();
  const closed = candidates
    .filter((c) => c.closedAt)
    .sort(
      (a, b) =>
        Math.abs(new Date(a.closedAt!).getTime() - sold) -
        Math.abs(new Date(b.closedAt!).getTime() - sold),
    );
  if (closed[0]) return closed[0];
  const negotiated = candidates
    .filter((c) => c.negotiatedAt)
    .sort((a, b) => b.negotiatedAt!.localeCompare(a.negotiatedAt!));
  return negotiated[0] ?? null;
}

export type SourceReturn = {
  revenueBySource: Map<string, number>; // comisión de ventas en USD
  unattributedUsd: number;
  costBySource: Map<string, number> | null; // null si el usuario no es admin
};

// Ingresos por fuente (comisiones de ventas del período) y costos cargados.
// RLS decide qué ventas y leads ve cada usuario: un agente ve solo lo suyo y
// nunca los costos.
export async function loadSourceReturn(
  supabase: SupabaseClient<Database>,
  opts: { isAdmin: boolean; periodStart: Date | null; usdToArs: number | null },
): Promise<SourceReturn> {
  const { isAdmin, periodStart, usdToArs } = opts;
  const out: SourceReturn = {
    revenueBySource: new Map(),
    unattributedUsd: 0,
    costBySource: null,
  };

  let salesQuery = supabase
    .from("property_sales")
    .select("property_id, sold_on, commission_amount, currency");
  if (periodStart)
    salesQuery = salesQuery.gte(
      "sold_on",
      periodStart.toISOString().slice(0, 10),
    );
  const { data: sales } = await salesQuery;

  const propertyIds = [...new Set((sales ?? []).map((s) => s.property_id))];
  const leads: {
    id: string;
    property_id: string | null;
    source: string | null;
    status: string | null;
  }[] = [];
  for (let i = 0; i < propertyIds.length; i += CHUNK) {
    const { data } = await supabase
      .from("leads")
      .select("id, property_id, source, status")
      .in("property_id", propertyIds.slice(i, i + CHUNK));
    leads.push(...(data ?? []));
  }

  const closedAt = new Map<string, string>();
  const negotiatedAt = new Map<string, string>();
  for (let i = 0; i < leads.length; i += CHUNK) {
    const { data } = await supabase
      .from("status_history")
      .select("entity_id, status, changed_at")
      .eq("entity_type", "lead")
      .in("status", ["CERRADO", "NEGOCIACIÓN"])
      .in(
        "entity_id",
        leads.slice(i, i + CHUNK).map((l) => l.id),
      );
    for (const h of data ?? []) {
      const target = h.status === "CERRADO" ? closedAt : negotiatedAt;
      if (!target.has(h.entity_id) || h.changed_at > target.get(h.entity_id)!)
        target.set(h.entity_id, h.changed_at);
    }
  }

  for (const sale of sales ?? []) {
    const usd = toUsd(sale.commission_amount, sale.currency, usdToArs);
    if (usd === null) continue;
    const candidates: Candidate[] = leads
      .filter((l) => l.property_id === sale.property_id)
      .map((l) => ({
        leadId: l.id,
        source: l.source,
        // Cerrado sin historial (anterior al registro): se asume cerrado en la venta.
        closedAt:
          closedAt.get(l.id) ??
          (l.status === "CERRADO" ? `${sale.sold_on}T12:00:00Z` : null),
        negotiatedAt: negotiatedAt.get(l.id) ?? null,
      }));
    const winner = attributeSale(candidates, sale.sold_on);
    if (!winner) {
      out.unattributedUsd += usd;
      continue;
    }
    const key = sourceKey(winner.source);
    out.revenueBySource.set(key, (out.revenueBySource.get(key) ?? 0) + usd);
  }

  if (isAdmin) {
    out.costBySource = new Map();
    let costQuery = supabase
      .from("lead_source_costs")
      .select("source, amount, currency");
    if (periodStart) {
      const firstMonth = new Date(
        Date.UTC(periodStart.getUTCFullYear(), periodStart.getUTCMonth(), 1),
      );
      costQuery = costQuery.gte("month", firstMonth.toISOString().slice(0, 10));
    }
    const { data: costs } = await costQuery;
    for (const c of costs ?? []) {
      const usd = toUsd(c.amount, c.currency, usdToArs);
      if (usd !== null)
        out.costBySource.set(
          c.source,
          (out.costBySource.get(c.source) ?? 0) + usd,
        );
    }
  }
  return out;
}
