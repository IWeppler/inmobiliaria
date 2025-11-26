import { createClientServer } from "@/lib/supabase";
import PropertyCard from "@/features/properties/PropertyCard";
import { PropertyCardData } from "@/app/types/entities";
import { PropertyFilterList } from "@/features/properties/PropertyFilterList";
import { Search } from "lucide-react";
import { SortDropdown } from "@/features/properties/SortDropdown";

export const revalidate = 60;

type PropertyType = { id: number; name: string };
type Amenity = { id: number; name: string };

type PageSearchParams = {
  tipo?: string;
  typeId?: string;
  loc?: string;
  amenities?: string;
  bedrooms?: string;
  bathrooms?: string;
  sortBy?: string;
};

export default async function PropiedadesPage({
  searchParams: searchParamsPromise,
}: {
  searchParams: Promise<PageSearchParams>;
}) {
  const searchParams = await searchParamsPromise;
  const supabase = await createClientServer();

  const amenityJoin = searchParams.amenities
    ? "property_amenities!inner"
    : "property_amenities";

  let query = supabase.from("properties").select(
    `
      id, title, price, currency, bedrooms, bathrooms,
      total_area, city, street_address, status,
      property_images ( image_url ),
      ${amenityJoin} ( amenity_id ) 
    `
  );

  // --- Aplicar Filtros de searchParams ---
  if (searchParams.tipo === "venta") {
    query = query.eq("status", "EN_VENTA");
  } else if (searchParams.tipo === "alquiler") {
    query = query.eq("status", "EN_ALQUILER");
  }

  if (searchParams.typeId) {
    query = query.eq("property_type_id", searchParams.typeId);
  }

  if (searchParams.loc) {
    query = query.eq("city", searchParams.loc);
  }

  if (searchParams.bedrooms) {
    query = query.gte("bedrooms", searchParams.bedrooms);
  }

  if (searchParams.bathrooms) {
    query = query.gte("bathrooms", searchParams.bathrooms);
  }

  if (searchParams.amenities) {
    const amenityIds = searchParams.amenities.split(",");
    query = query.in("property_amenities.amenity_id", amenityIds);
  }

  if (searchParams.sortBy === "price_asc") {
    query = query.order("price", { ascending: true });
  } else if (searchParams.sortBy === "price_desc") {
    query = query.order("price", { ascending: false });
  } else {
    query = query.order("created_at", { ascending: false });
  }

  // 2. Ejecutamos la consulta de propiedades
  const { data, error } = await query;

  // 3. Hacemos consultas para OBTENER los filtros
  const { data: propertyTypes } = await supabase
    .from("property_types")
    .select("id, name");
  const { data: amenities } = await supabase
    .from("amenities")
    .select("id, name");

  const { data: citiesData } = await supabase.from("properties").select("city");
  const cities = [
    ...new Set(citiesData?.map((p) => p.city).filter(Boolean) || []),
  ].sort();

  if (error) {
    console.error("Error fetching properties:", error);
  }

  const properties: PropertyCardData[] = (data as PropertyCardData[]) || [];

 return (
  <main className="flex min-h-screen w-full flex-col bg-complementary">
    <div className="container mx-auto max-w-7xl p-4 md:py-24">
      
      {/* Header y Sort (Sin cambios) */}
      <div className="flex flex-col md:flex-row justify-between md:items-center mb-8">
        <h1 className="text-3xl md:text-4xl font-clash font-semibold">
          Propiedades Disponibles
        </h1>
        <SortDropdown currentSort={searchParams.sortBy || "default"} />
      </div>

      {/* --- Layout de Grilla  --- */}
      <div className="grid grid-cols-1 md:grid-cols-[280px_1fr] gap-8">
        
        {/* Sidebar */}
        <aside className="
          order-1 
          lg:order-0 
          h-fit 
          lg:sticky top-24
        ">
          <PropertyFilterList
            types={propertyTypes as PropertyType[]}
            amenities={amenities as Amenity[]}
            cities={cities as string[]}
            currentParams={searchParams}
          />
        </aside>

        {/* Cards Section */}
        <section className="
          order-2
          lg:order-0 
        ">
          {properties.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-1 md:grid-cols-1 lg:grid-cols-2 gap-6">
              {properties.map((property) => (
                <PropertyCard
                  key={property.id}
                  property={property as PropertyCardData}
                />
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-96 w-full bg-white border border-zinc-200 rounded-lg">
              <Search size={48} className="text-zinc-400 mb-4" />
              <h3 className="text-xl mb-2 font-semibold">Sin resultados</h3>
              <p className="text-zinc-500 px-4 text-center">
                No se encontraron propiedades con esos filtros.
              </p>
            </div>
          )}
        </section>

      </div>
    </div>
  </main>
);
}