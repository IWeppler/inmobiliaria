"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { AlarmClock, Banknote, CalendarClock, CheckCircle2, Inbox, TrendingUp, Wrench, type LucideIcon } from "lucide-react";
import { FaWhatsapp } from "react-icons/fa";
import { Button } from "@/shared/components/ui/button";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/shared/components/ui/dropdown-menu";
import { StatusBadge, type StatusTone } from "@/shared/components/StatusBadge";
import { cn } from "@/lib/utils";
import { PayoutButton } from "@/features/rentals/PayoutButton";
import { clearSnoozesAction, snoozeTaskAction } from "@/features/rentals/taskActions";
import { useRunAction } from "@/features/rentals/useRunAction";
import {
  CATEGORY_LABELS, RISK_LABELS, type RentalTask, type RiskLevel, type TaskCategory, type TaskUrgency,
} from "@/features/rentals/tasks";

const CATEGORY_ICONS: Record<TaskCategory, LucideIcon> = {
  mensajes: Inbox,
  cobranzas: Banknote, ajustes: TrendingUp, liquidaciones: CheckCircle2, contratos: CalendarClock, mantenimiento: Wrench,
};
const URGENCY_STYLE: Record<TaskUrgency, string> = {
  alta: "text-danger", media: "text-warning", baja: "text-muted-foreground",
};
const RISK_TONE: Record<RiskLevel, StatusTone> = { ALTO: "danger", MEDIO: "warning", BAJO: "success", NUEVO: "neutral" };

// Bandeja "Hoy": todo lo que requiere al agente, ordenado por prioridad, y
// cada tarea con su acción a un clic. Las tareas se cierran solas cuando
// cambia el dato (se paga, se liquida...); las de seguimiento se posponen.
export function TodayInbox({ tasks, snoozed, today }: { tasks: RentalTask[]; snoozed: number; today: string }) {
  const { busy, run } = useRunAction();
  const [category, setCategory] = useState<TaskCategory | "todas">("todas");

  const counts = useMemo(() => {
    const map = new Map<TaskCategory, number>();
    for (const task of tasks) map.set(task.category, (map.get(task.category) ?? 0) + 1);
    return map;
  }, [tasks]);
  const visible = category === "todas" ? tasks : tasks.filter((t) => t.category === category);
  const urgent = tasks.filter((t) => t.urgency === "alta").length;

  const snooze = (task: RentalTask, days: number, reason?: string) =>
    run(`snooze-${task.key}`, () => snoozeTaskAction({ key: task.key, days, reason }));

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <FilterChip active={category === "todas"} onClick={() => setCategory("todas")} label="Todas" count={tasks.length} />
        {(Object.keys(CATEGORY_LABELS) as TaskCategory[]).filter((c) => counts.get(c)).map((c) => (
          <FilterChip key={c} active={category === c} onClick={() => setCategory(c)} label={CATEGORY_LABELS[c]} count={counts.get(c) ?? 0} />
        ))}
        <span className="ml-auto text-sm text-muted-foreground">
          {urgent > 0 && <span className="font-medium text-danger">{urgent} {urgent === 1 ? "urgente" : "urgentes"} · </span>}
          {snoozed > 0 && (
            <button type="button" className="underline-offset-4 hover:underline" disabled={!!busy}
              onClick={() => run("clear", clearSnoozesAction)}>
              {snoozed} {snoozed === 1 ? "pospuesta" : "pospuestas"}
            </button>
          )}
        </span>
      </div>

      {visible.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border px-4 py-14 text-center">
          <CheckCircle2 className="mx-auto size-8 text-success" aria-hidden />
          <p className="mt-3 font-medium">Todo al día</p>
          <p className="mt-1 text-sm text-muted-foreground">
            {tasks.length === 0 ? "No hay nada pendiente en los alquileres que administrás." : "No hay tareas en esta categoría."}
          </p>
        </div>
      ) : (
        <ul className="divide-y divide-border-subtle overflow-hidden rounded-lg border border-border bg-card">
          {visible.map((task) => {
            const Icon = CATEGORY_ICONS[task.category];
            return (
              <li key={task.key} className="flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center">
                <div className="flex min-w-0 flex-1 items-start gap-3">
                  <Icon className={cn("mt-0.5 size-4 shrink-0", URGENCY_STYLE[task.urgency])} aria-hidden />
                  <div className="min-w-0">
                    <p className="flex flex-wrap items-center gap-2 text-sm font-medium">
                      <span>{task.title}</span>
                      {task.risk && task.risk !== "BAJO" && <StatusBadge tone={RISK_TONE[task.risk]}>{RISK_LABELS[task.risk]}</StatusBadge>}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {task.detail} · <Link href={`/dashboard/alquileres/${task.contractId}`} className="underline-offset-4 hover:underline">ver contrato</Link>
                    </p>
                  </div>
                </div>
                <div className="flex shrink-0 flex-wrap items-center gap-2 pl-7 sm:pl-0">
                  {task.actions.map((action, index) => {
                    if (action.type === "whatsapp") {
                      return (
                        <Button key={index} asChild size="sm" variant={index === 0 ? "default" : "outline"}>
                          {/* Al abrir WhatsApp se pospone: el agente ya hizo el seguimiento. */}
                          <a href={`https://wa.me/${action.phone}?text=${encodeURIComponent(action.text)}`} target="_blank" rel="noopener noreferrer"
                            onClick={() => void snooze(task, action.snoozeDays, `WhatsApp: ${action.label}`)}>
                            <FaWhatsapp className="size-4" aria-hidden /> {action.label}
                          </a>
                        </Button>
                      );
                    }
                    if (action.type === "payout") {
                      return <PayoutButton key={index} today={today} share={{
                        id: action.shareId, ownerName: action.ownerName, amount: action.amount, currency: action.currency, paidAt: null,
                      }} />;
                    }
                    return (
                      <Button key={index} asChild size="sm" variant={index === 0 ? "default" : "outline"}>
                        <Link href={action.href}>{action.label}</Link>
                      </Button>
                    );
                  })}
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button size="icon" variant="ghost" className="size-8" aria-label="Posponer tarea" disabled={!!busy}>
                        <AlarmClock className="size-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => snooze(task, 1)}>Posponer hasta mañana</DropdownMenuItem>
                      <DropdownMenuItem onClick={() => snooze(task, 3)}>Posponer 3 días</DropdownMenuItem>
                      <DropdownMenuItem onClick={() => snooze(task, 7)}>Posponer una semana</DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function FilterChip({ active, onClick, label, count }: { active: boolean; onClick: () => void; label: string; count: number }) {
  return (
    <button type="button" onClick={onClick} aria-pressed={active}
      className={cn("inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
        active ? "bg-muted text-foreground" : "text-muted-foreground hover:text-foreground")}>
      {label} <span className="tabular-nums text-muted-foreground">{count}</span>
    </button>
  );
}
