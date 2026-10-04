import { redirect } from "next/navigation";
import { createClientServer } from "@/lib/supabase";
import { ymdInAppTz } from "@/lib/dates";
import { Page, PageHeader } from "@/shared/components/PageShell";
import { RentalsNav } from "@/features/rentals/RentalsNav";
import { loadReconciliationCandidates } from "@/features/rentals/reconciliationData";
import { ReconciliationView } from "@/features/rentals/ReconciliationView";

// /dashboard/alquileres/conciliacion: subir el extracto del banco y que el
// sistema empareje cada transferencia con la deuda del inquilino.
export default async function ConciliacionPage() {
  const supabase = await createClientServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // Punitorios al día: la deuda a comparar es la de hoy.
  await supabase.rpc("rental_accrue_late_fees");
  const candidates = await loadReconciliationCandidates(supabase, ymdInAppTz());

  return (
    <Page>
      <PageHeader title="Alquileres" description="Conciliación bancaria: subí el extracto y confirmá los cobros que encontramos." />
      <RentalsNav />
      <ReconciliationView candidates={candidates} />
    </Page>
  );
}
