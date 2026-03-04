"use client";

import Link from "next/link";
import Image from "next/image";
import {
  MapPin,
  Bath,
  BedDouble,
  Layout,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import type { PropertyCardData } from "@/app/types/entities";
import { useState } from "react";

type PropertyCardProps = {
  property: PropertyCardData;
};

export default function PropertyCard({ property }: PropertyCardProps) {
  // --- Lógica del Slider ---
  const [currentIndex, setCurrentIndex] = useState(0);
  const images =
    property.property_images?.map((img) => img.image_url).filter(Boolean) || [];

  const goToNext = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setCurrentIndex((prev) => (prev === images.length - 1 ? 0 : prev + 1));
  };

  const goToPrev = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setCurrentIndex((prev) => (prev === 0 ? images.length - 1 : prev - 1));
  };
  // ---

  const currentImage = images[currentIndex] || null;

  // --- Precio ---
  const hasPrice = typeof property.price === "number" && property.price > 0;
  const formattedPrice = hasPrice
    ? new Intl.NumberFormat("es-AR", { style: "decimal" }).format(
        property.price as number,
      )
    : null;
  const priceDisplay = hasPrice
    ? `${property.currency || "USD"} $${formattedPrice}`
    : "Consultar Precio";

  // --- Ubicación ---
  const locationDisplay = [property.street_address, property.city]
    .filter(Boolean)
    .join(", ");

  return (
    <div className="bg-white p-4 rounded-2xl border border-zinc-200 shadow-xs transition-all duration-300">
      {/* Imagen */}
      <div className="relative w-full h-56 group rounded-xl overflow-hidden">
        <Link
          href={`/propiedades/${property.id}`}
          className="block w-full h-full"
        >
          {images.length > 0 ? (
            <Image
              src={currentImage!}
              alt={property.title || "Propiedad"}
              fill
              className="object-cover transition-transform duration-500 group-hover:scale-[1.03]"
            />
          ) : (
            <div className="absolute inset-0 bg-zinc-100 flex items-center justify-center text-zinc-500">
              Sin foto
            </div>
          )}
        </Link>

        {/* Flechas */}
        {images.length > 1 && (
          <>
            <button
              onClick={goToPrev}
              className="absolute left-2 top-1/2 -translate-y-1/2 z-10 p-1.5 bg-white/90 rounded-full shadow-sm opacity-0 group-hover:opacity-100 transition-opacity hover:bg-white"
            >
              <ChevronLeft size={20} className="text-zinc-800" />
            </button>
            <button
              onClick={goToNext}
              className="absolute right-2 top-1/2 -translate-y-1/2 z-10 p-1.5 bg-white/90 rounded-full shadow-sm opacity-0 group-hover:opacity-100 transition-opacity hover:bg-white"
            >
              <ChevronRight size={20} className="text-zinc-800" />
            </button>
          </>
        )}

        {/* Estado */}
        <div className="absolute top-3 left-3 bg-white text-foreground font-semibold tracking-wide text-[10px] uppercase px-3 py-1.5 rounded-md shadow-sm">
          {property.status === "EN_VENTA"
            ? "En Venta"
            : property.status === "EN_ALQUILER"
              ? "En Alquiler"
              : "Propiedad"}
        </div>
      </div>

      {/* Contenido */}
      <div className="pt-4 flex flex-col gap-3">
        {/* Ubicación */}
        <div className="flex items-center text-zinc-500 text-sm truncate">
          <MapPin size={14} className="mr-1 shrink-0" />
          <span className="truncate">
            {locationDisplay || "Ubicación desconocida"}
          </span>
        </div>

        {/* Título */}
        <Link href={`/propiedades/${property.id}`}>
          <h3 className="text-xl font-clash font-semibold text-zinc-900 leading-tight line-clamp-2 transition-colors">
            {property.title}
          </h3>
        </Link>

        {/* Características */}
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-zinc-600 text-sm">
          {property.bedrooms !== null && property.bedrooms > 0 && (
            <span className="flex items-center gap-1.5">
              <BedDouble size={16} className="text-zinc-400" />{" "}
              {property.bedrooms}
            </span>
          )}
          {property.bathrooms !== null && property.bathrooms > 0 && (
            <span className="flex items-center gap-1.5">
              <Bath size={16} className="text-zinc-400" /> {property.bathrooms}
            </span>
          )}
          {property.total_area !== null && property.total_area > 0 && (
            <span className="flex items-center gap-1.5">
              <Layout size={16} className="text-zinc-400" />{" "}
              {property.total_area} m²
            </span>
          )}
        </div>

        {/* Precio + Link */}
        <div className="flex items-center justify-between pt-2">
          <span className="text-xl font-semibold text-zinc-900 font-clash">
            {priceDisplay}
          </span>

          <Link
            href={`/propiedades/${property.id}`}
            className="bg-foreground hover:bg-foreground/90 text-white px-4 py-2.5 rounded-lg text-sm font-medium transition-colors"
          >
            Ver Propiedad
          </Link>
        </div>
      </div>
    </div>
  );
}
