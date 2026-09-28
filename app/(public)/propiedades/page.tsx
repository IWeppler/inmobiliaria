import { createClientServer } from "@/lib/supabase";
import PropertyCard from "@/features/properties/PropertyCard";
import { PropertyCardData } from "@/app/types/entities";
import { PropertyFilterList } from "@/features/properties/PropertyFilterList";
import { Search } from "lucide-react";
import { SortDropdown } from "@/features/properties/SortDropdown";
import { ViewToggle } from "@/features/properties/ViewToggle";
import { PublicMapView } from "@/features/properties/PublicMapView";
import type { MapProperty } from "@/features/properties/PublicPropertiesMap";
import { PropertyFilterBar } from "@/features/properties/PropertyFilterBar";
import { PropertySearchInput } from "@/features/properties/PropertySearchInput";

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
  vista?: string;
  q?: string;
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
      total_area, city, street_address, status, latitude, longitude,
      property_images ( image_url, order ),
      ${amenityJoin} ( amenity_id ) 
    `,
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

  // Búsqueda libre: título, calle, barrio o ciudad. Se quitan los
  // caracteres que PostgREST interpreta dentro de .or() y los comodines.
  const q = searchParams.q?.replace(/[,()%*\\]/g, " ").trim().slice(0, 80);
  if (q) {
    const like = `%${q}%`;
    query = query.or(
      [
        `title.ilike.${like}`,
        `street_address.ilike.${like}`,
        `neighborhood.ilike.${like}`,
        `city.ilike.${like}`,
      ].join(","),
    );
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
  const view = searchParams.vista === "mapa" ? "mapa" : "lista";

  return (
    <main className="flex min-h-screen w-full flex-col bg-complementary">
      <div className="container mx-auto max-w-[1600px] p-4 md:py-16">
        <h1 className="mb-6 text-3xl md:text-4xl font-clash font-semibold">
          Propiedades Disponibles
        </h1>

        {/* Barra de herramientas: búsqueda + vista + orden */}
        <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="w-full md:max-w-md">
            <PropertySearchInput initial={searchParams.q ?? ""} />
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <ViewToggle current={view} />
            <SortDropdown currentSort={searchParams.sortBy || "default"} />
          </div>
        </div>

        {view === "mapa" ? (
          /* --- Vista mapa: filtros arriba, mapa a todo el ancho --- */
          <div className="space-y-3">
            <PropertyFilterBar
              types={(propertyTypes ?? []) as PropertyType[]}
              amenities={(amenities ?? []) as Amenity[]}
              cities={cities as string[]}
            />
            {properties.length > 0 ? (
              <PublicMapView properties={(data ?? []) as unknown as MapProperty[]} />
            ) : (
              <div className="flex flex-col items-center justify-center h-96 w-full bg-white border border-zinc-200 rounded-lg">
                <Search size={48} className="text-zinc-400 mb-4" />
                <h3 className="text-xl mb-2 font-semibold">Sin resultados</h3>
                <p className="text-zinc-500 px-4 text-center">
                  {q
                    ? `No encontramos propiedades para “${q}” con esos filtros.`
                    : "No se encontraron propiedades con esos filtros."}
                </p>
              </div>
            )}
          </div>
        ) : (
          /* --- Vista lista: filtros al costado --- */
          <div className="grid grid-cols-1 md:grid-cols-[280px_1fr] gap-2">
            <aside className="order-1 h-fit top-24 lg:order-0 lg:sticky">
              <PropertyFilterList
                types={propertyTypes as PropertyType[]}
                amenities={amenities as Amenity[]}
                cities={cities as string[]}
                currentParams={searchParams}
              />
            </aside>

            <section className="order-2 min-w-0 lg:order-0">
              {properties.length > 0 ? (
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
                  {properties.map((property) => (
                    <PropertyCard key={property.id} property={property} />
                  ))}
                </div>
              ) : (
              <div className="flex flex-col items-center justify-center h-96 w-full bg-white border border-zinc-200 rounded-lg">
                <Search size={48} className="text-zinc-400 mb-4" />
                <h3 className="text-xl mb-2 font-semibold">Sin resultados</h3>
                <p className="text-zinc-500 px-4 text-center">
                  {q
                    ? `No encontramos propiedades para “${q}” con esos filtros.`
                    : "No se encontraron propiedades con esos filtros."}
                </p>
              </div>
            )}
            </section>
          </div>
        )}
      </div>
    </main>
  );
}
