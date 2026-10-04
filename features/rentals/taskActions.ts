"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { createClientServer } from "@/lib/supabase";
import { addDays, ymdInAppTz } from "@/lib/dates";
import type { ActionResult } from "@/features/rentals/actions";

// Posponer una tarea de la bandeja "Hoy" (compartido por el equipo).
const snoozeSchema = z.object({
  key: z.string().min(3).max(200),
  days: z.coerce.number().int().min(1).max(60),
  reason: z.string().max(120).optional(),
});

export async function snoozeTaskAction(input: z.input<typeof snoozeSchema>): Promise<ActionResult> {
  const parsed = snoozeSchema.safeParse(input);
  if (!parsed.success) return { success: false, message: "Tarea inválida." };
  const supabase = await createClientServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false, message: "No autenticado" };
  const { key, days, reason } = parsed.data;
  const { error } = await supabase.from("rental_task_snoozes").upsert({
    task_key: key,
    snoozed_until: addDays(ymdInAppTz(), days),
    reason: reason ?? null,
    created_by: user.id,
    created_at: new Date().toISOString(),
  }, { onConflict: "task_key" });
  if (error) return { success: false, message: error.message };
  revalidatePath("/dashboard/alquileres/hoy");
  return { success: true, message: days === 1 ? "Pospuesta hasta mañana." : `Pospuesta ${days} días.` };
}

export async function clearSnoozesAction(): Promise<ActionResult> {
  const supabase = await createClientServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false, message: "No autenticado" };
  const { error } = await supabase.from("rental_task_snoozes").delete().gt("snoozed_until", ymdInAppTz());
  if (error) return { success: false, message: error.message };
  revalidatePath("/dashboard/alquileres/hoy");
  return { success: true, message: "Se muestran de nuevo las tareas pospuestas." };
}
