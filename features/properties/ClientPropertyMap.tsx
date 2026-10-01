"use client";

import dynamic from "next/dynamic";
import { MapPin } from "lucide-react";

const DynamicPropertyMap = dynamic(
  () => import("@/features/properties/PropertyMap").then((mod) => mod.default),
  {
    loading: () => <div className="h-full w-full animate-pulse bg-muted" aria-label="Cargando mapa" />,
    ssr: false,
  }
);

type ClientPropertyMapProps = {
  lat: number | null;
  lng: number | null;
  title: string;
};

export function ClientPropertyMap({ lat, lng, title }: ClientPropertyMapProps) {
  if (typeof lat !== "number" || typeof lng !== "number") {
    return (
      <div className="flex h-full w-full flex-col items-center justify-center bg-muted p-6 text-center text-muted-foreground">
        <MapPin size={32} className="mb-2 opacity-60" aria-hidden="true" />
        <p>Ubicación exacta no disponible en el mapa.</p>
      </div>
    );
  }

  return <DynamicPropertyMap lat={lat} lng={lng} title={title} />;
}
