"use client";

import { Share2, Check, Copy } from "lucide-react";
import { Button } from "@/shared/components/ui/button";
import { useState } from "react";
import { toast } from "sonner";

export function ShareButton({ title, text }: { title: string; text: string }) {
  const [copied, setCopied] = useState(false);

  const handleShare = async () => {
    const url = window.location.href;

    if (navigator.share) {
      try {
        await navigator.share({ title, text, url });
        return;
      } catch (err) {
        console.log("Compartir cancelado");
      }
    }

    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      toast.success("Link copiado al portapapeles");
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      toast.error("No se pudo copiar el link");
    }
  };

  return (
    <Button variant="outline" size="icon" onClick={handleShare} className="rounded-full">
      {copied ? <Check className="h-4 w-4 text-green-600" /> : <Share2 className="h-4 w-4" />}
    </Button>
  );
}