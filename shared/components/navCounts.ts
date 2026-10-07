import "server-only";
import { createClientServer } from "@/lib/supabase";
import { buildTodayTasks } from "@/features/dashboard/today/todayData";

// Contadores del sidebar: lo que necesita al agente. Corre con su sesión
// (RLS decide qué ve) y nunca rompe el layout: ante un error, 0.
//   today:   urgentes de la bandeja Hoy (ventas + alquileres)
//   rentals: urgentes de alquileres
export type NavCounts = { leads: number; rentals: number; inbox: number; today: number };

const EMPTY: NavCounts = { leads: 0, rentals: 0, inbox: 0, today: 0 };

export async function getNavCounts(): Promise<NavCounts> {
  try {
    const supabase = await createClientServer();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return EMPTY;

    const [{ count: leads }, urgent, { count: inbox }] = await Promise.all([
      // leads.status null se trata como NUEVO en toda la app.
      supabase.from("leads").select("id", { count: "exact", head: true }).or("status.is.null,status.eq.NUEVO"),
      buildTodayTasks(supabase, user.id)
        .then(({ tasks }) => tasks.filter((t) => t.urgency === "alta"))
        .catch(() => []),
      supabase.from("rental_inbox").select("id", { count: "exact", head: true }).eq("status", "PENDIENTE"),
    ]);
    return {
      leads: leads ?? 0,
      rentals: urgent.filter((t) => t.area === "alquileres").length,
      inbox: inbox ?? 0,
      today: urgent.length,
    };
  } catch {
    return EMPTY;
  }
}
