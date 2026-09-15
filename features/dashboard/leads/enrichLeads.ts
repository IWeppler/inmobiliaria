import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/app/types/supabase";
import type { LeadWithDetails } from "@/app/types";

// Completa status_since / last_activity_at para un lote de leads a partir
// de status_history (E0.2) y lead_notes. Dos queries agregadas en vez de
// N+1; RLS ya filtra por dueño/admin en ambas tablas.
export async function enrichLeadsWithActivity<T extends LeadWithDetails>(
  supabase: SupabaseClient<Database>,
  leads: T[]
): Promise<T[]> {
  if (leads.length === 0) return leads;
  const ids = leads.map((l) => l.id);

  const [{ data: history }, { data: notes }] = await Promise.all([
    supabase
      .from("status_history")
      .select("entity_id, changed_at")
      .eq("entity_type", "lead")
      .in("entity_id", ids)
      .order("changed_at", { ascending: false }),
    supabase
      .from("lead_notes")
      .select("lead_id, created_at")
      .in("lead_id", ids)
      .order("created_at", { ascending: false }),
  ]);

  // Ordenado desc: la primera aparición por id es la más reciente.
  const lastStatus = new Map<string, string>();
  for (const h of history ?? []) {
    if (!lastStatus.has(h.entity_id)) lastStatus.set(h.entity_id, h.changed_at);
  }
  const lastNote = new Map<string, string>();
  for (const n of notes ?? []) {
    if (n.lead_id && !lastNote.has(n.lead_id))
      lastNote.set(n.lead_id, n.created_at);
  }

  return leads.map((lead) => {
    const statusSince = lastStatus.get(lead.id) ?? lead.created_at;
    const candidates = [lead.created_at, statusSince, lastNote.get(lead.id)]
      .filter((d): d is string => !!d)
      .map((d) => new Date(d).getTime());
    return {
      ...lead,
      status_since: statusSince,
      last_activity_at: new Date(Math.max(...candidates)).toISOString(),
    };
  });
}
