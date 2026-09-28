"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import Image from "next/image";
import { motion, AnimatePresence } from "framer-motion";
import {
  X,
  ChevronLeft,
  ChevronRight,
  ZoomIn,
  ZoomOut,
  Images,
  Expand,
} from "lucide-react";

type ImageGalleryProps = {
  images: string[];
  title?: string;
};

const MIN_SCALE = 1;
const MAX_SCALE = 4;
const DOUBLE_TAP_SCALE = 2.5;
const SWIPE_THRESHOLD = 60;

export function ImageGallery({ images, title = "la propiedad" }: ImageGalleryProps) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [mobileIndex, setMobileIndex] = useState(0);
  const mobileTrackRef = useRef<HTMLDivElement>(null);

  const openModal = useCallback((index: number) => {
    setCurrentIndex(index);
    setIsModalOpen(true);
  }, []);

  // Índice visible del carrusel móvil según el scroll horizontal.
  const handleMobileScroll = useCallback(() => {
    const track = mobileTrackRef.current;
    if (!track) return;
    setMobileIndex(Math.round(track.scrollLeft / track.clientWidth));
  }, []);

  if (!images || images.length === 0) {
    return (
      <div className="flex h-[320px] w-full flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-zinc-300 bg-zinc-50 text-zinc-500 md:h-[480px]">
        <Images className="h-8 w-8 opacity-50" />
        No hay imágenes disponibles
      </div>
    );
  }

  const gridImages = images.slice(0, 5);
  const remainingCount = images.length - gridImages.length;

  return (
    <>
      {/* --- MÓVIL: carrusel con snap, contador y puntos --- */}
      <div className="relative -mx-4 md:hidden">
        <div
          ref={mobileTrackRef}
          onScroll={handleMobileScroll}
          className="flex aspect-4/3 snap-x snap-mandatory overflow-x-auto [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          {images.map((src, idx) => (
            <button
              key={`mobile-${idx}`}
              type="button"
              aria-label={`Abrir foto ${idx + 1} de ${images.length}`}
              className="relative h-full w-full shrink-0 snap-center bg-zinc-100"
              onClick={() => openModal(idx)}
            >
              <Image
                src={src}
                alt={`Foto ${idx + 1} de ${title}`}
                fill
                sizes="100vw"
                className="object-cover"
                priority={idx === 0}
              />
            </button>
          ))}
        </div>
        <div className="pointer-events-none absolute right-3 bottom-3 flex items-center gap-1.5 rounded-full bg-black/60 px-3 py-1.5 text-xs font-medium text-white backdrop-blur-sm">
          <Images className="h-3.5 w-3.5" />
          {mobileIndex + 1} / {images.length}
        </div>
        {images.length > 1 && images.length <= 12 && (
          <div className="pointer-events-none absolute bottom-3.5 left-1/2 flex -translate-x-1/2 gap-1.5">
            {images.map((_, idx) => (
              <span
                key={idx}
                className={`h-1.5 rounded-full bg-white transition-all ${
                  idx === mobileIndex ? "w-4 opacity-100" : "w-1.5 opacity-60"
                }`}
              />
            ))}
          </div>
        )}
      </div>

      {/* --- ESCRITORIO: grilla asimétrica --- */}
      <div className="relative hidden md:block">
        <div className="grid h-[520px] grid-cols-4 grid-rows-2 gap-2 overflow-hidden rounded-2xl lg:h-[580px]">
          {gridImages.map((src, idx) => {
            const span =
              images.length === 1
                ? "col-span-4 row-span-2"
                : idx === 0
                  ? "col-span-2 row-span-2"
                  : images.length === 2
                    ? "col-span-2 row-span-2"
                    : images.length === 3
                      ? "col-span-2"
                      : images.length === 4 && idx === 1
                        ? "col-span-2"
                        : "col-span-1";
            return (
              <button
                key={`${src}-${idx}`}
                type="button"
                aria-label={`Abrir foto ${idx + 1} de ${images.length}`}
                className={`group relative h-full w-full cursor-zoom-in overflow-hidden bg-zinc-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-inset ${span}`}
                onClick={() => openModal(idx)}
              >
                <Image
                  src={src}
                  alt={idx === 0 ? `Foto principal de ${title}` : `Foto ${idx + 1} de ${title}`}
                  fill
                  sizes={idx === 0 ? "(min-width: 1480px) 740px, 50vw" : "(min-width: 1480px) 370px, 25vw"}
                  className="object-cover transition-transform duration-500 ease-out group-hover:scale-[1.04]"
                  priority={idx === 0}
                />
                <span className="absolute inset-0 bg-black/0 transition-colors duration-300 group-hover:bg-black/10" />
                {idx === 4 && remainingCount > 0 && (
                  <span className="absolute inset-0 flex flex-col items-center justify-center bg-black/55 text-white transition-colors group-hover:bg-black/65">
                    <span className="font-clash text-3xl font-semibold">+{remainingCount}</span>
                    <span className="text-sm text-white/80">fotos más</span>
                  </span>
                )}
              </button>
            );
          })}
        </div>
        <button
          type="button"
          onClick={() => openModal(0)}
          className="absolute right-4 bottom-4 inline-flex items-center gap-2 rounded-full border border-zinc-200 bg-white/95 px-4 py-2 text-sm font-medium text-zinc-900 shadow-md backdrop-blur transition hover:bg-white hover:shadow-lg"
        >
          <Expand className="h-4 w-4" />
          Ver las {images.length} fotos
        </button>
      </div>

      <AnimatePresence>
        {isModalOpen && (
          <Lightbox
            images={images}
            title={title}
            index={currentIndex}
            onIndexChange={setCurrentIndex}
            onClose={() => setIsModalOpen(false)}
          />
        )}
      </AnimatePresence>
    </>
  );
}

// --- Lightbox con zoom (rueda, pinch, doble click/tap), paneo y swipe ---

type Point = { x: number; y: number };

function Lightbox({
  images,
  title,
  index,
  onIndexChange,
  onClose,
}: {
  images: string[];
  title: string;
  index: number;
  onIndexChange: (index: number) => void;
  onClose: () => void;
}) {
  const [scale, setScale] = useState(1);
  const [offset, setOffset] = useState<Point>({ x: 0, y: 0 });
  const [isGesturing, setIsGesturing] = useState(false);
  const stageRef = useRef<HTMLDivElement>(null);
  const thumbsRef = useRef<HTMLDivElement>(null);
  // Copias síncronas para calcular zoom incremental (rueda, pinch) sin
  // depender del render.
  const scaleRef = useRef(scale);
  const offsetRef = useRef(offset);
  useEffect(() => {
    scaleRef.current = scale;
    offsetRef.current = offset;
  }, [scale, offset]);

  // Estado del gesto en curso (no dispara renders).
  const pointers = useRef(new Map<number, Point>());
  const gesture = useRef({
    startDist: 0,
    startScale: 1,
    startOffset: { x: 0, y: 0 } as Point,
    startPoint: { x: 0, y: 0 } as Point,
    moved: false,
    lastTap: 0,
  });

  const count = images.length;
  const isZoomed = scale > 1.01;

  const clampOffset = useCallback((next: Point, s: number): Point => {
    const stage = stageRef.current;
    if (!stage || s <= 1) return { x: 0, y: 0 };
    const maxX = ((s - 1) * stage.clientWidth) / 2;
    const maxY = ((s - 1) * stage.clientHeight) / 2;
    return {
      x: Math.max(-maxX, Math.min(maxX, next.x)),
      y: Math.max(-maxY, Math.min(maxY, next.y)),
    };
  }, []);

  // Zoom hacia un punto (coordenadas de pantalla), manteniéndolo fijo.
  const zoomTo = useCallback(
    (nextScale: number, focus?: Point) => {
      const stage = stageRef.current;
      const s = Math.max(MIN_SCALE, Math.min(MAX_SCALE, nextScale));
      if (!stage || s <= 1) {
        setScale(1);
        setOffset({ x: 0, y: 0 });
        return;
      }
      const rect = stage.getBoundingClientRect();
      const fx = (focus?.x ?? rect.left + rect.width / 2) - (rect.left + rect.width / 2);
      const fy = (focus?.y ?? rect.top + rect.height / 2) - (rect.top + rect.height / 2);
      const prev = scaleRef.current;
      const o = offsetRef.current;
      const nextOffset = clampOffset(
        { x: fx - ((fx - o.x) * s) / prev, y: fy - ((fy - o.y) * s) / prev },
        s,
      );
      scaleRef.current = s;
      offsetRef.current = nextOffset;
      setScale(s);
      setOffset(nextOffset);
    },
    [clampOffset],
  );

  const resetZoom = useCallback(() => {
    setScale(1);
    setOffset({ x: 0, y: 0 });
  }, []);

  const goTo = useCallback(
    (next: number) => {
      resetZoom();
      onIndexChange((next + count) % count);
    },
    [count, onIndexChange, resetZoom],
  );

  // Teclado + bloqueo de scroll del body.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      else if (e.key === "ArrowRight") goTo(index + 1);
      else if (e.key === "ArrowLeft") goTo(index - 1);
      else if (e.key === "+" || e.key === "=") zoomTo(scale + 0.5);
      else if (e.key === "-") zoomTo(scale - 0.5);
      else if (e.key === "0") resetZoom();
    };
    window.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [index, scale, goTo, onClose, zoomTo, resetZoom]);

  // Rueda: listener no pasivo para poder hacer preventDefault.
  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const factor = Math.exp(-e.deltaY * (e.ctrlKey ? 0.01 : 0.002));
      zoomTo(scaleRef.current * factor, { x: e.clientX, y: e.clientY });
    };
    stage.addEventListener("wheel", onWheel, { passive: false });
    return () => stage.removeEventListener("wheel", onWheel);
  }, [zoomTo]);

  // Mantener visible la miniatura activa.
  useEffect(() => {
    const active = thumbsRef.current?.querySelector<HTMLElement>(`[data-index="${index}"]`);
    active?.scrollIntoView({ block: "nearest", inline: "center", behavior: "smooth" });
  }, [index]);

  const distance = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y);
  const midpoint = (a: Point, b: Point): Point => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });

  const onPointerDown = (e: React.PointerEvent) => {
    (e.target as Element).setPointerCapture?.(e.pointerId);
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const g = gesture.current;
    const pts = [...pointers.current.values()];
    setIsGesturing(true);
    g.moved = false;
    g.startOffset = offset;
    g.startScale = scale;
    if (pts.length === 2) {
      g.startDist = distance(pts[0], pts[1]);
    } else {
      g.startPoint = { x: e.clientX, y: e.clientY };
    }
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (!pointers.current.has(e.pointerId)) return;
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const g = gesture.current;
    const pts = [...pointers.current.values()];

    if (pts.length === 2 && g.startDist > 0) {
      g.moved = true;
      zoomTo(g.startScale * (distance(pts[0], pts[1]) / g.startDist), midpoint(pts[0], pts[1]));
      return;
    }
    const dx = e.clientX - g.startPoint.x;
    const dy = e.clientY - g.startPoint.y;
    if (Math.abs(dx) > 4 || Math.abs(dy) > 4) g.moved = true;
    if (isZoomed) {
      setOffset(clampOffset({ x: g.startOffset.x + dx, y: g.startOffset.y + dy }, scale));
    } else {
      // Arrastre horizontal sin zoom: feedback visual del swipe.
      setOffset({ x: dx, y: 0 });
    }
  };

  const onPointerUp = (e: React.PointerEvent) => {
    const g = gesture.current;
    const wasPinch = pointers.current.size === 2;
    pointers.current.delete(e.pointerId);
    if (pointers.current.size > 0) {
      // Queda un dedo tras el pinch: rebasar el paneo desde ahí.
      const rest = [...pointers.current.values()][0];
      g.startPoint = rest;
      g.startOffset = offset;
      g.startDist = 0;
      return;
    }
    setIsGesturing(false);
    if (wasPinch) return;

    const dx = e.clientX - g.startPoint.x;
    if (!isZoomed && Math.abs(dx) > SWIPE_THRESHOLD && count > 1) {
      goTo(dx < 0 ? index + 1 : index - 1);
      return;
    }
    if (!isZoomed) setOffset({ x: 0, y: 0 });

    // Doble tap / doble click.
    if (!g.moved) {
      const now = Date.now();
      if (now - g.lastTap < 300) {
        g.lastTap = 0;
        if (isZoomed) resetZoom();
        else zoomTo(DOUBLE_TAP_SCALE, { x: e.clientX, y: e.clientY });
      } else {
        g.lastTap = now;
      }
    }
  };

  const iconButton =
    "flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white/80 transition hover:bg-white/20 hover:text-white disabled:pointer-events-none disabled:opacity-30";

  return (
    <motion.div
      role="dialog"
      aria-modal="true"
      aria-label={`Galería de fotos de ${title}`}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
      className="fixed inset-0 z-100 flex flex-col bg-zinc-950/97 text-white backdrop-blur-sm"
    >
      {/* Barra superior */}
      <div className="relative z-20 flex items-center justify-between gap-3 px-4 py-3 md:px-6">
        <p className="text-sm font-medium tabular-nums text-white/80">
          {index + 1} <span className="text-white/40">/ {count}</span>
        </p>
        <div className="flex items-center gap-2">
          <button
            type="button"
            className={iconButton}
            onClick={() => zoomTo(scale - 0.75)}
            disabled={!isZoomed}
            aria-label="Alejar"
          >
            <ZoomOut className="h-5 w-5" />
          </button>
          <button
            type="button"
            onClick={resetZoom}
            disabled={!isZoomed}
            className="min-w-14 rounded-full px-2 py-1 text-xs font-medium tabular-nums text-white/70 transition hover:text-white disabled:opacity-40"
            aria-label="Restablecer zoom"
          >
            {Math.round(scale * 100)}%
          </button>
          <button
            type="button"
            className={iconButton}
            onClick={() => zoomTo(scale + 0.75)}
            disabled={scale >= MAX_SCALE}
            aria-label="Acercar"
          >
            <ZoomIn className="h-5 w-5" />
          </button>
          <span className="mx-1 h-6 w-px bg-white/15" />
          <button type="button" className={iconButton} onClick={onClose} aria-label="Cerrar galería">
            <X className="h-5 w-5" />
          </button>
        </div>
      </div>

      {/* Escenario */}
      <div className="relative flex min-h-0 flex-1 items-center justify-center">
        <div
          ref={stageRef}
          className={`relative h-full w-full touch-none select-none overflow-hidden md:mx-20 md:w-auto md:flex-1 ${
            isZoomed ? (isGesturing ? "cursor-grabbing" : "cursor-grab") : "cursor-zoom-in"
          }`}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
        >
          <AnimatePresence initial={false} mode="popLayout">
            <motion.div
              key={index}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.18 }}
              className="absolute inset-0"
            >
              <div
                className="absolute inset-0 will-change-transform"
                style={{
                  transform: `translate3d(${offset.x}px, ${offset.y}px, 0) scale(${scale})`,
                  transition: isGesturing ? "none" : "transform 220ms cubic-bezier(.2,.8,.2,1)",
                }}
              >
                <Image
                  src={images[index]}
                  alt={`Foto ${index + 1} de ${title}`}
                  fill
                  sizes="100vw"
                  quality={90}
                  draggable={false}
                  className="pointer-events-none object-contain"
                  priority
                />
              </div>
            </motion.div>
          </AnimatePresence>
        </div>

        {count > 1 && (
          <>
            <button
              type="button"
              onClick={() => goTo(index - 1)}
              aria-label="Foto anterior"
              className={`${iconButton} absolute left-3 top-1/2 z-20 hidden h-12 w-12 -translate-y-1/2 md:flex`}
            >
              <ChevronLeft className="h-7 w-7" />
            </button>
            <button
              type="button"
              onClick={() => goTo(index + 1)}
              aria-label="Foto siguiente"
              className={`${iconButton} absolute right-3 top-1/2 z-20 hidden h-12 w-12 -translate-y-1/2 md:flex`}
            >
              <ChevronRight className="h-7 w-7" />
            </button>
          </>
        )}

        {/* Precarga de vecinas */}
        {count > 1 && (
          <div className="hidden" aria-hidden="true">
            {[index + 1, index - 1].map((i) => (
              <Image
                key={i}
                src={images[(i + count) % count]}
                alt=""
                width={16}
                height={16}
                sizes="100vw"
                quality={90}
              />
            ))}
          </div>
        )}
      </div>

      {/* Pie: hint + miniaturas */}
      <div className="relative z-20 px-4 pt-2 pb-4 md:px-6">
        <p className="mb-3 text-center text-xs text-white/40">
          {isZoomed
            ? "Arrastrá para mover · doble toque para salir del zoom"
            : "Doble toque, rueda o pellizco para hacer zoom"}
        </p>
        {count > 1 && (
          <div
            ref={thumbsRef}
            className="mx-auto flex max-w-5xl gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          >
            {images.map((src, idx) => (
              <button
                key={`thumb-${idx}`}
                type="button"
                data-index={idx}
                onClick={() => goTo(idx)}
                aria-label={`Ver foto ${idx + 1}`}
                aria-current={idx === index}
                className={`relative h-14 w-20 shrink-0 overflow-hidden rounded-md transition md:h-16 md:w-24 ${
                  idx === index
                    ? "opacity-100 ring-2 ring-white ring-offset-2 ring-offset-zinc-950"
                    : "opacity-45 hover:opacity-80"
                }`}
              >
                <Image src={src} alt="" fill sizes="96px" className="object-cover" />
              </button>
            ))}
          </div>
        )}
      </div>
    </motion.div>
  );
}
