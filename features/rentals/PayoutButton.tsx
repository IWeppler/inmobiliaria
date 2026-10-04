"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import { Label } from "@/shared/components/ui/label";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/shared/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/shared/components/ui/select";
import { markSharePaidAction } from "@/features/rentals/lifecycleActions";
import { formatDate, money } from "@/features/rentals/logic";
import { useRunAction } from "@/features/rentals/useRunAction";

type Method = "TRANSFERENCIA" | "EFECTIVO" | "OTRO";
const METHOD_LABELS: Record<Method, string> = { TRANSFERENCIA: "Transferencia", EFECTIVO: "Efectivo", OTRO: "Otro" };

export type PayoutShare = {
  id: string; ownerName: string; amount: number; currency: string; paidAt: string | null;
  method?: string | null; reference?: string | null;
};

// Registra (o anula) el pago de la parte de un propietario en una liquidación.
export function PayoutButton({ share, today }: { share: PayoutShare; today: string }) {
  const { busy, run } = useRunAction();
  const [open, setOpen] = useState(false);
  const [v, setV] = useState({ paid_to_owner_at: today, payout_method: "TRANSFERENCIA" as Method, payout_reference: "" });

  if (share.paidAt) {
    return (
      <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
        <span title={share.reference ?? undefined}>
          {METHOD_LABELS[share.method as Method] ?? "Pagada"} {formatDate(share.paidAt)}{share.reference ? ` · ${share.reference}` : ""}
        </span>
        <Button size="sm" variant="ghost" className="h-6 px-1.5 text-xs print:hidden" disabled={!!busy}
          onClick={() => run("payout", () => markSharePaidAction({ share_id: share.id, paid_to_owner_at: null, payout_method: null }))}>
          Anular
        </Button>
      </span>
    );
  }

  return (
    <Dialog open={open} onOpenChange={(next) => { setOpen(next); if (next) setV({ paid_to_owner_at: today, payout_method: "TRANSFERENCIA", payout_reference: "" }); }}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline" className="print:hidden">Registrar pago</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Pago al propietario</DialogTitle>
          <DialogDescription>{share.ownerName} · {money(share.amount, share.currency)}</DialogDescription>
        </DialogHeader>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="grid gap-1.5"><Label htmlFor="payout-date">Fecha</Label><Input id="payout-date" type="date" max={today} value={v.paid_to_owner_at} onChange={(e) => setV({ ...v, paid_to_owner_at: e.target.value })} /></div>
          <div className="grid gap-1.5"><Label>Medio</Label>
            <Select value={v.payout_method} onValueChange={(value) => setV({ ...v, payout_method: value as Method })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{(Object.keys(METHOD_LABELS) as Method[]).map((m) => <SelectItem key={m} value={m}>{METHOD_LABELS[m]}</SelectItem>)}</SelectContent>
            </Select></div>
          <div className="grid gap-1.5 sm:col-span-2"><Label htmlFor="payout-ref">Referencia</Label><Input id="payout-ref" value={v.payout_reference} placeholder="N.º de operación o comprobante" onChange={(e) => setV({ ...v, payout_reference: e.target.value })} /></div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)}>Cancelar</Button>
          <Button disabled={!!busy || !v.paid_to_owner_at} onClick={async () => {
            const ok = await run("payout", () => markSharePaidAction({ share_id: share.id, ...v }));
            if (ok) setOpen(false);
          }}>{busy ? <Loader2 className="size-4 animate-spin" /> : "Registrar"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
