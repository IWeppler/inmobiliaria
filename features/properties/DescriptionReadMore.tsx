"use client";

import { useState } from "react";
import { Button } from "@/shared/components/ui/button";

type DescriptionProps = {
  text: string;
};

export function DescriptionWithReadMore({ text }: DescriptionProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  // Si no hay texto, no renderizar nada
  if (!text) {
    return <p className="text-zinc-700">No hay descripción disponible.</p>;
  }

  const collapsedMaxHeight = "max-h-60";

  return (
    <div className="relative">
      <div
        className={`text-zinc-700 leading-relaxed whitespace-pre-wrap overflow-hidden transition-all duration-300 ${
          isExpanded ? "max-h-none" : collapsedMaxHeight
        }`}
      >
        {text}
      </div>

      {!isExpanded && (
        <div className="absolute bottom-0 left-0 w-full h-24 bg-linear-to-t from-background via-background/80 to-transparent">
          <Button
            variant="link"
            className="absolute bottom-0 left-0 font-semibold text-main cursor-pointer"
            onClick={() => setIsExpanded(true)}
          >
            Continuar leyendo...
          </Button>
        </div>
      )}

      {/* Botón de "Ver menos" que aparece cuando está expandido */}
      {isExpanded && (
        <Button
          variant="link"
          className="font-semibold text-main px-0 cursor-pointer"
          onClick={() => setIsExpanded(false)}
        >
          Ver menos
        </Button>
      )}
    </div>
  );
}
