"use client";

import { useEffect, useMemo } from "react";
import Link from "next/link";
import { Bath, BedDouble, Maximize2 } from "lucide-react";
import { LngLatBounds } from "maplibre-gl";
import {
  Map,
  MapControls,
  MapMarker,
  MapPopup,
  MarkerContent,
  useMap,
} from "@/shared/components/ui/map";
import { cn } from "@/lib/utils";

export type MapProperty = {
  id: string;
  title: string;
  price: number | null;
  currency: string | null;
  bedrooms: number | null;
  bathrooms: number | null;
  total_area: number | null;
  city: string | null;
  street_address: string | null;
  status: string;
  latitude: number | null;
  longitude: number | null;
  property_images: { image_url: string | null; order?: number | null }[] | null;
};

export type LocatedProperty = MapProperty & { latitude: number; longitude: number };

export function isLocated(p: MapProperty): p is LocatedProperty {
  return typeof p.latitude === "number" && typeof p.longitude === "number";
}

// Precio completo ("USD $140.000"): en el sitio público no se abrevia.
export function fullPrice(price: number | null, currency: string | null) {
  if (!price || price <= 0) return "Consultar precio";
  return `${currency || "USD"} $${price.toLocaleString("es-AR")}`;
}

function FitBounds({ points }: { points: LocatedProperty[] }) {
  const { map, isLoaded } = useMap();
  useEffect(() => {
    if (!map || !isLoaded || points.length === 0) return;
    if (points.length === 1) {
      map.jumpTo({ center: [points[0].longitude, points[0].latitude], zoom: 14 });
      return;
    }
    const bounds = points.reduce(
      (b, p) => b.extend([p.longitude, p.latitude]),
      new LngLatBounds(),
    );
    map.fitBounds(bounds, { padding: 60, maxZoom: 15, duration: 0 });
  }, [map, isLoaded, points]);
  return null;
}

function FlyTo({ target }: { target: LocatedProperty | null }) {
  const { map, isLoaded } = useMap();
  useEffect(() => {
    if (!map || !isLoaded || !target) return;
    map.flyTo({
      center: [target.longitude, target.latitude],
      zoom: Math.max(map.getZoom(), 14),
      duration: 600,
    });
  }, [map, isLoaded, target]);
  return null;
}

function Popup({ property }: { property: LocatedProperty }) {
  const image = property.property_images?.[0]?.image_url;
  return (
    <Link
      href={`/propiedades/${property.id}`}
      className="group block w-[260px] overflow-hidden rounded-xl border border-zinc-200 bg-white text-zinc-900 shadow-xl"
    >
      <div className="relative h-[150px] bg-zinc-100">
        {image && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={image} alt="" className="h-full w-full object-cover" />
        )}
        <span className="absolute top-2 left-2 rounded-md bg-white px-2 py-1 text-[10px] font-semibold uppercase tracking-wide shadow-sm">
          {property.status === "EN_ALQUILER" ? "En alquiler" : "En venta"}
        </span>
      </div>
      <div className="space-y-1.5 p-3">
        <p className="font-clash text-lg font-semibold leading-tight">
          {fullPrice(property.price, property.currency)}
        </p>
        <p className="line-clamp-2 text-sm font-medium group-hover:underline">{property.title}</p>
        <p className="truncate text-xs text-zinc-500">
          {[property.street_address, property.city].filter(Boolean).join(", ")}
        </p>
        <Specs property={property} />
      </div>
    </Link>
  );
}

export function Specs({ property, className }: { property: MapProperty; className?: string }) {
  const items = [
    property.bedrooms ? { key: "bed", icon: BedDouble, text: `${property.bedrooms}` } : null,
    property.bathrooms ? { key: "bath", icon: Bath, text: `${property.bathrooms}` } : null,
    property.total_area ? { key: "area", icon: Maximize2, text: `${property.total_area} m²` } : null,
  ].filter(Boolean) as { key: string; icon: React.ElementType; text: string }[];
  if (items.length === 0) return null;
  return (
    <p className={cn("flex items-center gap-3 text-xs text-zinc-600", className)}>
      {items.map(({ key, icon: Icon, text }) => (
        <span key={key} className="inline-flex items-center gap-1">
          <Icon className="h-3.5 w-3.5 text-zinc-400" />
          {text}
        </span>
      ))}
    </p>
  );
}

const DEFAULT_CENTER: [number, number] = [-61.0, -32.0];

export default function PublicPropertiesMap({
  properties,
  activeId,
  selectedId,
  onActiveChange,
  onSelect,
  focus,
}: {
  properties: LocatedProperty[];
  activeId: string | null;
  selectedId: string | null;
  onActiveChange: (id: string | null) => void;
  onSelect: (id: string | null) => void;
  focus: LocatedProperty | null;
}) {
  // FitBounds solo cuando cambia el set de propiedades (filtros), no en
  // cada render.
  const points = useMemo(() => properties, [properties]);
  const selected = properties.find((p) => p.id === selectedId) ?? null;

  return (
    <Map
      center={DEFAULT_CENTER}
      zoom={6}
      cooperativeGestures
      locale={{
        "CooperativeGesturesHandler.WindowsHelpText": "Usá Ctrl + rueda para hacer zoom en el mapa",
        "CooperativeGesturesHandler.MacHelpText": "Usá ⌘ + rueda para hacer zoom en el mapa",
        "CooperativeGesturesHandler.MobileHelpText": "Usá dos dedos para mover el mapa",
      }}
      className="h-full w-full"
    >
      <FitBounds points={points} />
      <FlyTo target={focus} />
      <MapControls position="top-right" showZoom showFullscreen />

      {properties.map((p) => {
        const highlighted = activeId === p.id || selectedId === p.id;
        return (
          <MapMarker
            key={p.id}
            longitude={p.longitude}
            latitude={p.latitude}
            anchor="bottom"
            onClick={(e) => {
              e.stopPropagation();
              onSelect(p.id);
            }}
            onMouseEnter={() => onActiveChange(p.id)}
            onMouseLeave={() => onActiveChange(null)}
          >
            <MarkerContent className={highlighted ? "z-10" : undefined}>
              <span
                className={cn(
                  "relative flex flex-col items-center transition-transform duration-150",
                  highlighted && "scale-110",
                )}
              >
                <span
                  className={cn(
                    "whitespace-nowrap rounded-full border px-2.5 py-1 text-xs font-semibold shadow-md",
                    highlighted
                      ? "border-zinc-900 bg-zinc-900 text-white"
                      : "border-zinc-200 bg-white text-zinc-900",
                  )}
                >
                  {fullPrice(p.price, p.currency)}
                </span>
                <span
                  className={cn(
                    "-mt-1 h-2 w-2 rotate-45 border-r border-b",
                    highlighted ? "border-zinc-900 bg-zinc-900" : "border-zinc-200 bg-white",
                  )}
                />
              </span>
            </MarkerContent>
          </MapMarker>
        );
      })}

      {selected && (
        <MapPopup
          longitude={selected.longitude}
          latitude={selected.latitude}
          offset={36}
          closeButton
          closeOnClick={false}
          onClose={() => onSelect(null)}
          key={selected.id}
          className="max-w-none rounded-xl border-0 bg-transparent p-0 shadow-none"
        >
          <Popup property={selected} />
        </MapPopup>
      )}
    </Map>
  );
}
