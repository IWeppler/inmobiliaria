"use client";

import { useState, useEffect, useCallback } from "react";
import Image from "next/image";
import { motion, AnimatePresence } from "framer-motion";
import { X, ChevronLeft, ChevronRight } from "lucide-react";

type ImageGalleryProps = {
  images: string[];
};

export function ImageGallery({ images }: ImageGalleryProps) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);

  const openModal = useCallback((index: number) => {
    setCurrentImageIndex(index);
    setIsModalOpen(true);
  }, []);

  const goToNext = useCallback(() => {
    setCurrentImageIndex((prev) => (prev === images.length - 1 ? 0 : prev + 1));
  }, [images.length]);

  const goToPrev = useCallback(() => {
    setCurrentImageIndex((prev) => (prev === 0 ? images.length - 1 : prev - 1));
  }, [images.length]);

  // Navegación por teclado
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (!isModalOpen) return;
      if (e.key === "Escape") setIsModalOpen(false);
      if (e.key === "ArrowRight") goToNext();
      if (e.key === "ArrowLeft") goToPrev();
    },
    [isModalOpen, goToNext, goToPrev],
  );

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  if (!images || images.length === 0) {
    return (
      <div className="h-[350px] md:h-[500px] w-full bg-zinc-200 rounded-xl flex items-center justify-center text-zinc-500">
        No hay imágenes disponibles
      </div>
    );
  }

  const mainImage = images[0];
  const firstThreeGridImages = images.slice(1, 4);
  const fourthSlotImage = images[4];
  const remainingCount = images.length - 5;

  return (
    <>
      {/* --- VISTA MÓVIL: Carrusel Deslizable (< md) --- */}
      <div className="flex md:hidden overflow-x-auto snap-x snap-mandatory h-[350px] rounded-xl gap-2 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
        {images.map((src, idx) => (
          <div
            key={`mobile-${idx}`}
            className="relative w-full shrink-0 h-full snap-center cursor-pointer"
            onClick={() => openModal(idx)}
          >
            <Image
              src={src}
              alt={`Imagen de la propiedad ${idx + 1}`}
              fill
              style={{ objectFit: "cover" }}
              priority={idx === 0}
            />
            {/* Píldora contadora para móviles */}
            <div className="absolute bottom-4 right-4 bg-black/60 text-white text-xs font-medium px-3 py-1.5 rounded-full backdrop-blur-sm">
              {idx + 1} / {images.length}
            </div>
          </div>
        ))}
      </div>

      {/* --- VISTA ESCRITORIO: Grilla Asimétrica (>= md) --- */}
      <div className="hidden md:grid grid-cols-2 gap-4 h-[600px]">
        {/* Imagen Principal (Mitad Izquierda) */}
        <motion.div
          layoutId={`gallery-image-0`}
          className="h-full w-full rounded-l-xl overflow-hidden relative cursor-pointer group"
          onClick={() => openModal(0)}
        >
          <Image
            src={mainImage}
            alt="Imagen principal de la propiedad"
            fill
            style={{ objectFit: "cover" }}
            priority={true}
            className="transition-transform duration-300 group-hover:scale-105"
          />
          <div className="absolute inset-0 bg-black/10 opacity-0 group-hover:opacity-100 transition-opacity" />
        </motion.div>

        {/* Grilla 2x2 de 4 imágenes (Mitad Derecha) */}
        <div className="grid grid-cols-2 grid-rows-2 gap-4 h-full">
          {firstThreeGridImages.map((src, idx) => {
            const actualIndex = idx + 1;
            return (
              <motion.div
                layoutId={`gallery-image-${actualIndex}`}
                key={src}
                className="h-full w-full rounded-xl overflow-hidden relative cursor-pointer group"
                // Redondeamos las esquinas correctas
                style={{
                  borderTopRightRadius: idx === 1 ? "0.75rem" : undefined,
                }}
                onClick={() => openModal(actualIndex)}
              >
                <Image
                  src={src}
                  alt={`Galería de propiedad ${actualIndex}`}
                  fill
                  style={{ objectFit: "cover" }}
                  priority={true}
                  className="transition-transform duration-300 group-hover:scale-105"
                />
                <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity" />
              </motion.div>
            );
          })}

          {/* Último slot con overlay de "+X" */}
          {fourthSlotImage && (
            <motion.div
              layoutId={`gallery-image-4`}
              className="h-full w-full rounded-br-xl overflow-hidden relative cursor-pointer group"
              onClick={() => openModal(4)}
            >
              <Image
                src={fourthSlotImage}
                alt={`Galería de propiedad 4`}
                fill
                style={{ objectFit: "cover" }}
                priority={true}
                className="transition-transform duration-300 group-hover:scale-105"
              />

              {remainingCount > 0 ? (
                <div className="absolute inset-0 bg-black/60 flex items-center justify-center text-white backdrop-blur-[2px] transition-colors group-hover:bg-black/70">
                  <span className="text-3xl font-clash font-semibold tracking-wider">
                    +{remainingCount}
                  </span>
                </div>
              ) : (
                <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity" />
              )}
            </motion.div>
          )}
        </div>
      </div>

      {/* --- MODAL DE GALERÍA (Framer Motion) --- */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center">
            {/* Fondo oscuro animado */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/95 cursor-pointer backdrop-blur-sm"
              onClick={() => setIsModalOpen(false)}
            />

            {/* Botón Cerrar */}
            <motion.button
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              onClick={() => setIsModalOpen(false)}
              className="absolute top-6 right-6 text-white/70 hover:text-white z-50 p-2 bg-white/10 hover:bg-white/20 rounded-full transition-all"
            >
              <X size={28} />
            </motion.button>

            {/* Controles de navegación */}
            {images.length > 1 && (
              <>
                <motion.button
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  onClick={(e) => {
                    e.stopPropagation();
                    goToPrev();
                  }}
                  className="absolute left-4 md:left-8 top-1/2 -translate-y-1/2 text-white/70 hover:text-white bg-white/10 hover:bg-white/20 p-3 rounded-full z-50 transition-all cursor-pointer"
                >
                  <ChevronLeft size={32} />
                </motion.button>
                <motion.button
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 20 }}
                  onClick={(e) => {
                    e.stopPropagation();
                    goToNext();
                  }}
                  className="absolute right-4 md:right-8 top-1/2 -translate-y-1/2 text-white/70 hover:text-white bg-white/10 hover:bg-white/20 p-3 rounded-full z-50 transition-all cursor-pointer"
                >
                  <ChevronRight size={32} />
                </motion.button>
              </>
            )}

            {/* Contador de imágenes Modal */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute bottom-6 left-1/2 -translate-x-1/2 text-white/80 font-medium tracking-wide bg-black/50 px-4 py-1.5 rounded-full text-sm z-50"
            >
              {currentImageIndex + 1} / {images.length}
            </motion.div>

            {/* IMAGEN PRINCIPAL EXPANDIDA */}
            <motion.div
              // layoutId solo se activa en pantallas grandes para que la animación sea perfecta desde la grilla
              layoutId={
                typeof window !== "undefined" && window.innerWidth >= 768
                  ? `gallery-image-${currentImageIndex}`
                  : undefined
              }
              className="relative z-10 w-full max-w-6xl h-[70vh] md:h-[85vh] mx-4 md:mx-20"
              onClick={(e) => e.stopPropagation()}
            >
              <Image
                src={images[currentImageIndex]}
                alt={`Imagen en pantalla completa ${currentImageIndex + 1}`}
                fill
                style={{ objectFit: "contain" }}
                priority={true}
              />
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
}
