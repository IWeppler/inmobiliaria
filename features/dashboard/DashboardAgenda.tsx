"use client";

import { createContext, useContext, useMemo, useState } from "react";
import type { Dispatch, SetStateAction } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { DayButton } from "react-day-picker";
import { addMonths, format } from "date-fns";
import { es } from "date-fns/locale";
import {
  ArrowRight,
  CalendarClock,
  ChevronLeft,
  ChevronRight,
  Inbox,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { createClientBrowser } from "@/lib/supabase-browser";
import { dayStartISO, ymdInAppTz } from "@/lib/dates";
import { eventTypeLabel, eventTypeStyle } from "@/features/dashboard/eventTypes";
import { daysBetween } from "@/features/dashboard/leads/leadStatus";
import { NewEventDialog } from "@/features/dashboard/NewEventDialog";
import type { AttentionData } from "@/features/dashboard/AttentionToday";
import type { UpcomingEvent } from "@/features/dashboard/UpcomingEvents";
import { Button } from "@/shared/components/ui/button";
import { Calendar, CalendarDayButton } from "@/shared/components/ui/calendar";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/shared/components/ui/sheet";

const PREVIEW_ITEMS = 5;
const CalendarEventsContext = createContext<ReadonlyMap<string, UpcomingEvent[]>>(new Map());

function AgendaDayButton(props: React.ComponentProps<typeof DayButton>) {
  const eventsByDay = useContext(CalendarEventsContext);
  const dayEvents = eventsByDay.get(format(props.day.date, "yyyy-MM-dd")) ?? [];
  const eventTypes = dayEvents.map((event) => eventTypeLabel(event.type) ?? "Evento").join(", ");
  const label = dayEvents.length
    ? `${props["aria-label"] ?? format(props.day.date, "d 'de' MMMM", { locale: es })}: ${dayEvents.length} ${dayEvents.length === 1 ? "evento" : "eventos"} (${eventTypes})`
    : props["aria-label"];

  return (
    <CalendarDayButton
      {...props}
      aria-label={label}
      className={`${props.className ?? ""} ${dayEvents.length >= 4 ? "pb-3" : ""}`}
    >
      {props.children}
      {dayEvents.length > 0 && (
        <div className="pointer-events-none absolute inset-x-0 bottom-0.5 flex items-center justify-center" aria-hidden="true">
          {dayEvents.length >= 4 ? (
            <span className="inline-flex h-3.5 min-w-3.5 items-center justify-center rounded-full bg-foreground px-0.5 text-[8px] font-semibold leading-none text-background">
              +{dayEvents.length}
            </span>
          ) : (
            <span className="flex -space-x-0.5">
              {dayEvents.map((event) => (
                <span
                  key={event.id}
                  className={`size-1.5 rounded-full ring-1 ring-card ${eventTypeStyle(event.type).dot}`}
                />
              ))}
            </span>
          )}
        </div>
      )}
    </CalendarDayButton>
  );
}

function eventYmd(event: UpcomingEvent) {
  return ymdInAppTz(new Date(event.date));
}

function eventHref(event: UpcomingEvent) {
  if (event.lead_id) return `/dashboard/leads/${event.lead_id}`;
  if (event.property_id) return `/dashboard/propiedades/${event.property_id}`;
  return undefined;
}

function groupByDay(events: UpcomingEvent[]) {
  const groups = new Map<string, UpcomingEvent[]>();
  for (const event of events) {
    const day = eventYmd(event);
    groups.set(day, [...(groups.get(day) ?? []), event]);
  }
  return [...groups.entries()];
}

function EventRow({
  event,
  showDate,
  onDelete,
}: {
  event: UpcomingEvent;
  showDate?: boolean;
  onDelete?: (id: string) => void;
}) {
  const href = eventHref(event);
  const type = eventTypeLabel(event.type);
  const lead = showDate
    ? format(new Date(`${eventYmd(event)}T12:00:00`), "d MMM", { locale: es })
    : event.time;

  return (
    <li className="group flex min-h-9 items-center gap-2.5 text-sm">
      <span className="w-12 shrink-0 text-xs tabular-nums text-muted-foreground">
        {lead}
      </span>
      <span className="min-w-0 flex-1 truncate">
        {type && <span className="font-medium text-foreground">{type}</span>}
        {type && <span className="text-muted-foreground"> · </span>}
        {href ? (
          <Link href={href} className="underline-offset-4 hover:underline">
            {event.title}
          </Link>
        ) : (
          event.title
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
          <Trash2 />
        </Button>
      )}
    </li>
  );
}

function DashboardAttention({
  attention,
  onShowToday,
}: {
  attention: AttentionData;
  onShowToday: () => void;
}) {
  const pendingCount = attention.untouchedLeads.length + attention.visitsToday.length;

  return (
    <section className="overflow-hidden rounded-lg border border-border bg-card">
      <div className="flex h-11 items-center justify-between border-b border-border px-4">
        <h2 className="text-base font-semibold tracking-tight">
          Requiere tu atención
        </h2>
        <span className="text-xs text-muted-foreground">
          {pendingCount} pendientes
        </span>
      </div>

      <div className="divide-y divide-border-subtle">
        <div className="p-3">
          <Link
            href="/dashboard/leads?estado=NUEVO"
            className="flex items-center gap-3 rounded-md bg-muted/60 p-3 transition-colors hover:bg-muted"
          >
            <span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-card text-fg-secondary">
              <Inbox className="size-4" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-medium">Leads sin contactar</span>
              <span className="block truncate text-xs text-muted-foreground">
                {attention.untouchedLeads.length === 0
                  ? "Todo al día"
                  : `${attention.untouchedLeads.length} requieren una primera gestión`}
              </span>
            </span>
            <ArrowRight className="size-4 shrink-0 text-muted-foreground" />
          </Link>
          {attention.untouchedLeads.length > 0 && (
            <ul className="mt-2 space-y-1 px-1">
              {attention.untouchedLeads.slice(0, 2).map((lead) => (
                <li key={lead.id}>
                  <Link
                    href={`/dashboard/leads/${lead.id}`}
                    className="flex items-center justify-between gap-2 rounded px-2 py-1 text-xs hover:bg-muted/50"
                  >
                    <span className="min-w-0 truncate">{lead.name}</span>
                    <span className="shrink-0 text-muted-foreground">
                      {daysBetween(lead.created_at) === 0
                        ? "hoy"
                        : `hace ${daysBetween(lead.created_at)} d`}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="p-3">
          <button
            type="button"
            onClick={onShowToday}
            className="flex w-full items-center gap-3 rounded-md bg-muted/60 p-3 text-left transition-colors hover:bg-muted"
          >
            <span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-card text-fg-secondary">
              <CalendarClock className="size-4" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-medium">Visitas de hoy</span>
              <span className="block truncate text-xs text-muted-foreground">
                {attention.visitsToday.length === 0
                  ? "No hay visitas programadas"
                  : `${attention.visitsToday.length} ${attention.visitsToday.length === 1 ? "visita programada" : "visitas programadas"}`}
              </span>
            </span>
            <ArrowRight className="size-4 shrink-0 text-muted-foreground" />
          </button>
          {attention.visitsToday.length > 0 && (
            <ul className="mt-2 space-y-1 px-1">
              {attention.visitsToday.slice(0, 2).map((visit) => (
                <li key={visit.id}>
                  {visit.lead_id ? (
                    <Link
                      href={`/dashboard/leads/${visit.lead_id}`}
                      className="flex items-center gap-2 rounded px-2 py-1 text-xs hover:bg-muted/50"
                    >
                      <span className="shrink-0 text-muted-foreground">{visit.time}</span>
                      <span className="min-w-0 truncate">{visit.title}</span>
                    </Link>
                  ) : (
                    <button
                      type="button"
                      onClick={onShowToday}
                      className="flex w-full items-center gap-2 rounded px-2 py-1 text-left text-xs hover:bg-muted/50"
                    >
                      <span className="shrink-0 text-muted-foreground">{visit.time}</span>
                      <span className="min-w-0 truncate">{visit.title}</span>
                    </button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </section>
  );
}

export function DashboardAside({
  initialEvents,
  attention,
}: {
  initialEvents: UpcomingEvent[];
  attention: AttentionData;
}) {
  const [selectedDay, setSelectedDay] = useState<Date | undefined>();
  const today = ymdInAppTz();
  const [visibleMonth, setVisibleMonth] = useState(
    () => new Date(`${today.slice(0, 7)}-01T12:00:00`),
  );

  const showToday = () => {
    const date = new Date(`${today}T12:00:00`);
    setSelectedDay(date);
    setVisibleMonth(date);
  };

  const changeMonth = (month: Date) => {
    setSelectedDay(undefined);
    setVisibleMonth(month);
  };

  return (
    <aside className="flex min-w-0 flex-col gap-4">
      <DashboardAttention attention={attention} onShowToday={showToday} />
      <DashboardAgenda
        initialEvents={initialEvents}
        selectedDay={selectedDay}
        onSelectDay={setSelectedDay}
        visibleMonth={visibleMonth}
        onMonthChange={changeMonth}
      />
    </aside>
  );
}

function DashboardAgenda({
  initialEvents,
  selectedDay,
  onSelectDay,
  visibleMonth,
  onMonthChange,
}: {
  initialEvents: UpcomingEvent[];
  selectedDay: Date | undefined;
  onSelectDay: Dispatch<SetStateAction<Date | undefined>>;
  visibleMonth: Date;
  onMonthChange: (month: Date) => void;
}) {
  const supabase = createClientBrowser();
  const router = useRouter();
  const [events, setEvents] = useState(initialEvents);
  const [allOpen, setAllOpen] = useState(false);

  const today = ymdInAppTz();
  const calendarStart = new Date(`${today.slice(0, 7)}-01T12:00:00`);
  const [loadedMonths, setLoadedMonths] = useState(
    () =>
      new Set(
        [0, 1, 2].map((offset) =>
          format(addMonths(calendarStart, offset), "yyyy-MM"),
        ),
      ),
  );
  const [loadingMonth, setLoadingMonth] = useState<string | null>(null);
  const selectedYmd = selectedDay ? format(selectedDay, "yyyy-MM-dd") : null;
  const futureEvents = events.filter((event) => eventYmd(event) >= today);
  const selectedEvents = selectedYmd
    ? events.filter((event) => eventYmd(event) === selectedYmd)
    : futureEvents.slice(0, PREVIEW_ITEMS);
  const hiddenCount = Math.max(0, futureEvents.length - PREVIEW_ITEMS);
  const eventsByDay = useMemo(() => {
    const groups = new Map<string, UpcomingEvent[]>();
    for (const event of events) {
      const day = eventYmd(event);
      groups.set(day, [...(groups.get(day) ?? []), event]);
    }
    return groups;
  }, [events]);

  const changeMonth = async (month: Date) => {
    onMonthChange(month);
    const monthKey = format(month, "yyyy-MM");
    if (loadedMonths.has(monthKey)) return;

    setLoadingMonth(monthKey);
    const monthStart = `${monthKey}-01`;
    const nextMonthStart = format(addMonths(month, 1), "yyyy-MM-01");
    const { data, error } = await supabase
      .from("events")
      .select("id, date, time, title, type, lead_id, property_id")
      .gte("date", dayStartISO(monthStart))
      .lt("date", dayStartISO(nextMonthStart))
      .order("date", { ascending: true })
      .order("time", { ascending: true });

    if (error) {
      toast.error(`No se pudo cargar el mes: ${error.message}`);
    } else {
      setEvents((current) => {
        const byId = new Map(current.map((event) => [event.id, event]));
        for (const event of data ?? []) byId.set(event.id, event);
        return [...byId.values()].sort(
          (a, b) => a.date.localeCompare(b.date) || a.time.localeCompare(b.time),
        );
      });
      setLoadedMonths((current) => new Set(current).add(monthKey));
    }
    setLoadingMonth(null);
  };

  const handleDelete = async (id: string) => {
    const previous = events;
    setEvents(events.filter((event) => event.id !== id));
    const { error } = await supabase.from("events").delete().eq("id", id);
    if (error) {
      setEvents(previous);
      toast.error(`No se pudo eliminar: ${error.message}`);
      return;
    }
    router.refresh();
  };

  return (
    <div className="flex flex-col overflow-hidden rounded-lg border border-border bg-card">
      <div className="flex h-11 shrink-0 items-center justify-between border-b border-border px-4">
        <h2 className="text-base font-semibold tracking-tight">Agenda</h2>
        <NewEventDialog />
      </div>

      <div className="border-b border-border px-2 py-2">
        <div className="mx-auto flex w-64 max-w-full items-center justify-between">
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="Mes anterior"
            disabled={loadingMonth !== null}
            onClick={() => changeMonth(addMonths(visibleMonth, -1))}
          >
            <ChevronLeft />
          </Button>
          <span className="text-sm font-medium capitalize" aria-live="polite">
            {format(visibleMonth, "MMMM yyyy", { locale: es })}
          </span>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="Mes siguiente"
            disabled={loadingMonth !== null}
            onClick={() => changeMonth(addMonths(visibleMonth, 1))}
          >
            <ChevronRight />
          </Button>
        </div>
        <CalendarEventsContext.Provider value={eventsByDay}>
          <Calendar
            mode="single"
            selected={selectedDay}
            onSelect={onSelectDay}
            locale={es}
            weekStartsOn={1}
            month={visibleMonth}
            onMonthChange={changeMonth}
            hideNavigation
            showOutsideDays={false}
            components={{ DayButton: AgendaDayButton }}
            className="mx-auto w-fit max-w-full bg-transparent p-1 [--cell-size:--spacing(8)]"
            classNames={{ month_caption: "sr-only" }}
          />
        </CalendarEventsContext.Provider>
      </div>

      <section className="min-h-0">
        <div className="flex h-11 items-center justify-between border-b border-border-subtle px-4">
          <div className="min-w-0">
            <h3 className="truncate text-sm font-semibold tracking-tight">
              {selectedYmd
                ? format(new Date(`${selectedYmd}T12:00:00`), "d 'de' MMMM", {
                    locale: es,
                  })
                : "Próximos eventos"}
            </h3>
          </div>
          {selectedYmd ? (
            <Button
              variant="ghost"
              size="sm"
              className="-mr-2 text-fg-secondary"
              onClick={() => onSelectDay(undefined)}
            >
              Ver próximos
            </Button>
          ) : (
            futureEvents.length > 0 && (
              <Button
                variant="ghost"
                size="sm"
                className="-mr-2 text-fg-secondary"
                onClick={() => setAllOpen(true)}
              >
                Ver todos{hiddenCount > 0 && ` (${futureEvents.length})`}
                <ArrowRight />
              </Button>
            )
          )}
        </div>

        {selectedEvents.length === 0 ? (
          <p className="px-4 py-8 text-center text-sm text-muted-foreground">
            {selectedYmd
              ? "No hay eventos para este día."
              : "No hay próximos eventos."}
          </p>
        ) : (
          <ul className="divide-y divide-border-subtle px-4 py-1">
            {selectedEvents.map((event) => (
              <EventRow
                key={event.id}
                event={event}
                showDate={!selectedYmd}
              />
            ))}
          </ul>
        )}
      </section>

      <Sheet open={allOpen} onOpenChange={setAllOpen}>
        <SheetContent className="w-full overflow-y-auto sm:max-w-md">
          <SheetHeader>
            <SheetTitle>Próximos eventos</SheetTitle>
            <SheetDescription>
              {futureEvents.length}{" "}
              {futureEvents.length === 1 ? "evento programado" : "eventos programados"}.
            </SheetDescription>
          </SheetHeader>
          <div className="flex flex-col px-4 pb-4">
            {groupByDay(futureEvents).map(([day, items]) => (
              <div
                key={day}
                className="border-b border-border-subtle py-3 last:border-0"
              >
                <p className="mb-1 text-xs font-medium capitalize text-muted-foreground">
                  {format(new Date(`${day}T12:00:00`), "EEEE d 'de' MMMM", {
                    locale: es,
                  })}
                </p>
                <ul>
                  {items.map((event) => (
                    <EventRow
                      key={event.id}
                      event={event}
                      onDelete={handleDelete}
                    />
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
