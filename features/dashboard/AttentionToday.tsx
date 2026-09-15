import Link from "next/link";
import { Sparkles, CalendarClock, CheckCircle2 } from "lucide-react";
import { daysBetween } from "@/features/dashboard/leads/leadStatus";

export type AttentionData = {
  // Leads en NUEVO (o sin status) que todavía no tienen ninguna nota
  // cargada: nadie los tocó.
  untouchedLeads: { id: string; name: string; created_at: string }[];
  // events.type = 'visita' con fecha de hoy, vinculados a un lead.
  visitsToday: {
    id: string;
    time: string;
    title: string;
    lead_id: string | null;
  }[];
};

// E1.4 — Sección "Requiere tu atención hoy" del dashboard operativo.
export function AttentionToday({ data }: { data: AttentionData }) {
  const { untouchedLeads, visitsToday } = data;
  const empty = untouchedLeads.length === 0 && visitsToday.length === 0;

  return (
    <section className="bg-card rounded-md border border-border shadow-none overflow-hidden">
      <div className="py-4 px-4 border-b border-border flex items-center justify-between">
        <h3 className="font-serif font-semibold text-foreground">
          Requiere tu atención hoy
        </h3>
        <span className="text-xs bg-secondary text-secondary-foreground px-3 py-1 rounded-full font-medium">
          {untouchedLeads.length + visitsToday.length} pendientes
        </span>
      </div>

      {empty ? (
        <div className="flex items-center gap-2 p-4 text-sm text-muted-foreground">
          <CheckCircle2 className="size-4 text-emerald-700" />
          Nada pendiente. Todo al día.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-border">
          <div className="p-4">
            <h4 className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-muted-foreground mb-3">
              <Sparkles className="size-3.5" />
              Leads nuevos sin contactar ({untouchedLeads.length})
            </h4>
            {untouchedLeads.length === 0 ? (
              <p className="text-sm text-muted-foreground">Ninguno.</p>
            ) : (
              <ul className="flex flex-col gap-1.5">
                {untouchedLeads.map((l) => {
                  const days = daysBetween(l.created_at);
                  return (
                    <li key={l.id} className="flex items-center justify-between gap-2 text-sm">
                      <Link
                        href={`/dashboard/leads/${l.id}`}
                        className="font-medium hover:underline hover:text-primary truncate"
                      >
                        {l.name}
                      </Link>
                      <span className="text-xs text-muted-foreground shrink-0">
                        {days === 0 ? "hoy" : `hace ${days}d`}
                      </span>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          <div className="p-4">
            <h4 className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-muted-foreground mb-3">
              <CalendarClock className="size-3.5" />
              Visitas de hoy ({visitsToday.length})
            </h4>
            {visitsToday.length === 0 ? (
              <p className="text-sm text-muted-foreground">Ninguna.</p>
            ) : (
              <ul className="flex flex-col gap-1.5">
                {visitsToday.map((v) => (
                  <li key={v.id} className="flex items-center gap-3 text-sm">
                    <span className="tabular-nums text-muted-foreground w-12 shrink-0">
                      {v.time}
                    </span>
                    {v.lead_id ? (
                      <Link
                        href={`/dashboard/leads/${v.lead_id}`}
                        className="font-medium hover:underline hover:text-primary truncate"
                      >
                        {v.title}
                      </Link>
                    ) : (
                      <span className="font-medium truncate">{v.title}</span>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
