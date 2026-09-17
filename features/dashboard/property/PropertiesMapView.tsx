"use client";

import { useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import Image from "next/image";
import type { PropertyWithDetails } from "@/app/types/entities";
import {
  propertyStatusMeta,
  operationLabel,
  formatPrice,
} from "@/features/dashboard/property/propertyStatus";
import { isLocated, type Located } from "@/features/dashboard/property/PropertiesMap";
import { cn } from "@/lib/utils";

// Leaflet solo en cliente.
const PropertiesMap = dynamic(
  () => import("@/features/dashboard/property/PropertiesMap"),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
        Cargando mapa…
      </div>
    ),
  },
);

// Mapa + panel lateral sincronizados: hover en una fila resalta el pin,
// hover en un pin resalta (y hace scroll a) la fila; click en la fila
// vuela al pin y abre su popup. Las propiedades sin coordenadas van al
// final del panel, atenuadas, para que no desaparezcan del listado.
export function PropertiesMapView({ properties }: { properties: PropertyWithDetails[] }) {
  const [activeId, setActiveId] = useState<string | null>(null);
  const [focus, setFocus] = useState<Located | null>(null);
  const rowRefs = useRef<Map<string, HTMLLIElement>>(new Map());

  const located = properties.filter(isLocated);
  const unlocated = properties.filter((p) => !isLocated(p));

  // Cuando el hover viene del mapa, traer la fila a la vista.
  useEffect(() => {
    if (!activeId) return;
    rowRefs.current.get(activeId)?.scrollIntoView({ block: "nearest" });
  }, [activeId]);

  return (
    <div className="grid h-[calc(100vh-260px)] min-h-[440px] grid-cols-1 overflow-hidden rounded-lg border border-border bg-card lg:grid-cols-[360px_minmax(0,1fr)]">
      <aside className="order-2 flex min-h-0 flex-col border-t border-border lg:order-1 lg:border-r lg:border-t-0">
        <ul className="min-h-0 flex-1 overflow-y-auto">
          {[...located, ...unlocated].map((p) => {
            const meta = propertyStatusMeta(p.status);
            const price = formatPrice(p.price, p.currency);
            const image = p.property_images?.[0]?.image_url;
            const onMap = isLocated(p);
            const active = activeId === p.id;
            return (
              <li
                key={p.id}
                ref={(el) => {
                  if (el) rowRefs.current.set(p.id, el);
                  else rowRefs.current.delete(p.id);
                }}
                className={cn("border-b border-border-subtle last:border-0", !onMap && "opacity-60")}
              >
                <button
                  type="button"
                  onMouseEnter={() => onMap && setActiveId(p.id)}
                  onMouseLeave={() => setActiveId(null)}
                  onFocus={() => onMap && setActiveId(p.id)}
                  onBlur={() => setActiveId(null)}
                  onClick={() => onMap && setFocus(p)}
                  disabled={!onMap}
                  title={onMap ? "Ver en el mapa" : "Sin coordenadas"}
                  className={cn(
                    "flex w-full items-center gap-3 px-4 py-3 text-left transition-colors",
                    active ? "bg-muted" : "hover:bg-muted/50",
                    !onMap && "cursor-default",
                  )}
                >
                  <div className="relative size-14 shrink-0 overflow-hidden rounded-md bg-muted">
                    {image && <Image src={image} alt="" fill sizes="56px" className="object-cover" unoptimized />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-foreground">{p.title}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {[p.street_address, p.city].filter(Boolean).join(" · ") || "Sin dirección"}
                    </p>
                    <p className="mt-1.5 flex items-center gap-1.5 text-xs">
                      <span className="size-2 shrink-0 rounded-full" style={{ backgroundColor: meta.color }} aria-hidden />
                      <span className="text-fg-secondary">{meta.label}</span>
                      <span className="text-muted-foreground">· {operationLabel(p.operation_type)}</span>
                      <span className="ml-auto font-medium text-foreground">{price ?? "Consultar"}</span>
                    </p>
                  </div>
                </button>
              </li>
            );
          })}
        </ul>
      </aside>

      <div className="relative order-1 min-h-[280px] lg:order-2">
        <PropertiesMap
          properties={located}
          activeId={activeId}
          onActiveChange={setActiveId}
          focus={focus}
          className="h-full w-full"
        />
      </div>

    </div>
  );
}
