"use client";

import { useEffect, useMemo, useState } from "react";
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
import { cardImages } from "@/features/properties/PropertyCard";

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

function boundsOf(points: LocatedProperty[]) {
  return points.reduce((b, p) => b.extend([p.longitude, p.latitude]), new LngLatBounds());
}

function FitBounds({ points }: { points: LocatedProperty[] }) {
  const { map, isLoaded } = useMap();
  useEffect(() => {
    if (!map || !isLoaded || points.length === 0) return;
    if (points.length === 1) {
      map.jumpTo({ center: [points[0].longitude, points[0].latitude], zoom: 14 });
      return;
    }
    map.fitBounds(boundsOf(points), { padding: 72, maxZoom: 15, duration: 0 });
  }, [map, isLoaded, points]);
  return null;
}

function FlyTo({ target }: { target: LocatedProperty | null }) {
  const { map, isLoaded } = useMap();
  useEffect(() => {
    if (!map || !isLoaded || !target) return;
    map.flyTo({
      center: [target.longitude, target.latitude],
      // Al menos el zoom donde ya no se agrupa, así el pin elegido queda suelto.
      zoom: Math.max(map.getZoom(), NO_CLUSTER_ZOOM),
      duration: 600,
    });
  }, [map, isLoaded, target]);
  return null;
}

// --- Agrupación de pines ---------------------------------------------
// Los pines de precio miden ~100x30px: si dos se superponen en pantalla
// se agrupan en uno ("3 propiedades") que al hacer click acerca el mapa.
// Se recalcula al terminar cada movimiento; desde zoom 16 no se agrupa
// (a esa escala las superposiciones son direcciones casi iguales).
const OVERLAP_X = 96;
const OVERLAP_Y = 34;
const NO_CLUSTER_ZOOM = 16;

type Group = { key: string; members: LocatedProperty[]; lng: number; lat: number };

function useGroups(points: LocatedProperty[]) {
  const { map, isLoaded } = useMap();
  const [groups, setGroups] = useState<Group[]>([]);

  useEffect(() => {
    if (!map || !isLoaded) return;

    const compute = () => {
      if (map.getZoom() >= NO_CLUSTER_ZOOM) {
        setGroups(points.map((p) => ({ key: p.id, members: [p], lng: p.longitude, lat: p.latitude })));
        return;
      }
      const acc: { x: number; y: number; members: LocatedProperty[] }[] = [];
      for (const p of points) {
        const pt = map.project([p.longitude, p.latitude]);
        const hit = acc.find((g) => Math.abs(g.x - pt.x) < OVERLAP_X && Math.abs(g.y - pt.y) < OVERLAP_Y);
        if (hit) hit.members.push(p);
        else acc.push({ x: pt.x, y: pt.y, members: [p] });
      }
      setGroups(
        acc.map(({ members }) => ({
          key: members.map((m) => m.id).join("|"),
          members,
          lng: members.reduce((s, m) => s + m.longitude, 0) / members.length,
          lat: members.reduce((s, m) => s + m.latitude, 0) / members.length,
        })),
      );
    };

    compute();
    map.on("moveend", compute);
    return () => {
      map.off("moveend", compute);
    };
  }, [map, isLoaded, points]);

  return { groups, map };
}

function PriceMarkers({
  points,
  activeId,
  selectedId,
  onActiveChange,
  onSelect,
}: {
  points: LocatedProperty[];
  activeId: string | null;
  selectedId: string | null;
  onActiveChange: (id: string | null) => void;
  onSelect: (id: string | null) => void;
}) {
  const { groups, map } = useGroups(points);

  return (
    <>
      {groups.map((g) => {
        if (g.members.length === 1) {
          const p = g.members[0];
          const highlighted = activeId === p.id || selectedId === p.id;
          return (
            <MapMarker
              key={g.key}
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
                    "relative flex cursor-pointer flex-col items-center transition-transform duration-150 motion-reduce:transition-none",
                    highlighted && "scale-110",
                  )}
                >
                  <span
                    className={cn(
                      "rounded-full border px-2.5 py-1 text-xs font-semibold whitespace-nowrap shadow-[0_4px_12px_-4px_rgb(22_24_26/0.35)] transition-colors",
                      highlighted
                        ? "border-main bg-main text-primary-foreground"
                        : "border-border bg-card text-foreground",
                    )}
                  >
                    {fullPrice(p.price, p.currency)}
                  </span>
                  <span
                    className={cn(
                      "-mt-1 h-2 w-2 rotate-45 border-r border-b transition-colors",
                      highlighted ? "border-main bg-main" : "border-border bg-card",
                    )}
                  />
                </span>
              </MarkerContent>
            </MapMarker>
          );
        }

        const highlighted = g.members.some((m) => m.id === activeId || m.id === selectedId);
        return (
          <MapMarker
            key={g.key}
            longitude={g.lng}
            latitude={g.lat}
            anchor="center"
            onClick={(e) => {
              e.stopPropagation();
              map?.fitBounds(boundsOf(g.members), { padding: 96, maxZoom: NO_CLUSTER_ZOOM + 1, duration: 500 });
            }}
          >
            <MarkerContent className={highlighted ? "z-10" : undefined}>
              <span
                role="button"
                aria-label={`${g.members.length} propiedades en esta zona, acercar`}
                className={cn(
                  "flex cursor-pointer items-center rounded-full border-2 px-3 py-1.5 text-xs font-semibold whitespace-nowrap shadow-[0_4px_12px_-4px_rgb(22_24_26/0.4)] transition-[transform,background-color] duration-150 hover:scale-105 motion-reduce:transition-none",
                  highlighted
                    ? "border-card bg-main text-primary-foreground"
                    : "border-card bg-foreground text-background",
                )}
              >
                {g.members.length} propiedades
              </span>
            </MarkerContent>
          </MapMarker>
        );
      })}
    </>
  );
}

function Popup({ property }: { property: LocatedProperty }) {
  const image = cardImages(property.property_images)[0];
  return (
    <Link
      href={`/propiedades/${property.id}`}
      className="site-public group block w-[260px] overflow-hidden rounded-lg border border-border bg-card text-foreground shadow-[0_16px_40px_-12px_rgb(22_24_26/0.35)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <div className="relative h-[150px] bg-muted">
        {image && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={image} alt="" className="h-full w-full object-cover" />
        )}
      </div>
      <div className="space-y-1.5 p-3">
        <p className="font-clash text-lg leading-tight font-semibold">
          {fullPrice(property.price, property.currency)}
        </p>
        <p className="line-clamp-2 text-sm font-medium underline-offset-2 group-hover:underline">{property.title}</p>
        <p className="truncate text-xs text-muted-foreground">
          {[property.street_address, property.city].filter(Boolean).join(", ")}
        </p>
        <Specs property={property} />
      </div>
    </Link>
  );
}

export function Specs({ property, className }: { property: MapProperty; className?: string }) {
  const items = [
    property.bedrooms ? { key: "bed", icon: BedDouble, text: `${property.bedrooms}`, label: "dormitorios" } : null,
    property.bathrooms ? { key: "bath", icon: Bath, text: `${property.bathrooms}`, label: "baños" } : null,
    property.total_area ? { key: "area", icon: Maximize2, text: `${property.total_area} m²`, label: "superficie" } : null,
  ].filter(Boolean) as { key: string; icon: React.ElementType; text: string; label: string }[];
  if (items.length === 0) return null;
  return (
    <p className={cn("flex items-center gap-3 text-xs text-muted-foreground", className)}>
      {items.map(({ key, icon: Icon, text, label }) => (
        <span key={key} className="inline-flex items-center gap-1" title={label}>
          <Icon className="h-3.5 w-3.5" aria-hidden="true" />
          <span className="sr-only">{label}: </span>
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
      // El sitio público siempre es claro, aunque el panel haya quedado en oscuro.
      theme="light"
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

      <PriceMarkers
        points={points}
        activeId={activeId}
        selectedId={selectedId}
        onActiveChange={onActiveChange}
        onSelect={onSelect}
      />

      {selected && (
        <MapPopup
          longitude={selected.longitude}
          latitude={selected.latitude}
          offset={36}
          closeButton
          closeOnClick={false}
          onClose={() => onSelect(null)}
          key={selected.id}
          className="max-w-none rounded-lg border-0 bg-transparent p-0 shadow-none"
        >
          <Popup property={selected} />
        </MapPopup>
      )}
    </Map>
  );
}
