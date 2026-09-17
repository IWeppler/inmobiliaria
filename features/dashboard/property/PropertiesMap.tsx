"use client";

import { useEffect, useMemo, useRef } from "react";
import Link from "next/link";
import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import type { PropertyWithDetails } from "@/app/types/entities";
import {
  propertyStatusMeta,
  operationLabel,
  formatPrice,
} from "@/features/dashboard/property/propertyStatus";

// Pin SVG con el color del estado (mismo color que el badge y el donut).
// Variante "activa" más grande para el hover sincronizado con el panel.
const iconCache = new Map<string, L.DivIcon>();
function pinIcon(color: string, active: boolean) {
  const key = `${color}:${active ? 1 : 0}`;
  let icon = iconCache.get(key);
  if (!icon) {
    const w = active ? 32 : 24;
    const h = active ? 42 : 32;
    icon = L.divIcon({
      className: active ? "tn-pin-active" : "",
      html: `<svg viewBox="0 0 24 32" width="${w}" height="${h}" xmlns="http://www.w3.org/2000/svg">
        <path d="M12 1C6.2 1 1.5 5.6 1.5 11.4 1.5 19 12 31 12 31s10.5-12 10.5-19.6C22.5 5.6 17.8 1 12 1z" fill="${color}" stroke="#fff" stroke-width="2"/>
        <circle cx="12" cy="11.5" r="3.5" fill="#fff"/>
      </svg>`,
      iconSize: [w, h],
      iconAnchor: [w / 2, h - 1],
      popupAnchor: [0, -(h - 4)],
    });
    iconCache.set(key, icon);
  }
  return icon;
}

export type Located = PropertyWithDetails & { latitude: number; longitude: number };

export function isLocated(p: PropertyWithDetails): p is Located {
  return typeof p.latitude === "number" && typeof p.longitude === "number";
}

// Encuadra todos los pines cuando cambia el conjunto (filtros).
function FitBounds({ points }: { points: Located[] }) {
  const map = useMap();
  useEffect(() => {
    if (points.length === 0) return;
    if (points.length === 1) {
      map.setView([points[0].latitude, points[0].longitude], 14);
      return;
    }
    map.fitBounds(
      L.latLngBounds(points.map((p) => [p.latitude, p.longitude] as [number, number])),
      { padding: [32, 32], maxZoom: 15 },
    );
  }, [map, points]);
  return null;
}

// Vuela al pin elegido desde el panel y abre su popup.
function FlyTo({
  target,
  markers,
}: {
  target: Located | null;
  markers: React.MutableRefObject<Map<string, L.Marker>>;
}) {
  const map = useMap();
  useEffect(() => {
    if (!target) return;
    map.flyTo([target.latitude, target.longitude], Math.max(map.getZoom(), 14), { duration: 0.6 });
    const m = markers.current.get(target.id);
    const t = setTimeout(() => m?.openPopup(), 650);
    return () => clearTimeout(t);
  }, [map, target, markers]);
  return null;
}

// Fallback: centro aproximado de la zona de trabajo (Santa Fe / Rosario).
const DEFAULT_CENTER: [number, number] = [-32.0, -61.0];

export default function PropertiesMap({
  properties,
  activeId,
  onActiveChange,
  focus,
  className,
}: {
  properties: PropertyWithDetails[];
  /** Propiedad resaltada (hover en panel o en pin). */
  activeId?: string | null;
  onActiveChange?: (id: string | null) => void;
  /** Propiedad a la que volar (click en el panel). */
  focus?: Located | null;
  className?: string;
}) {
  const located = useMemo(() => properties.filter(isLocated), [properties]);
  const markers = useRef<Map<string, L.Marker>>(new Map());

  return (
    <MapContainer
      center={DEFAULT_CENTER}
      zoom={7}
      scrollWheelZoom
      className={className ?? "h-full w-full"}
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <FitBounds points={located} />
      <FlyTo target={focus ?? null} markers={markers} />
      {located.map((p) => {
        const meta = propertyStatusMeta(p.status);
        const price = formatPrice(p.price, p.currency);
        const image = p.property_images?.[0]?.image_url;
        const active = activeId === p.id;
        return (
          <Marker
            key={p.id}
            position={[p.latitude, p.longitude]}
            icon={pinIcon(meta.color, active)}
            zIndexOffset={active ? 1000 : 0}
            ref={(m) => {
              if (m) markers.current.set(p.id, m);
              else markers.current.delete(p.id);
            }}
            eventHandlers={{
              mouseover: () => onActiveChange?.(p.id),
              mouseout: () => onActiveChange?.(null),
            }}
          >
            <Popup closeButton={false} minWidth={240} maxWidth={240}>
              {/* Alto fijo: Leaflet mide el popup al abrir y no re-mide cuando
                  carga la imagen; con dimensiones fijas nunca queda recortado. */}
              <div className="flex w-[240px] flex-col text-sm">
                {image && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={image} alt="" className="block h-[140px] w-full object-cover" />
                )}
                <div className="flex flex-col gap-1 p-3">
                <Link
                  href={`/dashboard/propiedades/${p.id}`}
                  className="font-medium text-foreground underline-offset-4 hover:underline"
                >
                  {p.title}
                </Link>
                <span className="text-xs text-muted-foreground">
                  {[p.street_address, p.city].filter(Boolean).join(" · ")}
                </span>
                <span className="flex items-center justify-between gap-2">
                  <span className="font-medium text-foreground">{price ?? "Consultar"}</span>
                  <span className="inline-flex items-center gap-1.5 text-xs text-fg-secondary">
                    <span className="size-2 rounded-full" style={{ backgroundColor: meta.color }} aria-hidden />
                    {meta.label} · {operationLabel(p.operation_type)}
                  </span>
                </span>
                </div>
              </div>
            </Popup>
          </Marker>
        );
      })}
    </MapContainer>
  );
}
