import { createClientServer } from "@/lib/supabase";
import { Hero } from "@/features/public/Hero";
import PropertyCard from "@/features/properties/PropertyCard";
import { PropertyCardData } from "@/app/types/entities";
import { Solutions } from "@/features/public/Solutions";

export default async function Home() {
  const supabase = await createClientServer();

 const { data: properties, error } = await supabase
    .from("properties")
    .select(
      `
      id,
      title,
      price,
      currency,
      bedrooms,
      bathrooms,
      total_area,
      city,
      street_address, 
      status,
      property_images ( image_url )
    `
    )
    .eq("status", "EN_VENTA")
    .order("created_at", { ascending: false })
    .limit(6);

  if (error) {
    console.error("Error al cargar propiedades:", error.message);
  }

  const safeProperties = properties ?? [];

  return (
    <div className="flex min-h-screen flex-col items-start justify-center mx-2 md:mx-8">
      <Hero />
      <main className="flex min-h-screen w-full flex-col items-center justify-start py-16">
        <section className="w-full pb-16">
  <h2 className="text-4xl md:text-5xl font-clash font-semibold mb-4">
    Nuevas Propiedades
  </h2>

  {safeProperties.length > 0 ? (
    <div className="grid grid-cols-1 gap-2 md:grid-cols-2 lg:gap-6 lg:grid-cols-4 w-full">
      {safeProperties.map((property) => (
        <PropertyCard key={property.id} property={property as PropertyCardData} />
      ))}
    </div>
  ) : (
    <p>No hay propiedades disponibles en este momento.</p>
  )}
</section>

        <Solutions />
      </main>
    </div>
  );
}