"use client";

import { useState } from "react";
import Link from "next/link";
import { MoreHorizontal, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/shared/components/ui/button";
import { Checkbox } from "@/shared/components/ui/checkbox";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuSub,
  DropdownMenuSubContent, DropdownMenuSubTrigger, DropdownMenuTrigger,
} from "@/shared/components/ui/dropdown-menu";
import { useRunAction } from "@/features/rentals/useRunAction";
import { deleteTaskAction, postponeTaskAction, reassignTaskAction, setTaskStatusAction } from "@/features/tasks/actions";
import type { TaskAssignee } from "@/features/tasks/NewTaskDialog";
import type { TaskStatus } from "@/features/tasks/rules";

export type TaskListItem = {
  id: string;
  title: string;
  status: TaskStatus;
  /** "mañana", "vencida hace 2 días"... */
  due: string | null;
  overdue: boolean;
  assigneeId: string | null;
  assigneeName: string | null;
  /** Estado vivo ("faltan 2 fotos") o cómo terminó ("La propiedad pasó a reservada"). */
  hint: string | null;
  auto: boolean;
  action: { label: string; href: string } | null;
  canDelete: boolean;
};

const DONE_VISIBLE = 3;

// Lista de tareas de una ficha: pendientes arriba, hechas y canceladas
// abajo (colapsadas). Tildar cierra o reabre.
export function TaskList({ tasks, agents, currentUserId }: { tasks: TaskListItem[]; agents: TaskAssignee[]; currentUserId: string }) {
  const { busy, run } = useRunAction();
  const [showAll, setShowAll] = useState(false);
  const open = tasks.filter((t) => t.status === "PENDIENTE");
  const closed = tasks.filter((t) => t.status !== "PENDIENTE");
  const visibleClosed = showAll ? closed : closed.slice(0, DONE_VISIBLE);

  if (tasks.length === 0) {
    return <p className="text-sm text-muted-foreground">Sin tareas. Las que agregues le aparecen al responsable en Hoy.</p>;
  }

  const row = (task: TaskListItem) => {
    const done = task.status === "HECHA";
    const cancelled = task.status === "CANCELADA";
    return (
      <li key={task.id} className="flex items-start gap-3 py-2">
        <Checkbox
          className="mt-0.5"
          checked={done}
          disabled={cancelled || !!busy}
          aria-label={done ? `Reabrir: ${task.title}` : `Marcar hecha: ${task.title}`}
          onCheckedChange={(value) => run(`status-${task.id}`, () => setTaskStatusAction({ id: task.id, done: value === true }))}
        />
        <div className="min-w-0 flex-1">
          <p className={cn("text-sm", done || cancelled ? "text-muted-foreground line-through decoration-muted-foreground/50" : "font-medium text-foreground")}>
            {task.title}
          </p>
          <p className="flex flex-wrap items-center gap-x-1.5 text-xs text-muted-foreground">
            {[
              task.assigneeName ? (task.assigneeId === currentUserId ? "vos" : task.assigneeName.split(" ")[0]) : "sin asignar",
              !done && !cancelled && task.due ? <span key="due" className={cn(task.overdue && "font-medium text-danger")}>{task.due}</span> : null,
              task.hint,
            ].filter(Boolean).map((part, i) => <span key={i}>{i > 0 && "· "}{part}</span>)}
            {task.auto && !done && !cancelled && (
              <span className="inline-flex items-center gap-0.5" title="Se cierra sola cuando se cumple"><Sparkles className="size-3" aria-hidden /> automática</span>
            )}
          </p>
        </div>
        {task.action && !done && !cancelled && (
          <Button asChild size="sm" variant="ghost" className="h-7 px-2 text-xs"><Link href={task.action.href}>{task.action.label}</Link></Button>
        )}
        {!cancelled && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="icon" variant="ghost" className="size-7" aria-label="Más acciones" disabled={!!busy}>
                <MoreHorizontal className="size-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {!done && (
                <>
                  <DropdownMenuItem onClick={() => run(`pp-${task.id}`, () => postponeTaskAction({ id: task.id, days: 1 }))}>Pasar a mañana</DropdownMenuItem>
                  <DropdownMenuItem onClick={() => run(`pp-${task.id}`, () => postponeTaskAction({ id: task.id, days: 7 }))}>Posponer una semana</DropdownMenuItem>
                  <ReassignSub agents={agents} currentUserId={currentUserId} assigneeId={task.assigneeId}
                    onPick={(assignee) => run(`ra-${task.id}`, () => reassignTaskAction({ id: task.id, assignee_id: assignee }))} />
                </>
              )}
              {task.canDelete && (
                <>
                  {!done && <DropdownMenuSeparator />}
                  <DropdownMenuItem className="text-danger focus:text-danger" onClick={() => run(`del-${task.id}`, () => deleteTaskAction({ id: task.id }))}>
                    Borrar
                  </DropdownMenuItem>
                </>
              )}
              {done && !task.canDelete && (
                <DropdownMenuItem onClick={() => run(`status-${task.id}`, () => setTaskStatusAction({ id: task.id, done: false }))}>Reabrir</DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </li>
    );
  };

  return (
    <div>
      {open.length > 0 && <ul className="divide-y divide-border-subtle">{open.map(row)}</ul>}
      {closed.length > 0 && (
        <ul className={cn("divide-y divide-border-subtle", open.length > 0 && "mt-1 border-t border-border-subtle")}>
          {visibleClosed.map(row)}
        </ul>
      )}
      {closed.length > DONE_VISIBLE && (
        <button type="button" onClick={() => setShowAll((v) => !v)} className="mt-1 text-xs text-muted-foreground underline-offset-4 hover:underline">
          {showAll ? "Ver menos" : `Ver ${closed.length - DONE_VISIBLE} más`}
        </button>
      )}
    </div>
  );
}

export function ReassignSub({ agents, currentUserId, assigneeId, onPick }: {
  agents: TaskAssignee[]; currentUserId: string; assigneeId: string | null; onPick: (id: string) => void;
}) {
  return (
    <DropdownMenuSub>
      <DropdownMenuSubTrigger>Reasignar</DropdownMenuSubTrigger>
      <DropdownMenuSubContent>
        {agents.filter((a) => a.id !== assigneeId).map((a) => (
          <DropdownMenuItem key={a.id} onClick={() => onPick(a.id)}>
            {a.id === currentUserId ? "A mí" : a.full_name ?? "Sin nombre"}
          </DropdownMenuItem>
        ))}
      </DropdownMenuSubContent>
    </DropdownMenuSub>
  );
}
