import { createClientServer } from "@/lib/supabase";
import { notFound } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { Metadata } from "next";
import { BRAND, formatLocation, formatPrice } from "@/lib/brand";
import {
  MapPin,
  Bath,
  BedDouble,
  Ruler,
  Building,
  Car,
  CheckCircle,
  ArrowRight,
  ArrowLeft,
  DoorOpen,
  Maximize2,
  Navigation,
  Receipt,
  CalendarClock,
  Tag,
} from "lucide-react";

import { ClientPropertyMap } from "@/features/properties/ClientPropertyMap";
import { ImageGallery } from "@/features/properties/ImageGallery";
import { DescriptionWithReadMore } from "@/features/properties/DescriptionReadMore";
import { AgentCard, MobileContactBar } from "@/features/public/AgentCard";
import { ViewCounter } from "@/features/public/ViewCounter";
import { PropertyJsonLd } from "@/features/public/seo/PropertyJsonLd";
import { PropertyFullDetails } from "@/features/properties/types/index";
import { ShareButton } from "@/features/properties/ShareButton";
import { formatArea } from "@/features/social/propertyCard";
import { FactChip, KeyFacts, type Fact } from "@/features/properties/KeyFacts";

// --- Carga de Datos Principal ---
async function getPropertyDetails(
  slug: string,
): Promise<PropertyFullDetails | null> {
  const supabase = await createClientServer();
  const { data, error } = await supabase
    .from("properties")
    .select(
      `
      id, title, street_address, neighborhood, city, province, status, available_from, operation_type,
      price, currency, bedrooms, bathrooms, total_area, covered_area, rooms,
      description, latitude, longitude, expensas, antiguedad, cocheras,
      property_types ( name ),
      property_images ( image_url, order ),
      property_amenities ( amenities ( name ) ),
      agents!properties_agent_id_fkey ( id, full_name, avatar_url, phone, email )
    `,
    )
    .eq("id", slug)
    .single();

  if (error) {
    console.error("Error fetching property details:", error);
    if (error.code === "PGRST116") return null;
    throw new Error("No se pudieron cargar los datos de la propiedad.");
  }
  return data as unknown as PropertyFullDetails;
}

// --- Cargar Recomendados ---
async function getRecommendedProperties(
  currentId: string,
  city: string | null,
  operationType: string,
) {
  const supabase = await createClientServer();

  // 1. Buscamos primero en la misma ciudad y misma operación
  let { data } = await supabase
    .from("properties")
    .select(
      "id, title, price, currency, city, province, bedrooms, total_area, property_images(image_url)",
    )
    .eq("operation_type", operationType)
    .in("status", ["EN_VENTA", "EN_ALQUILER"])
    .eq("city", city || "")
    .neq("id", currentId)
    .limit(3);

  // 2. FALLBACK: Si no encuentra suficientes en la misma ciudad, busca en cualquier ciudad
  if (!data || data.length === 0) {
    const fallback = await supabase
      .from("properties")
      .select(
        "id, title, price, currency, city, province, bedrooms, total_area, property_images(image_url)",
      )
      .eq("operation_type", operationType)
      .in("status", ["EN_VENTA", "EN_ALQUILER"])
      .neq("id", currentId)
      .limit(3);

    data = fallback.data;
  }

  return data || [];
}

// --- Metadata (SEO / OG) ---
// E2.1: la imagen de previsualización la genera opengraph-image.tsx (misma
// carpeta) -- Next la agrega sola a og:image y twitter:image, no hace
// falta declararla acá. Título y descripción con precio + ubicación para
// que la tarjeta de WhatsApp/redes sea informativa sin abrir el link.
export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const supabase = await createClientServer();

  const { data: property } = await supabase
    .from("properties")
    .select(
      "title, description, price, currency, city, province, neighborhood, bedrooms, total_area, operation_type",
    )
    .eq("id", slug)
    .single();

  if (!property) return { title: `Propiedad no encontrada | ${BRAND.name}` };

  const price = formatPrice(property.price, property.currency);
  const location = formatLocation(property);
  const specs = [
    property.bedrooms ? `${property.bedrooms} dorm.` : null,
    property.total_area ? formatArea(Number(property.total_area)) : null,
  ]
    .filter(Boolean)
    .join(" · ");
  const operation =
    property.operation_type?.toUpperCase() === "ALQUILER"
      ? "En alquiler"
      : "En venta";

  // Corte en palabra completa: WhatsApp muestra ~2 líneas de descripción.
  const excerpt = property.description?.replace(/\s+/g, " ").trim();
  const shortExcerpt = excerpt && excerpt.length > 120
    ? `${excerpt.slice(0, 120).replace(/\s+\S*$/, "")}…`
    : excerpt;
  const shortDescription = [
    [operation, price, specs].filter(Boolean).join(" · "),
    location,
    shortExcerpt,
  ]
    .filter(Boolean)
    .join(". ");

  return {
    title: `${property.title} | ${price}`,
    description: shortDescription,
    alternates: { canonical: `/propiedades/${slug}` },
    openGraph: {
      title: `${property.title} · ${price}`,
      description: shortDescription,
      url: `/propiedades/${slug}`,
      siteName: BRAND.name,
      locale: "es_AR",
      type: "website",
    },
    twitter: {
      card: "summary_large_image",
      title: `${property.title} · ${price}`,
      description: shortDescription,
    },
  };
}

// --- Helpers Visuales ---
function TechSpecItem({
  label,
  value,
}: {
  label: string;
  value: string | number | null;
}) {
  if (value === null || value === undefined || value === "") return null;
  return (
    <div className="flex justify-between py-3 border-b border-zinc-100 last:border-0">
      <dt className="text-zinc-600">{label}</dt>
      <dd className="font-medium text-right text-zinc-900">{value}</dd>
    </div>
  );
}

// --- Página Principal ---
export default async function PropertyPage({
  params: paramsPromise,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await paramsPromise;
  const property = await getPropertyDetails(slug);

  if (!property) notFound();

  // 1. Cargar Recomendados
  const recommendedProperties = await getRecommendedProperties(
    property.id,
    property.city,
    property.operation_type ?? "",
  );

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

  const locationString = [street_address, neighborhood, city, province]
    .filter(Boolean)
    .join(", ");
  const statusLabels: { [key: string]: string } = {
    EN_VENTA: "En Venta",
    EN_ALQUILER: "En Alquiler",
    RESERVADO: "Reservado",
    VENDIDO: "Vendido",
    ALQUILADO: "Alquilado",
  };
  const statusDisplay = statusLabels[status] || status;

  let priceDisplay = "Consultar Precio";
  if (typeof price === "number" && price > 0) {
    const formattedPrice = new Intl.NumberFormat("es-AR", {
      style: "decimal",
    }).format(price);
    priceDisplay = `${currency || "USD"} $${formattedPrice}`;
  }

  const amenities =
    property_amenities?.map((a) => a.amenities?.name).filter(Boolean) || [];
  const images = [...(property_images || [])]
    .sort(
      (a, b) =>
        (a.order ?? Number.MAX_SAFE_INTEGER) -
        (b.order ?? Number.MAX_SAFE_INTEGER),
    )
    .map((img) => img.image_url)
    .filter((url): url is string => Boolean(url));
  const available = status === "EN_VENTA" || status === "EN_ALQUILER";
  const isRent =
    property.operation_type?.toUpperCase() === "ALQUILER" ||
    status === "EN_ALQUILER" ||
    status === "ALQUILADO";
  const priceLabel = isRent ? "Alquiler mensual" : "Precio de venta";
  const expensasDisplay =
    property.expensas && property.expensas > 0
      ? `ARS $${property.expensas.toLocaleString("es-AR")}`
      : null;
  const pricePerM2 =
    !isRent &&
    typeof price === "number" &&
    price > 0 &&
    property.total_area &&
    property.total_area > 0
      ? `${currency || "USD"} $${Math.round(price / property.total_area).toLocaleString("es-AR")}`
      : null;
  const keyFacts = (
    [
      { icon: DoorOpen, label: "Ambientes", value: property.rooms },
      { icon: BedDouble, label: "Dormitorios", value: property.bedrooms },
      { icon: Bath, label: "Baños", value: property.bathrooms },
      { icon: Maximize2, label: "Sup. total", value: property.total_area, unit: "m²" },
      { icon: Ruler, label: "Sup. cubierta", value: property.covered_area, unit: "m²" },
      { icon: Car, label: "Cocheras", value: property.cocheras },
    ] as { icon: React.ElementType; label: string; value: number | string | null | undefined; unit?: string }[]
  ).filter((f): f is Fact => f.value !== null && f.value !== undefined && f.value !== "");
  const hasCoords =
    typeof property.latitude === "number" &&
    typeof property.longitude === "number";

  return (
    <main className="min-h-screen pb-24 lg:pb-0">
      <ViewCounter propertyId={property.id} />
      <PropertyJsonLd property={property} />

      <div className="container mx-auto max-w-[1480px] px-4 py-8 md:px-8 md:py-12">
        {/* Header */}
        <header className="mb-7 md:mb-9">
          <Link
            href="/propiedades"
            className="mb-6 inline-flex items-center gap-2 text-sm text-zinc-600 hover:text-zinc-900"
          >
            <ArrowLeft className="h-4 w-4" />
            Volver a las propiedades
          </Link>
          <div className="flex flex-wrap items-center gap-3">
            <span className="rounded-full border border-zinc-200 bg-zinc-100 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-zinc-700">
              {statusDisplay}
            </span>
            {/* Publicada antes de desocuparse (vacancia): desde cuándo se puede alquilar. */}
            {status === "EN_ALQUILER" && property.available_from && property.available_from > new Date().toISOString().slice(0, 10) && (
              <span className="text-sm text-zinc-600">
                Disponible desde el {property.available_from.split("-").reverse().join("/")}
              </span>
            )}
            {property.property_types?.name && (
              <span className="text-sm text-zinc-500">
                {property.property_types.name}
              </span>
            )}
          </div>
          <div className="mt-3 flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
            <div className="max-w-4xl">
              <h1 className="font-clash text-3xl font-semibold leading-tight text-zinc-900 md:text-5xl">
                {title}
              </h1>
              {locationString && (
                <p className="mt-3 flex items-start gap-2 text-sm text-zinc-600 md:text-base">
                  <MapPin size={18} className="mt-0.5 shrink-0" />
                  <span>{locationString}</span>
                </p>
              )}
            </div>
            <div className="flex shrink-0 items-center justify-between gap-4 md:block md:text-right">
              <p className="font-clash text-2xl font-semibold text-zinc-900 md:text-3xl">
                {priceDisplay}
              </p>
              <ShareButton
                title={title}
                price={priceDisplay}
                location={locationString}
              />
            </div>
          </div>
        </header>

        <ImageGallery images={images} title={title} />

        <div className="mt-12 grid grid-cols-1 gap-10 lg:grid-cols-12 lg:gap-12">
          {/* Columna Principal (8 columnas) */}
          <div className="space-y-14 lg:col-span-8">
            {/* Datos clave */}
            <section aria-labelledby="key-facts-title">
              <h2
                id="key-facts-title"
                className="font-clash text-2xl font-semibold mb-5 text-zinc-900"
              >
                La propiedad de un vistazo
              </h2>
              <KeyFacts facts={keyFacts} />
              <div className="mt-4 flex flex-wrap gap-2">
                <FactChip icon={Building} label="Tipo" value={property.property_types?.name ?? null} />
                <FactChip icon={Tag} label="Precio / m²" value={pricePerM2} />
                <FactChip icon={Receipt} label="Expensas" value={expensasDisplay} />
                <FactChip icon={CalendarClock} label="Antigüedad" value={property.antiguedad} />
              </div>
            </section>

            {/* Descripción */}
            <section>
              <h2 className="font-clash text-2xl font-semibold mb-4 text-zinc-900">
                Descripción
              </h2>
              <DescriptionWithReadMore
                text={property.description || "No hay descripción disponible."}
              />
            </section>

            {/* Amenities */}
            {amenities.length > 0 && (
              <section>
                <h2 className="font-clash text-2xl font-semibold mb-6 text-zinc-900">
                  Características
                </h2>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-y-4 gap-x-8">
                  {amenities.map((name) => (
                    <div
                      key={name}
                      className="flex items-center gap-3 text-zinc-700"
                    >
                      <CheckCircle size={18} className="text-black shrink-0" />
                      <span>{name}</span>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* Ficha Técnica */}
            <section>
              <h2 className="font-clash text-2xl font-semibold mb-6 text-zinc-900">
                Ficha Técnica
              </h2>
              <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-6">
                <div className="grid md:grid-cols-2 gap-x-12 gap-y-2">
                  <TechSpecItem label="Precio" value={priceDisplay} />
                  <TechSpecItem
                    label="Expensas"
                    value={
                      property.expensas === null
                        ? "No informadas"
                        : `ARS $${property.expensas.toLocaleString("es-AR")}`
                    }
                  />
                  <TechSpecItem
                    label="Antigüedad"
                    value={property.antiguedad}
                  />
                  <TechSpecItem
                    label="Superficie Total"
                    value={
                      property.total_area !== null
                        ? `${property.total_area} m²`
                        : null
                    }
                  />
                  <TechSpecItem
                    label="Superficie Cubierta"
                    value={
                      property.covered_area !== null
                        ? `${property.covered_area} m²`
                        : null
                    }
                  />
                  <TechSpecItem label="Cocheras" value={property.cocheras} />
                  <TechSpecItem
                    label="ID Ref"
                    value={property.id.slice(0, 8)}
                  />
                </div>
              </div>
            </section>

            {/* Mapa */}
            <section>
              <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
                <div>
                  <h2 className="font-clash text-2xl font-semibold text-zinc-900">
                    Ubicación
                  </h2>
                  {locationString && (
                    <p className="mt-1 text-sm text-zinc-600">{locationString}</p>
                  )}
                </div>
                {hasCoords && (
                  <a
                    href={`https://www.google.com/maps/dir/?api=1&destination=${property.latitude},${property.longitude}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 rounded-full border border-zinc-200 bg-white px-4 py-2 text-sm font-medium text-zinc-900 transition hover:bg-zinc-50"
                  >
                    <Navigation className="h-4 w-4" />
                    Cómo llegar
                  </a>
                )}
              </div>
              <div className="h-[380px] w-full overflow-hidden rounded-2xl border border-zinc-200 md:h-[460px]">
                <ClientPropertyMap
                  lat={property.latitude}
                  lng={property.longitude}
                  title={property.title}
                />
              </div>
            </section>
          </div>

          {/* Aside (4 columnas) */}
          <aside className="lg:col-span-4">
            <div className="sticky top-24 space-y-8">
              <AgentCard
                agent={property.agents}
                propertyTitle={property.title}
                propertyId={property.id}
                available={available}
                priceDisplay={priceDisplay}
                priceLabel={priceLabel}
                statusDisplay={statusDisplay}
                expensasDisplay={expensasDisplay}
              />
            </div>
          </aside>
        </div>

        {/* --- SECCIÓN: PROPIEDADES RECOMENDADAS --- */}
        {recommendedProperties && recommendedProperties.length > 0 && (
          <section className="mt-24 border-t pt-16">
            <div className="flex items-center justify-between mb-8">
              <h2 className="font-clash text-2xl md:text-3xl font-semibold">
                También te puede interesar
              </h2>
              <Link
                href="/propiedades"
                className="hidden md:flex items-center text-sm font-medium hover:underline"
              >
                Ver todas <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
              {recommendedProperties.map((prop) => {
                const mainImg =
                  prop.property_images?.[0]?.image_url || "/placeholder.jpg";
                let priceFmt = "Consultar Precio";
                if (prop.price && prop.price > 0) {
                  priceFmt = `${prop.currency} $${prop.price.toLocaleString(
                    "es-AR",
                  )}`;
                }

                return (
                  <Link
                    key={prop.id}
                    href={`/propiedades/${prop.id}`}
                    className="group block"
                  >
                    <div className="relative aspect-4/3 overflow-hidden rounded-xl bg-zinc-100 mb-4">
                      <Image
                        src={mainImg}
                        alt={prop.title}
                        fill
                        className="object-cover transition-transform duration-500 group-hover:scale-105"
                      />
                    </div>
                    <h3 className="font-semibold text-lg truncate text-zinc-900 group-hover:text-zinc-600 transition-colors">
                      {prop.title}
                    </h3>
                    <p className="text-zinc-500 text-sm mb-2">
                      {prop.city}, {prop.province}
                    </p>
                    <div className="flex items-center justify-between">
                      <p className="font-clash font-semibold text-lg">
                        {priceFmt}
                      </p>
                      {(prop.total_area || prop.bedrooms) && (
                        <div className="flex gap-3 text-xs text-zinc-500">
                          {prop.bedrooms && <span>{prop.bedrooms} Dorm</span>}
                          {prop.total_area && <span>{prop.total_area} m²</span>}
                        </div>
                      )}
                    </div>
                  </Link>
                );
              })}
            </div>
            <div className="mt-8 text-center md:hidden">
              <Link
                href="/propiedades"
                className="inline-flex items-center text-sm font-medium hover:underline"
              >
                Ver todas las propiedades{" "}
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </div>
          </section>
        )}
      </div>

      <MobileContactBar
        agent={property.agents}
        propertyTitle={property.title}
        propertyId={property.id}
        available={available}
        priceDisplay={priceDisplay}
        priceLabel={priceLabel}
      />
    </main>
  );
}
