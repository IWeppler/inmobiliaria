import { redirect } from "next/navigation";
import { createClientServer } from "@/lib/supabase";
import { ContractForm } from "@/features/rentals/ContractForm";
import { Page, PageHeader } from "@/shared/components/PageShell";

export default async function NuevoContratoPage() {
  const supabase = await createClientServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [{ data: properties }, { data: contacts }] = await Promise.all([
    // Cualquier propiedad de alquiler (aunque ya figure ALQUILADO, por si
    // se carga un contrato vigente que no estaba en el sistema).
    supabase
      .from("properties")
      .select("id, title, status")
      .ilike("operation_type", "alquiler")
      .order("title"),
    supabase.from("rental_contacts").select("id, full_name, kind").order("full_name"),
  ]);

  const opts = (contacts ?? []) as { id: string; full_name: string; kind: string }[];

  return (
    <Page width="narrow">
      <PageHeader
        backHref="/dashboard/alquileres"
        title="Nuevo contrato"
        description="Se generan las cuotas mensuales automáticamente y la propiedad pasa a Alquilada."
      />
      <ContractForm
        properties={((properties ?? []) as { id: string; title: string; status: string }[]).map(
          (p) => ({
            id: p.id,
            label: `${p.title}${p.status === "ALQUILADO" ? " (alquilada)" : ""}`,
          })
        )}
        owners={opts.filter((c) => c.kind === "owner").map((c) => ({ id: c.id, label: c.full_name }))}
        tenants={opts.filter((c) => c.kind === "tenant").map((c) => ({ id: c.id, label: c.full_name }))}
      />
    </Page>
  );
}
