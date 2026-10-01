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
import { PropertySearchCombobox } from "@/features/properties/PropertySearchCombobox";
import { getUniqueLocations } from "@/shared/utils/getLocations";

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

  // Ubicación: una o varias ciudades separadas por coma.
  const locs = searchParams.loc?.split(",").map((c) => c.trim()).filter(Boolean) ?? [];
  if (locs.length === 1) {
    query = query.eq("city", locs[0]);
  } else if (locs.length > 1) {
    query = query.in("city", locs);
  }

  // Búsqueda libre por palabras: cada palabra tiene que aparecer en algún
  // campo (título, calle, barrio, ciudad o provincia), así "casa tostado"
  // o "tostado santa fe" encuentran resultados aunque la frase completa no
  // esté escrita igual en ningún campo. Se quitan los caracteres que
  // PostgREST interpreta dentro de .or() y los comodines.
  const q = searchParams.q?.replace(/[,()%*\\.:"]/g, " ").trim().slice(0, 80);
  const words = (q ?? "").split(/\s+/).filter(Boolean).slice(0, 6);
  for (const word of words) {
    const like = `%${word}%`;
    query = query.or(
      [
        `title.ilike.${like}`,
        `street_address.ilike.${like}`,
        `neighborhood.ilike.${like}`,
        `city.ilike.${like}`,
        `province.ilike.${like}`,
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

  // Ciudades con cantidad: sugerencias del buscador y opciones de Ubicación.
  const locations = await getUniqueLocations();
  const cities = [...new Set(locations.map((l) => l.city))].sort((a, b) => a.localeCompare(b, "es"));

  if (error) {
    console.error("Error fetching properties:", error);
  }

  const properties: PropertyCardData[] = (data as PropertyCardData[]) || [];
  const view = searchParams.vista === "mapa" ? "mapa" : "lista";

  // Mismo título y misma barra en lista y mapa: al cambiar de vista solo
  // cambia el contenido de abajo, el encabezado queda quieto.
  const title =
    searchParams.tipo === "venta"
      ? "Propiedades en venta"
      : searchParams.tipo === "alquiler"
        ? "Propiedades en alquiler"
        : "Propiedades";

  const header = (
    <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
      <div className="flex min-w-0 flex-col gap-3 md:flex-row md:items-center md:gap-5">
        <h1 className="shrink-0 font-clash text-2xl font-semibold tracking-tight text-foreground">{title}</h1>
        <div className="w-full md:w-80 lg:w-96">
          <PropertySearchCombobox locations={locations} />
        </div>
      </div>
      <div className="flex items-center gap-2">
        <ViewToggle current={view} />
        <SortDropdown currentSort={searchParams.sortBy || "default"} />
      </div>
    </div>
  );

  const emptyState = (
    <div className="flex h-full min-h-96 w-full flex-col items-center justify-center gap-2 rounded-lg border border-border bg-card px-4 text-center">
      <Search className="mb-2 h-10 w-10 text-muted-foreground" aria-hidden="true" />
      <h2 className="font-clash text-xl font-semibold text-foreground">Sin resultados</h2>
      <p className="max-w-[48ch] text-muted-foreground">
        {q
          ? `No encontramos propiedades para “${q}” con esos filtros.`
          : "No se encontraron propiedades con esos filtros."}
      </p>
    </div>
  );

  // Vista mapa: layout de aplicación que ocupa el viewport (sin doble
  // scroll). Mapa + lista llenan el alto que deja la barra.
  if (view === "mapa") {
    return (
      <div className="flex h-[calc(100dvh-4rem)] min-h-[600px] w-full flex-col bg-background">
        <div className="mx-auto flex w-full max-w-[1600px] flex-1 flex-col gap-3 px-3 pt-4 pb-3 md:px-6 md:pb-6">
          {header}

          <PropertyFilterBar
            types={(propertyTypes ?? []) as PropertyType[]}
            amenities={(amenities ?? []) as Amenity[]}
            cities={cities as string[]}
          />

          <div key="mapa" className="site-fade relative min-h-0 flex-1">
            {properties.length > 0 ? (
              <PublicMapView properties={(data ?? []) as unknown as MapProperty[]} />
            ) : (
              <div className="absolute inset-0">{emptyState}</div>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full bg-background">
      <div className="mx-auto flex w-full max-w-[1600px] flex-col gap-3 px-3 pt-4 pb-16 md:px-6">
        {header}

        {/* Vista lista: filtros al costado */}
        <div key="lista" className="site-fade grid grid-cols-1 gap-4 md:grid-cols-[280px_1fr]">
          <aside className="order-1 h-fit md:sticky md:top-20">
            <PropertyFilterList
              types={propertyTypes as PropertyType[]}
              amenities={amenities as Amenity[]}
              cities={cities as string[]}
              currentParams={searchParams}
            />
          </aside>

          <section aria-label="Resultados" className="order-2 min-w-0">
            {properties.length > 0 ? (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {properties.map((property) => (
                  <PropertyCard key={property.id} property={property} />
                ))}
              </div>
            ) : (
              emptyState
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
