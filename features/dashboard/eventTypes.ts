// Tipos de evento de la agenda (events.type). "visita" es el que ya usan
// ScheduleVisitCard, la booking pública y el funnel; el resto se agrega
// para la carga rápida desde el dashboard. Null = evento viejo sin tipo.
export const EVENT_TYPES = [
  { value: "llamada", label: "Llamada" },
  { value: "reunion", label: "Reunión" },
  { value: "visita", label: "Visita" },
  { value: "firma", label: "Firma" },
] as const;

export type EventType = (typeof EVENT_TYPES)[number]["value"];

export function eventTypeLabel(type: string | null) {
  return EVENT_TYPES.find((t) => t.value === type)?.label ?? null;
}

export function eventTypeStyle(type: string | null) {
  switch (type) {
    case "llamada": return { dot: "bg-sky-500", chip: "border-sky-200 bg-sky-50 text-sky-900 dark:border-sky-900 dark:bg-sky-950 dark:text-sky-200" };
    case "reunion": return { dot: "bg-violet-500", chip: "border-violet-200 bg-violet-50 text-violet-900 dark:border-violet-900 dark:bg-violet-950 dark:text-violet-200" };
    case "visita": return { dot: "bg-amber-500", chip: "border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-200" };
    case "firma": return { dot: "bg-emerald-500", chip: "border-emerald-200 bg-emerald-50 text-emerald-900 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-200" };
    default: return { dot: "bg-slate-400", chip: "border-border bg-muted text-foreground" };
  }
}
