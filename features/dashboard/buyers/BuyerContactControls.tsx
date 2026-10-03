"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ChevronDown, MessageCircle } from "lucide-react";
import { createClientBrowser } from "@/lib/supabase-browser";
import { Button } from "@/shared/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/shared/components/ui/dropdown-menu";
import { NO_INTEREST_REASONS, OUTCOMES, type Outcome } from "./outcomes";

// WhatsApp + resultado del contacto. Abrir WhatsApp registra "contactado"
// si todavía no había contacto, así la base se actualiza sin pasos extra.
export function BuyerContactControls({
  leadId,
  propertyId,
  leadName,
  waHref,
  current,
}: {
  leadId: string;
  propertyId: string;
  leadName: string;
  waHref: string | null;
  current: Outcome | null;
}) {
  const supabase = createClientBrowser();
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  const record = async (outcome: Outcome, reason?: string) => {
    setBusy(true);
    const { error } = await supabase
      .from("buyer_contacts")
      .insert({ lead_id: leadId, property_id: propertyId, outcome, reason: reason ?? null });
    setBusy(false);
    if (error) {
      toast.error("No se pudo registrar el contacto");
      return false;
    }
    router.refresh();
    return true;
  };

  const openWhatsApp = async () => {
    if (!waHref) return;
    window.open(waHref, "_blank", "noopener,noreferrer");
    if (!current) await record("contactado");
  };

  return (
    <div className="flex shrink-0 items-center gap-1">
      {waHref && (
        <Button
          variant="outline"
          size="icon"
          className="size-8"
          onClick={openWhatsApp}
          disabled={busy}
          aria-label={`WhatsApp a ${leadName}`}
        >
          <MessageCircle />
        </Button>
      )}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="icon" className="size-8" disabled={busy} aria-label="Registrar resultado">
            <ChevronDown />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuLabel>Resultado del contacto</DropdownMenuLabel>
          {OUTCOMES.filter((o) => o.value !== "no_interesado").map((o) => (
            <DropdownMenuItem key={o.value} onSelect={() => record(o.value)}>
              {o.label}
            </DropdownMenuItem>
          ))}
          <DropdownMenuSeparator />
          <DropdownMenuLabel>No interesado por…</DropdownMenuLabel>
          {NO_INTEREST_REASONS.map((r) => (
            <DropdownMenuItem key={r.value} onSelect={() => record("no_interesado", r.value)}>
              {r.label}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
