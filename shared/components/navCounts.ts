import "server-only";
import { createClientServer } from "@/lib/supabase";
import { ymdInAppTz } from "@/lib/dates";
import { getRentalAlertSettings } from "@/features/rentals/settings";
import { buildRentalTasks } from "@/features/rentals/taskData";

// Contadores del sidebar: lo que necesita al agente. Corre con su sesión
// (RLS decide qué ve) y nunca rompe el layout: ante un error, 0.
export type NavCounts = { leads: number; rentals: number };

export async function getNavCounts(): Promise<NavCounts> {
  try {
    const supabase = await createClientServer();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { leads: 0, rentals: 0 };

    const today = ymdInAppTz();
    const [{ count: leads }, rentals] = await Promise.all([
      // leads.status null se trata como NUEVO en toda la app.
      supabase.from("leads").select("id", { count: "exact", head: true }).or("status.is.null,status.eq.NUEVO"),
      getRentalAlertSettings(supabase)
        .then((alerts) => buildRentalTasks(supabase, today, alerts))
        .then(({ tasks }) => tasks.filter((t) => t.urgency === "alta").length)
        .catch(() => 0),
    ]);
    return { leads: leads ?? 0, rentals };
  } catch {
    return { leads: 0, rentals: 0 };
  }
}
