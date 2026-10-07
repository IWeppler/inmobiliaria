import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/app/types/supabase";
import { ymdInAppTz } from "@/lib/dates";
import { daysBetween, formatDate } from "@/features/rentals/logic";
import { findBuyerMatches } from "@/features/dashboard/buyers/queries";
import type { MatchableProperty } from "@/features/dashboard/buyers/matching";
import type { TodayTask } from "@/features/dashboard/today/types";
import { listingGaps, ruleAction, type TaskPriority, type TaskStatus } from "@/features/tasks/rules";
import { contractCode } from "@/features/rentals/codes";

// Tareas guardadas del motor (las de reglas y las manuales). Se leen con la
// sesión del usuario: RLS decide cuáles ve. Antes de mostrarlas se cierran
// solas las que el dato ya confirma (ficha completa, compradores avisados).

type Client = SupabaseClient<Database>;

export const STRONG_MATCH = 70;

const TASK_SELECT = `id, title, notes, status, priority, due_date, rule, resolution, property_id, lead_id, contract_id,
  assignee_id, created_by, done_at, created_at,
  property:properties(id, title, status, description, operation_type, property_type_id, city, neighborhood, price, currency, bedrooms, bathrooms, property_images(count)),
  lead:leads(id, name),
  contract:rental_contracts(id, number),
  assignee:agents!tasks_assignee_id_fkey(full_name),
  creator:agents!tasks_created_by_fkey(full_name)`;

type TaskProperty = MatchableProperty & {
  id: string; title: string; status: string | null; description: string | null; property_images: { count: number }[];
};

export type TaskRow = {
  id: string; title: string; notes: string | null; status: TaskStatus; priority: TaskPriority; due_date: string | null;
  rule: string | null; resolution: string | null; property_id: string | null; lead_id: string | null; contract_id: string | null;
  assignee_id: string | null; created_by: string | null; done_at: string | null; created_at: string;
  property: TaskProperty | null;
  lead: { id: string; name: string } | null;
  contract: { id: string; number: number } | null;
  assignee: { full_name: string | null } | null;
  creator: { full_name: string | null } | null;
  /** Estado vivo que agrega el motor al leer ("faltan 2 fotos", "3 sin avisar"). */
  hint?: string;
};

// Cierra las tareas automáticas que el dato ya resolvió y anota el resto.
// Solo evalúa las del usuario que mira: el matching depende de qué leads ve.
async function autoResolve(supabase: Client, rows: TaskRow[], viewerId: string) {
  const resolved = new Map<string, string>();

  for (const task of rows) {
    if (task.status !== "PENDIENTE" || !task.property) continue;
    if (task.rule === "PROP_FICHA") {
      const gaps = listingGaps(task.property.property_images?.[0]?.count ?? 0, task.property.description);
      if (gaps.length === 0) resolved.set(task.id, "La ficha quedó completa");
      else task.hint = gaps.join(" y ");
    }
  }

  const buyerTasks = rows.filter((t) => t.status === "PENDIENTE" && t.rule === "PROP_COMPRADORES" && t.property && t.assignee_id === viewerId);
  if (buyerTasks.length) {
    const { data: contacts } = await supabase.from("buyer_contacts").select("property_id, lead_id")
      .in("property_id", buyerTasks.map((t) => t.property_id!));
    const contacted = new Set((contacts ?? []).map((c) => `${c.property_id}|${c.lead_id}`));
    for (const task of buyerTasks) {
      const matches = (await findBuyerMatches(supabase, task.property!)).filter((m) => m.score >= STRONG_MATCH);
      const pending = matches.filter((m) => !contacted.has(`${task.property_id}|${m.lead.id}`));
      if (pending.length === 0) {
        resolved.set(task.id, matches.length ? "Todos los compradores compatibles fueron avisados" : "No hay compradores compatibles en la base");
      } else {
        task.hint = `${pending.length} ${pending.length === 1 ? "comprador sin avisar" : "compradores sin avisar"}: `
          + pending.slice(0, 3).map((m) => m.lead.name).join(", ") + (pending.length > 3 ? ` y ${pending.length - 3} más` : "");
      }
    }
  }

  for (const [id, resolution] of resolved) {
    const { error } = await supabase.from("tasks").update({ status: "HECHA", resolution }).eq("id", id).eq("status", "PENDIENTE");
    if (error) { console.error("[tareas] cierre automático", error.message); continue; }
    const task = rows.find((t) => t.id === id)!;
    task.status = "HECHA";
    task.resolution = resolution;
    task.done_at = new Date().toISOString();
  }
}

/** Título completo: las de reglas llevan la propiedad. */
export function taskTitle(task: Pick<TaskRow, "title" | "rule" | "property">) {
  return task.rule && task.property ? `${task.title}: ${task.property.title}` : task.title;
}

// Tareas del usuario para la bandeja Hoy: pendientes, vencidas o para hoy
// (o sin fecha).
export async function buildEngineTasks(supabase: Client, userId: string, today = ymdInAppTz()): Promise<TodayTask[]> {
  const { data, error } = await supabase.from("tasks").select(TASK_SELECT)
    .eq("assignee_id", userId).eq("status", "PENDIENTE")
    .or(`due_date.is.null,due_date.lte.${today}`);
  if (error) throw error;
  const rows = (data ?? []) as unknown as TaskRow[];
  await autoResolve(supabase, rows, userId);

  return rows.filter((t) => t.status === "PENDIENTE").map((task) => {
    const overdue = task.due_date ? daysBetween(task.due_date, today) : 0;
    const urgency = overdue > 0 ? "alta" : task.priority;
    const action = ruleAction(task.rule, task.property_id);
    const assignedBy = task.created_by && task.created_by !== userId ? task.creator?.full_name : null;
    return {
      key: `TAREA:${task.id}`,
      taskId: task.id,
      area: task.contract_id ? "alquileres" : task.property_id || task.lead_id ? "ventas" : "general",
      category: task.rule ? "propiedades" : "tareas",
      urgency,
      score: (task.priority === "alta" ? 90 : task.priority === "media" ? 60 : 30) + Math.min(overdue, 20),
      title: taskTitle(task),
      detail: [
        !task.due_date ? "Sin fecha" : overdue > 0 ? `Vencida hace ${overdue} ${overdue === 1 ? "día" : "días"}` : "Para hoy",
        task.hint,
        task.lead && !task.rule ? task.lead.name : null,
        task.contract ? contractCode(task.contract.number) : null,
        assignedBy ? `te la asignó ${assignedBy.split(" ")[0]}` : null,
        task.notes,
      ].filter(Boolean).join(" · "),
      link: task.property_id ? { href: `/dashboard/propiedades/${task.property_id}`, label: "ver propiedad" }
        : task.lead_id ? { href: `/dashboard/leads/${task.lead_id}`, label: "ver lead" }
        : task.contract_id ? { href: `/dashboard/alquileres/${task.contract_id}`, label: "ver contrato" }
        : undefined,
      actions: [
        ...(action ? [{ type: "link" as const, ...action }] : []),
        { type: "task-done" as const, taskId: task.id, label: "Hecho" },
      ],
    } satisfies TodayTask;
  });
}

// Propiedades con la tarea "avisar a compradores" abierta: la alerta
// derivada de ventas no se repite para ellas.
export async function propertiesWithOpenBuyerTask(supabase: Client): Promise<Set<string>> {
  const { data } = await supabase.from("tasks").select("property_id")
    .eq("rule", "PROP_COMPRADORES").eq("status", "PENDIENTE").not("property_id", "is", null);
  return new Set((data ?? []).map((t) => t.property_id!));
}

// Tareas de una propiedad, un lead o un contrato, para la tarjeta de su ficha.
export async function getEntityTasks(
  supabase: Client, viewerId: string, entity: { propertyId?: string; leadId?: string; contractId?: string },
): Promise<TaskRow[]> {
  let query = supabase.from("tasks").select(TASK_SELECT);
  if (entity.propertyId) query = query.eq("property_id", entity.propertyId);
  else if (entity.leadId) query = query.eq("lead_id", entity.leadId);
  else if (entity.contractId) query = query.eq("contract_id", entity.contractId);
  else return [];
  const { data, error } = await query.order("created_at", { ascending: true }).limit(50);
  if (error) { console.error("[tareas] ficha", error.message); return []; }
  const rows = (data ?? []) as unknown as TaskRow[];
  await autoResolve(supabase, rows, viewerId);
  return rows;
}

export function dueLabel(due: string | null, today: string) {
  if (!due) return null;
  const days = daysBetween(today, due);
  if (days === 0) return "hoy";
  if (days === 1) return "mañana";
  if (days < 0) return `vencida hace ${-days} ${days === -1 ? "día" : "días"}`;
  return formatDate(due);
}
