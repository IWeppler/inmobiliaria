import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/app/types/supabase";
import { SOURCE_LABELS, sourceKey } from "./reportMetrics";
import {
  businessMinutes,
  firstResponseAt,
  isMeasurable,
  summarize,
  type ResponseGroup,
  type ResponseLead,
} from "./responseTime";

const CHUNK = 100;

export type ResponseInsights = {
  overall: ResponseGroup;
  byAgent: ResponseGroup[];
  bySource: ResponseGroup[];
  // Consultas todavía sin respuesta, las que más esperan primero.
  waiting: {
    id: string;
    name: string;
    source: string;
    waitingMinutes: number;
  }[];
};

// Tiempo de primera respuesta de las consultas entrantes del período. Se
// calcula al leer: no hay tabla ni proceso. RLS limita a cada asesor a sus
// leads y a sus propias notas.
export async function loadResponseInsights(
  supabase: SupabaseClient<Database>,
  leads: (ResponseLead & { name: string })[],
  historyByLead: Map<string, { status: string; changed_at: string }[]>,
  now: Date,
): Promise<ResponseInsights> {
  const measurable = leads.filter(isMeasurable);

  // Notas escritas por un asesor (user_id presente). Las del webhook de
  // WhatsApp son mensajes del comprador y no cuentan como respuesta.
  const notesByLead = new Map<string, string[]>();
  for (let i = 0; i < measurable.length; i += CHUNK) {
    const { data } = await supabase
      .from("lead_notes")
      .select("lead_id, created_at, user_id")
      .not("user_id", "is", null)
      .in(
        "lead_id",
        measurable.slice(i, i + CHUNK).map((l) => l.id),
      );
    for (const n of data ?? []) {
      if (n.lead_id)
        notesByLead.set(n.lead_id, [
          ...(notesByLead.get(n.lead_id) ?? []),
          n.created_at,
        ]);
    }
  }

  const { data: agents } = await supabase
    .from("agents")
    .select("id, full_name");
  const agentName = new Map(
    (agents ?? []).map((a) => [a.id, a.full_name ?? "Sin nombre"]),
  );
  const sourceLabel = new Map<string, string>(
    SOURCE_LABELS.map(([k, l]) => [k, l]),
  );

  const rows = measurable.map((lead) => {
    const responded = firstResponseAt(
      lead,
      notesByLead.get(lead.id) ?? [],
      historyByLead.get(lead.id) ?? [],
    );
    const answered = responded !== null;
    const minutes = businessMinutes(
      new Date(lead.created_at),
      answered ? new Date(responded) : now,
    );
    return { lead, answered, minutes };
  });

  const group = (
    keyOf: (l: ResponseLead) => string,
    labelOf: (k: string) => string,
  ) => {
    const map = new Map<string, { minutes: number; answered: boolean }[]>();
    for (const r of rows) {
      const k = keyOf(r.lead);
      map.set(k, [
        ...(map.get(k) ?? []),
        { minutes: r.minutes, answered: r.answered },
      ]);
    }
    return [...map]
      .map(([k, samples]) => summarize(k, labelOf(k), samples))
      .sort((a, b) => b.total - a.total);
  };

  return {
    overall: summarize(
      "all",
      "Todas",
      rows.map((r) => ({ minutes: r.minutes, answered: r.answered })),
    ),
    byAgent: group(
      (l) => l.agent_id ?? "none",
      (k) => (k === "none" ? "Sin asignar" : (agentName.get(k) ?? "Asesor")),
    ),
    bySource: group(
      (l) => sourceKey(l.source),
      (k) => sourceLabel.get(k) ?? k,
    ),
    waiting: rows
      .filter((r) => !r.answered)
      .sort((a, b) => b.minutes - a.minutes)
      .slice(0, 5)
      .map((r) => ({
        id: r.lead.id,
        name: r.lead.name,
        source: sourceLabel.get(sourceKey(r.lead.source)) ?? "",
        waitingMinutes: r.minutes,
      })),
  };
}
