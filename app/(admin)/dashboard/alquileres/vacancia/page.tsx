import { redirect } from "next/navigation";
import { createClientServer } from "@/lib/supabase";
import { ymdInAppTz } from "@/lib/dates";
import { Page, PageHeader } from "@/shared/components/PageShell";
import { money } from "@/features/rentals/logic";
import { RentalsNav } from "@/features/rentals/RentalsNav";
import { getRentalAlertSettings } from "@/features/rentals/settings";
import { Stat, StatStrip } from "@/features/rentals/StatStrip";
import { buildVacancy } from "@/features/rentals/vacancyData";
import { VacancyView } from "@/features/rentals/VacancyView";

// /dashboard/alquileres/vacancia: qué se va a desocupar, qué está vacío y
// cuánto cuesta cada día sin inquilino (E4.17).
export default async function VacanciaPage() {
  const supabase = await createClientServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const today = ymdInAppTz();
  const [alerts, { data: me }] = await Promise.all([
    getRentalAlertSettings(supabase),
    supabase.from("agents").select("role").eq("id", user.id).single(),
  ]);
  // Para planificar la salida a publicar conviene mirar al menos 90 días.
  const windowDays = Math.max(alerts.expiryAlertDays, 90);
  const { expiring, vacant } = await buildVacancy(supabase, today, windowDays, { id: user.id, isAdmin: me?.role === "admin" });

  const lost = new Map<string, number>();
  for (const v of vacant) if (v.lostRent) lost.set(v.currency, (lost.get(v.currency) ?? 0) + v.lostRent);
  const avgDays = vacant.length ? Math.round(vacant.reduce((s, v) => s + v.daysVacant, 0) / vacant.length) : 0;
  const undecided = expiring.filter((e) => e.intent === null).length;

  return (
    <Page>
      <PageHeader title="Alquileres" description="Vacancia: contratos que terminan y propiedades vacías, para que ninguna quede parada." />
      <RentalsNav />
      <StatStrip>
        <Stat label="Vacantes" value={vacant.length} tone={vacant.length ? "danger" : undefined}
          detail={`${vacant.filter((v) => v.stage === "SIN_PUBLICAR").length} sin publicar`} />
        <Stat label="Días sin contrato (promedio)" value={vacant.length ? avgDays : "-"} />
        <Stat label="Sin cobrar por vacancia" value={lost.size ? [...lost].map(([c, a]) => money(a, c)).join(" + ") : "-"}
          detail="Desde que terminó el último contrato" />
        <Stat label={`Vencen en ${windowDays} días`} value={expiring.length} tone={undecided ? "warning" : undefined}
          detail={undecided ? `${undecided} sin definir si renuevan` : "Todos definidos"} />
      </StatStrip>
      <VacancyView expiring={expiring} vacant={vacant} windowDays={windowDays} />
    </Page>
  );
}
