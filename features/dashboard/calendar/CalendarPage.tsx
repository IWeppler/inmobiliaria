"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { addMonths, endOfMonth, endOfWeek, format, startOfMonth, startOfWeek } from "date-fns";
import { es } from "date-fns/locale";
import { ChevronLeft, ChevronRight, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { createClientBrowser } from "@/lib/supabase-browser";
import { addDays, dayStartISO, ymdInAppTz } from "@/lib/dates";
import { EVENT_TYPES, eventTypeLabel, eventTypeStyle } from "@/features/dashboard/eventTypes";
import { NewEventDialog } from "@/features/dashboard/NewEventDialog";
import type { UpcomingEvent } from "@/features/dashboard/UpcomingEvents";
import { Button } from "@/shared/components/ui/button";
import { PageHeader } from "@/shared/components/PageShell";
import { cn } from "@/lib/utils";

type View = "dia" | "semana" | "mes" | "agenda";
const VIEWS: { key: View; label: string }[] = [
  { key: "dia", label: "Día" }, { key: "semana", label: "Semana" },
  { key: "mes", label: "Mes" }, { key: "agenda", label: "Agenda" },
];
const WEEKDAYS = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];

function localDate(ymd: string) { return new Date(`${ymd}T12:00:00`); }
function localYmd(date: Date) { return format(date, "yyyy-MM-dd"); }
function eventYmd(event: UpcomingEvent) { return ymdInAppTz(new Date(event.date)); }
function eventHref(event: UpcomingEvent) {
  if (event.lead_id) return `/dashboard/leads/${event.lead_id}`;
  if (event.property_id) return `/dashboard/propiedades/${event.property_id}`;
  return null;
}
function sortEvents(events: UpcomingEvent[]) { return [...events].sort((a, b) => a.date.localeCompare(b.date) || a.time.localeCompare(b.time)); }

function EventCard({ event, compact = false, onDelete }: { event: UpcomingEvent; compact?: boolean; onDelete?: (id: string) => void }) {
  const href = eventHref(event);
  const style = eventTypeStyle(event.type);
  return (
    <div className={cn("group flex min-w-0 items-start gap-2 rounded-md border px-2.5 py-2", style.chip, compact && "px-2 py-1.5 text-xs")}>
      <span className={cn("mt-1 size-2 shrink-0 rounded-full", style.dot)} />
      <div className="min-w-0 flex-1">
        <p className="truncate font-medium">{event.time.slice(0, 5)} · {event.title}</p>
        {!compact && <p className="text-xs opacity-75">{eventTypeLabel(event.type) ?? "Sin clasificar"}</p>}
      </div>
      {href && <Link href={href} className="shrink-0 text-xs underline underline-offset-2">Ver</Link>}
      {onDelete && <button type="button" aria-label={`Eliminar ${event.title}`} onClick={() => onDelete(event.id)} className="shrink-0 opacity-60 hover:opacity-100"><Trash2 className="size-3.5" /></button>}
    </div>
  );
}

export function CalendarPage() {
  const supabase = useMemo(() => createClientBrowser(), []);
  const router = useRouter();
  const today = ymdInAppTz();
  const [view, setView] = useState<View>("mes");
  const [selectedDay, setSelectedDay] = useState(today);
  const [events, setEvents] = useState<UpcomingEvent[]>([]);
  const [upcoming, setUpcoming] = useState<UpcomingEvent[]>([]);
  const [loading, setLoading] = useState(true);

  const range = useMemo(() => {
    const date = localDate(selectedDay);
    if (view === "dia") return { start: selectedDay, end: addDays(selectedDay, 1) };
    if (view === "semana") {
      const start = localYmd(startOfWeek(date, { weekStartsOn: 1 }));
      return { start, end: addDays(start, 7) };
    }
    const start = localYmd(startOfWeek(startOfMonth(date), { weekStartsOn: 1 }));
    const end = addDays(localYmd(endOfWeek(endOfMonth(date), { weekStartsOn: 1 })), 1);
    return view === "agenda" ? { start: localYmd(startOfMonth(date)), end: localYmd(addMonths(startOfMonth(date), 1)) } : { start, end };
  }, [selectedDay, view]);

  useEffect(() => {
    let active = true;
    async function load() {
      const rows: UpcomingEvent[] = [];
      setLoading(true);
      for (let from = 0; ; from += 1000) {
        const { data, error } = await supabase.from("events")
          .select("id, date, time, title, type, lead_id, property_id")
          .gte("date", dayStartISO(range.start)).lt("date", dayStartISO(range.end))
          .order("date").order("time").range(from, from + 999);
        if (!active) return;
        if (error) { toast.error(`No se pudo cargar el calendario: ${error.message}`); break; }
        rows.push(...(data ?? []));
        if (!data || data.length < 1000) break;
      }
      if (active) { setEvents(rows); setLoading(false); }
    }
    void load();
    return () => { active = false; };
  }, [supabase, range.start, range.end]);

  useEffect(() => {
    let active = true;
    async function loadUpcoming() {
      const { data, error } = await supabase.from("events")
        .select("id, date, time, title, type, lead_id, property_id")
        .gte("date", dayStartISO(today)).lt("date", dayStartISO(addDays(today, 31)))
        .order("date").order("time").limit(200);
      if (!active) return;
      if (error) toast.error(`No se pudieron cargar los próximos eventos: ${error.message}`);
      else setUpcoming(data ?? []);
    }
    void loadUpcoming();
    return () => { active = false; };
  }, [supabase, today]);

  const byDay = useMemo(() => {
    const map = new Map<string, UpcomingEvent[]>();
    for (const event of sortEvents(events)) {
      const day = eventYmd(event);
      map.set(day, [...(map.get(day) ?? []), event]);
    }
    return map;
  }, [events]);
  const days: string[] = [];
  for (let day = range.start; day < range.end; day = addDays(day, 1)) days.push(day);
  const periodLabel = view === "dia" ? format(localDate(selectedDay), "EEEE d 'de' MMMM yyyy", { locale: es })
    : view === "semana" ? `${format(localDate(range.start), "d MMM", { locale: es })} – ${format(localDate(addDays(range.end, -1)), "d MMM yyyy", { locale: es })}`
    : format(localDate(selectedDay), "MMMM yyyy", { locale: es });

  const navigate = (direction: -1 | 1) => {
    if (view === "mes" || view === "agenda") setSelectedDay(localYmd(addMonths(localDate(selectedDay), direction)));
    else setSelectedDay(addDays(selectedDay, direction * (view === "semana" ? 7 : 1)));
  };
  const selectDay = (day: string) => { setSelectedDay(day); setView("dia"); };
  const onCreated = (event: UpcomingEvent) => {
    if (eventYmd(event) >= range.start && eventYmd(event) < range.end) setEvents((current) => sortEvents([...current, event]));
    if (eventYmd(event) >= today && eventYmd(event) < addDays(today, 31)) setUpcoming((current) => sortEvents([...current, event]));
  };
  const onDelete = async (id: string) => {
    const { error } = await supabase.from("events").delete().eq("id", id);
    if (error) { toast.error(`No se pudo eliminar el evento: ${error.message}`); return; }
    setEvents((current) => current.filter((event) => event.id !== id));
    setUpcoming((current) => current.filter((event) => event.id !== id));
    toast.success("Evento eliminado.");
    router.refresh();
  };

  return <>
    <PageHeader title="Calendario" description="Organizá visitas, llamadas, reuniones y firmas." actions={<NewEventDialog initialDate={selectedDay >= today ? selectedDay : today} onCreated={onCreated} />} />
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="flex items-center gap-2">
        <Button variant="outline" size="sm" onClick={() => setSelectedDay(today)}>Hoy</Button>
        <Button variant="outline" size="icon-sm" aria-label="Período anterior" onClick={() => navigate(-1)}><ChevronLeft /></Button>
        <Button variant="outline" size="icon-sm" aria-label="Período siguiente" onClick={() => navigate(1)}><ChevronRight /></Button>
        <h2 className="ml-1 text-base font-semibold capitalize" aria-live="polite">{periodLabel}</h2>
      </div>
      <div role="group" aria-label="Vista del calendario" className="flex rounded-md border bg-card p-1">
        {VIEWS.map((option) => <Button key={option.key} size="sm" variant={view === option.key ? "secondary" : "ghost"} aria-pressed={view === option.key} onClick={() => setView(option.key)}>{option.label}</Button>)}
      </div>
    </div>
    <div className={cn("grid min-w-0 gap-4", (view === "semana" || view === "mes") && "xl:grid-cols-[minmax(0,1fr)_280px]")}>
      <div className="min-w-0 overflow-hidden rounded-lg border bg-card">
        {loading && <p className="border-b px-4 py-2 text-xs text-muted-foreground">Cargando eventos…</p>}
        {view === "mes" && <div className="overflow-x-auto"><div className="min-w-[700px]">
          <div className="grid grid-cols-7 border-b bg-muted/30">{WEEKDAYS.map((day) => <span key={day} className="px-2 py-2 text-center text-xs font-medium text-muted-foreground">{day}</span>)}</div>
          <div className="grid grid-cols-7">{days.map((day) => {
            const dayEvents = byDay.get(day) ?? [];
            return <div key={day} className={cn("min-h-32 border-b border-r p-2 last:border-r-0", day.slice(0, 7) !== selectedDay.slice(0, 7) && "bg-muted/20")}>
              <button type="button" onClick={() => selectDay(day)} aria-label={`Ver ${day}`} className={cn("mb-1 flex size-7 items-center justify-center rounded-full text-sm hover:bg-muted", day === today && "bg-primary text-primary-foreground hover:bg-primary")}>{Number(day.slice(-2))}</button>
              <div className="space-y-1">{dayEvents.slice(0, 3).map((event) => <EventCard key={event.id} event={event} compact />)}{dayEvents.length > 3 && <button type="button" onClick={() => selectDay(day)} className="text-xs text-primary hover:underline">+{dayEvents.length - 3} más</button>}</div>
            </div>;
          })}</div>
        </div></div>}
        {view === "semana" && <div className="overflow-x-auto"><div className="grid min-w-[700px] grid-cols-7 divide-x">{days.map((day) => <section key={day} className="min-h-[430px] p-2.5">
          <button type="button" onClick={() => selectDay(day)} className={cn("mb-3 block w-full rounded-md px-1 py-2 text-center text-sm hover:bg-muted", day === today && "bg-primary/10 text-primary")}><span className="block text-xs capitalize">{format(localDate(day), "EEE", { locale: es })}</span><span className="text-lg font-semibold">{Number(day.slice(-2))}</span></button>
          <div className="space-y-2">{(byDay.get(day) ?? []).map((event) => <EventCard key={event.id} event={event} compact />)}</div>
        </section>)}</div></div>}
        {view === "dia" && <div className="divide-y">{(byDay.get(selectedDay) ?? []).length ? (byDay.get(selectedDay) ?? []).map((event) => <div key={event.id} className="grid grid-cols-[70px_1fr] gap-3 px-4 py-3"><span className="pt-2 text-sm tabular-nums text-muted-foreground">{event.time.slice(0, 5)}</span><EventCard event={event} onDelete={onDelete} /></div>) : <p className="p-10 text-center text-sm text-muted-foreground">No hay eventos para este día.</p>}</div>}
        {view === "agenda" && <div className="divide-y">{[...byDay.entries()].length ? [...byDay.entries()].map(([day, dayEvents]) => <section key={day} className="grid gap-3 p-4 md:grid-cols-[160px_1fr]"><button type="button" onClick={() => selectDay(day)} className="text-left text-sm font-semibold capitalize hover:underline">{format(localDate(day), "EEEE d MMMM", { locale: es })}</button><div className="space-y-2">{dayEvents.map((event) => <EventCard key={event.id} event={event} onDelete={onDelete} />)}</div></section>) : <p className="p-10 text-center text-sm text-muted-foreground">No hay eventos en este mes.</p>}</div>}
      </div>
      {(view === "mes" || view === "semana") && <aside className="space-y-4">
        <section className="rounded-lg border bg-card p-4"><h3 className="font-semibold">Próximos eventos</h3><p className="mt-1 text-xs text-muted-foreground">Siguientes 30 días</p><div className="mt-4 max-h-[480px] space-y-3 overflow-auto">{upcoming.length ? upcoming.map((event) => <div key={event.id}><p className="mb-1 text-xs capitalize text-muted-foreground">{format(localDate(eventYmd(event)), "EEE d MMM", { locale: es })}</p><EventCard event={event} compact onDelete={onDelete} /></div>) : <p className="text-sm text-muted-foreground">No hay próximos eventos.</p>}</div></section>
        <section className="rounded-lg border bg-card p-4"><h3 className="text-sm font-semibold">Tipos de evento</h3><div className="mt-3 grid grid-cols-2 gap-2 text-xs">{EVENT_TYPES.map((type) => <span key={type.value} className="flex items-center gap-2"><span className={cn("size-2.5 rounded-full", eventTypeStyle(type.value).dot)} />{type.label}</span>)}<span className="flex items-center gap-2"><span className={cn("size-2.5 rounded-full", eventTypeStyle(null).dot)} />Sin clasificar</span></div></section>
      </aside>}
    </div>
  </>;
}
