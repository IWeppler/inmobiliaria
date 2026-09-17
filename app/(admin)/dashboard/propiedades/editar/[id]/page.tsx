import { createClientServer } from "@/lib/supabase";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import {
  PropertyForm,
  type PropertyFormValues,
} from "@/features/dashboard/property/PropertyForm";
import { Page, PageHeader } from "@/shared/components/PageShell";

export const metadata: Metadata = { title: "Editar propiedad" };

type PropertyData = PropertyFormValues & {
  id: string;
  property_images: { id: string; image_url: string }[];
};

async function getPageData(propertyId: string) {
  const supabase = await createClientServer();

  // Propiedad + fotos (ordenadas) + amenities asignados. Sin los amenities
  // el formulario los daba por vacíos y al guardar los borraba.
  const [{ data: property, error }, { data: types }, { data: links }] = await Promise.all([
    supabase
      .from("properties")
      .select("*, property_images (id, image_url, order)")
      .eq("id", propertyId)
      .single(),
    supabase.from("property_types").select("id, name").order("name"),
    supabase.from("property_amenities").select("amenity_id").eq("property_id", propertyId),
  ]);

  if (error || !property) {
    console.error("Error fetching property for edit:", error);
    notFound();
  }

  const images = [...(property.property_images ?? [])]
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
    .map(({ id, image_url }) => ({ id, image_url: image_url ?? "" }))
    .filter((i) => i.image_url);

  return {
    initialData: {
      ...(property as unknown as PropertyFormValues & { id: string }),
      property_images: images,
      amenities: (links ?? []).map((l) => l.amenity_id),
    } as PropertyData,
    propertyTypes: types || [],
  };
}

export default async function EditPropertyPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  if (!id) notFound();
  const { initialData, propertyTypes } = await getPageData(id);

  return (
    <Page>
      <PageHeader
        backHref={`/dashboard/propiedades/${id}`}
        title="Editar propiedad"
        description={initialData.title}
      />
      <PropertyForm propertyTypes={propertyTypes} initialData={initialData} />
    </Page>
  );
}
