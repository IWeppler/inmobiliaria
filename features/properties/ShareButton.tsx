"use client";

import { useState } from "react";
import { Check, Link as LinkIcon } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/shared/components/ui/button";

interface ShareButtonProps {
  title: string;
  url?: string;
}

export function ShareButton({ title, url }: ShareButtonProps) {
  const [copied, setCopied] = useState(false);

  const shareUrl =
    url || (typeof window !== "undefined" ? window.location.href : "");

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      toast.success("¡Enlace copiado al portapapeles!");
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      toast.error("No se pudo copiar el enlace.");
    }
  };

  const handleWhatsAppShare = () => {
    const text = encodeURIComponent(
      `¡Mirá esta excelente propiedad en TerraNova!\n\n*${title}*\n\nPodés ver todos los detalles aquí: ${shareUrl}`,
    );
    window.open(`https://api.whatsapp.com/send?text=${text}`, "_blank");
  };

  return (
    <>
      {/* Botón para Móviles -> Abre WhatsApp Directamente */}
      <Button
        variant="outline"
        className="gap-2 flex md:hidden border-green-200 bg-green-50 hover:bg-green-100 hover:text-green-800 cursor-pointer"
        onClick={handleWhatsAppShare}
      >
        <LinkIcon className="w-4 h-4 text-zinc-500" />
        Compartir
      </Button>

      {/* Botón para Escritorio-> Copia el enlace */}
      <Button
        variant="outline"
        className="gap-2 hidden md:flex cursor-pointer"
        onClick={handleCopyLink}
      >
        {copied ? (
          <Check className="w-4 h-4 text-green-600" />
        ) : (
          <LinkIcon className="w-4 h-4 text-zinc-500" />
        )}
        <span className={copied ? "text-green-600 font-medium" : ""}>
          {copied ? "¡Copiado!" : "Copiar enlace"}
        </span>
      </Button>
    </>
  );
}
