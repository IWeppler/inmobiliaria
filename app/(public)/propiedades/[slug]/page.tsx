import { createClientServer } from "@/lib/supabase";
import { notFound } from "next/navigation";
import {
  MapPin,
  Bath,
  BedDouble,
  Ruler,
  Building,
  Car,
  CheckCircle,
} from "lucide-react";

// Componentes Cliente que crearemos
import { ClientPropertyMap } from "@/features/properties/ClientPropertyMap";
import { ImageGallery } from "@/features/properties/ImageGallery";
import { DescriptionWithReadMore } from "@/features/properties/DescriptionReadMore";
import { AgentCard } from "@/features/public/AgentCard";

// --- Tipos ---
type Amenity = { amenities: { name: string } | null };
type PropertyImage = { image_url: string | null };

type PropertyFullDetails = {
  id: string;
  title: string;
  street_address: string | null;
  neighborhood: string | null;
  city: string | null;
  province: string | null;
  status: string;
  price: number | null;
  currency: string | null;
  property_types: { name: string } | null;
  bedrooms: number | null;
  bathrooms: number | null;
  rooms: number | null;
  total_area: number | null;
  covered_area: number | null;
  description: string | null;
  latitude: number | null;
  longitude: number | null;
  expensas: number | null;
  antiguedad: string | null;
  cocheras: number | null;
  property_images: PropertyImage[];
  property_amenities: Amenity[];
  agents: {
    full_name: string | null;
    avatar_url: string | null;
    phone: string | null;
    email: string | null;
  } | null;
};
// ---

// --- Carga de Datos ---
async function getPropertyDetails(
  slug: string
): Promise<PropertyFullDetails | null> {
  const supabase = await createClientServer();
  const { data, error } = await supabase
    .from("properties")
    .select(
      `
      id, title, street_address, neighborhood, city, province, status,
      price, currency, bedrooms, bathrooms, total_area, covered_area,
      description, latitude, longitude, expensas, antiguedad, cocheras,
      property_types ( name ),
      property_images ( image_url ),
      property_amenities ( amenities ( name ) ),
      agents ( full_name, avatar_url, phone, email )
    `
    )
    .eq("id", slug)
    .single();

  if (error) {
    console.error("Error fetching property details:", error);
    return null;
  }
  return data as unknown as PropertyFullDetails;
}

// --- Componentes de UI Helpers ---
function AspectItem({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ElementType;
  label: string;
  value: string | number | null;
}) {
  if (!value) return null;
  return (
    <div className="flex items-center gap-4 ">
      <div className="p-3 bg-white  rounded-xl border">
        <Icon className="w-5 h-5 text-main" />
      </div>

      <div>
        <dt className="text-sm text-zinc-500">{label}</dt>
        <dd className="text-lg font-semibold">{value}</dd>
      </div>
    </div>
  );
}

// Un helper para la tabla de "Aspectos Técnicos"
function TechSpecItem({
  label,
  value,
}: {
  label: string;
  value: string | number | null;
}) {
  if (!value) return null;
  return (
    <div className="flex justify-between py-3 border-b">
      <dt className="text-zinc-600">{label}</dt>
      <dd className="font-medium">{value}</dd>
    </div>
  );
}

// --- La Página ---
export default async function PropertyPage({
  params: paramsPromise,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await paramsPromise;
  const property = await getPropertyDetails(slug);

  if (!property) {
    notFound();
  }

  // --- Lógica de Preparación de Datos ---
  const {
    title,
    street_address,
    neighborhood,
    city,
    province,
    status,
    price,
    currency,
    property_images,
    property_amenities,
  } = property;

  // Formateo de Ubicación
  const locationParts = [street_address, neighborhood, city, province].filter(
    Boolean
  );
  const locationString = locationParts.join(" | ");

  // Diccionario de Status (como en tu dashboard)
  const statusLabels: { [key: string]: string } = {
    EN_VENTA: "En Venta",
    EN_ALQUILER: "En Alquiler",
    RESERVADO: "Reservado",
    VENDIDO: "Vendido",
  };
  const statusDisplay = statusLabels[status] || status;

  // Formateo de Precio
  let priceDisplay = "Consultar Precio";
  if (typeof price === "number" && price > 0) {
    const formattedPrice = new Intl.NumberFormat("es-AR", {
      style: "decimal",
    }).format(price);
    priceDisplay = `${currency || "USD"} $${formattedPrice}`;
  }

  // Lista de Amenities
  const amenities =
    property_amenities?.map((a) => a.amenities?.name).filter(Boolean) || [];

  // Lista de Imágenes
  const images =
    property_images?.map((img) => img.image_url).filter(Boolean) || [];

  return (
    <main>
      <div className="container mx-auto max-w-7xl p-4 md:p-8 py-12">
        {/* --- 1. Header (Título, Precio, Ubicación) --- */}
        <header className="mb-6 md:mb-10">
          <div className="flex flex-col md:flex-row justify-between md:items-end mb-2">
            <h1 className="font-clash text-2xl md:text-4xl font-semibold leading-tight max-w-5xl">
              {title}
            </h1>

            <div className="mt-2 md:mt-0 text-left md:text-right shrink-0">
              <span className="text-xs md:text-sm font-semibold text-main">
                {statusDisplay}
              </span>

              <p className="font-clash text-xl md:text-2xl font-semibold text-black">
                {priceDisplay}
              </p>
            </div>
          </div>

          <div className="flex items-center text-zinc-600 mt-1">
            <MapPin size={16} className="mr-2 shrink-0" />
            <span className="text-sm md:text-base">{locationString}</span>
          </div>
        </header>

        <ImageGallery images={images as string[]} />

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 md:gap-12 mt-12">
          {/* Columna Principal de Contenido */}
          <div className="lg:col-span-2 space-y-12">
            {/* 3.1. Aspectos Básicos */}
            <section>
              <h2 className="font-clash text-xl md:text-2xl font-semibold mb-6">
                Aspectos Básicos
              </h2>

              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                <AspectItem
                  icon={BedDouble}
                  label="Dormitorios"
                  value={property.bedrooms}
                />
                <AspectItem
                  icon={Bath}
                  label="Baños"
                  value={property.bathrooms}
                />
                <AspectItem
                  icon={Building}
                  label="Ambientes"
                  value={property.rooms}
                />
                <AspectItem
                  icon={Ruler}
                  label="Sup. Total"
                  value={
                    property.total_area ? `${property.total_area} m²` : null
                  }
                />
                <AspectItem
                  icon={Ruler}
                  label="Sup. Cubierta"
                  value={
                    property.covered_area ? `${property.covered_area} m²` : null
                  }
                />
                <AspectItem
                  icon={Car}
                  label="Cocheras"
                  value={property.cocheras}
                />
              </div>
            </section>

            {/* 3.2. Descripción */}
            <section>
              <h2 className="font-clash text-xl md:text-2xl font-semibold mb-4">
                Lo que tenés que saber de esta propiedad
              </h2>

              <DescriptionWithReadMore
                text={property.description || "No hay descripción disponible."}
              />
            </section>

            {/* 3.3. Amenities */}
            {amenities.length > 0 && (
              <section>
                <h2 className="font-clash text-xl md:text-2xl font-semibold mb-6">
                  Amenities y Características
                </h2>

                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  {amenities.map((name) => (
                    <div
                      key={name}
                      className="flex items-center gap-3 text-sm md:text-base text-zinc-700"
                    >
                      <CheckCircle size={18} className="text-main shrink-0" />
                      <span>{name}</span>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* 3.4. Aspectos Técnicos */}
            <section>
              <h2 className="font-clash text-xl md:text-2xl font-semibold mb-6">
                Aspectos Técnicos de la propiedad
              </h2>

              <div className="max-w-md space-y-2">
                <TechSpecItem label="Precio" value={priceDisplay} />
                <TechSpecItem
                  label="Expensas"
                  value={
                    property.expensas
                      ? `ARS $${property.expensas}`
                      : "No especifica"
                  }
                />
                <TechSpecItem label="Antigüedad" value={property.antiguedad} />
                <TechSpecItem
                  label="Superficie Total"
                  value={
                    property.total_area ? `${property.total_area} m²` : null
                  }
                />
                <TechSpecItem
                  label="Superficie Cubierta"
                  value={
                    property.covered_area ? `${property.covered_area} m²` : null
                  }
                />
                <TechSpecItem label="Cocheras" value={property.cocheras} />
                <TechSpecItem label="ID de Propiedad" value={property.id} />
              </div>
            </section>

            {/* 3.5. Ubicación */}
            <section>
              <h2 className="font-clash text-xl md:text-2xl font-semibold mb-6">
                Ubicación
              </h2>

              <div className="h-[400px] w-full rounded-lg overflow-hidden border">
                <ClientPropertyMap
                  lat={property.latitude}
                  lng={property.longitude}
                  title={property.title}
                />
              </div>
            </section>
          </div>

          {/* Aside */}
          <aside className="lg:col-span-1">
            <div className="sticky top-24">
              <AgentCard
                agent={property.agents}
                propertyTitle={property.title}
              />
            </div>
          </aside>
        </div>
      </div>
    </main>
  );
}
