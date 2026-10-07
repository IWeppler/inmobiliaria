"use client";

import { useState } from "react";
import { APP_TZ } from "@/lib/dates";
import { ArrowRightLeft, CalendarClock, MessageSquare, StickyNote, UserPlus, type LucideIcon } from "lucide-react";
import { FaWhatsapp } from "react-icons/fa";
import { cn } from "@/lib/utils";

export type TimelineItem = {
  id: string;
  at: string;
  kind: "alta" | "estado" | "visita" | "nota" | "whatsapp";
  text: string;
};

const ICONS: Record<TimelineItem["kind"], LucideIcon | typeof FaWhatsapp> = {
  alta: UserPlus, estado: ArrowRightLeft, visita: CalendarClock, nota: StickyNote, whatsapp: FaWhatsapp,
};

// Fecha y hora en la zona de la app: igual en servidor y navegador.
const formatter = new Intl.DateTimeFormat("es-AR", {
  timeZone: APP_TZ, day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", hourCycle: "h23",
});
const when = (iso: string) => formatter.format(new Date(iso));

const FILTERS = [
  { value: "todo", label: "Todo", kinds: null },
  { value: "notas", label: "Notas", kinds: ["nota"] },
  { value: "whatsapp", label: "WhatsApp", kinds: ["whatsapp"] },
  { value: "actividad", label: "Estados y visitas", kinds: ["estado", "visita", "alta"] },
] as const;

// Historial del lead en una sola línea de tiempo: notas, mensajes de
// WhatsApp, cambios de estado, visitas y alta. Lo de sistema va en gris.
export function LeadTimeline({ items, originalMessage }: { items: TimelineItem[]; originalMessage: string | null }) {
  const [filter, setFilter] = useState<(typeof FILTERS)[number]["value"]>("todo");
  const kinds = FILTERS.find((f) => f.value === filter)?.kinds;
  const visible = kinds ? items.filter((i) => (kinds as readonly string[]).includes(i.kind)) : items;
  const counts = (k: readonly string[] | null) => (k ? items.filter((i) => k.includes(i.kind)).length : items.length);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-1">
        {FILTERS.filter((f) => f.value === "todo" || counts(f.kinds) > 0).map((f) => (
          <button key={f.value} type="button" onClick={() => setFilter(f.value)} aria-pressed={filter === f.value}
            className={cn("rounded-md px-2.5 py-1 text-xs font-medium", filter === f.value ? "bg-muted text-foreground" : "text-muted-foreground hover:text-foreground")}>
            {f.label} <span className="tabular-nums text-muted-foreground">{counts(f.kinds)}</span>
          </button>
        ))}
      </div>

      <ul className="divide-y divide-border-subtle">
        {originalMessage && filter === "todo" && (
          <li className="flex gap-3 py-3 first:pt-0">
            <MessageSquare className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden />
            <div className="min-w-0">
              <p className="text-xs text-muted-foreground">Mensaje original</p>
              <p className="whitespace-pre-wrap text-sm text-fg-secondary">{originalMessage}</p>
            </div>
          </li>
        )}
        {visible.length === 0 && <li className="py-3 text-sm text-muted-foreground">Nada para mostrar.</li>}
        {visible.map((item) => {
          const Icon = ICONS[item.kind];
          const system = item.kind === "estado" || item.kind === "visita" || item.kind === "alta";
          return (
            <li key={item.id} className="flex gap-3 py-3 first:pt-0 last:pb-0">
              <Icon className={cn("mt-0.5 size-4 shrink-0", item.kind === "whatsapp" ? "text-success" : "text-muted-foreground")} aria-hidden />
              <div className="min-w-0 flex-1">
                <p className={cn("whitespace-pre-wrap text-sm", system ? "text-muted-foreground" : "text-foreground")}>{item.text}</p>
                <p className="text-xs text-muted-foreground">{when(item.at)}</p>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
