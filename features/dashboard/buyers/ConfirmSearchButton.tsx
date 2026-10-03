"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { CheckCheck } from "lucide-react";
import { createClientBrowser } from "@/lib/supabase-browser";
import { Button } from "@/shared/components/ui/button";

// "Sigue buscando": reconfirma la búsqueda de un lead sin tocar sus criterios.
export function ConfirmSearchButton({ leadId }: { leadId: string }) {
  const supabase = createClientBrowser();
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  const confirm = async () => {
    setBusy(true);
    const { error } = await supabase
      .from("leads")
      .update({ search_confirmed_at: new Date().toISOString() })
      .eq("id", leadId);
    setBusy(false);
    if (error) toast.error("No se pudo confirmar");
    else {
      toast.success("Búsqueda confirmada");
      router.refresh();
    }
  };

  return (
    <Button variant="ghost" size="sm" onClick={confirm} disabled={busy}>
      <CheckCheck /> Sigue buscando
    </Button>
  );
}
