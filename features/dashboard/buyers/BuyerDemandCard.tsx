"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { CheckCheck, Pencil } from "lucide-react";
import { createClientBrowser } from "@/lib/supabase-browser";
import type { LeadWithDetails } from "@/app/types";
import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import { Label } from "@/shared/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/components/ui/select";
import { daysAgo } from "@/features/dashboard/buyers/format";

type PropertyType = { id: number; name: string | null };

const NONE = "none";
const URGENCY: Record<string, string> = { alta: "Alta", media: "Media", baja: "Baja" };

const num = (v: string) => (v.trim() === "" ? null : Number(v.replace(/\./g, "").replace(",", ".")));
const money = (n: number | null, cur: string | null) =>
  n === null ? null : `${cur ?? "USD"} ${new Intl.NumberFormat("es-AR", { maximumFractionDigits: 0 }).format(n)}`;

// "Qué busca": la demanda del comprador, guardada en el propio lead. Es lo
// que usa Buyer Intelligence para cruzarlo con propiedades nuevas.
export function BuyerDemandCard({
  lead,
  propertyTypes,
}: {
  lead: LeadWithDetails;
  propertyTypes: PropertyType[];
}) {
  const supabase = createClientBrowser();
  const router = useRouter();
  const hasSearch = !!lead.search_operation;
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);

  const [operation, setOperation] = useState(lead.search_operation ?? NONE);
  const [typeId, setTypeId] = useState(String(lead.search_type_ids?.[0] ?? NONE));
  const [locations, setLocations] = useState((lead.search_locations ?? []).join(", "));
  const [budgetMin, setBudgetMin] = useState(lead.search_budget_min?.toString() ?? "");
  const [budgetMax, setBudgetMax] = useState(lead.search_budget_max?.toString() ?? "");
  const [currency, setCurrency] = useState(lead.search_currency ?? "USD");
  const [bedrooms, setBedrooms] = useState(lead.search_bedrooms_min?.toString() ?? "");
  const [bathrooms, setBathrooms] = useState(lead.search_bathrooms_min?.toString() ?? "");
  const [financing, setFinancing] = useState(
    lead.search_financing === null ? NONE : lead.search_financing ? "si" : "no",
  );
  const [urgency, setUrgency] = useState(lead.search_urgency ?? NONE);

  const save = async () => {
    if (operation === NONE) {
      toast.error("Elegí si busca comprar o alquilar.");
      return;
    }
    setSaving(true);
    const { error } = await supabase
      .from("leads")
      .update({
        search_operation: operation,
        search_type_ids: typeId === NONE ? [] : [Number(typeId)],
        search_locations: locations.split(",").map((s) => s.trim()).filter(Boolean),
        search_budget_min: num(budgetMin),
        search_budget_max: num(budgetMax),
        search_currency: currency,
        search_bedrooms_min: num(bedrooms),
        search_bathrooms_min: num(bathrooms),
        search_financing: financing === NONE ? null : financing === "si",
        search_urgency: urgency === NONE ? null : urgency,
        search_confirmed_at: new Date().toISOString(),
      })
      .eq("id", lead.id);
    setSaving(false);
    if (error) {
      toast.error("No se pudo guardar la búsqueda");
      return;
    }
    toast.success("Búsqueda guardada");
    setEditing(false);
    router.refresh();
  };

  // "Sigue buscando": reconfirma sin tocar los criterios.
  const confirm = async () => {
    const { error } = await supabase
      .from("leads")
      .update({ search_confirmed_at: new Date().toISOString() })
      .eq("id", lead.id);
    if (error) toast.error("No se pudo confirmar");
    else {
      toast.success("Búsqueda confirmada");
      router.refresh();
    }
  };

  const typeName = propertyTypes.find((t) => t.id === lead.search_type_ids?.[0])?.name;
  const budget =
    lead.search_budget_min || lead.search_budget_max
      ? [money(lead.search_budget_min, lead.search_currency), money(lead.search_budget_max, lead.search_currency)]
          .filter(Boolean)
          .join(" – ")
      : null;
  const confirmedDays = daysAgo(lead.search_confirmed_at);

  const summary: { label: string; value: React.ReactNode }[] = [
    { label: "Operación", value: lead.search_operation === "venta" ? "Comprar" : "Alquilar" },
    { label: "Tipo", value: typeName },
    { label: "Zona", value: lead.search_locations?.join(", ") },
    { label: "Presupuesto", value: budget },
    { label: "Dormitorios", value: lead.search_bedrooms_min ? `${lead.search_bedrooms_min}+` : null },
    { label: "Baños", value: lead.search_bathrooms_min ? `${lead.search_bathrooms_min}+` : null },
    {
      label: "Financiación",
      value: lead.search_financing === null ? null : lead.search_financing ? "Sí" : "No",
    },
    { label: "Urgencia", value: lead.search_urgency ? URGENCY[lead.search_urgency] : null },
  ].filter((r) => r.value);

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between gap-2">
        <CardTitle>Qué busca</CardTitle>
        <Button variant="outline" size="sm" onClick={() => setEditing((e) => !e)}>
          {editing ? "Cerrar" : hasSearch ? <><Pencil /> Editar</> : "Cargar"}
        </Button>
      </CardHeader>
      <CardContent className="space-y-3">
        {!editing && !hasSearch && (
          <p className="text-sm text-muted-foreground">
            Sin búsqueda cargada. Cargala para que aparezca cuando entre una propiedad que le encaje.
          </p>
        )}

        {!editing && hasSearch && (
          <>
            <dl className="space-y-1.5">
              {summary.map((r) => (
                <div key={r.label} className="flex items-baseline justify-between gap-4 text-sm">
                  <dt className="text-muted-foreground">{r.label}</dt>
                  <dd className="text-right font-medium">{r.value}</dd>
                </div>
              ))}
            </dl>
            <div className="flex items-center justify-between gap-2 border-t border-border-subtle pt-3">
              <span className="text-xs text-muted-foreground">
                {confirmedDays === null
                  ? "Nunca confirmada"
                  : confirmedDays === 0
                    ? "Confirmada hoy"
                    : `Confirmada hace ${confirmedDays} d`}
              </span>
              <Button variant="ghost" size="sm" onClick={confirm}>
                <CheckCheck /> Sigue buscando
              </Button>
            </div>
          </>
        )}

        {editing && (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Operación *</Label>
                <Select value={operation} onValueChange={setOperation}>
                  <SelectTrigger><SelectValue placeholder="Elegir" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="venta">Comprar</SelectItem>
                    <SelectItem value="alquiler">Alquilar</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Tipo</Label>
                <Select value={typeId} onValueChange={setTypeId}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NONE}>Cualquiera</SelectItem>
                    {propertyTypes.map((t) => (
                      <SelectItem key={t.id} value={String(t.id)}>{t.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Zona (ciudades o barrios, separados por coma)</Label>
              <Input value={locations} onChange={(e) => setLocations(e.target.value)} placeholder="Córdoba, Nueva Córdoba" />
            </div>
            <div className="grid grid-cols-[1fr_1fr_88px] gap-3">
              <div className="space-y-1.5">
                <Label>Desde</Label>
                <Input inputMode="numeric" value={budgetMin} onChange={(e) => setBudgetMin(e.target.value)} placeholder="90000" />
              </div>
              <div className="space-y-1.5">
                <Label>Hasta</Label>
                <Input inputMode="numeric" value={budgetMax} onChange={(e) => setBudgetMax(e.target.value)} placeholder="120000" />
              </div>
              <div className="space-y-1.5">
                <Label>Moneda</Label>
                <Select value={currency} onValueChange={setCurrency}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="USD">USD</SelectItem>
                    <SelectItem value="ARS">ARS</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Dormitorios (mín.)</Label>
                <Input inputMode="numeric" value={bedrooms} onChange={(e) => setBedrooms(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>Baños (mín.)</Label>
                <Input inputMode="numeric" value={bathrooms} onChange={(e) => setBathrooms(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>Financiación</Label>
                <Select value={financing} onValueChange={setFinancing}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NONE}>Sin dato</SelectItem>
                    <SelectItem value="si">Sí</SelectItem>
                    <SelectItem value="no">No</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Urgencia</Label>
                <Select value={urgency} onValueChange={setUrgency}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NONE}>Sin dato</SelectItem>
                    <SelectItem value="alta">Alta</SelectItem>
                    <SelectItem value="media">Media</SelectItem>
                    <SelectItem value="baja">Baja</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="flex justify-end">
              <Button onClick={save} disabled={saving}>{saving ? "Guardando…" : "Guardar búsqueda"}</Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
