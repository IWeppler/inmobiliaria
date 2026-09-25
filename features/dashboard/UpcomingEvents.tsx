"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { ArrowRight, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { createClientBrowser } from "@/lib/supabase-browser";
import { addDays, ymdInAppTz } from "@/lib/dates";
import { eventTypeLabel } from "@/features/dashboard/eventTypes";
import { Button } from "@/shared/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/shared/components/ui/sheet";

export type UpcomingEvent = {
  id: string;
  date: string;
  time: string;
  title: string;
  type: string | null;
  lead_id: string | null;
  property_id: string | null;
};

// Cuántos ítems muestra el widget antes de mandar a "Ver todos".
const PREVIEW_ITEMS = 7;

type Bucket = "hoy" | "manana" | "proximos";

const BUCKET_LABEL: Record<Bucket, string> = {
  hoy: "Hoy",
  manana: "Mañana",
  proximos: "Próximos días",
};

// Día en la zona de la app (no la del servidor): las fechas de events
// vienen como timestamptz y un 00:00Z es "ayer a la noche" en Argentina.
function eventYmd(e: UpcomingEvent) {
  return ymdInAppTz(new Date(e.date));
}

function bucketOf(ymd: string): Bucket {
  const today = ymdInAppTz();
  if (ymd === today) return "hoy";
  if (ymd === addDays(today, 1)) return "manana";
  return "proximos";
}

function groupBy<K extends string>(events: UpcomingEvent[], key: (e: UpcomingEvent) => K) {
  const groups = new Map<K, UpcomingEvent[]>();
  for (const e of events) {
    const k = key(e);
    groups.set(k, [...(groups.get(k) ?? []), e]);
  }
  return [...groups.entries()];
}

function eventHref(e: UpcomingEvent) {
  if (e.lead_id) return `/dashboard/leads/${e.lead_id}`;
  if (e.property_id) return `/dashboard/propiedades/${e.property_id}`;
  return undefined;
}

function shortDate(ymd: string) {
  return format(new Date(`${ymd}T12:00:00`), "d MMM", { locale: es }).replace(".", "");
}

function longDate(ymd: string) {
  const b = bucketOf(ymd);
  if (b !== "proximos") return BUCKET_LABEL[b];
  return format(new Date(`${ymd}T12:00:00`), "EEEE d 'de' MMMM", { locale: es });
}

// "10:30 — Visita · Juan Pérez". En "Próximos días" la hora se reemplaza
// por la fecha corta ("20 sep") porque el día es lo que importa ahí.
function EventRow({
  event,
  lead,
  onDelete,
}: {
  event: UpcomingEvent;
  lead: string;
  onDelete?: (id: string) => void;
}) {
  const href = eventHref(event);
  const typeLabel = eventTypeLabel(event.type);
  return (
    <li className="group flex h-8 items-center gap-3 text-sm">
      <span className="w-14 shrink-0 tabular-nums text-muted-foreground">{lead}</span>
      <span className="min-w-0 flex-1 truncate">
        {typeLabel && <span className="font-medium text-foreground">{typeLabel}</span>}
        {typeLabel && <span className="text-muted-foreground"> · </span>}
        {href ? (
          <Link href={href} className="text-foreground underline-offset-4 hover:underline">
            {event.title}
          </Link>
        ) : (
          <span className="text-foreground">{event.title}</span>
        )}
      </span>
      {onDelete && (
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label="Eliminar evento"
          className="shrink-0 text-muted-foreground opacity-0 hover:text-danger focus-visible:opacity-100 group-hover:opacity-100"
          onClick={() => onDelete(event.id)}
        >
          <Trash2 className="size-3.5" />
        </Button>
      )}
    </li>
  );
}

// Centro de actividad de las próximas 2 semanas, agrupado por Hoy / Mañana
// / Próximos días. El widget muestra un anticipo; "Ver todos" abre la
// lista completa (por día) con opción de borrar. Reemplaza al calendario.
export function UpcomingEvents({ events: initial }: { events: UpcomingEvent[] }) {
  const supabase = createClientBrowser();
  const router = useRouter();
  const [events, setEvents] = useState(initial);
  const [allOpen, setAllOpen] = useState(false);

  const handleDelete = async (id: string) => {
    const previous = events;
    setEvents(events.filter((e) => e.id !== id));
    const { error } = await supabase.from("events").delete().eq("id", id);
    if (error) {
      setEvents(previous);
      toast.error(`No se pudo eliminar: ${error.message}`);
      return;
    }
    router.refresh();
  };

  const preview = events.slice(0, PREVIEW_ITEMS);
  const hiddenCount = events.length - preview.length;

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex h-10 shrink-0 items-center justify-between border-b border-border-subtle px-4">
        <h3 className="text-sm font-semibold tracking-tight">Próximos eventos</h3>
        {events.length > 0 && (
          <Button
            variant="ghost"
            size="sm"
            className="text-fg-secondary"
            onClick={() => setAllOpen(true)}
          >
            Ver todos{hiddenCount > 0 && ` (${events.length})`}
            <ArrowRight />
          </Button>
        )}
      </div>

      {events.length === 0 ? (
        <p className="flex flex-1 items-center justify-center px-4 text-sm text-muted-foreground">
          Nada agendado en las próximas 2 semanas.
        </p>
      ) : (
        <div className="min-h-0 flex-1 overflow-y-auto">
          {groupBy(preview, (e) => bucketOf(eventYmd(e))).map(([bucket, items]) => (
            <div key={bucket} className="border-b border-border-subtle px-4 py-2 last:border-0">
              <p className="mb-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                {BUCKET_LABEL[bucket]}
              </p>
              <ul>
                {items.map((e) => (
                  <EventRow
                    key={e.id}
                    event={e}
                    lead={bucket === "proximos" ? shortDate(eventYmd(e)) : e.time}
                  />
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}

      <Sheet open={allOpen} onOpenChange={setAllOpen}>
        <SheetContent className="w-full overflow-y-auto sm:max-w-md">
          <SheetHeader>
            <SheetTitle>Próximos eventos</SheetTitle>
            <SheetDescription>
              {events.length} {events.length === 1 ? "evento" : "eventos"} en las próximas 2 semanas.
            </SheetDescription>
          </SheetHeader>
          <div className="flex flex-col px-4 pb-4">
            {groupBy(events, eventYmd).map(([day, items]) => (
              <div key={day} className="border-b border-border-subtle py-3 last:border-0">
                <p className="mb-1 text-xs font-medium capitalize text-muted-foreground">
                  {longDate(day)}
                </p>
                <ul>
                  {items.map((e) => (
                    <EventRow key={e.id} event={e} lead={e.time} onDelete={handleDelete} />
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
