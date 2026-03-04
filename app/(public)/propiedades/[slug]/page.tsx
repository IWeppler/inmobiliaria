import { createClientServer } from "@/lib/supabase";
import { notFound } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { Metadata, ResolvingMetadata } from "next";
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
} from "lucide-react";

import { ClientPropertyMap } from "@/features/properties/ClientPropertyMap";
import { ImageGallery } from "@/features/properties/ImageGallery";
import { DescriptionWithReadMore } from "@/features/properties/DescriptionReadMore";
import { AgentCard } from "@/features/public/AgentCard";
import { ViewCounter } from "@/features/public/ViewCounter";
import { PropertyJsonLd } from "@/features/public/seo/PropertyJsonLd";
import { PropertyFullDetails } from "@/features/properties/types/index";
import { ShareButton } from "@/features/properties/ShareButton";

// --- Carga de Datos Principal ---
async function getPropertyDetails(
  slug: string,
): Promise<PropertyFullDetails | null> {
  const supabase = await createClientServer();
  const { data, error } = await supabase
    .from("properties")
    .select(
      `
      id, title, street_address, neighborhood, city, province, status, operation_type,
      price, currency, bedrooms, bathrooms, total_area, covered_area, rooms,
      description, latitude, longitude, expensas, antiguedad, cocheras,
      property_types ( name ),
      property_images ( image_url ),
      property_amenities ( amenities ( name ) ),
      agents ( id, full_name, avatar_url, phone, email )
    `,
    )
    .eq("id", slug)
    .single();

  if (error) {
    console.error("Error fetching property details:", error);
    return null;
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

// --- Metadata (SEO) ---
export async function generateMetadata(
  { params }: { params: Promise<{ slug: string }> },
  parent: ResolvingMetadata,
): Promise<Metadata> {
  const { slug } = await params;
  const supabase = await createClientServer();

  const { data: property } = await supabase
    .from("properties")
    .select("title, description, price, currency, property_images(image_url)")
    .eq("id", slug)
    .single();

  if (!property) return { title: "Propiedad no encontrada | TerraNova" };

  const previousImages = (await parent).openGraph?.images || [];
  const mainImage =
    property.property_images?.[0]?.image_url ||
    "https://inmobiliaria-pi.vercel.app/og-default.jpg";

  let priceText = "";
  if (property.price) {
    priceText = `| ${property.currency} $${property.price.toLocaleString(
      "es-AR",
    )}`;
  }

  return {
    title: `${property.title} ${priceText}`,
    description:
      property.description?.substring(0, 160) ||
      "Consultá por esta propiedad en TerraNova.",
    openGraph: {
      title: property.title,
      description: property.description?.substring(0, 160),
      url: `/propiedades/${slug}`,
      siteName: "TerraNova Inmobiliaria",
      images: [
        { url: mainImage, width: 1200, height: 630, alt: property.title },
        ...previousImages,
      ],
      locale: "es_AR",
      type: "website",
    },
  };
}

// --- Helpers Visuales ---
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
    <div className="flex items-center gap-4">
      <div className="p-3 bg-white rounded-xl border shadow-sm">
        <Icon className="w-5 h-5 text-black" />
      </div>
      <div>
        <dt className="text-xs text-zinc-500 uppercase tracking-wide">
          {label}
        </dt>
        <dd className="text-lg font-semibold text-zinc-900">{value}</dd>
      </div>
    </div>
  );
}

function TechSpecItem({
  label,
  value,
}: {
  label: string;
  value: string | number | null;
}) {
  if (!value) return null;
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
    property.operation_type,
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
    .join(" | ");
  const statusLabels: { [key: string]: string } = {
    EN_VENTA: "En Venta",
    EN_ALQUILER: "En Alquiler",
    RESERVADO: "Reservado",
    VENDIDO: "Vendido",
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
  const images =
    property_images?.map((img) => img.image_url).filter(Boolean) || [];

  return (
    <main className="min-h-screen">
      <ViewCounter propertyId={property.id} />
      <PropertyJsonLd property={property} />

      <div className="container mx-auto max-w-[1600px] p-4 md:p-8 py-8">
        {/* Header */}
        <header className="mb-8 md:mb-12">
          <Link
            href="/propiedades"
            className="flex gap-1 items-center mb-4 hover:underline cursor-pointer"
          >
            <ArrowLeft className="h-4 w-4" />
            <p>Volver a las propiedades</p>
          </Link>
          <div className="flex flex-col md:flex-row justify-between md:items-end mb-3 gap-4">
            <h1 className="font-clash text-3xl md:text-5xl font-semibold leading-tight max-w-4xl text-zinc-900">
              {title}
            </h1>
            <div className="md:text-right shrink-0">
              <div className="flex justify-end items-center gap-3 mb-2">
                <ShareButton title={title} />
                <span className="text-xs font-semibold tracking-wider text-white bg-main px-3 py-1.5 rounded-full uppercase">
                  {statusDisplay}
                </span>
              </div>
              <p className="font-clash text-2xl md:text-3xl font-bold text-zinc-900">
                {priceDisplay}
              </p>
            </div>
          </div>
          <div className="flex items-center text-zinc-500">
            <MapPin size={18} className="mr-2 shrink-0" />
            <span className="text-base font-medium">{locationString}</span>
          </div>
        </header>

        <ImageGallery images={images as string[]} />

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 mt-16">
          {/* Columna Principal (8 columnas) */}
          <div className="lg:col-span-8 space-y-16">
            {/* Aspectos Básicos */}
            <section>
              <h2 className="font-clash text-2xl font-semibold mb-6 text-zinc-900">
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
              <div className="bg-zinc-50 p-6 rounded-2xl border border-zinc-100">
                <div className="grid md:grid-cols-2 gap-x-12 gap-y-2">
                  <TechSpecItem label="Precio" value={priceDisplay} />
                  <TechSpecItem
                    label="Expensas"
                    value={
                      property.expensas
                        ? `ARS $${property.expensas}`
                        : "No especifica"
                    }
                  />
                  <TechSpecItem
                    label="Antigüedad"
                    value={property.antiguedad}
                  />
                  <TechSpecItem
                    label="Superficie Total"
                    value={
                      property.total_area ? `${property.total_area} m²` : null
                    }
                  />
                  <TechSpecItem
                    label="Superficie Cubierta"
                    value={
                      property.covered_area
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
              <h2 className="font-clash text-2xl font-semibold mb-6 text-zinc-900">
                Ubicación
              </h2>
              <div className="h-[450px] w-full rounded-2xl overflow-hidden border border-zinc-200 shadow-sm">
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
    </main>
  );
}
