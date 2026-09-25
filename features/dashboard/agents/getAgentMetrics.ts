import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/app/types/supabase";

type Db = SupabaseClient<Database>;
type Lead = Pick<Database["public"]["Tables"]["leads"]["Row"], "id" | "name" | "agent_id" | "status" | "created_at">;
type History = { entity_id: string; status: string; changed_at: string };
type Note = { lead_id: string | null; created_at: string };

export type AgentMetric = {
  id: string;
  assigned: number;
  contacted: number;
  visitedStage: number;
  negotiating: number;
  closed: number;
  pastVisits: number;
  captured: number;
  meanResponseMinutes: number | null;
  responseSample: number;
  commissions: { ARS: number; USD: number };
  openLeads: { id: string; name: string; lastActivityAt: string }[];
};

const PAGE = 1000;
const RANK: Record<string, number> = { NUEVO: 0, CONTACTADO: 1, "VISITA PROGRAMADA": 2, "NEGOCIACIÓN": 3, CERRADO: 4 };

async function all<T>(load: (from: number, to: number) => Promise<{ data: T[] | null; error: { message: string } | null }>): Promise<T[]> {
  const rows: T[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await load(from, from + PAGE - 1);
    if (error) throw new Error(`No se pudieron calcular las métricas de agentes: ${error.message}`);
    rows.push(...(data ?? []));
    if (!data || data.length < PAGE) return rows;
  }
}

export async function getAgentMetrics(db: Db, agentIds: string[]): Promise<AgentMetric[]> {
  const metrics = new Map<string, AgentMetric>(agentIds.map((id) => [id, {
    id, assigned: 0, contacted: 0, visitedStage: 0, negotiating: 0, closed: 0,
    pastVisits: 0, captured: 0, meanResponseMinutes: null, responseSample: 0,
    commissions: { ARS: 0, USD: 0 }, openLeads: [],
  } satisfies AgentMetric]));
  if (!agentIds.length) return [];

  const [leads, properties, events, contracts, settlements] = await Promise.all([
    all(async (from, to) => { const { data, error } = await db.from("leads").select("id, name, agent_id, status, created_at").order("id").range(from, to); return { data, error }; }),
    all(async (from, to) => {
      const { data, error } = await db.from("properties").select("id, captured_by").order("id").range(from, to);
      if (error?.code === "42703" || error?.code === "PGRST204") return { data: [], error: null };
      return { data, error };
    }),
    all(async (from, to) => { const { data, error } = await db.from("events").select("id, agent_id, lead_id, type, date").eq("type", "visita").order("id").range(from, to); return { data, error }; }),
    all(async (from, to) => { const { data, error } = await db.from("rental_contracts").select("id, agent_id").order("id").range(from, to); return { data, error }; }),
    all(async (from, to) => { const { data, error } = await db.from("rental_settlements").select("id, contract_id, currency, commission_amount").order("id").range(from, to); return { data, error }; }),
  ]);

  const history: History[] = [];
  const notes: Note[] = [];
  for (let offset = 0; offset < leads.length; offset += 100) {
    const ids = leads.slice(offset, offset + 100).map((lead) => lead.id);
    const [batchHistory, batchNotes] = await Promise.all([
      all(async (from, to) => { const { data, error } = await db.from("status_history").select("entity_id, status, changed_at").eq("entity_type", "lead").in("entity_id", ids).order("id").range(from, to); return { data, error }; }),
      all(async (from, to) => { const { data, error } = await db.from("lead_notes").select("lead_id, created_at").in("lead_id", ids).order("id").range(from, to); return { data, error }; }),
    ]);
    history.push(...batchHistory);
    notes.push(...batchNotes);
  }

  const historyByLead = new Map<string, History[]>();
  for (const item of history) historyByLead.set(item.entity_id, [...(historyByLead.get(item.entity_id) ?? []), item]);
  const lastNote = new Map<string, number>();
  for (const note of notes) if (note.lead_id) lastNote.set(note.lead_id, Math.max(lastNote.get(note.lead_id) ?? 0, Date.parse(note.created_at)));
  const responseMinutes = new Map<string, number[]>();

  for (const lead of leads as Lead[]) {
    if (!lead.agent_id) continue;
    const metric = metrics.get(lead.agent_id);
    if (!metric) continue;
    metric.assigned++;
    const entries = historyByLead.get(lead.id) ?? [];
    const stage = Math.max(RANK[lead.status ?? "NUEVO"] ?? 0, ...entries.map((entry) => RANK[entry.status] ?? 0));
    if (stage >= 1) metric.contacted++;
    if (stage >= 2) metric.visitedStage++;
    if (stage >= 3) metric.negotiating++;
    if (stage >= 4) metric.closed++;

    const createdAt = Date.parse(lead.created_at);
    const firstContact = Math.min(...entries.filter((entry) => entry.status === "CONTACTADO").map((entry) => Date.parse(entry.changed_at)).filter((time) => time > createdAt));
    if (Number.isFinite(firstContact)) responseMinutes.set(metric.id, [...(responseMinutes.get(metric.id) ?? []), (firstContact - createdAt) / 60000]);

    if (lead.status !== "CERRADO" && lead.status !== "DESCARTADO") {
      const lastActivity = Math.max(createdAt, lastNote.get(lead.id) ?? 0, ...entries.map((entry) => Date.parse(entry.changed_at)));
      metric.openLeads.push({ id: lead.id, name: lead.name, lastActivityAt: new Date(lastActivity).toISOString() });
    }
  }

  for (const property of properties) if (property.captured_by) { const metric = metrics.get(property.captured_by); if (metric) metric.captured++; }
  const now = Date.now();
  for (const event of events) if (Date.parse(event.date) < now && event.agent_id) { const metric = metrics.get(event.agent_id); if (metric) metric.pastVisits++; }
  const contractAgent = new Map(contracts.map((contract) => [contract.id, contract.agent_id]));
  for (const settlement of settlements) {
    const agentId = contractAgent.get(settlement.contract_id);
    const metric = agentId ? metrics.get(agentId) : null;
    if (!metric) continue;
    if (settlement.currency === "ARS" || settlement.currency === "USD") metric.commissions[settlement.currency] += settlement.commission_amount;
  }
  for (const metric of metrics.values()) {
    const responses = responseMinutes.get(metric.id) ?? [];
    metric.responseSample = responses.length;
    metric.meanResponseMinutes = responses.length ? responses.reduce((sum, value) => sum + value, 0) / responses.length : null;
    metric.openLeads.sort((a, b) => a.lastActivityAt.localeCompare(b.lastActivityAt));
  }
  return [...metrics.values()];
}
