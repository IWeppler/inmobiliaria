import Link from "next/link";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { addDays, ymdInAppTz } from "@/lib/dates";

export type UpcomingEvent = {
  id: string;
  date: string;
  time: string;
  title: string;
  type: string | null;
  lead_id: string | null;
  property_id: string | null;
};

// Día en la zona de la app (no la del servidor): las fechas de events
// vienen como timestamptz y un 00:00Z es "ayer a la noche" en Argentina.
function dayLabel(ymd: string) {
  const today = ymdInAppTz();
  if (ymd === today) return "Hoy";
  if (ymd === addDays(today, 1)) return "Mañana";
  return format(new Date(`${ymd}T12:00:00`), "EEE d", { locale: es });
}

// Próximos 7 días agrupados por día. Reemplaza al calendario mensual en el
// dashboard: lo que hay que hacer, no un almanaque. El calendario completo
// vive en /dashboard/agenda.
export function UpcomingEvents({ events }: { events: UpcomingEvent[] }) {
  if (events.length === 0) {
    return (
      <p className="flex h-full items-center justify-center px-4 text-sm text-muted-foreground">
        Nada agendado en los próximos 7 días.
      </p>
    );
  }

  const groups = new Map<string, UpcomingEvent[]>();
  for (const e of events) {
    const key = ymdInAppTz(new Date(e.date));
    groups.set(key, [...(groups.get(key) ?? []), e]);
  }

  return (
    <div className="flex flex-col">
      {[...groups.entries()].map(([day, items]) => (
        <div key={day} className="border-b border-border-subtle px-4 py-2 last:border-0">
          <p className="mb-1 text-xs font-medium capitalize text-muted-foreground">
            {dayLabel(day)}
          </p>
          <ul>
            {items.map((e) => {
              const href = e.lead_id
                ? `/dashboard/leads/${e.lead_id}`
                : e.property_id
                  ? `/dashboard/propiedades/${e.property_id}`
                  : undefined;
              return (
                <li key={e.id} className="flex h-7 items-center gap-3 text-sm">
                  <span className="w-11 shrink-0 text-muted-foreground">{e.time}</span>
                  {href ? (
                    <Link href={href} className="truncate font-medium text-foreground underline-offset-4 hover:underline">
                      {e.title}
                    </Link>
                  ) : (
                    <span className="truncate font-medium text-foreground">{e.title}</span>
                  )}
                  {e.type === "visita" && (
                    <span className="ml-auto shrink-0 text-xs text-muted-foreground">visita</span>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </div>
  );
}
