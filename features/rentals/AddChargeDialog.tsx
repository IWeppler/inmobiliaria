"use client";

import { useState } from "react";
import { Loader2, Plus } from "lucide-react";
import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import { Label } from "@/shared/components/ui/label";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/shared/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/shared/components/ui/select";
import { addRentalChargeAction } from "@/features/rentals/actions";
import { CHARGE_LABELS, MANUAL_CHARGE_KINDS, periodOf, type ManualChargeKind } from "@/features/rentals/logic";
import { useRunAction } from "@/features/rentals/useRunAction";

// Cargo manual en la cuenta corriente del inquilino (expensas, servicios,
// punitorios, reparaciones, penalidad). El alquiler lo generan las cuotas.
export function AddChargeDialog({
  contractId, currency, today, settledPeriods, preset,
}: {
  contractId: string; currency: string; today: string; settledPeriods: string[];
  preset?: { kind: ManualChargeKind; description: string; amount: number; period: string; label: string };
}) {
  const { busy, run } = useRunAction();
  const [open, setOpen] = useState(false);
  const blank = () => preset
    ? { kind: preset.kind, description: preset.description, amount: preset.amount, due_date: today, period: preset.period }
    : { kind: "EXPENSAS" as ManualChargeKind, description: "", amount: 0, due_date: today, period: periodOf(today) };
  const [v, setV] = useState(blank);
  const settled = settledPeriods.includes(v.period);

  return (
    <Dialog open={open} onOpenChange={(next) => { setOpen(next); if (next) setV(blank()); }}>
      <DialogTrigger asChild>
        {preset
          ? <Button size="sm" variant="outline">{preset.label}</Button>
          : <Button size="sm" variant="outline"><Plus /> Agregar cargo</Button>}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Agregar cargo</DialogTitle>
          <DialogDescription>Se suma a la cuenta corriente del inquilino y se cobra como cualquier cuota.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="grid gap-1.5"><Label>Concepto</Label>
            <Select value={v.kind} onValueChange={(value) => setV({ ...v, kind: value as ManualChargeKind })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{MANUAL_CHARGE_KINDS.map((kind) => <SelectItem key={kind} value={kind}>{CHARGE_LABELS[kind]}</SelectItem>)}</SelectContent>
            </Select></div>
          <div className="grid gap-1.5"><Label htmlFor="charge-amount">Importe ({currency})</Label><Input id="charge-amount" type="number" min="0.01" step="0.01" value={v.amount || ""} onChange={(e) => setV({ ...v, amount: Number(e.target.value) })} /></div>
          <div className="grid gap-1.5 sm:col-span-2"><Label htmlFor="charge-desc">Descripción</Label><Input id="charge-desc" value={v.description} placeholder="Expensas ordinarias octubre" onChange={(e) => setV({ ...v, description: e.target.value })} /></div>
          <div className="grid gap-1.5 sm:col-span-2">
            <Label htmlFor="charge-due">Vencimiento</Label>
            <Input id="charge-due" type="date" value={v.due_date} onChange={(e) => setV({ ...v, due_date: e.target.value, period: preset ? v.period : periodOf(e.target.value) })} />
            {settled && <p className="text-xs text-danger">Ese mes ya está liquidado al propietario: elegí otro vencimiento.</p>}
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)}>Cancelar</Button>
          <Button disabled={!!busy || settled || v.description.trim().length < 3 || v.amount <= 0} onClick={async () => {
            const ok = await run("charge", () => addRentalChargeAction({ contract_id: contractId, ...v }));
            if (ok) setOpen(false);
          }}>{busy ? <Loader2 className="size-4 animate-spin" /> : "Agregar"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
