"use client";

import { useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { ChevronLeft, ChevronRight, ImageOff } from "lucide-react";
import { cn } from "@/lib/utils";

const MAX_IMAGES = 8;
const MAX_DOTS = 5;

// Fotos de una tarjeta de propiedad: se deslizan con el dedo (scroll
// snap nativo) o con las flechas en desktop; click en la foto abre la
// ficha. Solo carga la primera foto al entrar, el resto al deslizar.
export function CardImageCarousel({
  images,
  alt,
  href,
  sizes,
  className,
  priority = false,
  compact = false,
  children,
}: {
  images: string[];
  alt: string;
  href: string;
  sizes: string;
  className?: string;
  priority?: boolean;
  /** Flechas y puntos más chicos, para miniaturas. */
  compact?: boolean;
  /** Contenido superpuesto (badges). */
  children?: React.ReactNode;
}) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [index, setIndex] = useState(0);
  const slides = images.slice(0, MAX_IMAGES);
  const count = slides.length;

  const go = (e: React.MouseEvent, dir: 1 | -1) => {
    e.preventDefault();
    e.stopPropagation();
    const track = trackRef.current;
    if (!track) return;
    const next = (index + dir + count) % count;
    track.scrollTo({ left: next * track.clientWidth, behavior: "smooth" });
  };

  const onScroll = () => {
    const track = trackRef.current;
    if (!track || !track.clientWidth) return;
    setIndex(Math.round(track.scrollLeft / track.clientWidth));
  };

  // Puntos: ventana de hasta 5 alrededor de la foto actual.
  const dotStart = Math.min(Math.max(0, index - Math.floor(MAX_DOTS / 2)), Math.max(0, count - MAX_DOTS));
  const arrow =
    "absolute top-1/2 z-10 hidden -translate-y-1/2 items-center justify-center rounded-full bg-white/90 text-zinc-800 opacity-0 shadow-sm transition group-hover/carousel:opacity-100 hover:bg-white focus-visible:opacity-100 md:flex";
  const dots = Array.from({ length: Math.min(count, MAX_DOTS) }, (_, i) => dotStart + i);

  return (
    <div className={cn("group/carousel relative overflow-hidden bg-zinc-100", className)}>
      {count === 0 ? (
        <Link href={href} className="flex h-full w-full items-center justify-center text-zinc-400" aria-label={alt}>
          <ImageOff className="h-6 w-6" />
        </Link>
      ) : (
        <div
          ref={trackRef}
          onScroll={onScroll}
          className="flex h-full w-full snap-x snap-mandatory overflow-x-auto overscroll-x-contain [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          {slides.map((src, i) => (
            <Link
              key={`${src}-${i}`}
              href={href}
              draggable={false}
              className="relative h-full w-full shrink-0 snap-start snap-always"
              aria-label={i === 0 ? alt : `${alt}, foto ${i + 1}`}
              tabIndex={i === 0 ? 0 : -1}
            >
              <Image
                src={src}
                alt={i === 0 ? alt : ""}
                fill
                sizes={sizes}
                priority={priority && i === 0}
                draggable={false}
                className="object-cover"
              />
            </Link>
          ))}
        </div>
      )}

      {children}

      {count > 1 && (
        <>
          <button
            type="button"
            onClick={(e) => go(e, -1)}
            aria-label="Foto anterior"
            className={cn(arrow, compact ? "left-1 h-6 w-6" : "left-2 h-8 w-8")}
          >
            <ChevronLeft className={compact ? "h-3.5 w-3.5" : "h-4 w-4"} />
          </button>
          <button
            type="button"
            onClick={(e) => go(e, 1)}
            aria-label="Foto siguiente"
            className={cn(arrow, compact ? "right-1 h-6 w-6" : "right-2 h-8 w-8")}
          >
            <ChevronRight className={compact ? "h-3.5 w-3.5" : "h-4 w-4"} />
          </button>
          <div
            className={cn(
              "pointer-events-none absolute left-1/2 z-10 flex -translate-x-1/2 items-center gap-1",
              compact ? "bottom-1.5" : "bottom-2.5",
            )}
          >
            {dots.map((i) => (
              <span
                key={i}
                className={cn(
                  "rounded-full bg-white shadow-sm transition-all",
                  i === index ? "h-1.5 w-1.5 opacity-100" : "h-1.5 w-1.5 opacity-55",
                  (i === dots[0] && dotStart > 0) || (i === dots[dots.length - 1] && dotStart + MAX_DOTS < count)
                    ? "scale-75"
                    : "",
                )}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
