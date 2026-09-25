"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { MapPin } from "lucide-react";
import { LngLatBounds } from "maplibre-gl";
import type { PropertyWithDetails } from "@/app/types/entities";
import {
  Map,
  MapControls,
  MapMarker,
  MapPopup,
  MarkerContent,
  useMap,
} from "@/shared/components/ui/map";
import {
  propertyStatusMeta,
  operationLabel,
  formatPrice,
} from "@/features/dashboard/property/propertyStatus";

export type Located = PropertyWithDetails & {
  latitude: number;
  longitude: number;
};

export function isLocated(property: PropertyWithDetails): property is Located {
  return (
    typeof property.latitude === "number" &&
    typeof property.longitude === "number"
  );
}

function FitBounds({ points }: { points: Located[] }) {
  const { map, isLoaded } = useMap();
  useEffect(() => {
    if (!map || !isLoaded || points.length === 0) return;
    if (points.length === 1) {
      map.flyTo({
        center: [points[0].longitude, points[0].latitude],
        zoom: 14,
      });
      return;
    }
    const bounds = points.reduce(
      (result, point) => result.extend([point.longitude, point.latitude]),
      new LngLatBounds(),
    );
    map.fitBounds(bounds, { padding: 32, maxZoom: 15 });
  }, [map, isLoaded, points]);
  return null;
}

function FlyTo({ target }: { target: Located | null }) {
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

function PropertyPopup({ property }: { property: Located }) {
  const meta = propertyStatusMeta(property.status);
  const price = formatPrice(property.price, property.currency);
  const image = property.property_images?.[0]?.image_url;

  return (
    <div className="flex w-[240px] flex-col text-sm">
      {image && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={image}
          alt=""
          className="block h-[140px] w-full object-cover"
        />
      )}
      <div className="flex flex-col gap-1 p-3">
        <Link
          href={`/dashboard/propiedades/${property.id}`}
          className="font-medium text-foreground underline-offset-4 hover:underline"
        >
          {property.title}
        </Link>
        <span className="text-xs text-muted-foreground">
          {[property.street_address, property.city].filter(Boolean).join(" · ")}
        </span>
        <span className="flex items-center justify-between gap-2">
          <span className="font-medium text-foreground">
            {price ?? "Consultar"}
          </span>
          <span className="inline-flex items-center gap-1.5 text-xs text-fg-secondary">
            <span
              className="size-2 rounded-full"
              style={{ backgroundColor: meta.color }}
              aria-hidden="true"
            />
            {meta.label} · {operationLabel(property.operation_type)}
          </span>
        </span>
      </div>
    </div>
  );
}

const DEFAULT_CENTER: [number, number] = [-61.0, -32.0];

export default function PropertiesMap({
  properties,
  activeId,
  onActiveChange,
  focus,
  className,
}: {
  properties: PropertyWithDetails[];
  activeId?: string | null;
  onActiveChange?: (id: string | null) => void;
  focus?: Located | null;
  className?: string;
}) {
  const located = useMemo(() => properties.filter(isLocated), [properties]);
  const [selection, setSelection] = useState<{
    id: string | null;
    focus: Located | null;
  }>({ id: null, focus: null });
  const selectedId =
    selection.focus === (focus ?? null) ? selection.id : (focus?.id ?? null);
  const selected = located.find((property) => property.id === selectedId);

  return (
    <Map
      center={DEFAULT_CENTER}
      zoom={7}
      className={className ?? "h-full w-full"}
    >
      <FitBounds points={located} />
      <FlyTo target={focus ?? null} />
      <MapControls position="top-right" showZoom />
      {located.map((property) => {
        const active = activeId === property.id;
        return (
          <MapMarker
            key={property.id}
            longitude={property.longitude}
            latitude={property.latitude}
            onClick={() =>
              setSelection({ id: property.id, focus: focus ?? null })
            }
            onMouseEnter={() => onActiveChange?.(property.id)}
            onMouseLeave={() => onActiveChange?.(null)}
          >
            <MarkerContent>
              <MapPin
                className={active ? "size-10" : "size-8 drop"}
                style={{
                  fill: propertyStatusMeta(property.status).color,
                  stroke: "#fff",
                }}
                aria-label={property.title}
              />
            </MarkerContent>
          </MapMarker>
        );
      })}
      {selected && (
        <MapPopup
          longitude={selected.longitude}
          latitude={selected.latitude}
          className="w-[240px] max-w-none overflow-hidden p-0"
          closeButton
          closeOnClick={false}
          onClose={() => setSelection({ id: null, focus: focus ?? null })}
        >
          <PropertyPopup property={selected} />
        </MapPopup>
      )}
    </Map>
  );
}
