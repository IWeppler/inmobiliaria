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
        property.price as number
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
    <div className="bg-white p-4 rounded-2xl transition-all duration-300 overflow-hidden border border-gray-200">
      {/* Imagen (ahora con slider) */}
      <div className="relative w-full h-56 group">
        {images.length > 0 ? (
          <Image
            src={currentImage!}
            alt={property.title || "Propiedad"}
            className="absolute inset-4 object-cover rounded-lg"
            fill
          />
        ) : (
          <div className="absolute inset-4 bg-zinc-100 flex items-center justify-center text-zinc-500 rounded-lg">
            Sin foto
          </div>
        )}

        {/* Flechas del Slider */}
        {images.length > 1 && (
          <>
            <button
              onClick={goToPrev}
              className="absolute left-2 top-1/2 -translate-y-1/2 z-10 p-1 bg-white/50 cursor-pointer rounded-full shadow-md opacity-0 group-hover:opacity-100 transition-opacity"
            >
              <ChevronLeft size={20} />
            </button>
            <button
              onClick={goToNext}
              className="absolute right-2 top-1/2 -translate-y-1/2 z-10 p-1 bg-white/50 cursor-pointer rounded-full shadow-md opacity-0 group-hover:opacity-100 transition-opacity"
            >
              <ChevronRight size={20} />
            </button>
          </>
        )}

        {/* Etiqueta de Estado */}
        <div className="absolute top-3 left-3 bg-white/90 text-zinc-800 font-medium text-sm px-3 py-1 rounded-sm">
          {property.status === "EN_VENTA"
            ? "En Venta"
            : property.status === "EN_ALQUILER"
            ? "En Alquiler"
            : "Propiedad"}
        </div>
      </div>

      {/* Contenido */}
      <div className="pt-4 pb-2 flex flex-col justify-between">
        {/* Ubicación (Actualizada) */}
        <div className="flex items-center text-zinc-500 text-sm mb-2 truncate">
          <MapPin size={14} className="mr-1 shrink-0" />
          <span className="truncate">
            {locationDisplay || "Ubicación desconocida"}
          </span>
        </div>

        {/* Título */}
        <h3 className="text-lg font-semibold text-zinc-900 mb-3 truncate">
          {property.title}
        </h3>

        {/* Características */}
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-zinc-600 text-sm mb-4">
          <div className="flex items-center gap-1">
            <BedDouble size={16} /> {property.bedrooms} Dorm.
          </div>
          <div className="flex items-center gap-1">
            <Bath size={15} /> {property.bathrooms} Baños
          </div>
          <div className="flex items-center gap-1">
            <Layout size={15} /> {property.total_area} m²
          </div>
        </div>

        {/* Precio + Botón */}
        <div className="flex items-center justify-between mt-auto">
          <span className="text-xl font-bold text-gray-800">
            {priceDisplay}
          </span>

          <Link
            href={`/propiedades/${property.id}`}
            className="bg-foreground hover:bg-main text-white px-4 py-2 rounded-md text-sm font-medium transition-colors"
          >
            Ver Propiedad
          </Link>
        </div>
      </div>
    </div>
  );
}
