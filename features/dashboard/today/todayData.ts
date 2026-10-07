import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/app/types/supabase";
import { ymdInAppTz } from "@/lib/dates";
import { getRentalAlertSettings } from "@/features/rentals/settings";
import { buildRentalTasks } from "@/features/rentals/taskData";
import { buildSalesTasks } from "@/features/dashboard/today/salesTasks";
import { buildDealTasks, buildListingTasks } from "@/features/dashboard/today/pipelineTasks";
import { buildEngineTasks, propertiesWithOpenBuyerTask } from "@/features/tasks/taskData";
import type { TodayTask } from "@/features/dashboard/today/types";

// Bandeja Hoy unificada: tareas de ventas + alquileres derivadas de los
// datos, más las guardadas del motor (reglas y manuales), sin las
// pospuestas, ordenadas por urgencia y puntaje.
export async function buildTodayTasks(supabase: SupabaseClient<Database>, userId: string): Promise<{ tasks: TodayTask[]; snoozed: number }> {
  const today = ymdInAppTz();
  const [salesOnly, deals, listings, rentals, engine, buyerTaskProperties, { data: snoozes }] = await Promise.all([
    buildSalesTasks(supabase, userId, today).catch((e) => { console.error("[hoy] ventas", e); return [] as TodayTask[]; }),
    buildDealTasks(supabase, userId, today).catch((e) => { console.error("[hoy] operaciones", e); return [] as TodayTask[]; }),
    buildListingTasks(supabase, userId, today).catch((e) => { console.error("[hoy] captaciones", e); return [] as TodayTask[]; }),
    getRentalAlertSettings(supabase).then((alerts) => buildRentalTasks(supabase, today, alerts))
      .catch((e) => { console.error("[hoy] alquileres", e); return { tasks: [], snoozed: 0 }; }),
    buildEngineTasks(supabase, userId, today).catch((e) => { console.error("[hoy] motor", e); return [] as TodayTask[]; }),
    propertiesWithOpenBuyerTask(supabase).catch(() => new Set<string>()),
    supabase.from("rental_task_snoozes").select("task_key").gt("snoozed_until", today),
  ]);

  // Las de alquileres ya vienen sin las pospuestas; a las de ventas se les
  // aplica el mismo registro de posposiciones. Las del motor se posponen
  // moviendo su vencimiento, así que no pasan por acá. "Avisar a
  // compradores" no se duplica si la propiedad ya tiene esa tarea abierta.
  const sales = [...salesOnly, ...deals, ...listings]
    .filter((t) => !(t.key.startsWith("COMPRADORES:") && buyerTaskProperties.has(t.key.split(":")[1])));
  const snoozedKeys = new Set((snoozes ?? []).map((s) => s.task_key));
  const visibleSales = sales.filter((t) => !snoozedKeys.has(t.key));

  const rentalTasks: TodayTask[] = rentals.tasks.map((t) => ({
    key: t.key, area: "alquileres", category: t.category, urgency: t.urgency, score: t.score,
    title: t.title, detail: t.detail, risk: t.risk, actions: t.actions,
    link: { href: `/dashboard/alquileres/${t.contractId}`, label: "ver contrato" },
  }));

  const rank = { alta: 0, media: 1, baja: 2 };
  const tasks = [...visibleSales, ...engine, ...rentalTasks].sort((a, b) => rank[a.urgency] - rank[b.urgency] || b.score - a.score);
  return { tasks, snoozed: rentals.snoozed + (sales.length - visibleSales.length) };
}
