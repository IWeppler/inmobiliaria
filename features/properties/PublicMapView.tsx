"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { MapPin, MapPinOff } from "lucide-react";
import { cn } from "@/lib/utils";
import { CardImageCarousel } from "@/features/properties/CardImageCarousel";
import { cardImages } from "@/features/properties/PropertyCard";
import {
  Specs,
  fullPrice,
  isLocated,
  type LocatedProperty,
  type MapProperty,
} from "@/features/properties/PublicPropertiesMap";

// MapLibre solo en cliente. El placeholder ocupa el mismo lugar que el
// mapa para no mover el layout al cargar.
const PublicPropertiesMap = dynamic(() => import("@/features/properties/PublicPropertiesMap"), {
  ssr: false,
  loading: () => <div className="h-full w-full animate-pulse bg-muted" aria-label="Cargando mapa" />,
});

// Vista mapa del listado público: panel de resultados + mapa con pines de
// precio, sincronizados. Hover en una tarjeta resalta su pin y viceversa;
// click en "Ver en mapa" vuela al pin y abre la vista previa; click en la
// vista previa lleva a la ficha. Ocupa el alto que le da el contenedor.
export function PublicMapView({ properties }: { properties: MapProperty[] }) {
  const [activeId, setActiveId] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [focus, setFocus] = useState<LocatedProperty | null>(null);
  const rowRefs = useRef<Map<string, HTMLLIElement>>(new Map());

  const located = useMemo(() => properties.filter(isLocated), [properties]);
  const unlocated = useMemo(() => properties.filter((p) => !isLocated(p)), [properties]);

  const highlightedId = activeId ?? selectedId;

  // Hover o click en un pin: traer la tarjeta a la vista del panel. Solo
  // desde el mapa; el hover en la propia lista no la desplaza.
  const [scrollTarget, setScrollTarget] = useState<string | null>(null);
  useEffect(() => {
    if (!scrollTarget) return;
    rowRefs.current.get(scrollTarget)?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [scrollTarget]);

  const onMapActive = (id: string | null) => {
    setActiveId(id);
    if (id) setScrollTarget(id);
  };
  const onMapSelect = (id: string | null) => {
    setSelectedId(id);
    if (id) setScrollTarget(id);
  };

  const selectFromList = (p: LocatedProperty) => {
    setSelectedId(p.id);
    setFocus({ ...p });
  };

  return (
    <div className="absolute inset-0 grid grid-rows-[minmax(0,1fr)_minmax(0,1.1fr)] overflow-hidden rounded-lg border border-border bg-card lg:grid-cols-[440px_minmax(0,1fr)] lg:grid-rows-1 xl:grid-cols-[minmax(0,11fr)_minmax(0,9fr)]">
      <aside className="order-2 flex min-h-0 flex-col border-t border-border lg:order-1 lg:border-t-0 lg:border-r">
        <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-3 text-sm">
          <p className="font-semibold text-foreground" aria-live="polite">
            {properties.length} {properties.length === 1 ? "propiedad" : "propiedades"}
          </p>
          {unlocated.length > 0 && (
            <p className="text-xs text-muted-foreground">
              {unlocated.length} sin ubicación en el mapa
            </p>
          )}
        </div>

        {/* Lista: filas en pantallas medianas; grilla de 2 tarjetas en xl. */}
        <ul className="min-h-0 flex-1 divide-y divide-border overflow-y-auto overscroll-contain xl:grid xl:auto-rows-min xl:grid-cols-2 xl:gap-3 xl:divide-y-0 xl:p-3">
          {[...located, ...unlocated].map((p) => {
            const onMap = isLocated(p);
            const highlighted = highlightedId === p.id;
            return (
              <li
                key={p.id}
                ref={(el) => {
                  if (el) rowRefs.current.set(p.id, el);
                  else rowRefs.current.delete(p.id);
                }}
                onMouseEnter={() => onMap && setActiveId(p.id)}
                onMouseLeave={() => setActiveId(null)}
                className={cn(
                  "group relative transition-[background-color,border-color,box-shadow] duration-200 xl:overflow-hidden xl:rounded-lg xl:border",
                  highlighted
                    ? "bg-main-soft xl:border-main xl:bg-card xl:shadow-[0_0_0_1px_var(--brand-main)]"
                    : "hover:bg-muted/60 xl:border-border xl:hover:border-border-strong xl:hover:bg-card",
                )}
              >
                {highlighted && <span className="absolute inset-y-0 left-0 w-0.5 bg-main xl:hidden" aria-hidden />}
                <div className="flex gap-3 p-3 xl:h-full xl:flex-col xl:gap-0 xl:p-0">
                  <CardImageCarousel
                    images={cardImages(p.property_images)}
                    alt={p.title}
                    href={`/propiedades/${p.id}`}
                    sizes="(min-width: 1280px) 22vw, 112px"
                    compact
                    className="h-24 w-28 shrink-0 rounded-md xl:aspect-16/10 xl:h-auto xl:w-full xl:rounded-none"
                  />
                  <div className="flex min-w-0 flex-1 flex-col xl:p-3">
                    <p className="font-clash text-base font-semibold text-foreground xl:text-lg">
                      {fullPrice(p.price, p.currency)}
                    </p>
                    <Link
                      href={`/propiedades/${p.id}`}
                      className="line-clamp-1 text-sm font-medium text-foreground underline-offset-2 hover:underline xl:line-clamp-2 xl:min-h-[2lh]"
                    >
                      {p.title}
                    </Link>
                    <p className="truncate text-xs text-muted-foreground">
                      {[p.street_address, p.city].filter(Boolean).join(", ") || "Ubicación a consultar"}
                    </p>
                    <div className="mt-auto flex items-center justify-between gap-2 pt-1.5 xl:pt-3">
                      <Specs property={p} />
                      {onMap ? (
                        <button
                          type="button"
                          onClick={() => selectFromList(p)}
                          className="inline-flex shrink-0 cursor-pointer items-center gap-1 rounded-sm px-2 py-1 text-xs font-medium text-muted-foreground transition-colors hover:bg-main-soft hover:text-main focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        >
                          <MapPin className="h-3.5 w-3.5" aria-hidden="true" />
                          Ver en mapa
                        </button>
                      ) : (
                        <span className="inline-flex shrink-0 items-center gap-1 text-xs text-muted-foreground">
                          <MapPinOff className="h-3.5 w-3.5" aria-hidden="true" />
                          Sin mapa
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      </aside>

      <div className="relative order-1 min-h-0 lg:order-2">
        {located.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center gap-2 bg-muted p-6 text-center text-muted-foreground">
            <MapPinOff className="h-8 w-8 opacity-60" aria-hidden="true" />
            <p>Ninguna de estas propiedades tiene ubicación cargada en el mapa.</p>
          </div>
        ) : (
          <PublicPropertiesMap
            properties={located}
            activeId={activeId}
            selectedId={selectedId}
            onActiveChange={onMapActive}
            onSelect={onMapSelect}
            focus={focus}
          />
        )}
      </div>
    </div>
  );
}
