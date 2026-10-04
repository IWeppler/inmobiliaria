"use client";

import { useState } from "react";
import Link from "next/link";
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
import { ADJUSTMENT_LABELS, COMMON_ADJUSTMENT_MONTHS, DEFAULT_INDEX_LAG, type AdjustmentIndex } from "@/features/rentals/logic";
import { ownersLabel, type PropertyOwner } from "@/features/rentals/propertyOwners";

const CUSTOM = "custom";

type Option = { id: string; label: string };

export type ContactDraft = { full_name: string; document: string | null; phone: string | null; email: string | null };

type Props = {
  properties: Option[];
  owners: Option[];
  tenants: Option[];
  initial?: Partial<ContractInput>;
  contactDrafts?: { owner?: ContactDraft; tenant?: ContactDraft };
  // Dueños registrados por propiedad: el contrato los toma de ahí.
  propertyOwners?: Record<string, PropertyOwner[]>;
};

const primaryOwner = (owners?: PropertyOwner[]) => owners?.find((o) => o.is_primary)?.contact_id;

// Selector de contacto con alta inline ("+ Nuevo") para no salir del
// formulario del contrato a cargar propietario/inquilino.
export function ContactPicker({
  kind,
  label,
  options,
  value,
  onChange,
  draft,
}: {
  kind: "owner" | "tenant";
  label: string;
  options: Option[];
  value: string;
  onChange: (id: string, opt: Option) => void;
  draft?: ContactDraft;
}) {
  const [list, setList] = useState(options);
  // Con un borrador (contrato leído del PDF) y sin contacto existente, el
  // alta arranca abierta y prellenada.
  const [creating, setCreating] = useState(!!draft && !value);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    full_name: draft?.full_name ?? "", document: draft?.document ?? "", phone: draft?.phone ?? "", email: draft?.email ?? "",
  });

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

export function ContractForm({ properties, owners, tenants, initial, contactDrafts, propertyOwners }: Props) {
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
    index_lag_months: DEFAULT_INDEX_LAG.ICL,
    guarantee_type: "NINGUNA",
    guarantee_detail: "",
    deposit_amount: 0,
    commission_pct: 8,
    late_fee_pct_daily: 0.1,
    late_fee_fixed: 0,
    late_fee_mode: "AUTO",
    late_fee_grace_days: 0,
    payment_due_day: 10,
    notes: "",
    ...initial,
    ...(initial?.property_id && primaryOwner(propertyOwners?.[initial.property_id])
      ? { owner_id: primaryOwner(propertyOwners?.[initial.property_id]) }
      : {}),
  });
  const registeredOwners = v.property_id ? propertyOwners?.[v.property_id] : undefined;
  const set = <K extends keyof ContractInput>(k: K, val: ContractInput[K]) =>
    setV((p) => ({ ...p, [k]: val }));
  // Personalizada si al renovar viene una frecuencia que no es de las habituales.
  const [customFrequency, setCustomFrequency] = useState(!(v.adjustment_months in COMMON_ADJUSTMENT_MONTHS));

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
            <Select
              value={v.property_id}
              onValueChange={(id) => setV((p) => ({ ...p, property_id: id, owner_id: primaryOwner(propertyOwners?.[id]) ?? "" }))}
            >
              <SelectTrigger className="w-full min-w-0 [&>span]:truncate">
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
          {registeredOwners?.length ? (
            <div className="space-y-2">
              <Label>{registeredOwners.length > 1 ? "Propietarios" : "Propietario"}</Label>
              <p className="flex min-h-9 items-center rounded-md border border-border bg-muted/40 px-3 py-1.5 text-sm">
                {ownersLabel(registeredOwners)}
              </p>
              <Link href={`/dashboard/propiedades/${v.property_id}`} target="_blank" className="text-xs text-muted-foreground underline-offset-4 hover:underline">
                Los dueños se cambian en la propiedad
              </Link>
            </div>
          ) : (
            <div className="space-y-1.5">
              <ContactPicker
                kind="owner"
                label="Propietario"
                options={owners}
                value={v.owner_id}
                onChange={(id) => set("owner_id", id)}
                draft={contactDrafts?.owner}
              />
              {v.property_id && <p className="text-xs text-muted-foreground">La propiedad no tiene dueño cargado: queda registrado como su dueño.</p>}
            </div>
          )}
          <ContactPicker
            kind="tenant"
            label="Inquilino"
            options={tenants}
            value={v.tenant_id}
            onChange={(id) => set("tenant_id", id)}
            draft={contactDrafts?.tenant}
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
              onValueChange={(c) => setV((p) => ({ ...p, adjustment_index: c as AdjustmentIndex, index_lag_months: DEFAULT_INDEX_LAG[c] ?? 0 }))}
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
            <Label>Periodicidad</Label>
            <Select
              value={customFrequency ? CUSTOM : String(v.adjustment_months)}
              onValueChange={(value) => {
                if (value === CUSTOM) { setCustomFrequency(true); return; }
                setCustomFrequency(false);
                set("adjustment_months", Number(value));
              }}
              disabled={v.adjustment_index === "NINGUNO"}
            >
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {Object.entries(COMMON_ADJUSTMENT_MONTHS).map(([months, label]) => <SelectItem key={months} value={months}>{label}</SelectItem>)}
                <SelectItem value={CUSTOM}>Personalizada</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {customFrequency && v.adjustment_index !== "NINGUNO" && (
            <div className="space-y-2">
              <Label htmlFor="adjustment-months">Ajusta cada (meses)</Label>
              <Input id="adjustment-months" type="number" min={1} max={36} step={1} value={v.adjustment_months || ""}
                onChange={(e) => set("adjustment_months", Number(e.target.value))} />
              {(v.adjustment_months < 1 || v.adjustment_months > 36) && <p className="text-xs text-danger">Entre 1 y 36 meses.</p>}
            </div>
          )}
          {v.adjustment_index === "CASA_PROPIA" && (
            <p className="col-span-2 self-end text-xs text-muted-foreground">
              Casa Propia no tiene fuente automática: el coeficiente de cada mes se carga en Ajustes, tal como lo publica el Ministerio de Desarrollo Territorial y Hábitat. El ajuste se aplica cuando el coeficiente de ese mes está cargado.
            </p>
          )}
          {(v.adjustment_index === "ICL" || v.adjustment_index === "IPC") && (
            <div className="space-y-2">
              <Label>Rezago del índice</Label>
              <Select value={String(v.index_lag_months ?? DEFAULT_INDEX_LAG[v.adjustment_index])} onValueChange={(value) => set("index_lag_months", Number(value))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {[0, 1, 2, 3].map((n) => <SelectItem key={n} value={String(n)}>{n === 0 ? "Sin rezago" : `${n} ${n === 1 ? "mes" : "meses"}`}</SelectItem>)}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                {v.adjustment_index === "IPC" ? "El IPC se publica a mediados del mes siguiente: con 2 meses siempre está disponible al ajustar." : "El ICL se publica a diario: normalmente sin rezago."}
              </p>
            </div>
          )}
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
          <div className="space-y-2"><Label>Punitorio fijo</Label><Input type="number" min={0} step="0.01" value={v.late_fee_fixed} onChange={(e) => set("late_fee_fixed", Number(e.target.value))} /></div>
          <div className="space-y-2">
            <Label>Cálculo del punitorio</Label>
            <Select value={v.late_fee_mode} onValueChange={(value) => set("late_fee_mode", value as ContractInput["late_fee_mode"])}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="AUTO">Automático (se suma solo)</SelectItem>
                <SelectItem value="MANUAL">Manual (lo carga el agente)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="grace-days">Días de gracia</Label>
            <Input id="grace-days" type="number" min={0} max={30} step={1} value={v.late_fee_grace_days} onChange={(e) => set("late_fee_grace_days", Number(e.target.value))} />
          </div>
          <div className="space-y-2"><Label>Depósito ({v.currency})</Label><Input type="number" min={0} step="0.01" value={v.deposit_amount} onChange={(e) => set("deposit_amount", Number(e.target.value))} /></div>
          <div className="space-y-2"><Label>Garantía</Label><Select value={v.guarantee_type} onValueChange={(value) => set("guarantee_type", value as ContractInput["guarantee_type"])}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="NINGUNA">Sin garantía</SelectItem><SelectItem value="GARANTE">Garante</SelectItem><SelectItem value="CAUCION">Seguro de caución</SelectItem></SelectContent></Select></div>
          {v.guarantee_type !== "NINGUNA" && <div className="space-y-2"><Label>{v.guarantee_type === "GARANTE" ? "Nombre del garante" : "Aseguradora y póliza"}</Label><Input value={v.guarantee_detail ?? ""} onChange={(e) => set("guarantee_detail", e.target.value)} /></div>}
          <div className="space-y-2 col-span-2">
            <Label>Notas</Label>
            <Textarea rows={2} value={v.notes ?? ""} onChange={(e) => set("notes", e.target.value)} />
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button
          type="submit"
          disabled={saving || !v.property_id || !v.owner_id || !v.tenant_id || !v.end_date || !v.rent_amount
            || !Number.isInteger(v.adjustment_months) || v.adjustment_months < 1 || v.adjustment_months > 36}
        >
          {saving ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}
          Crear contrato
        </Button>
      </div>
    </form>
  );
}
