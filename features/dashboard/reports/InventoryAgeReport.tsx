"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { SlidersHorizontal, X } from "lucide-react";
import { ReportSection } from "@/features/dashboard/reports/ReportSection";
import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHeader,
  TableRow,
} from "@/shared/components/ui/table";
import { ExportCsvButton } from "@/features/dashboard/reports/ExportCsvButton";
import {
  SortHead,
  useSortable,
} from "@/features/dashboard/reports/useSortable";
import type { InventoryItem } from "@/features/dashboard/reports/getReportInsights";

const ALL = "__all__";
const BUCKETS = [
  { label: "0–30 días", min: 0, max: 30, bar: "bg-primary" },
  { label: "31–60 días", min: 31, max: 60, bar: "bg-primary" },
  { label: "61–90 días", min: 61, max: 90, bar: "bg-primary" },
  { label: "91–180 días", min: 91, max: 180, bar: "bg-warning" },
  { label: "+180 días", min: 181, max: Infinity, bar: "bg-danger" },
] as const;
const OPERATION_LABELS: Record<string, string> = {
  venta: "Venta",
  alquiler: "Alquiler",
};

type AgedItem = InventoryItem & { days: number };
type SortKey = "title" | "zone" | "days" | "price";

function zoneOf(item: InventoryItem) {
  return [item.neighborhood, item.city].filter(Boolean).join(" · ");
}

const ACCESSORS = {
  title: (item: AgedItem) => item.title,
  zone: (item: AgedItem) => zoneOf(item) || null,
  days: (item: AgedItem) => item.days,
  price: (item: AgedItem) => item.price,
} satisfies Record<SortKey, (item: AgedItem) => number | string | null>;

function ageDays(createdAt: string, asOf: string) {
  return Math.max(
    0,
    Math.floor(
      (new Date(asOf).getTime() - new Date(createdAt).getTime()) / 86400000,
    ),
  );
}

function median(values: number[]) {
  if (!values.length) return null;
  const ordered = [...values].sort((a, b) => a - b);
  const middle = Math.floor(ordered.length / 2);
  return ordered.length % 2
    ? ordered[middle]
    : (ordered[middle - 1] + ordered[middle]) / 2;
}

export function InventoryAgeReport({
  items,
  asOf,
}: {
  items: InventoryItem[];
  asOf: string;
}) {
  const [showFilters, setShowFilters] = useState(false);
  const [operation, setOperation] = useState(ALL);
  const [propertyType, setPropertyType] = useState(ALL);
  const [zone, setZone] = useState("");
  const [currency, setCurrency] = useState(ALL);
  const [minPrice, setMinPrice] = useState("");
  const [maxPrice, setMaxPrice] = useState("");
  const types = useMemo(
    () =>
      [
        ...new Set(
          items
            .map((item) => item.propertyType)
            .filter((type): type is string => !!type),
        ),
      ].sort((a, b) => a.localeCompare(b, "es")),
    [items],
  );
  const currencies = useMemo(
    () =>
      [
        ...new Set(
          items
            .map((item) => item.currency)
            .filter((value): value is string => !!value),
        ),
      ].sort(),
    [items],
  );

  const filtered = useMemo(
    () =>
      items.filter((item) => {
        if (
          operation !== ALL &&
          item.operation_type?.toLowerCase() !== operation
        )
          return false;
        if (propertyType !== ALL && item.propertyType !== propertyType)
          return false;
        const location = [item.neighborhood, item.city, item.province]
          .filter(Boolean)
          .join(" ")
          .toLocaleLowerCase("es");
        if (
          zone.trim() &&
          !location.includes(zone.trim().toLocaleLowerCase("es"))
        )
          return false;
        if (currency !== ALL && item.currency !== currency) return false;
        if (
          minPrice !== "" &&
          (item.price === null || item.price < Number(minPrice))
        )
          return false;
        if (
          maxPrice !== "" &&
          (item.price === null || item.price > Number(maxPrice))
        )
          return false;
        return true;
      }),
    [items, operation, propertyType, zone, currency, minPrice, maxPrice],
  );

  const withAge = useMemo<AgedItem[]>(
    () =>
      filtered.map((item) => ({
        ...item,
        days: ageDays(item.created_at, asOf),
      })),
    [filtered, asOf],
  );
  const counts = BUCKETS.map(
    (bucket) =>
      withAge.filter(
        (item) => item.days >= bucket.min && item.days <= bucket.max,
      ).length,
  );
  const maxCount = Math.max(1, ...counts);
  const medianDays = median(withAge.map((item) => item.days));
  const stagnantRows = useMemo(
    () => withAge.filter((item) => item.days > 90),
    [withAge],
  );
  const {
    sorted: stagnant,
    sort,
    toggle,
  } = useSortable<AgedItem, SortKey>(stagnantRows, ACCESSORS, {
    key: "days",
    dir: "desc",
  });

  const activeFilters = [
    operation !== ALL && {
      key: "operation",
      label: OPERATION_LABELS[operation] ?? operation,
      clear: () => setOperation(ALL),
    },
    propertyType !== ALL && {
      key: "type",
      label: propertyType,
      clear: () => setPropertyType(ALL),
    },
    zone.trim() && {
      key: "zone",
      label: `Zona: ${zone.trim()}`,
      clear: () => setZone(""),
    },
    currency !== ALL && {
      key: "price",
      label: `${currency}${minPrice ? ` desde ${Number(minPrice).toLocaleString("es-AR")}` : ""}${maxPrice ? ` hasta ${Number(maxPrice).toLocaleString("es-AR")}` : ""}`,
      clear: () => {
        setCurrency(ALL);
        setMinPrice("");
        setMaxPrice("");
      },
    },
  ].filter((filter) => !!filter);
  const clearAll = () => activeFilters.forEach((filter) => filter.clear());

  return (
    <ReportSection
      title="Antigüedad de la cartera disponible"
      subtitle="Días desde el alta de propiedades en venta o alquiler. Aún no se registra la fecha exacta de publicación."
    >
      <div className="space-y-5">
        <div className="space-y-3">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setShowFilters((open) => !open)}
            aria-expanded={showFilters}
            aria-controls="inventory-filters"
          >
            <SlidersHorizontal className="size-4" aria-hidden />
            Filtros
            {activeFilters.length > 0 ? ` (${activeFilters.length})` : ""}
          </Button>
          {showFilters && (
            <div id="inventory-filters" className="space-y-3">
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                <Select value={operation} onValueChange={setOperation}>
                  <SelectTrigger className="w-full" aria-label="Operación">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={ALL}>Venta y alquiler</SelectItem>
                    <SelectItem value="venta">Venta</SelectItem>
                    <SelectItem value="alquiler">Alquiler</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={propertyType} onValueChange={setPropertyType}>
                  <SelectTrigger
                    className="w-full"
                    aria-label="Tipo de propiedad"
                  >
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={ALL}>Todos los tipos</SelectItem>
                    {types.map((type) => (
                      <SelectItem key={type} value={type}>
                        {type}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Input
                  className="sm:col-span-2 lg:col-span-2"
                  value={zone}
                  onChange={(event) => setZone(event.target.value)}
                  placeholder="Zona, barrio o ciudad"
                  aria-label="Filtrar por zona"
                />
              </div>
              <div className="grid gap-2 sm:grid-cols-3 lg:max-w-xl">
                <Select
                  value={currency}
                  onValueChange={(value) => {
                    setCurrency(value);
                    setMinPrice("");
                    setMaxPrice("");
                  }}
                >
                  <SelectTrigger
                    className="w-full"
                    aria-label="Moneda del precio"
                  >
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={ALL}>Precio: moneda</SelectItem>
                    {currencies.map((value) => (
                      <SelectItem key={value} value={value}>
                        {value}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Input
                  type="number"
                  min="0"
                  value={minPrice}
                  onChange={(event) => setMinPrice(event.target.value)}
                  placeholder="Precio mín."
                  aria-label="Precio mínimo"
                  disabled={currency === ALL}
                />
                <Input
                  type="number"
                  min="0"
                  value={maxPrice}
                  onChange={(event) => setMaxPrice(event.target.value)}
                  placeholder="Precio máx."
                  aria-label="Precio máximo"
                  disabled={currency === ALL}
                />
              </div>
              {currency === ALL && (
                <p className="text-[13px] text-muted-foreground">
                  Elegí una moneda para filtrar por rango de precio.
                </p>
              )}
            </div>
          )}
          {activeFilters.length > 0 && (
            <div
              className="flex flex-wrap items-center gap-1.5"
              aria-label="Filtros activos"
            >
              {activeFilters.map((filter) => (
                <button
                  key={filter.key}
                  type="button"
                  onClick={filter.clear}
                  className="inline-flex items-center gap-1 rounded-full border border-border bg-muted px-2.5 py-1 text-xs font-medium outline-none transition-colors hover:bg-secondary focus-visible:ring-2 focus-visible:ring-ring"
                  aria-label={`Quitar filtro ${filter.label}`}
                >
                  {filter.label}
                  <X className="size-3" aria-hidden />
                </button>
              ))}
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={clearAll}
              >
                Limpiar todo
              </Button>
            </div>
          )}
        </div>

        <div className="grid gap-4 md:grid-cols-[220px_1fr]">
          <div className="flex flex-col justify-center rounded-md bg-muted/60 px-4 py-4">
            <p className="text-[13px] text-muted-foreground">
              Mediana desde el alta
            </p>
            <p className="mt-1 text-3xl font-semibold tabular-nums tracking-tight">
              {medianDays === null
                ? "—"
                : `${medianDays.toLocaleString("es-AR")} días`}
            </p>
            <p className="mt-1 text-[13px] text-muted-foreground">
              {filtered.length} propiedades con estos filtros
            </p>
          </div>
          <div className="flex flex-col justify-center gap-2.5">
            {BUCKETS.map((bucket, index) => (
              <div
                key={bucket.label}
                className="grid grid-cols-[96px_1fr_32px] items-center gap-3 text-[13px]"
              >
                <span className="text-fg-secondary">{bucket.label}</span>
                <div
                  aria-hidden
                  className="h-2 overflow-hidden rounded-full bg-muted"
                >
                  <div
                    className={`h-full rounded-full ${bucket.bar}`}
                    style={{
                      width: `${counts[index] ? Math.max(4, (counts[index] / maxCount) * 100) : 0}%`,
                    }}
                  />
                </div>
                <span className="text-right font-medium tabular-nums">
                  {counts[index]}
                </span>
              </div>
            ))}
          </div>
        </div>

        <div>
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-baseline gap-2">
              <h4 className="text-sm font-semibold">
                Más de 90 días desde el alta
              </h4>
              <span className="text-xs text-muted-foreground">
                {stagnant.length} propiedades
              </span>
            </div>
            <ExportCsvButton
              filename="cartera-estancada.csv"
              header={[
                "Propiedad",
                "Zona",
                "Días desde el alta",
                "Moneda",
                "Precio",
              ]}
              rows={stagnant.map((item) => [
                item.title,
                zoneOf(item),
                item.days,
                item.currency,
                item.price,
              ])}
            />
          </div>
          {stagnant.length ? (
            <div className="max-h-[360px] overflow-auto rounded-md border border-border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <SortHead
                      label="Propiedad"
                      sortKey="title"
                      sort={sort}
                      onToggle={toggle}
                    />
                    <SortHead
                      label="Zona"
                      sortKey="zone"
                      sort={sort}
                      onToggle={toggle}
                    />
                    <SortHead
                      label="Días"
                      sortKey="days"
                      sort={sort}
                      onToggle={toggle}
                      align="right"
                    />
                    <SortHead
                      label="Precio"
                      sortKey="price"
                      sort={sort}
                      onToggle={toggle}
                      align="right"
                    />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {stagnant.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell className="font-medium">
                        <Link
                          href={`/dashboard/propiedades/${item.id}`}
                          className="underline decoration-border underline-offset-4 hover:decoration-current"
                        >
                          {item.title}
                        </Link>
                      </TableCell>
                      <TableCell className="text-fg-secondary">
                        {zoneOf(item) || "—"}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {item.days}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {item.price === null
                          ? "—"
                          : `${item.currency ?? ""} ${item.price.toLocaleString("es-AR")}`}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <p className="rounded-md border border-dashed border-border p-4 text-sm text-muted-foreground">
              {activeFilters.length
                ? "No hay propiedades estancadas con estos filtros."
                : "No hay propiedades con más de 90 días desde el alta."}
            </p>
          )}
        </div>
      </div>
    </ReportSection>
  );
}
