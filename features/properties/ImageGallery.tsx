"use client";

import { useState } from "react";
import Image from "next/image";
import { Dialog, DialogContent } from "@/shared/components/ui/dialog";
import { X } from "lucide-react";

type ImageGalleryProps = {
  images: string[];
};

export function ImageGallery({ images }: ImageGalleryProps) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);

  if (!images || images.length === 0) {
    return (
      <div className="h-[500px] w-full bg-zinc-200 rounded-lg flex items-center justify-center text-zinc-500">
        No hay imágenes disponibles
      </div>
    );
  }

  const mainImage = images[0];

  const firstThreeGridImages = images.slice(1, 4);

  const fourthSlotImage = images[4];

  const remainingCount = images.length - 5;

  const openModal = (index: number) => {
    setCurrentImageIndex(index);
    setIsModalOpen(true);
  };

  const goToNext = () => {
    setCurrentImageIndex((prev) => (prev === images.length - 1 ? 0 : prev + 1));
  };

  const goToPrev = () => {
    setCurrentImageIndex((prev) => (prev === 0 ? images.length - 1 : prev - 1));
  };

  return (
    <>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 h-[500px]">
        {/* Imagen Principal */}
        <div
          className="h-full w-full rounded-t-xl md:rounded-l-xl overflow-hidden relative cursor-pointer group"
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
        </div>

        {/* ---  Grilla 2x2 de 4 imágenes --- */}
        <div className="hidden md:grid grid-cols-2 grid-rows-2 gap-4 h-full">
          {/* 1. Renderiza las primeras 3 imágenes de la grilla */}
          {firstThreeGridImages.map((src, index) => (
            <div
              key={src}
              className="h-full w-full rounded-xl overflow-hidden relative cursor-pointer group"
              onClick={() => openModal(index + 1)}
            >
              <Image
                src={src}
                alt={`Galería de propiedad ${index + 1}`}
                fill
                style={{ objectFit: "cover" }}
                priority={true}
                className="transition-transform duration-300 group-hover:scale-105"
              />
              <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity" />
            </div>
          ))}

          {/* 2. Renderiza el 4to slot (si existe) */}
          {fourthSlotImage && (
            <div
              className="h-full w-full rounded-lg overflow-hidden relative cursor-pointer group"
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

              {/* 3. Lógica del Overlay  */}
              {remainingCount > 0 ? (
                <div className="absolute inset-0 bg-black/70 flex items-center justify-center text-white">
                  <span className="text-4xl font-bold">+{remainingCount}</span>
                </div>
              ) : (
                <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity" />
              )}
            </div>
          )}
        </div>
      </div>

      {/* --- Modal de Galería --- */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="min-w-[50dvw] max-w-[95vw] h-[95vh] p-0 border-0 bg-black/80 flex items-center justify-center">
          <button
            onClick={() => setIsModalOpen(false)}
            className="absolute top-4 right-4 text-white z-50"
          >
            <X size={32} />
          </button>

          <button
            onClick={goToPrev}
            className="absolute left-4 top-1/2 -translate-y-1/2 text-white bg-black/30 p-2 rounded-full z-50 cursor-pointer"
          >
            {"<"}
          </button>
          <button
            onClick={goToNext}
            className="absolute right-4 top-1/2 -translate-y-1/2 text-white bg-black/30 p-2 rounded-full z-50 cursor-pointer"
          >
            {">"}
          </button>

          <div className="relative w-full h-full">
            <Image
              src={images[currentImageIndex]}
              alt="Galería de propiedad"
              fill
              style={{ objectFit: "contain" }}
            />
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
