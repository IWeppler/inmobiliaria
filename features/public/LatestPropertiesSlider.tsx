"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useReducedMotion } from "framer-motion";
import { ArrowRight, ChevronLeft, ChevronRight } from "lucide-react";
import PropertyCard from "@/features/properties/PropertyCard";
import type { PropertyCardData } from "@/app/types/entities";

// Últimas propiedades en una sola fila con desplazamiento lateral
// (scroll snap nativo + flechas). Muestra 3 por vista en desktop, 2 en
// tablet y una y algo en mobile para insinuar que hay más; con más
// publicaciones la fila crece hacia el costado, nunca a un segundo renglón.
export function LatestPropertiesSlider({
  properties,
}: {
  properties: PropertyCardData[];
}) {
  const trackRef = useRef<HTMLDivElement>(null);
  const reduce = useReducedMotion();
  const [canPrev, setCanPrev] = useState(false);
  const [canNext, setCanNext] = useState(false);

  // Habilita cada flecha según quede contenido hacia ese lado. React
  // descarta el render si el valor no cambió, así que el scroll no
  // re-renderiza en cada frame.
  const update = useCallback(() => {
    const track = trackRef.current;
    if (!track) return;
    setCanPrev(track.scrollLeft > 4);
    setCanNext(track.scrollLeft + track.clientWidth < track.scrollWidth - 4);
  }, []);

  useEffect(() => {
    const track = trackRef.current;
    if (!track) return;
    update();
    const observer = new ResizeObserver(update);
    observer.observe(track);
    return () => observer.disconnect();
  }, [update]);

  const go = (dir: 1 | -1) => {
    const track = trackRef.current;
    if (!track) return;
    track.scrollBy({
      left: dir * track.clientWidth,
      behavior: reduce ? "auto" : "smooth",
    });
  };

  const arrow =
    "flex size-11 items-center justify-center rounded-full border border-background/20 text-background transition-colors hover:bg-background hover:text-foreground active:scale-[0.96] disabled:pointer-events-none disabled:opacity-30";
  const hasOverflow = canPrev || canNext;

  return (
    <div>
      <div className="mb-10 flex flex-wrap items-end justify-between gap-4">
        <h2 className="font-clash text-4xl font-semibold md:text-5xl">
          Nuevas propiedades
        </h2>
        <div className="flex items-center gap-6">
          <Link
            href="/propiedades?tipo=venta"
            className="group inline-flex items-center gap-2 text-sm font-medium text-background underline-offset-4 hover:underline"
          >
            Ver todas
            <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
          </Link>
          {hasOverflow && (
            <div className="hidden items-center gap-2 md:flex">
              <button
                type="button"
                onClick={() => go(-1)}
                disabled={!canPrev}
                aria-label="Propiedades anteriores"
                aria-controls="latest-properties-track"
                className={arrow}
              >
                <ChevronLeft className="size-5" />
              </button>
              <button
                type="button"
                onClick={() => go(1)}
                disabled={!canNext}
                aria-label="Más propiedades"
                aria-controls="latest-properties-track"
                className={arrow}
              >
                <ChevronRight className="size-5" />
              </button>
            </div>
          )}
        </div>
      </div>

      <div
        id="latest-properties-track"
        ref={trackRef}
        onScroll={update}
        role="region"
        aria-roledescription="carrusel"
        aria-label="Nuevas propiedades"
        className="-mx-4 grid snap-x snap-mandatory scroll-px-4 auto-cols-[85%] grid-flow-col gap-4 overflow-x-auto px-4 pb-2 [scrollbar-width:none] md:mx-0 md:scroll-px-0 md:auto-cols-[calc((100%-1.5rem)/2)] md:gap-6 md:px-0 lg:auto-cols-[calc((100%-3rem)/3)] [&::-webkit-scrollbar]:hidden"
      >
        {properties.map((property) => (
          <div key={property.id} className="snap-start">
            <PropertyCard property={property} showStatus={false} variant="plain" />
          </div>
        ))}
      </div>
    </div>
  );
}
