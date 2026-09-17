import Link from "next/link";
import { daysBetween } from "@/features/dashboard/leads/leadStatus";

// Alto compartido de las dos cards operativas del dashboard.
export const DASHBOARD_CARD_H = "h-[300px]";

export type AttentionData = {
  // Leads en NUEVO (o sin status) sin ninguna nota: nadie los tocó.
  untouchedLeads: { id: string; name: string; created_at: string }[];
  // events.type = 'visita' con fecha de hoy, vinculados a un lead.
  visitsToday: {
    id: string;
    time: string;
    title: string;
    lead_id: string | null;
  }[];
};

const MAX_ITEMS = 6;

// E1.4 — "Requiere tu atención". Alto fijo compartido con "Próximos 7 días"
// (ver DASHBOARD_CARD_H); dos listas de hasta 6 ítems con scroll interno si
// hay más. El conteo va en el título; el color solo marca urgencia (> 7 d).
export function AttentionToday({ data }: { data: AttentionData }) {
  const { untouchedLeads, visitsToday } = data;
  const empty = untouchedLeads.length === 0 && visitsToday.length === 0;
  const total = untouchedLeads.length + visitsToday.length;

  if (empty) {
    return (
      <section className={`${DASHBOARD_CARD_H} flex min-w-0 flex-col overflow-hidden rounded-lg border border-border bg-card`}>
        <div className="flex h-11 shrink-0 items-center border-b border-border px-4">
          <h2 className="text-base font-semibold tracking-tight">Requiere tu atención</h2>
        </div>
        <p className="flex flex-1 items-center justify-center text-sm text-muted-foreground">Nada pendiente para hoy.</p>
      </section>
    );
  }

  return (
    <section className="flex min-w-0 flex-col overflow-hidden rounded-lg border border-border bg-card">
      <div className="flex h-11 shrink-0 items-center justify-between border-b border-border px-4">
        <h2 className="text-base font-semibold tracking-tight">Requiere tu atención</h2>
        <span className="text-xs text-muted-foreground">{total} pendientes</span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 md:divide-x md:divide-border">
          <div className="px-4 py-3">
            <h3 className="mb-1 text-xs font-medium text-muted-foreground">
              Leads sin contactar · {untouchedLeads.length}
            </h3>
            {untouchedLeads.length === 0 ? (
              <p className="text-sm text-muted-foreground">Ninguno.</p>
            ) : (
              <ul className="flex flex-col">
                {untouchedLeads.slice(0, MAX_ITEMS).map((l) => {
                  const days = daysBetween(l.created_at);
                  const late = days > 7;
                  return (
                    <li
                      key={l.id}
                      className="flex h-7 items-center justify-between gap-3 text-sm"
                    >
                      <Link
                        href={`/dashboard/leads/${l.id}`}
                        className="truncate font-medium text-foreground underline-offset-4 hover:underline"
                      >
                        {l.name}
                      </Link>
                      <span
                        className={
                          late
                            ? "shrink-0 text-xs font-medium text-warning"
                            : "shrink-0 text-xs text-muted-foreground"
                        }
                      >
                        {days === 0 ? "hoy" : `hace ${days} d`}
                      </span>
                    </li>
                  );
                })}
                {untouchedLeads.length > MAX_ITEMS && (
                  <li className="flex h-7 items-center text-xs">
                    <Link
                      href="/dashboard/leads?estado=NUEVO"
                      className="text-fg-secondary underline-offset-4 hover:underline"
                    >
                      Ver los {untouchedLeads.length} en Leads
                    </Link>
                  </li>
                )}
              </ul>
            )}
          </div>

          <div className="px-4 py-3">
            <h3 className="mb-1 text-xs font-medium text-muted-foreground">
              Visitas de hoy · {visitsToday.length}
            </h3>
            {visitsToday.length === 0 ? (
              <p className="text-sm text-muted-foreground">Ninguna.</p>
            ) : (
              <ul className="flex flex-col">
                {visitsToday.slice(0, MAX_ITEMS).map((v) => (
                  <li key={v.id} className="flex h-7 items-center gap-3 text-sm">
                    <span className="w-12 shrink-0 text-muted-foreground">
                      {v.time}
                    </span>
                    {v.lead_id ? (
                      <Link
                        href={`/dashboard/leads/${v.lead_id}`}
                        className="truncate font-medium text-foreground underline-offset-4 hover:underline"
                      >
                        {v.title}
                      </Link>
                    ) : (
                      <span className="truncate font-medium">{v.title}</span>
                    )}
                  </li>
                ))}
                {visitsToday.length > MAX_ITEMS && (
                  <li className="flex h-7 items-center text-xs">
                    <Link href="/dashboard/agenda" className="text-fg-secondary underline-offset-4 hover:underline">
                      Ver las {visitsToday.length} en Agenda
                    </Link>
                  </li>
                )}
              </ul>
            )}
          </div>
      </div>
    </section>
  );
}
