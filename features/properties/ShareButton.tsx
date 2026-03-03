"use client";

import { useState } from "react";
import { Share2, Check } from "lucide-react";
import { Button } from "@/shared/components/ui/button";

interface ShareButtonProps {
  title: string;
}

export function ShareButton({ title }: ShareButtonProps) {
  const [copied, setCopied] = useState(false);

  const handleShare = async () => {
    const url = window.location.href;

    try {
      if (navigator.share) {
        await navigator.share({
          title: "TerraNova Inmobiliaria",
          text: `Mirá esta propiedad: ${title}`,
          url: url,
        });
      } else {
        await navigator.clipboard.writeText(url);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }
    } catch (error) {
      console.error("Error al compartir:", error);
    }
  };

  return (
    <Button
      variant="outline"
      size="sm"
      className="bg-white text-zinc-700 border-zinc-200 hover:bg-zinc-50 cursor-pointer"
      onClick={handleShare}
    >
      {copied ? (
        <Check size={16} className="mr-2 text-green-600" />
      ) : (
        <Share2 size={16} className="mr-2" />
      )}
      {copied ? "¡Copiado!" : "Compartir"}
    </Button>
  );
}