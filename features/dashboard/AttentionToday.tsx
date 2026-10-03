import Link from "next/link";
import { daysBetween } from "@/features/dashboard/leads/leadStatus";
import { ON_TIME_MINUTES } from "@/features/dashboard/reports/responseTime";

// Alto compartido del bloque operativo del dashboard.
export const DASHBOARD_CARD_H = "h-[300px]";

export type AttentionData = {
  // Leads en NUEVO (o sin status) sin ninguna nota: nadie los tocó.
  // waitingMinutes: tiempo hábil (lun-sáb, 9 a 18 hs) desde que entró.
  untouchedLeads: { id: string; name: string; created_at: string; waitingMinutes: number }[];
  // events.type = 'visita' con fecha de hoy, vinculados a un lead.
  visitsToday: {
    id: string;
    time: string;
    title: string;
    lead_id: string | null;
  }[];
  // Propiedades activas con más de 30 días publicadas y ninguna consulta
  // en los últimos 30.
  stalledProperties: { id: string; title: string; days: number }[];
  // Alquileres: cargos vencidos con saldo (últimos 12 meses), reclamos de
  // mantenimiento abiertos y contratos activos que vencen en ≤ 30 días.
  rentals: { overdueCharges: number; openMaintenance: number; expiringContracts: number };
};

const MAX_ITEMS = 6;

// E1.4 — "Requiere tu atención". Dos listas de hasta 6 ítems; el color solo
// marca urgencia (> 7 d).
export function AttentionToday({ data }: { data: AttentionData }) {
  const { untouchedLeads, visitsToday, stalledProperties } = data;
  const empty = untouchedLeads.length === 0 && visitsToday.length === 0 && stalledProperties.length === 0;
  const total = untouchedLeads.length + visitsToday.length + stalledProperties.length;

  return (
    <div className="flex h-full min-h-0 min-w-0 flex-col">
      <div className="flex h-10 shrink-0 items-center justify-between border-b border-border-subtle px-4">
        <h3 className="text-sm font-semibold tracking-tight">Requiere tu atención</h3>
        <span className="text-xs text-muted-foreground">
          {total} pendientes
        </span>
      </div>

      {empty ? (
        <p className="flex flex-1 items-center justify-center px-4 text-sm text-muted-foreground">
          Nada pendiente para hoy.
        </p>
      ) : (
        <div className="min-h-0 flex-1 overflow-y-auto">
          <div className="flex flex-col divide-y divide-border-subtle">
          <div className="px-4 py-3">
            {untouchedLeads.length === 0 ? (
              <p className="text-sm text-muted-foreground">Ninguno.</p>
            ) : (
              <ul className="flex flex-col">
                {untouchedLeads.slice(0, MAX_ITEMS).map((l) => {
                  const days = daysBetween(l.created_at);
                  const late = days > 7 || l.waitingMinutes > ON_TIME_MINUTES;
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
                        {days > 0
                          ? `hace ${days} d`
                          : l.waitingMinutes < 1
                            ? "hoy"
                            : l.waitingMinutes < 60
                              ? `${Math.round(l.waitingMinutes)} min háb.`
                              : `${(l.waitingMinutes / 60).toLocaleString("es-AR", { maximumFractionDigits: 1 })} h háb.`}
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
              <p></p>
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
                  <li className="flex h-7 items-center text-xs text-muted-foreground">
                    y {visitsToday.length - MAX_ITEMS} más en Próximos eventos
                  </li>
                )}
              </ul>
            )}
          </div>

          {stalledProperties.length > 0 && (
            <div className="px-4 py-3">
              <h3 className="mb-1 text-xs font-medium text-muted-foreground">
                Sin consultas en 30 días · {stalledProperties.length}
              </h3>
              <ul className="flex flex-col">
                {stalledProperties.slice(0, MAX_ITEMS).map((p) => (
                  <li key={p.id} className="flex h-7 items-center justify-between gap-3 text-sm">
                    <Link
                      href={`/dashboard/propiedades/${p.id}`}
                      className="truncate font-medium text-foreground underline-offset-4 hover:underline"
                    >
                      {p.title}
                    </Link>
                    <span className="shrink-0 text-xs text-muted-foreground">publicada hace {p.days} d</span>
                  </li>
                ))}
                {stalledProperties.length > MAX_ITEMS && (
                  <li className="flex h-7 items-center text-xs text-muted-foreground">
                    y {stalledProperties.length - MAX_ITEMS} más en Propiedades
                  </li>
                )}
              </ul>
            </div>
          )}
          </div>
        </div>
      )}
    </div>
  );
}
