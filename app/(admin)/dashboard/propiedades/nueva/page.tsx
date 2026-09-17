import type { Metadata } from "next";
import { createClientServer } from "@/lib/supabase";
import { PropertyForm } from "@/features/dashboard/property/PropertyForm";
import { Page, PageHeader } from "@/shared/components/PageShell";

export const metadata: Metadata = { title: "Nueva propiedad" };

export default async function NewPropertyPage() {
  const supabase = await createClientServer();
  const { data: types } = await supabase
    .from("property_types")
    .select("id, name")
    .order("name");

  return (
    <Page>
      <PageHeader
        backHref="/dashboard/propiedades"
        title="Nueva propiedad"
        description="Completá lo básico, marcá la ubicación y subí fotos. Todo se puede editar después."
      />
      <PropertyForm propertyTypes={types ?? []} />
    </Page>
  );
}
