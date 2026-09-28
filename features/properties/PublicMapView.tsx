"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { MapPinOff } from "lucide-react";
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

// MapLibre solo en cliente.
const PublicPropertiesMap = dynamic(() => import("@/features/properties/PublicPropertiesMap"), {
  ssr: false,
  loading: () => (
    <div className="flex h-full items-center justify-center bg-zinc-100 text-sm text-zinc-500">
      Cargando mapa…
    </div>
  ),
});

// Vista mapa del listado público: panel de resultados + mapa con pines de
// precio, sincronizados. Hover en una tarjeta resalta su pin y viceversa;
// click en la tarjeta vuela al pin y abre la vista previa; click en la
// vista previa lleva a la ficha.
export function PublicMapView({ properties }: { properties: MapProperty[] }) {
  const [activeId, setActiveId] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [focus, setFocus] = useState<LocatedProperty | null>(null);
  const rowRefs = useRef<Map<string, HTMLLIElement>>(new Map());

  const located = useMemo(() => properties.filter(isLocated), [properties]);
  const unlocated = useMemo(() => properties.filter((p) => !isLocated(p)), [properties]);

  // Hover o click en un pin: traer la tarjeta a la vista del panel.
  const highlightedId = activeId ?? selectedId;
  useEffect(() => {
    if (!highlightedId) return;
    rowRefs.current.get(highlightedId)?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [highlightedId]);

  const selectFromList = (p: LocatedProperty) => {
    setSelectedId(p.id);
    setFocus({ ...p });
  };

  return (
    <div className="grid h-[calc(100svh-7rem)] min-h-[520px] grid-rows-[minmax(0,1fr)_minmax(0,1fr)] overflow-hidden rounded-2xl border border-zinc-200 bg-white lg:grid-cols-[460px_minmax(0,1fr)] lg:grid-rows-1 xl:grid-cols-[minmax(0,11fr)_minmax(0,9fr)]">
      <aside className="order-2 flex min-h-0 flex-col border-t border-zinc-200 lg:order-1 lg:border-t-0 lg:border-r">
        <div className="flex items-center justify-between border-b border-zinc-100 px-4 py-3 text-sm">
          <span className="font-semibold text-zinc-900">
            {properties.length} {properties.length === 1 ? "propiedad" : "propiedades"}
          </span>
          {unlocated.length > 0 && (
            <span className="text-xs text-zinc-500">{unlocated.length} sin ubicación en el mapa</span>
          )}
        </div>
        {/* Lista: filas en pantallas medianas; grilla de 2 tarjetas en xl. */}
        <ul className="min-h-0 flex-1 divide-y divide-zinc-100 overflow-y-auto xl:grid xl:auto-rows-min xl:grid-cols-2 xl:gap-3 xl:divide-y-0 xl:p-3">
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
                  "group relative transition xl:overflow-hidden xl:rounded-xl xl:border",
                  highlighted
                    ? "bg-zinc-50 xl:border-zinc-900 xl:bg-white xl:shadow-md"
                    : "hover:bg-zinc-50/70 xl:border-zinc-200 xl:hover:bg-white xl:hover:shadow-sm",
                )}
              >
                {highlighted && <span className="absolute inset-y-0 left-0 w-0.5 bg-zinc-900 xl:hidden" aria-hidden />}
                <div className="flex gap-3 p-3 xl:h-full xl:flex-col xl:gap-0 xl:p-0">
                  <CardImageCarousel
                    images={cardImages(p.property_images)}
                    alt={p.title}
                    href={`/propiedades/${p.id}`}
                    sizes="(min-width: 1280px) 22vw, 112px"
                    compact
                    className="h-24 w-28 shrink-0 rounded-lg xl:aspect-16/10 xl:h-auto xl:w-full xl:rounded-none"
                  />
                  <div className="flex min-w-0 flex-1 flex-col xl:p-3">
                    <p className="font-clash text-base font-semibold text-zinc-900 xl:text-lg">
                      {fullPrice(p.price, p.currency)}
                    </p>
                    <Link
                      href={`/propiedades/${p.id}`}
                      className="line-clamp-1 text-sm font-medium text-zinc-800 xl:line-clamp-2 xl:min-h-[2lh]"
                    >
                      {p.title}
                    </Link>
                    <p className="truncate text-xs text-zinc-500">
                      {[p.street_address, p.city].filter(Boolean).join(", ") || "Ubicación a consultar"}
                    </p>
                    <div className="mt-auto flex items-center justify-between gap-2 pt-1.5 xl:pt-3">
                      <Specs property={p} />
                      {onMap ? (
                        <button
                          type="button"
                          onClick={() => selectFromList(p)}
                          className="shrink-0 rounded-md px-2 py-1 text-xs font-medium text-zinc-600 transition hover:bg-white hover:text-zinc-900 hover:shadow-sm"
                        >
                          Ver en mapa
                        </button>
                      ) : (
                        <span className="inline-flex shrink-0 items-center gap-1 text-xs text-zinc-400">
                          <MapPinOff className="h-3.5 w-3.5" />
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
          <div className="flex h-full flex-col items-center justify-center gap-2 bg-zinc-50 p-6 text-center text-zinc-500">
            <MapPinOff className="h-8 w-8 opacity-50" />
            <p>Ninguna de estas propiedades tiene ubicación cargada en el mapa.</p>
          </div>
        ) : (
          <PublicPropertiesMap
            properties={located}
            activeId={activeId}
            selectedId={selectedId}
            onActiveChange={setActiveId}
            onSelect={setSelectedId}
            focus={focus}
          />
        )}
      </div>
    </div>
  );
}
