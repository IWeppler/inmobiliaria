import { redirect } from "next/navigation";
import { createClientServer } from "@/lib/supabase";
import { ymdInAppTz } from "@/lib/dates";
import { Page, PageHeader } from "@/shared/components/PageShell";
import { formatDate } from "@/features/rentals/logic";
import { buildTodayTasks } from "@/features/dashboard/today/todayData";
import { TodayBoard } from "@/features/dashboard/today/TodayBoard";

// /dashboard/hoy: la bandeja del agente. Ventas y alquileres en una sola
// lista: en vez de recorrer pantallas buscando qué hacer, el sistema la arma.
export default async function HoyPage() {
  const supabase = await createClientServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // Alquileres al día antes de armar la bandeja (ajustes y punitorios).
  await supabase.rpc("rental_apply_due_adjustments");
  await supabase.rpc("rental_accrue_late_fees");

  const today = ymdInAppTz();
  const [{ tasks, snoozed }, { data: agents }] = await Promise.all([
    buildTodayTasks(supabase, user.id),
    supabase.from("agents").select("id, full_name, role").order("full_name"),
  ]);

  return (
    <Page>
      <PageHeader title="Hoy" description={`${formatDate(today)}: ${tasks.length} ${tasks.length === 1 ? "tarea" : "tareas"}, las más urgentes primero`} />
      <TodayBoard tasks={tasks} snoozed={snoozed} today={today} agents={agents ?? []} currentUserId={user.id} />
    </Page>
  );
}
