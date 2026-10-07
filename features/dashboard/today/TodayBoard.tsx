"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  AlarmClock, Banknote, Building2, CalendarCheck, CalendarClock, Check, CheckCircle2, Handshake, Inbox, KeyRound, ListTodo, MessageSquareReply,
  TrendingUp, UserRoundSearch, Users, Wrench, type LucideIcon,
} from "lucide-react";
import { FaWhatsapp } from "react-icons/fa";
import { Button } from "@/shared/components/ui/button";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/shared/components/ui/dropdown-menu";
import { StatusBadge, type StatusTone } from "@/shared/components/StatusBadge";
import { cn } from "@/lib/utils";
import { PayoutButton } from "@/features/rentals/PayoutButton";
import { clearSnoozesAction, snoozeTaskAction } from "@/features/rentals/taskActions";
import { useRunAction } from "@/features/rentals/useRunAction";
import { RISK_LABELS, type RiskLevel, type TaskUrgency } from "@/features/rentals/tasks";
import { completeNextActionAction } from "@/features/dashboard/leads/followUpActions";
import { postponeTaskAction, reassignTaskAction, setTaskStatusAction } from "@/features/tasks/actions";
import { NewTaskDialog, type TaskAssignee } from "@/features/tasks/NewTaskDialog";
import { ReassignSub } from "@/features/tasks/TaskList";
import { AREA_LABELS, TODAY_CATEGORY_LABELS, type TodayArea, type TodayCategory, type TodayTask } from "@/features/dashboard/today/types";

const CATEGORY_ICONS: Record<TodayCategory, LucideIcon> = {
  consultas: MessageSquareReply, seguimiento: UserRoundSearch, visitas: CalendarCheck, compradores: Users, propiedades: Building2,
  operaciones: Handshake, captaciones: KeyRound,
  mensajes: Inbox, cobranzas: Banknote, ajustes: TrendingUp, liquidaciones: CheckCircle2, contratos: CalendarClock, mantenimiento: Wrench,
  tareas: ListTodo,
};
const URGENCY_STYLE: Record<TaskUrgency, string> = { alta: "text-danger", media: "text-warning", baja: "text-muted-foreground" };
const RISK_TONE: Record<RiskLevel, StatusTone> = { ALTO: "danger", MEDIO: "warning", BAJO: "success", NUEVO: "neutral" };

type Filter = "todas" | TodayArea;

// Bandeja "Hoy": todo lo que necesita al agente en ventas y alquileres, en
// una sola lista priorizada y con la acción a un clic. Las alertas derivadas
// se cierran solas cuando cambia el dato y se pueden posponer; las del motor
// (reglas y manuales) se marcan hechas, se posponen moviendo el vencimiento
// y se pueden reasignar.
export function TodayBoard({ tasks, snoozed, today, agents, currentUserId }: {
  tasks: TodayTask[]; snoozed: number; today: string; agents: TaskAssignee[]; currentUserId: string;
}) {
  const router = useRouter();
  const { busy, run } = useRunAction();
  const [filter, setFilter] = useState<Filter>("todas");

  const counts = useMemo(() => ({
    todas: tasks.length,
    ventas: tasks.filter((t) => t.area === "ventas").length,
    alquileres: tasks.filter((t) => t.area === "alquileres").length,
    general: tasks.filter((t) => t.area === "general").length,
  }), [tasks]);
  const visible = filter === "todas" ? tasks : tasks.filter((t) => t.area === filter);
  const urgent = visible.filter((t) => t.urgency === "alta").length;

  const snooze = (task: TodayTask, days: number, reason?: string) =>
    run(`snooze-${task.key}`, () => task.taskId
      ? postponeTaskAction({ id: task.taskId, days })
      : snoozeTaskAction({ key: task.key, days, reason }));

  const complete = async (task: TodayTask, leadId: string) => {
    const ok = await run(`done-${task.key}`, () => completeNextActionAction({ lead_id: leadId }));
    if (ok) toast("¿Cuál es el siguiente paso?", { action: { label: "Definir", onClick: () => router.push(`/dashboard/leads/${leadId}`) } });
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        {(["todas", "ventas", "alquileres", "general"] as Filter[]).filter((f) => f === "todas" || counts[f] > 0).map((f) => (
          <button key={f} type="button" onClick={() => setFilter(f)} aria-pressed={filter === f}
            className={cn("inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
              filter === f ? "bg-muted text-foreground" : "text-muted-foreground hover:text-foreground")}>
            {f === "todas" ? "Todas" : AREA_LABELS[f]} <span className="tabular-nums text-muted-foreground">{counts[f]}</span>
          </button>
        ))}
        <span className="ml-auto flex items-center gap-3 text-sm text-muted-foreground">
          <span>
          {urgent > 0 && <span className="font-medium text-danger">{urgent} {urgent === 1 ? "urgente" : "urgentes"}</span>}
          {urgent > 0 && snoozed > 0 && " · "}
          {snoozed > 0 && (
            <button type="button" className="underline-offset-4 hover:underline" disabled={!!busy} onClick={() => run("clear", clearSnoozesAction)}>
              {snoozed} {snoozed === 1 ? "pospuesta" : "pospuestas"}
            </button>
          )}
          </span>
          <NewTaskDialog agents={agents} currentUserId={currentUserId} today={today} />
        </span>
      </div>

      {visible.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border px-4 py-14 text-center">
          <CheckCircle2 className="mx-auto size-8 text-success" aria-hidden />
          <p className="mt-3 font-medium">Todo al día</p>
          <p className="mt-1 text-sm text-muted-foreground">No hay nada pendiente{filter !== "todas" ? ` en ${AREA_LABELS[filter].toLowerCase()}` : ""}.</p>
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
                      <span className="mr-1 font-medium">{TODAY_CATEGORY_LABELS[task.category]}</span>
                      · {task.detail}
                      {task.link && <> · <Link href={task.link.href} className="underline-offset-4 hover:underline">{task.link.label}</Link></>}
                    </p>
                  </div>
                </div>
                <div className="flex shrink-0 flex-wrap items-center gap-2 pl-7 sm:pl-0">
                  {task.actions.map((action, index) => {
                    const variant = index === 0 ? "default" : "outline";
                    if (action.type === "complete") {
                      return (
                        <Button key={index} size="sm" variant={variant} disabled={!!busy} onClick={() => complete(task, action.leadId)}>
                          <Check className="size-4" /> {action.label}
                        </Button>
                      );
                    }
                    if (action.type === "task-done") {
                      return (
                        <Button key={index} size="sm" variant={variant} disabled={!!busy}
                          onClick={() => run(`done-${task.key}`, () => setTaskStatusAction({ id: action.taskId, done: true }))}>
                          <Check className="size-4" /> {action.label}
                        </Button>
                      );
                    }
                    if (action.type === "whatsapp") {
                      return (
                        <Button key={index} asChild size="sm" variant={variant}>
                          {/* Abrir WhatsApp pospone la tarea: el agente ya hizo el contacto. */}
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
                      <Button key={index} asChild size="sm" variant={variant}>
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
                      {task.taskId && (
                        <>
                          <DropdownMenuSeparator />
                          <ReassignSub agents={agents} currentUserId={currentUserId} assigneeId={currentUserId}
                            onPick={(assignee) => run(`ra-${task.key}`, () => reassignTaskAction({ id: task.taskId!, assignee_id: assignee }))} />
                        </>
                      )}
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
