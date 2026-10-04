"use client";

import { useState } from "react";
import { Loader2, Pencil } from "lucide-react";
import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import { Label } from "@/shared/components/ui/label";
import { Textarea } from "@/shared/components/ui/textarea";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/shared/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/shared/components/ui/select";
import { updateContactAction, updateContractTermsAction } from "@/features/rentals/lifecycleActions";
import { useRunAction } from "@/features/rentals/useRunAction";

type Option = { id: string; label: string };
type Terms = {
  owner_id: string; tenant_id: string; commission_pct: number; late_fee_pct_daily: number;
  late_fee_fixed: number; late_fee_mode: "AUTO" | "MANUAL"; late_fee_grace_days: number;
  guarantee_type: "NINGUNA" | "GARANTE" | "CAUCION";
  guarantee_detail: string; notes: string;
};

// Condiciones no financieras. Canon, fechas y ajuste no se tocan acá porque
// ya generaron cuotas: se corrigen con el ajuste manual o renovando.
export function EditContractDialog({
  contractId, initial, owners, tenants,
}: { contractId: string; initial: Terms; owners: Option[]; tenants: Option[] }) {
  const { busy, run } = useRunAction();
  const [open, setOpen] = useState(false);
  const [v, setV] = useState(initial);
  const set = <K extends keyof Terms>(key: K, value: Terms[K]) => setV((prev) => ({ ...prev, [key]: value }));

  return (
    <Dialog open={open} onOpenChange={(next) => { setOpen(next); if (next) setV(initial); }}>
      <DialogTrigger asChild><Button variant="outline"><Pencil /> Editar</Button></DialogTrigger>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Editar contrato</DialogTitle>
          <DialogDescription>Canon, fechas y ajuste no se editan: usá el ajuste manual o renová el contrato.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="grid gap-1.5"><Label>Propietario</Label>
            <Select value={v.owner_id} onValueChange={(id) => set("owner_id", id)}><SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{owners.map((o) => <SelectItem key={o.id} value={o.id}>{o.label}</SelectItem>)}</SelectContent></Select></div>
          <div className="grid gap-1.5"><Label>Inquilino</Label>
            <Select value={v.tenant_id} onValueChange={(id) => set("tenant_id", id)}><SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{tenants.map((o) => <SelectItem key={o.id} value={o.id}>{o.label}</SelectItem>)}</SelectContent></Select></div>
          <div className="grid gap-1.5"><Label>Comisión (% del canon)</Label><Input type="number" min={0} max={100} step="0.01" value={v.commission_pct} onChange={(e) => set("commission_pct", Number(e.target.value))} /></div>
          <div className="grid gap-1.5"><Label>Punitorio (% diario)</Label><Input type="number" min={0} step="0.001" value={v.late_fee_pct_daily} onChange={(e) => set("late_fee_pct_daily", Number(e.target.value))} /></div>
          <div className="grid gap-1.5"><Label>Punitorio fijo</Label><Input type="number" min={0} step="0.01" value={v.late_fee_fixed} onChange={(e) => set("late_fee_fixed", Number(e.target.value))} /></div>
          <div className="grid gap-1.5"><Label>Cálculo del punitorio</Label>
            <Select value={v.late_fee_mode} onValueChange={(value) => set("late_fee_mode", value as Terms["late_fee_mode"])}><SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="AUTO">Automático</SelectItem><SelectItem value="MANUAL">Manual</SelectItem></SelectContent></Select></div>
          <div className="grid gap-1.5"><Label htmlFor="edit-grace">Días de gracia</Label><Input id="edit-grace" type="number" min={0} max={30} step={1} value={v.late_fee_grace_days} onChange={(e) => set("late_fee_grace_days", Number(e.target.value))} /></div>
          {initial.late_fee_mode === "MANUAL" && v.late_fee_mode === "AUTO" && (
            <p className="rounded-md bg-warning/10 p-2.5 text-xs text-warning sm:col-span-2">
              Al pasar a automático se calculan punitorios sobre todas las cuotas atrasadas de meses sin liquidar, incluidas las de antes de hoy. Revisá la cuenta corriente después de guardar.
            </p>
          )}
          <div className="grid gap-1.5"><Label>Garantía</Label>
            <Select value={v.guarantee_type} onValueChange={(value) => set("guarantee_type", value as Terms["guarantee_type"])}><SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="NINGUNA">Sin garantía</SelectItem><SelectItem value="GARANTE">Garante</SelectItem><SelectItem value="CAUCION">Seguro de caución</SelectItem></SelectContent></Select></div>
          {v.guarantee_type !== "NINGUNA" && <div className="grid gap-1.5 sm:col-span-2"><Label>{v.guarantee_type === "GARANTE" ? "Detalle del garante" : "Aseguradora y póliza"}</Label><Input value={v.guarantee_detail} onChange={(e) => set("guarantee_detail", e.target.value)} /></div>}
          <div className="grid gap-1.5 sm:col-span-2"><Label>Notas</Label><Textarea rows={3} value={v.notes} onChange={(e) => set("notes", e.target.value)} /></div>
        </div>
        <p className="text-xs text-muted-foreground">Un cambio de comisión aplica a las liquidaciones que se emitan desde ahora.</p>
        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)}>Cancelar</Button>
          <Button disabled={!!busy} onClick={async () => {
            const ok = await run("terms", () => updateContractTermsAction({ contract_id: contractId, ...v }));
            if (ok) setOpen(false);
          }}>{busy === "terms" ? <Loader2 className="size-4 animate-spin" /> : "Guardar"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export type ContactData = {
  id: string; full_name: string; document: string | null; phone: string | null;
  email: string | null; address: string | null; notes: string | null;
};

export function EditContactDialog({ contact, contractId }: { contact: ContactData; contractId?: string }) {
  const { busy, run } = useRunAction();
  const [open, setOpen] = useState(false);
  const blank = () => ({
    full_name: contact.full_name, document: contact.document ?? "", phone: contact.phone ?? "",
    email: contact.email ?? "", address: contact.address ?? "", notes: contact.notes ?? "",
  });
  const [v, setV] = useState(blank);

  return (
    <Dialog open={open} onOpenChange={(next) => { setOpen(next); if (next) setV(blank()); }}>
      <DialogTrigger asChild>
        <Button size="icon" variant="ghost" aria-label={`Editar ${contact.full_name}`} className="size-7"><Pencil className="size-3.5" /></Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Editar contacto</DialogTitle><DialogDescription>Los cambios se ven en todos sus contratos.</DialogDescription></DialogHeader>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="grid gap-1.5 sm:col-span-2"><Label>Nombre y apellido / razón social</Label><Input value={v.full_name} onChange={(e) => setV({ ...v, full_name: e.target.value })} /></div>
          <div className="grid gap-1.5"><Label>DNI / CUIT</Label><Input value={v.document} onChange={(e) => setV({ ...v, document: e.target.value })} /></div>
          <div className="grid gap-1.5"><Label>Teléfono</Label><Input value={v.phone} onChange={(e) => setV({ ...v, phone: e.target.value })} /></div>
          <div className="grid gap-1.5 sm:col-span-2"><Label>Email</Label><Input type="email" value={v.email} onChange={(e) => setV({ ...v, email: e.target.value })} /></div>
          <div className="grid gap-1.5 sm:col-span-2"><Label>Domicilio</Label><Input value={v.address} onChange={(e) => setV({ ...v, address: e.target.value })} /></div>
          <div className="grid gap-1.5 sm:col-span-2"><Label>Notas</Label><Textarea rows={2} value={v.notes} onChange={(e) => setV({ ...v, notes: e.target.value })} /></div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)}>Cancelar</Button>
          <Button disabled={!!busy || v.full_name.trim().length < 3} onClick={async () => {
            const ok = await run("contact", () => updateContactAction({ id: contact.id, ...v }, contractId));
            if (ok) setOpen(false);
          }}>{busy === "contact" ? <Loader2 className="size-4 animate-spin" /> : "Guardar"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
