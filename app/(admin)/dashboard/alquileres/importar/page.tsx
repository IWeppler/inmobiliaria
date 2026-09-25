import { notFound, redirect } from "next/navigation";
import { createClientServer } from "@/lib/supabase";
import { ImportContracts } from "@/features/rentals/ImportContracts";
import { Page, PageHeader } from "@/shared/components/PageShell";

export default async function ImportarContratosPage() {
  const supabase = await createClientServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const [{ data: isAdmin }, { data: properties }] = await Promise.all([
    supabase.rpc("is_admin"),
    supabase.from("properties").select("id, title").ilike("operation_type", "alquiler").order("title"),
  ]);
  if (!isAdmin) notFound();
  return <Page width="narrow">
    <PageHeader backHref="/dashboard/alquileres" title="Importar contratos" description="Carga masiva de contratos vigentes desde CSV." />
    <ImportContracts properties={properties ?? []} />
  </Page>;
}
