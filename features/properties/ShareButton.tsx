"use client";

import { useState, useSyncExternalStore } from "react";
import { Check, Link as LinkIcon, Share2 } from "lucide-react";
import { FaWhatsapp } from "react-icons/fa";
import { toast } from "sonner";

import { Button } from "@/shared/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/shared/components/ui/dropdown-menu";
import { BRAND } from "@/lib/brand";

interface ShareButtonProps {
  title: string;
  price?: string;
  location?: string;
  url?: string;
}

// E2.1: un solo botón "Compartir". En dispositivos con Web Share API
// (móvil) abre la hoja nativa -- WhatsApp, Instagram, etc. -- con el
// texto armado; en escritorio abre un menú: WhatsApp Web / copiar link.
// La tarjeta rica (foto, precio) la aporta la OG image dinámica de
// /propiedades/[slug]/opengraph-image.tsx, no este componente.
export function ShareButton({ title, price, location, url }: ShareButtonProps) {
  const [copied, setCopied] = useState(false);
  // Se resuelve con useSyncExternalStore para no desincronizar la
  // hidratación: en servidor (snapshot false) no existe navigator.
  const canNativeShare = useSyncExternalStore(
    () => () => {},
    () => typeof navigator.share === "function",
    () => false
  );

  // Sin query ni hash: WhatsApp cachea la vista previa por URL exacta, y
  // con parámetros (utm, filtros) cada variante pide una tarjeta nueva.
  const shareUrl =
    url || (typeof window !== "undefined" ? `${window.location.origin}${window.location.pathname}` : "");

  const shareText = [
    `*${title}*`,
    [price, location].filter(Boolean).join(" · "),
    "",
    `Mirá todos los detalles en ${BRAND.name}:`,
  ]
    .filter((l) => l !== undefined)
    .join("\n");

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      toast.success("¡Enlace copiado al portapapeles!");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("No se pudo copiar el enlace.");
    }
  };

  const handleWhatsApp = () => {
    const text = encodeURIComponent(`${shareText}\n${shareUrl}`);
    window.open(`https://api.whatsapp.com/send?text=${text}`, "_blank");
  };

  const handleNativeShare = async () => {
    if (typeof navigator === "undefined" || !navigator.share) return false;
    try {
      await navigator.share({ title, text: shareText, url: shareUrl });
    } catch {
      // Cancelado por el usuario: no es un error.
    }
    return true;
  };

  if (canNativeShare) {
    return (
      <Button
        variant="outline"
        className="gap-2 cursor-pointer"
        onClick={handleNativeShare}
      >
        <Share2 className="w-4 h-4 text-zinc-500" />
        Compartir
      </Button>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" className="gap-2 cursor-pointer">
          {copied ? (
            <Check className="w-4 h-4 text-green-600" />
          ) : (
            <Share2 className="w-4 h-4 text-zinc-500" />
          )}
          {copied ? "¡Copiado!" : "Compartir"}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={handleWhatsApp}>
          <FaWhatsapp className="mr-2 h-4 w-4 text-green-600" aria-hidden />
          WhatsApp
        </DropdownMenuItem>
        <DropdownMenuItem onClick={handleCopyLink}>
          <LinkIcon className="mr-2 h-4 w-4" />
          Copiar enlace
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
