"use client";

import { useEffect, useMemo, useState } from "react";
import type { StyleSpecification } from "maplibre-gl";
import { LocateFixed, Loader2, MapPin } from "lucide-react";
import { toast } from "sonner";
import { Map, MapControls, MapMarker, MarkerContent, useMap } from "@/shared/components/ui/map";

type LatLngTuple = [number, number];
type Coordinates = { lat: number; lng: number };

const PICKER_STYLE: StyleSpecification = {
  version: 8,
  sources: {
    satellite: {
      type: "raster",
      tiles: ["https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"],
      tileSize: 256,
      attribution: "Tiles © Esri — Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community",
    },
    streets: {
      type: "raster",
      tiles: ["https://tile.openstreetmap.org/{z}/{x}/{y}.png"],
      tileSize: 256,
      attribution: "© OpenStreetMap contributors",
    },
  },
  layers: [
    { id: "satellite", type: "raster", source: "satellite" },
    { id: "streets", type: "raster", source: "streets", paint: { "raster-opacity": 0.4 } },
  ],
};

function MapUpdater({ center, zoom }: { center: [number, number]; zoom: number }) {
  const { map, isLoaded } = useMap();
  useEffect(() => {
    if (!map || !isLoaded) return;
    map.flyTo({ center, zoom, duration: 600 });
  }, [map, isLoaded, center, zoom]);
  return null;
}

function MapClickHandler({ onChange }: { onChange: (point: Coordinates) => void }) {
  const { map } = useMap();
  useEffect(() => {
    if (!map) return;
    const handleClick = (event: { lngLat: Coordinates }) => onChange(event.lngLat);
    map.on("click", handleClick);
    return () => { map.off("click", handleClick); };
  }, [map, onChange]);
  return null;
}

interface LocationPickerProps {
  initialLat?: number;
  initialLng?: number;
  cityCoordinates?: LatLngTuple;
  selected?: LatLngTuple | null;
  zoom?: number;
  onLocationSelect: (lat: number, lng: number) => void;
}

export default function LocationPicker({
  initialLat,
  initialLng,
  cityCoordinates = [-31.6107, -60.6973],
  selected,
  zoom = 13,
  onLocationSelect,
}: LocationPickerProps) {
  const [position, setPosition] = useState<Coordinates | null>(
    initialLat != null && initialLng != null ? { lat: initialLat, lng: initialLng } : null,
  );
  const [locating, setLocating] = useState(false);

  const [prevSelected, setPrevSelected] = useState(selected);
  if (selected?.[0] !== prevSelected?.[0] || selected?.[1] !== prevSelected?.[1]) {
    setPrevSelected(selected);
    if (selected) setPosition({ lat: selected[0], lng: selected[1] });
  }

  const [cityLat, cityLng] = cityCoordinates;
  const center = useMemo<[number, number]>(
    () => position ? [position.lng, position.lat] : [cityLng, cityLat],
    [position, cityLng, cityLat],
  );
  const effectiveZoom = position ? Math.max(zoom, 15) : zoom;

  const handleChange = (point: Coordinates) => {
    setPosition(point);
    onLocationSelect(point.lat, point.lng);
  };

  const useMyLocation = () => {
    if (!navigator.geolocation) {
      toast.error("Tu navegador no soporta geolocalización.");
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (result) => {
        handleChange({ lat: result.coords.latitude, lng: result.coords.longitude });
        setLocating(false);
        toast.success(`Ubicación marcada (precisión ±${Math.round(result.coords.accuracy)} m).`);
      },
      (error) => {
        setLocating(false);
        toast.error(error.code === error.PERMISSION_DENIED
          ? "Permiso de ubicación denegado."
          : "No se pudo obtener tu ubicación.");
      },
      { enableHighAccuracy: true, timeout: 10000 },
    );
  };

  return (
    <div className="relative isolate h-[400px] w-full overflow-hidden rounded-lg border border-border">
      <Map
        center={center}
        zoom={effectiveZoom}
        styles={{ light: PICKER_STYLE, dark: PICKER_STYLE }}
        className="h-full w-full"
      >
        <MapUpdater center={center} zoom={effectiveZoom} />
        <MapClickHandler onChange={handleChange} />
        <MapControls position="top-left" showZoom />
        {position && (
          <MapMarker longitude={position.lng} latitude={position.lat} draggable onDragEnd={handleChange}>
            <MarkerContent>
              <MapPin className="size-9 cursor-move fill-primary text-white drop-shadow-md" aria-label="Ubicación elegida" />
            </MarkerContent>
          </MapMarker>
        )}
      </Map>

      <div className="pointer-events-none absolute bottom-4 left-4 z-10 rounded-md border border-border bg-card/95 px-2 py-1 text-xs font-medium text-foreground shadow-md">
        {position ? "Arrastrá el marcador para ajustar" : "Hacé click para marcar la ubicación"}
      </div>
      <button
        type="button"
        onClick={useMyLocation}
        disabled={locating}
        className="absolute right-4 top-4 z-10 inline-flex h-7 items-center gap-1.5 rounded-md border border-border bg-card/95 px-2.5 text-xs font-medium text-foreground shadow-md hover:bg-card disabled:opacity-60"
      >
        {locating ? <Loader2 className="size-3.5 animate-spin" /> : <LocateFixed className="size-3.5" />}
        Usar mi ubicación
      </button>
      {position && (
        <div className="pointer-events-none absolute bottom-4 right-4 z-10 rounded-md border border-border bg-card/95 px-2 py-1 text-xs text-fg-secondary shadow-md">
          {position.lat.toFixed(5)}, {position.lng.toFixed(5)}
        </div>
      )}
    </div>
  );
}
