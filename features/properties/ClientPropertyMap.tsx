"use client";

import dynamic from "next/dynamic";
import { MapPin } from "lucide-react";

const DynamicPropertyMap = dynamic(
  () => import("@/features/properties/PropertyMap").then((mod) => mod.default),
  {
    loading: () => (
      <p className="h-full w-full flex items-center justify-center">
        Cargando mapa...
      </p>
    ),
    ssr: false,
  }
);

type ClientPropertyMapProps = {
  lat: number | null;
  lng: number | null;
  title: string;
};

export function ClientPropertyMap({ lat, lng, title }: ClientPropertyMapProps) {
  if (!lat || !lng) {
    return (
      <div className="w-full h-full bg-zinc-200 flex flex-col items-center justify-center text-zinc-500 p-6 text-center">
        <MapPin size={32} className="mb-2 opacity-50" />
        <p>Ubicación exacta no disponible en el mapa.</p>
      </div>
    );
  }

  return <DynamicPropertyMap lat={lat} lng={lng} title={title} />;
}
