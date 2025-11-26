import { createClientServer } from "@/lib/supabase";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import {
  propertySchema,
  PropertyForm,
} from "@/features/dashboard/PropertyForm";
import { z } from "zod";

type PropertyData = z.infer<typeof propertySchema> & {
  id: string;
  property_images: { id: string; image_url: string }[];
};

async function getPageData(propertyId: string) {
  const supabase = await createClientServer();

  // 1. Buscar la propiedad específica
  const { data: property, error } = await supabase
    .from("properties")
    .select(
      `
      *, 
      property_images (id, image_url)
    `
    )
    .eq("id", propertyId)
    .single();

  if (error || !property) {
    console.error("Error fetching property for edit:", error);
    notFound();
  }

  // 2. Buscar TODOS los tipos de propiedad (para el dropdown)
  const { data: types } = await supabase
    .from("property_types")
    .select("id, name")
    .order("name", { ascending: true });

  return {
    initialData: property as unknown as PropertyData,
    propertyTypes: types || [],
  };
}

// El componente de la página
export default async function EditPropertyPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  if (!(await params).id) {
    notFound();
  }
  const { initialData, propertyTypes } = await getPageData((await params).id);

  return (
    <div className="flex-1 space-y-8 max-w-5xl mx-auto p-4">
      <Suspense fallback={<div>Cargando formulario...</div>}>
        <PropertyForm propertyTypes={propertyTypes} initialData={initialData}  />
      </Suspense>
    </div>
  );
}
