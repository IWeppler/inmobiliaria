"use client";

import Link from "next/link";
import { Bath, BedDouble, MapPin, Maximize2 } from "lucide-react";
import type { PropertyCardData } from "@/app/types/entities";
import { CardImageCarousel } from "@/features/properties/CardImageCarousel";

type PropertyCardProps = {
  property: PropertyCardData;
};

type OrderedImage = { image_url: string | null; order?: number | null };

// Fotos en el orden que definió la inmobiliaria (si viene `order`).
export function cardImages(images: OrderedImage[] | null | undefined) {
  return [...(images ?? [])]
    .sort((a, b) => (a.order ?? Number.MAX_SAFE_INTEGER) - (b.order ?? Number.MAX_SAFE_INTEGER))
    .map((img) => img.image_url)
    .filter((url): url is string => Boolean(url));
}

const STATUS_LABEL: Record<string, string> = {
  EN_VENTA: "En venta",
  EN_ALQUILER: "En alquiler",
  RESERVADO: "Reservado",
  VENDIDO: "Vendido",
  ALQUILADO: "Alquilado",
};

// Tarjeta del listado público. Toda la tarjeta lleva a la ficha (link
// estirado sobre el título); el carrusel queda por encima para poder
// deslizar las fotos. Alto parejo: el título reserva siempre dos líneas
// y el pie se apoya abajo.
export default function PropertyCard({ property }: PropertyCardProps) {
  const href = `/propiedades/${property.id}`;
  const images = cardImages(property.property_images as OrderedImage[] | null);

  const hasPrice = typeof property.price === "number" && property.price > 0;
  const priceDisplay = hasPrice
    ? `${property.currency || "USD"} $${(property.price as number).toLocaleString("es-AR")}`
    : "Consultar precio";
  const location = [property.street_address, property.city].filter(Boolean).join(", ");

  const specs = [
    property.bedrooms ? { key: "bed", icon: BedDouble, text: `${property.bedrooms} dorm.` } : null,
    property.bathrooms ? { key: "bath", icon: Bath, text: `${property.bathrooms} ${property.bathrooms === 1 ? "baño" : "baños"}` } : null,
    property.total_area ? { key: "area", icon: Maximize2, text: `${property.total_area} m²` } : null,
  ].filter(Boolean) as { key: string; icon: React.ElementType; text: string }[];

  return (
    <article className="group relative flex h-full flex-col overflow-hidden rounded-2xl border border-zinc-200 bg-white transition duration-300 hover:border-zinc-300 hover:shadow-[0_12px_32px_-16px_rgb(0_0_0/0.25)]">
      <CardImageCarousel
        images={images}
        alt={property.title || "Propiedad"}
        href={href}
        sizes="(min-width: 1024px) 30vw, 100vw"
        className="relative z-10 aspect-4/3 w-full"
      >
        <span className="pointer-events-none absolute top-3 left-3 z-10 rounded-md bg-white/95 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-zinc-900 shadow-sm">
          {STATUS_LABEL[property.status] ?? "Propiedad"}
        </span>
      </CardImageCarousel>

      <div className="flex flex-1 flex-col p-4">
        <p className="font-clash text-xl font-semibold text-zinc-900">{priceDisplay}</p>

        <h3 className="mt-1 line-clamp-2 min-h-[2lh] text-[15px] font-medium leading-snug text-zinc-800">
          <Link href={href} className="after:absolute after:inset-0 focus-visible:outline-none">
            {property.title}
          </Link>
        </h3>

        <p className="mt-1.5 flex items-center gap-1 truncate text-sm text-zinc-500">
          <MapPin className="h-3.5 w-3.5 shrink-0" />
          <span className="truncate">{location || "Ubicación a consultar"}</span>
        </p>

        <div className="mt-auto pt-4">
          <div className="flex min-h-5 flex-wrap items-center gap-x-4 gap-y-1 border-t border-zinc-100 pt-3 text-sm text-zinc-600">
            {specs.map(({ key, icon: Icon, text }) => (
              <span key={key} className="inline-flex items-center gap-1.5">
                <Icon className="h-4 w-4 text-zinc-400" />
                {text}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* Anillo de foco para el link estirado */}
      <span className="pointer-events-none absolute inset-0 rounded-2xl ring-zinc-900 ring-offset-2 group-has-[a:focus-visible]:ring-2" />
    </article>
  );
}
