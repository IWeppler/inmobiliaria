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
import { recordRentalPaymentAction } from "@/features/rentals/actions";
import { money } from "@/features/rentals/logic";
import { useRunAction } from "@/features/rentals/useRunAction";

type Method = "TRANSFERENCIA" | "EFECTIVO" | "OTRO";

// Registra un cobro (total o parcial) sobre un cargo. Genera recibo numerado.
export function PaymentDialog({
  chargeId, description, balance, currency, today, trigger,
}: {
  chargeId: string; description: string; balance: number; currency: string; today: string;
  trigger?: React.ReactNode;
}) {
  const { busy, run } = useRunAction();
  const [open, setOpen] = useState(false);
  const blank = () => ({ paid_at: today, amount: balance, method: "TRANSFERENCIA" as Method, account: "", notes: "" });
  const [v, setV] = useState(blank);

  const invalid = v.amount <= 0 || v.amount > balance + 0.005 || !v.account.trim() || !v.paid_at;
  const partial = v.amount > 0 && v.amount + 0.005 < balance;

  return (
    <Dialog open={open} onOpenChange={(next) => { setOpen(next); if (next) setV(blank()); }}>
      <DialogTrigger asChild>{trigger ?? <Button size="sm" variant="outline">Cobrar</Button>}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Registrar cobro</DialogTitle>
          <DialogDescription>{description} · saldo {money(balance, currency)}</DialogDescription>
        </DialogHeader>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="grid gap-1.5"><Label htmlFor="pay-date">Fecha</Label><Input id="pay-date" type="date" max={today} value={v.paid_at} onChange={(e) => setV({ ...v, paid_at: e.target.value })} /></div>
          <div className="grid gap-1.5">
            <Label htmlFor="pay-amount">Importe ({currency})</Label>
            <Input id="pay-amount" type="number" min="0.01" max={balance} step="0.01" value={v.amount || ""} onChange={(e) => setV({ ...v, amount: Number(e.target.value) })} />
            {partial && <p className="text-xs text-muted-foreground">Cobro parcial: quedan {money(balance - v.amount, currency)}.</p>}
          </div>
          <div className="grid gap-1.5"><Label>Medio</Label>
            <Select value={v.method} onValueChange={(value) => setV({ ...v, method: value as Method, account: value === "EFECTIVO" ? "Caja" : v.account === "Caja" ? "" : v.account })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="TRANSFERENCIA">Transferencia</SelectItem><SelectItem value="EFECTIVO">Efectivo</SelectItem><SelectItem value="OTRO">Otro</SelectItem></SelectContent>
            </Select></div>
          <div className="grid gap-1.5"><Label htmlFor="pay-account">Cuenta de ingreso</Label><Input id="pay-account" value={v.account} placeholder="Banco o caja" onChange={(e) => setV({ ...v, account: e.target.value })} /></div>
          <div className="grid gap-1.5 sm:col-span-2"><Label htmlFor="pay-notes">Nota</Label><Input id="pay-notes" value={v.notes} onChange={(e) => setV({ ...v, notes: e.target.value })} /></div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)}>Cancelar</Button>
          <Button disabled={!!busy || invalid} onClick={async () => {
            const ok = await run("pay", () => recordRentalPaymentAction({ charge_id: chargeId, ...v }));
            if (ok) setOpen(false);
          }}>{busy ? <Loader2 className="size-4 animate-spin" /> : "Registrar cobro"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
