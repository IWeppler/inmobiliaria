"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Input } from "@/shared/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/shared/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/shared/components/ui/table";
import type { InventoryItem } from "@/features/dashboard/reports/getReportInsights";

const ALL = "__all__";
const BUCKETS = [
  { label: "0–30 días", min: 0, max: 30 },
  { label: "31–60 días", min: 31, max: 60 },
  { label: "61–90 días", min: 61, max: 90 },
  { label: "91–180 días", min: 91, max: 180 },
  { label: "+180 días", min: 181, max: Infinity },
] as const;

function ageDays(createdAt: string, asOf: string) {
  return Math.max(0, Math.floor((new Date(asOf).getTime() - new Date(createdAt).getTime()) / 86400000));
}

function median(values: number[]) {
  if (!values.length) return null;
  const ordered = [...values].sort((a, b) => a - b);
  const middle = Math.floor(ordered.length / 2);
  return ordered.length % 2 ? ordered[middle] : (ordered[middle - 1] + ordered[middle]) / 2;
}

export function InventoryAgeReport({ items, asOf }: { items: InventoryItem[]; asOf: string }) {
  const [operation, setOperation] = useState(ALL);
  const [propertyType, setPropertyType] = useState(ALL);
  const [zone, setZone] = useState("");
  const [currency, setCurrency] = useState(ALL);
  const [minPrice, setMinPrice] = useState("");
  const [maxPrice, setMaxPrice] = useState("");
  const types = useMemo(() => [...new Set(items.map((item) => item.propertyType).filter((type): type is string => !!type))].sort((a, b) => a.localeCompare(b, "es")), [items]);
  const currencies = useMemo(() => [...new Set(items.map((item) => item.currency).filter((value): value is string => !!value))].sort(), [items]);

  const filtered = useMemo(() => items.filter((item) => {
    if (operation !== ALL && item.operation_type?.toLowerCase() !== operation) return false;
    if (propertyType !== ALL && item.propertyType !== propertyType) return false;
    const location = [item.neighborhood, item.city, item.province].filter(Boolean).join(" ").toLocaleLowerCase("es");
    if (zone.trim() && !location.includes(zone.trim().toLocaleLowerCase("es"))) return false;
    if (currency !== ALL && item.currency !== currency) return false;
    if (minPrice !== "" && (item.price === null || item.price < Number(minPrice))) return false;
    if (maxPrice !== "" && (item.price === null || item.price > Number(maxPrice))) return false;
    return true;
  }), [items, operation, propertyType, zone, currency, minPrice, maxPrice]);

  const withAge = useMemo(() => filtered.map((item) => ({ ...item, days: ageDays(item.created_at, asOf) })), [filtered, asOf]);
  const counts = BUCKETS.map((bucket) => withAge.filter((item) => item.days >= bucket.min && item.days <= bucket.max).length);
  const maxCount = Math.max(1, ...counts);
  const medianDays = median(withAge.map((item) => item.days));
  const stagnant = withAge.filter((item) => item.days > 90).sort((a, b) => b.days - a.days);

  return (
    <section className="overflow-hidden rounded-lg border border-border bg-card">
      <div className="border-b border-border px-4 py-3">
        <h3 className="text-base font-semibold tracking-tight">Antigüedad de la cartera disponible</h3>
        <p className="mt-1 text-xs text-muted-foreground">Días desde el alta de propiedades en venta o alquiler. Aún no se registra la fecha exacta de publicación.</p>
      </div>
      <div className="space-y-5 p-4">
        <div className="flex flex-wrap gap-2">
          <Select value={operation} onValueChange={setOperation}>
            <SelectTrigger className="w-[155px]" aria-label="Operación"><SelectValue /></SelectTrigger>
            <SelectContent><SelectItem value={ALL}>Venta y alquiler</SelectItem><SelectItem value="venta">Venta</SelectItem><SelectItem value="alquiler">Alquiler</SelectItem></SelectContent>
          </Select>
          <Select value={propertyType} onValueChange={setPropertyType}>
            <SelectTrigger className="w-[170px]" aria-label="Tipo de propiedad"><SelectValue /></SelectTrigger>
            <SelectContent><SelectItem value={ALL}>Todos los tipos</SelectItem>{types.map((type) => <SelectItem key={type} value={type}>{type}</SelectItem>)}</SelectContent>
          </Select>
          <Input className="w-[190px]" value={zone} onChange={(event) => setZone(event.target.value)} placeholder="Zona, barrio o ciudad" aria-label="Filtrar por zona" />
          <Select value={currency} onValueChange={(value) => { setCurrency(value); setMinPrice(""); setMaxPrice(""); }}>
            <SelectTrigger className="w-[145px]" aria-label="Moneda del precio"><SelectValue /></SelectTrigger>
            <SelectContent><SelectItem value={ALL}>Precio: moneda</SelectItem>{currencies.map((value) => <SelectItem key={value} value={value}>{value}</SelectItem>)}</SelectContent>
          </Select>
          <Input className="w-[125px]" type="number" min="0" value={minPrice} onChange={(event) => setMinPrice(event.target.value)} placeholder="Precio mín." aria-label="Precio mínimo" disabled={currency === ALL} />
          <Input className="w-[125px]" type="number" min="0" value={maxPrice} onChange={(event) => setMaxPrice(event.target.value)} placeholder="Precio máx." aria-label="Precio máximo" disabled={currency === ALL} />
        </div>

        <div className="grid gap-4 sm:grid-cols-[180px_1fr] sm:items-center">
          <div><p className="text-xs text-muted-foreground">Mediana desde el alta</p><p className="text-3xl font-semibold tabular-nums">{medianDays === null ? "—" : `${medianDays.toLocaleString("es-AR")} días`}</p><p className="text-xs text-muted-foreground">{filtered.length} propiedades con estos filtros</p></div>
          <div className="space-y-2">
            {BUCKETS.map((bucket, index) => (
              <div key={bucket.label} className="grid grid-cols-[90px_1fr_30px] items-center gap-3 text-xs">
                <span className="text-fg-secondary">{bucket.label}</span>
                <div className="h-4 overflow-hidden rounded-sm bg-muted"><div className="h-full rounded-sm bg-primary" style={{ width: `${counts[index] ? Math.max(4, counts[index] / maxCount * 100) : 0}%` }} /></div>
                <span className="text-right tabular-nums">{counts[index]}</span>
              </div>
            ))}
          </div>
        </div>

        <div>
          <div className="mb-2 flex items-baseline justify-between gap-2"><h4 className="text-sm font-semibold">Más de 90 días desde el alta</h4><span className="text-xs text-muted-foreground">{stagnant.length} propiedades</span></div>
          {stagnant.length ? (
            <div className="max-h-[360px] overflow-auto rounded-md border border-border">
              <Table><TableHeader><TableRow><TableHead>Propiedad</TableHead><TableHead>Zona</TableHead><TableHead className="text-right">Días</TableHead><TableHead className="text-right">Precio</TableHead></TableRow></TableHeader>
                <TableBody>{stagnant.map((item) => <TableRow key={item.id}>
                  <TableCell className="font-medium"><Link href={`/dashboard/propiedades/${item.id}`} className="hover:underline">{item.title}</Link></TableCell>
                  <TableCell className="text-fg-secondary">{[item.neighborhood, item.city].filter(Boolean).join(" · ") || "—"}</TableCell>
                  <TableCell className="text-right tabular-nums">{item.days}</TableCell>
                  <TableCell className="text-right tabular-nums">{item.price === null ? "—" : `${item.currency ?? ""} ${item.price.toLocaleString("es-AR")}`}</TableCell>
                </TableRow>)}</TableBody>
              </Table>
            </div>
          ) : <p className="rounded-md border border-dashed border-border p-4 text-sm text-muted-foreground">No hay propiedades estancadas con estos filtros.</p>}
        </div>
      </div>
    </section>
  );
}
