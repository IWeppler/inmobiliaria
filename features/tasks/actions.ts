"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { createClientServer } from "@/lib/supabase";
import { addDays, ymdInAppTz } from "@/lib/dates";
import type { ActionResult } from "@/features/rentals/actions";

// Motor de tareas: alta manual, cerrar, reabrir, posponer, reasignar y las
// reglas (admin). Con la sesión del usuario: RLS decide qué tareas toca.

const uuid = z.string().uuid();
const ymd = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const priority = z.enum(["alta", "media", "baja"]);

async function session() {
  const supabase = await createClientServer();
  const { data: { user } } = await supabase.auth.getUser();
  return { supabase, user };
}

// Hoy, las fichas y el contador del sidebar: todo cuelga del layout.
const revalidateTasks = () => revalidatePath("/dashboard", "layout");

const createSchema = z.object({
  title: z.string().trim().min(2, "Escribí qué hay que hacer.").max(200),
  notes: z.string().trim().max(2000).optional(),
  assignee_id: uuid,
  due_date: ymd.nullable(),
  priority,
  property_id: uuid.nullish(),
  lead_id: uuid.nullish(),
  contract_id: uuid.nullish(),
});

export async function createTaskAction(input: z.input<typeof createSchema>): Promise<ActionResult> {
  const parsed = createSchema.safeParse(input);
  if (!parsed.success) return { success: false, message: parsed.error.issues[0]?.message ?? "Datos inválidos." };
  const { supabase, user } = await session();
  if (!user) return { success: false, message: "No autenticado" };
  const v = parsed.data;
  const { error } = await supabase.from("tasks").insert({
    title: v.title, notes: v.notes || null, assignee_id: v.assignee_id, due_date: v.due_date, priority: v.priority,
    property_id: v.property_id ?? null, lead_id: v.lead_id ?? null, contract_id: v.contract_id ?? null, created_by: user.id,
  });
  if (error) return { success: false, message: error.message };
  revalidateTasks();
  return { success: true, message: v.assignee_id === user.id ? "Tarea creada." : "Tarea creada y asignada." };
}

// Cierra o reabre.
export async function setTaskStatusAction(input: { id: string; done: boolean }): Promise<ActionResult> {
  const parsed = z.object({ id: uuid, done: z.boolean() }).safeParse(input);
  if (!parsed.success) return { success: false, message: "Tarea inválida." };
  const { supabase, user } = await session();
  if (!user) return { success: false, message: "No autenticado" };
  const { id, done } = parsed.data;
  const { data, error } = await supabase.from("tasks")
    .update({ status: done ? "HECHA" : "PENDIENTE" }).eq("id", id)
    .select("id");
  if (error || !data?.length) return { success: false, message: error?.message ?? "No se encontró la tarea." };
  revalidateTasks();
  return { success: true, message: done ? "Tarea hecha." : "Tarea reabierta." };
}

export async function postponeTaskAction(input: { id: string; days: number }): Promise<ActionResult> {
  const parsed = z.object({ id: uuid, days: z.number().int().min(1).max(60) }).safeParse(input);
  if (!parsed.success) return { success: false, message: "Datos inválidos." };
  const { supabase, user } = await session();
  if (!user) return { success: false, message: "No autenticado" };
  const { id, days } = parsed.data;
  const { data, error } = await supabase.from("tasks")
    .update({ due_date: addDays(ymdInAppTz(), days) }).eq("id", id).eq("status", "PENDIENTE")
    .select("id");
  if (error || !data?.length) return { success: false, message: error?.message ?? "No se encontró la tarea." };
  revalidateTasks();
  return { success: true, message: days === 1 ? "Pasa a mañana." : `Pospuesta ${days} días.` };
}

export async function reassignTaskAction(input: { id: string; assignee_id: string }): Promise<ActionResult> {
  const parsed = z.object({ id: uuid, assignee_id: uuid }).safeParse(input);
  if (!parsed.success) return { success: false, message: "Datos inválidos." };
  const { supabase, user } = await session();
  if (!user) return { success: false, message: "No autenticado" };
  const { id, assignee_id } = parsed.data;
  // Sin RETURNING: quien la pasa puede dejar de verla, y RLS rechazaría
  // devolver la fila. Alcanza con el conteo.
  const [{ count, error }, { data: agent }] = await Promise.all([
    supabase.from("tasks").update({ assignee_id }, { count: "exact" }).eq("id", id),
    supabase.from("agents").select("full_name").eq("id", assignee_id).maybeSingle(),
  ]);
  if (error || !count) return { success: false, message: error?.message ?? "No se encontró la tarea." };
  revalidateTasks();
  return { success: true, message: assignee_id === user.id ? "Ahora es tuya." : `Asignada a ${agent?.full_name ?? "otra persona"}.` };
}

export async function deleteTaskAction(input: { id: string }): Promise<ActionResult> {
  const parsed = z.object({ id: uuid }).safeParse(input);
  if (!parsed.success) return { success: false, message: "Tarea inválida." };
  const { supabase, user } = await session();
  if (!user) return { success: false, message: "No autenticado" };
  const { data, error } = await supabase.from("tasks").delete().eq("id", parsed.data.id).select("id");
  if (error || !data?.length) return { success: false, message: error?.message ?? "Solo se borran las tareas manuales que creaste." };
  revalidateTasks();
  return { success: true, message: "Tarea borrada." };
}

// La regla se cumplió por una acción en otra pantalla (ej.: descargar la
// pieza de Instagram). Silenciosa: si no hay tarea abierta no pasa nada.
export async function completeRuleTaskAction(input: { property_id: string; rule: "PROP_INSTAGRAM" }): Promise<ActionResult> {
  const parsed = z.object({ property_id: uuid, rule: z.literal("PROP_INSTAGRAM") }).safeParse(input);
  if (!parsed.success) return { success: false, message: "Datos inválidos." };
  const { supabase, user } = await session();
  if (!user) return { success: false, message: "No autenticado" };
  const { data } = await supabase.from("tasks").update({ status: "HECHA" })
    .eq("property_id", parsed.data.property_id).eq("rule", parsed.data.rule).eq("status", "PENDIENTE").select("id");
  if (data?.length) revalidateTasks();
  return { success: true, message: data?.length ? "Tarea \"Pieza de Instagram\" hecha." : "" };
}

const ruleSchema = z.object({
  key: z.string().min(3).max(40),
  enabled: z.boolean(),
  assignee_id: uuid.nullable(),
  due_days: z.coerce.number().int().min(0).max(60),
  priority,
});

export async function updateTaskRuleAction(input: z.input<typeof ruleSchema>): Promise<ActionResult> {
  const parsed = ruleSchema.safeParse(input);
  if (!parsed.success) return { success: false, message: parsed.error.issues[0]?.message ?? "Datos inválidos." };
  const { supabase, user } = await session();
  if (!user) return { success: false, message: "No autenticado" };
  const { key, ...values } = parsed.data;
  const { data, error } = await supabase.from("task_rules")
    .update({ ...values, updated_at: new Date().toISOString() }).eq("key", key).select("key");
  if (error || !data?.length) return { success: false, message: error?.message ?? "Solo un administrador puede cambiar las reglas." };
  revalidatePath("/dashboard/ajustes");
  return { success: true, message: "Regla guardada." };
}
