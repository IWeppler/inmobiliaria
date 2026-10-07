import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/app/types/supabase";
import { ymdInAppTz } from "@/lib/dates";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/components/ui/card";
import { dueLabel, getEntityTasks, taskTitle } from "@/features/tasks/taskData";
import { AUTO_RULES, ruleAction } from "@/features/tasks/rules";
import { NewTaskDialog, type TaskEntity } from "@/features/tasks/NewTaskDialog";
import { TaskList, type TaskListItem } from "@/features/tasks/TaskList";

// Tarjeta "Tareas" de una ficha (propiedad, lead o contrato): las del
// motor y las manuales, con el avance. Desde acá se cargan nuevas para
// cualquier usuario.
export async function EntityTasksCard({
  supabase, userId, isAdmin, entity,
}: {
  supabase: SupabaseClient<Database>;
  userId: string;
  isAdmin: boolean;
  entity: TaskEntity;
}) {
  const today = ymdInAppTz();
  const [rows, { data: agents }] = await Promise.all([
    getEntityTasks(supabase, userId, { propertyId: entity.property_id, leadId: entity.lead_id, contractId: entity.contract_id }),
    supabase.from("agents").select("id, full_name, role").order("full_name"),
  ]);

  const items: TaskListItem[] = rows.map((task) => ({
    id: task.id,
    // En la ficha de la propiedad el nombre sobra.
    title: entity.property_id ? task.title : taskTitle(task),
    status: task.status,
    due: dueLabel(task.due_date, today),
    overdue: !!task.due_date && task.due_date < today,
    assigneeId: task.assignee_id,
    assigneeName: task.assignee?.full_name ?? null,
    hint: task.status === "PENDIENTE" ? task.hint ?? task.notes : task.resolution,
    auto: !!task.rule && AUTO_RULES.has(task.rule),
    action: ruleAction(task.rule, task.property_id),
    canDelete: !task.rule && (task.created_by === userId || isAdmin),
  }));
  const relevant = items.filter((t) => t.status !== "CANCELADA");
  const done = relevant.filter((t) => t.status === "HECHA").length;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-2">
        <CardTitle>
          Tareas
          {relevant.length > 0 && (
            <span className="ml-1.5 text-sm font-normal text-muted-foreground">{done} de {relevant.length} hechas</span>
          )}
        </CardTitle>
        <NewTaskDialog agents={agents ?? []} currentUserId={userId} today={today} entity={entity} trigger="icon" />
      </CardHeader>
      <CardContent>
        {relevant.length > 0 && (
          <div className="mb-2 h-1 overflow-hidden rounded-full bg-muted" aria-hidden>
            <div className="h-full rounded-full bg-success transition-all" style={{ width: `${(done / relevant.length) * 100}%` }} />
          </div>
        )}
        <TaskList tasks={items} agents={agents ?? []} currentUserId={userId} />
      </CardContent>
    </Card>
  );
}
