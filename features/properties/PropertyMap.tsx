"use client";

import { MapPin } from "lucide-react";
import { Map, MapMarker, MarkerContent, MarkerPopup } from "@/shared/components/ui/map";

type PropertyMapProps = {
  lat: number | null;
  lng: number | null;
  title: string;
};

export default function PropertyMap({ lat, lng, title }: PropertyMapProps) {
  if (typeof lat !== "number" || typeof lng !== "number") {
    return (
      <div className="flex h-full w-full items-center justify-center bg-muted text-muted-foreground">
        Ubicación no disponible
      </div>
    );
  }

  return (
    <Map center={[lng, lat]} zoom={16} scrollZoom={false} className="h-full w-full rounded-lg">
      <MapMarker longitude={lng} latitude={lat}>
        <MarkerContent>
          <MapPin className="size-9 fill-orange-500 text-white drop-shadow-md" aria-label={title} />
        </MarkerContent>
        <MarkerPopup>{title}</MarkerPopup>
      </MapMarker>
    </Map>
  );
}
