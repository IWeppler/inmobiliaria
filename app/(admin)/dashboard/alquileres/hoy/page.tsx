import { redirect } from "next/navigation";
import { createClientServer } from "@/lib/supabase";
import { ymdInAppTz } from "@/lib/dates";
import { Page, PageHeader } from "@/shared/components/PageShell";
import { formatDate } from "@/features/rentals/logic";
import { RentalsNav } from "@/features/rentals/RentalsNav";
import { getRentalAlertSettings } from "@/features/rentals/settings";
import { buildRentalTasks } from "@/features/rentals/taskData";
import { TodayInbox } from "@/features/rentals/TodayInbox";

// /dashboard/alquileres/hoy: la bandeja del agente. En vez de recorrer cada
// pantalla buscando qué hacer, el sistema arma la lista priorizada.
export default async function HoyPage() {
  const supabase = await createClientServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // Datos al día antes de armar la bandeja (igual que Contratos).
  await supabase.rpc("rental_apply_due_adjustments");
  await supabase.rpc("rental_accrue_late_fees");

  const today = ymdInAppTz();
  const alerts = await getRentalAlertSettings(supabase);
  const { tasks, snoozed } = await buildRentalTasks(supabase, today, alerts);

  return (
    <Page>
      <PageHeader title="Alquileres" description={`Para hoy, ${formatDate(today)}: ${tasks.length} ${tasks.length === 1 ? "tarea" : "tareas"} ordenadas por prioridad`} />
      <RentalsNav />
      <TodayInbox tasks={tasks} snoozed={snoozed} today={today} />
    </Page>
  );
}
