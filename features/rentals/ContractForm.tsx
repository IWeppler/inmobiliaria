"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, PlusCircle } from "lucide-react";
import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import { Label } from "@/shared/components/ui/label";
import { Textarea } from "@/shared/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/components/ui/card";
import {
  createContactAction,
  createContractAction,
  type ContractInput,
} from "@/features/rentals/actions";
import { ADJUSTMENT_LABELS, type AdjustmentIndex } from "@/features/rentals/logic";

type Option = { id: string; label: string };

type Props = {
  properties: Option[];
  owners: Option[];
  tenants: Option[];
};

// Selector de contacto con alta inline ("+ Nuevo") para no salir del
// formulario del contrato a cargar propietario/inquilino.
function ContactPicker({
  kind,
  label,
  options,
  value,
  onChange,
}: {
  kind: "owner" | "tenant";
  label: string;
  options: Option[];
  value: string;
  onChange: (id: string, opt: Option) => void;
}) {
  const [list, setList] = useState(options);
  const [creating, setCreating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ full_name: "", document: "", phone: "", email: "" });

  const save = async () => {
    setSaving(true);
    const res = await createContactAction({ kind, ...form });
    setSaving(false);
    if (!res.success || !res.data) {
      toast.error(res.message);
      return;
    }
    const opt = { id: res.data.id, label: res.data.full_name };
    setList((prev) => [...prev, opt]);
    onChange(opt.id, opt);
    setCreating(false);
    setForm({ full_name: "", document: "", phone: "", email: "" });
    toast.success(res.message);
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <Label>{label}</Label>
        <button
          type="button"
          onClick={() => setCreating((p) => !p)}
          className="text-xs text-primary hover:underline inline-flex items-center gap-1"
        >
          <PlusCircle className="size-3" />
          {creating ? "Cancelar" : "Nuevo"}
        </button>
      </div>
      {!creating ? (
        <Select
          value={value}
          onValueChange={(id) => onChange(id, list.find((o) => o.id === id)!)}
        >
          <SelectTrigger>
            <SelectValue placeholder="Seleccionar..." />
          </SelectTrigger>
          <SelectContent>
            {list.map((o) => (
              <SelectItem key={o.id} value={o.id}>
                {o.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      ) : (
        <div className="rounded-md border border-border p-3 space-y-2 bg-secondary/30">
          <Input
            placeholder="Nombre y apellido / razón social"
            value={form.full_name}
            onChange={(e) => setForm({ ...form, full_name: e.target.value })}
          />
          <div className="grid grid-cols-2 gap-2">
            <Input
              placeholder="DNI / CUIT"
              value={form.document}
              onChange={(e) => setForm({ ...form, document: e.target.value })}
            />
            <Input
              placeholder="Teléfono"
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
            />
          </div>
          <Input
            placeholder="Email"
            type="email"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
          />
          <Button type="button" size="sm" onClick={save} disabled={saving || form.full_name.length < 3}>
            {saving ? <Loader2 className="size-3.5 animate-spin" /> : "Guardar contacto"}
          </Button>
        </div>
      )}
    </div>
  );
}

const today = new Date().toISOString().slice(0, 10);

export function ContractForm({ properties, owners, tenants }: Props) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [v, setV] = useState<ContractInput>({
    property_id: "",
    owner_id: "",
    tenant_id: "",
    start_date: today,
    end_date: "",
    rent_amount: 0,
    currency: "ARS",
    adjustment_index: "ICL",
    adjustment_months: 3,
    adjustment_pct: 0,
    commission_pct: 8,
    late_fee_pct_daily: 0.1,
    payment_due_day: 10,
    notes: "",
  });
  const set = <K extends keyof ContractInput>(k: K, val: ContractInput[K]) =>
    setV((p) => ({ ...p, [k]: val }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    const res = await createContractAction(v);
    setSaving(false);
    if (!res.success || !res.data) {
      toast.error(res.message);
      return;
    }
    toast.success(res.message);
    router.push(`/dashboard/alquileres/${res.data.id}`);
  };

  return (
    <form onSubmit={submit} className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="font-semibold">Partes</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="space-y-2">
            <Label>Propiedad</Label>
            <Select value={v.property_id} onValueChange={(id) => set("property_id", id)}>
              <SelectTrigger>
                <SelectValue placeholder="Seleccionar..." />
              </SelectTrigger>
              <SelectContent>
                {properties.map((o) => (
                  <SelectItem key={o.id} value={o.id}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <ContactPicker
            kind="owner"
            label="Propietario"
            options={owners}
            value={v.owner_id}
            onChange={(id) => set("owner_id", id)}
          />
          <ContactPicker
            kind="tenant"
            label="Inquilino"
            options={tenants}
            value={v.tenant_id}
            onChange={(id) => set("tenant_id", id)}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="font-semibold">Condiciones</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="space-y-2">
            <Label>Inicio</Label>
            <Input type="date" value={v.start_date} onChange={(e) => set("start_date", e.target.value)} required />
          </div>
          <div className="space-y-2">
            <Label>Fin</Label>
            <Input type="date" value={v.end_date} onChange={(e) => set("end_date", e.target.value)} required />
          </div>
          <div className="space-y-2">
            <Label>Canon mensual</Label>
            <Input
              type="number"
              min={1}
              step="0.01"
              value={v.rent_amount || ""}
              onChange={(e) => set("rent_amount", Number(e.target.value))}
              required
            />
          </div>
          <div className="space-y-2">
            <Label>Moneda</Label>
            <Select value={v.currency} onValueChange={(c) => set("currency", c as "ARS" | "USD")}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ARS">ARS</SelectItem>
                <SelectItem value="USD">USD</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Ajuste</Label>
            <Select
              value={v.adjustment_index}
              onValueChange={(c) => set("adjustment_index", c as AdjustmentIndex)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(ADJUSTMENT_LABELS) as AdjustmentIndex[]).map((k) => (
                  <SelectItem key={k} value={k}>
                    {ADJUSTMENT_LABELS[k]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Cada (meses)</Label>
            <Input
              type="number"
              min={1}
              max={36}
              value={v.adjustment_months}
              onChange={(e) => set("adjustment_months", Number(e.target.value))}
              disabled={v.adjustment_index === "NINGUNO"}
            />
          </div>
          <div className="space-y-2">
            <Label>% fijo por ajuste</Label>
            <Input
              type="number"
              min={0}
              step="0.01"
              value={v.adjustment_pct ?? 0}
              onChange={(e) => set("adjustment_pct", Number(e.target.value))}
              disabled={v.adjustment_index !== "FIJO"}
            />
          </div>
          <div className="space-y-2">
            <Label>Día de vencimiento</Label>
            <Input
              type="number"
              min={1}
              max={28}
              value={v.payment_due_day}
              onChange={(e) => set("payment_due_day", Number(e.target.value))}
            />
          </div>

          <div className="space-y-2">
            <Label>Comisión (% del canon)</Label>
            <Input
              type="number"
              min={0}
              max={100}
              step="0.01"
              value={v.commission_pct}
              onChange={(e) => set("commission_pct", Number(e.target.value))}
            />
          </div>
          <div className="space-y-2">
            <Label>Punitorio (% diario)</Label>
            <Input
              type="number"
              min={0}
              step="0.001"
              value={v.late_fee_pct_daily}
              onChange={(e) => set("late_fee_pct_daily", Number(e.target.value))}
            />
          </div>
          <div className="space-y-2 col-span-2">
            <Label>Notas</Label>
            <Textarea rows={2} value={v.notes ?? ""} onChange={(e) => set("notes", e.target.value)} />
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button
          type="submit"
          disabled={saving || !v.property_id || !v.owner_id || !v.tenant_id || !v.end_date || !v.rent_amount}
        >
          {saving ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}
          Crear contrato
        </Button>
      </div>
    </form>
  );
}
