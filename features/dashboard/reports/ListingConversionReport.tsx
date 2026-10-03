"use client";

import { useState } from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import {
  Table,
  TableBody,
  TableCell,
  TableHeader,
  TableRow,
} from "@/shared/components/ui/table";
import { niceScale } from "@/features/dashboard/reports/chartScale";
import {
  SortHead,
  useSortable,
} from "@/features/dashboard/reports/useSortable";
import {
  LISTING_STATUS_LABEL,
  viewsPerInquiry,
  type ListingConversion,
  type ListingPoint,
  type ListingStatus,
} from "@/features/dashboard/reports/listingConversion";

// Identidad de cada estado por color Y forma (relleno contra anillo), para
// que no dependa solo del color. Advertencia: --warning en claro y
// --warning-vivid en oscuro (validados contra --primary: ΔE ≥ 18 en ambos).
const MARK: Record<ListingStatus, string> = {
  no_convence: "bg-warning dark:bg-[var(--warning-vivid)]",
  en_linea: "bg-primary",
  poca_exposicion: "border-2 border-primary bg-card",
  reciente: "border-2 border-border-strong bg-card",
};
const LEGEND_ORDER: ListingStatus[] = [
  "no_convence",
  "poca_exposicion",
  "en_linea",
  "reciente",
];

const fmt = (n: number) => n.toLocaleString("es-AR");

function Mark({
  status,
  className,
}: {
  status: ListingStatus;
  className?: string;
}) {
  return (
    <span
      aria-hidden
      className={cn(
        "inline-block size-2.5 shrink-0 rounded-full",
        MARK[status],
        className,
      )}
    />
  );
}

function ratioText(point: ListingPoint) {
  const every = viewsPerInquiry(point);
  return every === null
    ? "sin consultas"
    : `1 consulta cada ${fmt(every)} vistas`;
}

function Scatter({ data }: { data: ListingConversion }) {
  const [active, setActive] = useState<string | null>(null);
  const x = niceScale(Math.max(...data.points.map((p) => p.views)));
  const y = niceScale(Math.max(...data.points.map((p) => p.inquiries)));
  const activePoint = data.points.find((p) => p.id === active) ?? null;
  // Línea del promedio de la cartera: consultas = per100 / 100 × vistas.
  const avgEndY =
    data.per100 === null ? null : ((data.per100 / 100) * x.top) / y.top;

  const position = (point: ListingPoint) => ({
    left: (point.views / x.top) * 100,
    bottom: (point.inquiries / y.top) * 100,
  });

  return (
    <div className="grid grid-cols-[1.75rem_minmax(0,1fr)] gap-x-2">
      <div className="relative h-72" aria-hidden>
        {y.ticks.map((tick) => (
          <span
            key={tick}
            className="absolute right-0 translate-y-1/2 text-xs tabular-nums text-muted-foreground"
            style={{ bottom: `${(tick / y.top) * 100}%` }}
          >
            {fmt(tick)}
          </span>
        ))}
      </div>

      <div className="relative h-72" onPointerLeave={() => setActive(null)}>
        {y.ticks.map((tick) => (
          <div
            key={tick}
            aria-hidden
            className={cn(
              "absolute inset-x-0 h-px",
              tick === 0 ? "bg-border-strong" : "bg-border",
            )}
            style={{ bottom: `${(tick / y.top) * 100}%` }}
          />
        ))}
        <div
          aria-hidden
          className="absolute inset-y-0 left-0 w-px bg-border-strong"
        />

        {avgEndY !== null && (
          <svg
            aria-hidden
            className="absolute inset-0 size-full overflow-hidden"
            viewBox="0 0 100 100"
            preserveAspectRatio="none"
          >
            <line
              x1="0"
              y1="100"
              x2="100"
              y2={100 - avgEndY * 100}
              stroke="var(--muted-foreground)"
              strokeOpacity="0.55"
              strokeWidth="1"
              strokeDasharray="4 4"
              vectorEffect="non-scaling-stroke"
            />
          </svg>
        )}

        <ul>
          {data.points.map((point) => {
            const { left, bottom } = position(point);
            return (
              <li key={point.id}>
                <Link
                  href={`/dashboard/propiedades/${point.id}`}
                  className="absolute flex size-6 -translate-x-1/2 translate-y-1/2 items-center justify-center rounded-full outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  style={{ left: `${left}%`, bottom: `${bottom}%` }}
                  onPointerEnter={() => setActive(point.id)}
                  onFocus={() => setActive(point.id)}
                  onBlur={() => setActive(null)}
                  aria-label={`${point.title}: ${fmt(point.views)} vistas, ${point.inquiries} consultas. ${LISTING_STATUS_LABEL[point.status]}.`}
                >
                  <Mark
                    status={point.status}
                    className={cn(
                      "size-3 shadow-[0_0_0_2px_var(--card)] transition-transform",
                      active === point.id && "scale-150",
                    )}
                  />
                </Link>
              </li>
            );
          })}
        </ul>

        {activePoint && (
          <div
            role="status"
            className="pointer-events-none absolute z-10 w-max max-w-64 rounded-md border border-border bg-card px-3 py-2 text-xs shadow-md"
            style={(() => {
              const { left, bottom } = position(activePoint);
              return {
                left: `${left}%`,
                bottom: `calc(${bottom}% + 16px)`,
                transform:
                  left < 20
                    ? "translateX(-8px)"
                    : left > 75
                      ? "translateX(calc(-100% + 8px))"
                      : "translateX(-50%)",
              };
            })()}
          >
            <p className="truncate text-sm font-medium">{activePoint.title}</p>
            <p className="mt-0.5">
              <span className="font-semibold tabular-nums">
                {fmt(activePoint.views)}
              </span>{" "}
              <span className="text-muted-foreground">vistas</span>
              <span className="mx-1.5 text-muted-foreground">·</span>
              <span className="font-semibold tabular-nums">
                {activePoint.inquiries}
              </span>{" "}
              <span className="text-muted-foreground">consultas</span>
            </p>
            <p className="mt-1 flex items-center gap-1.5 text-muted-foreground">
              <Mark status={activePoint.status} className="size-2" />
              {LISTING_STATUS_LABEL[activePoint.status]},{" "}
              {ratioText(activePoint)}
            </p>
          </div>
        )}
      </div>

      <div aria-hidden />
      <div className="relative h-5 pt-1.5" aria-hidden>
        {x.ticks.map((tick) => (
          <span
            key={tick}
            className="absolute -translate-x-1/2 text-xs tabular-nums text-muted-foreground"
            style={{ left: `${(tick / x.top) * 100}%` }}
          >
            {fmt(tick)}
          </span>
        ))}
      </div>
      <div aria-hidden />
      <p className="pt-2 text-center text-xs text-muted-foreground">Vistas</p>
    </div>
  );
}

function Watchlist({
  title,
  hint,
  status,
  points,
}: {
  title: string;
  hint: string;
  status: ListingStatus;
  points: ListingPoint[];
}) {
  return (
    <div>
      <div className="flex items-center gap-2">
        <Mark status={status} />
        <h4 className="text-sm font-semibold">{title}</h4>
        <span className="text-xs text-muted-foreground">({points.length})</span>
      </div>
      <p className="mt-0.5 text-[13px] text-muted-foreground">{hint}</p>
      {points.length ? (
        <ul className="mt-2 space-y-1">
          {points.map((point) => (
            <li key={point.id}>
              <Link
                href={`/dashboard/propiedades/${point.id}`}
                className="group flex items-baseline justify-between gap-3 rounded-md px-2 py-1.5 text-sm hover:bg-muted"
              >
                <span className="min-w-0 truncate underline decoration-border underline-offset-4 group-hover:decoration-current">
                  {point.title}
                </span>
                <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                  {fmt(point.views)} vistas · {point.inquiries} cons.
                </span>
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-2 text-[13px] text-muted-foreground">
          Ninguna por ahora.
        </p>
      )}
    </div>
  );
}

type SortKey = "title" | "views" | "inquiries" | "every" | "status";
const STATUS_RANK: Record<ListingStatus, number> = {
  no_convence: 0,
  poca_exposicion: 1,
  en_linea: 2,
  reciente: 3,
};
const ACCESSORS = {
  title: (p: ListingPoint) => p.title,
  views: (p: ListingPoint) => p.views,
  inquiries: (p: ListingPoint) => p.inquiries,
  every: (p: ListingPoint) => viewsPerInquiry(p),
  status: (p: ListingPoint) => STATUS_RANK[p.status],
} satisfies Record<SortKey, (p: ListingPoint) => number | string | null>;

function FullTable({ points }: { points: ListingPoint[] }) {
  const { sorted, sort, toggle } = useSortable<ListingPoint, SortKey>(
    points,
    ACCESSORS,
    { key: "status", dir: "asc" },
  );
  return (
    <div className="max-h-96 overflow-auto">
      <Table className="min-w-[620px]">
        <TableHeader>
          <TableRow>
            <SortHead
              label="Propiedad"
              sortKey="title"
              sort={sort}
              onToggle={toggle}
            />
            <SortHead
              label="Vistas"
              sortKey="views"
              sort={sort}
              onToggle={toggle}
              align="right"
            />
            <SortHead
              label="Consultas"
              sortKey="inquiries"
              sort={sort}
              onToggle={toggle}
              align="right"
            />
            <SortHead
              label="Vistas por consulta"
              sortKey="every"
              sort={sort}
              onToggle={toggle}
              align="right"
            />
            <SortHead
              label="Estado"
              sortKey="status"
              sort={sort}
              onToggle={toggle}
            />
          </TableRow>
        </TableHeader>
        <TableBody>
          {sorted.map((point) => {
            const every = viewsPerInquiry(point);
            return (
              <TableRow key={point.id}>
                <TableCell className="max-w-[260px] truncate font-medium">
                  <Link
                    href={`/dashboard/propiedades/${point.id}`}
                    className="underline decoration-border underline-offset-4 hover:decoration-current"
                  >
                    {point.title}
                  </Link>
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {fmt(point.views)}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {point.inquiries}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {every === null ? "—" : fmt(every)}
                </TableCell>
                <TableCell>
                  <span className="inline-flex items-center gap-1.5 text-[13px]">
                    <Mark status={point.status} className="size-2" />
                    {LISTING_STATUS_LABEL[point.status]}
                  </span>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}

export function ListingConversionReport({ data }: { data: ListingConversion }) {
  if (!data.points.length)
    return (
      <p className="rounded-md border border-dashed border-border p-4 text-sm text-muted-foreground">
        No hay propiedades publicadas en venta o alquiler.
      </p>
    );

  const unconvinced = data.points
    .filter((p) => p.status === "no_convence")
    .sort((a, b) => b.views - a.views);
  const lowExposure = data.points
    .filter((p) => p.status === "poca_exposicion")
    .sort((a, b) => a.views - b.views);
  const avgEvery =
    data.per100 && data.per100 > 0 ? Math.round(100 / data.per100) : null;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2">
        <p className="text-sm">
          {avgEvery === null ? (
            "Todavía no hay vistas registradas."
          ) : (
            <>
              En promedio, tu cartera recibe{" "}
              <span className="font-semibold">
                1 consulta cada {fmt(avgEvery)} vistas
              </span>
              <span className="text-muted-foreground"> (línea punteada).</span>
            </>
          )}
        </p>
        <ul className="flex flex-wrap gap-x-4 gap-y-1 text-[13px] text-fg-secondary">
          {LEGEND_ORDER.filter((status) =>
            data.points.some((p) => p.status === status),
          ).map((status) => (
            <li key={status} className="inline-flex items-center gap-1.5">
              <Mark status={status} />
              {LISTING_STATUS_LABEL[status]}
            </li>
          ))}
        </ul>
      </div>

      <div className="grid gap-8 xl:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <div>
          <p className="mb-2 text-xs text-muted-foreground">Consultas</p>
          <Scatter data={data} />
        </div>
        <div className="space-y-6">
          <Watchlist
            title="Se ven pero no consultan"
            hint="Revisar precio, fotos y título: la gente llega y no se convence."
            status="no_convence"
            points={unconvinced}
          />
          <Watchlist
            title="Poca exposición"
            hint={`Menos de ${data.lowViewsThreshold === null ? "la mitad de la mediana de" : fmt(data.lowViewsThreshold)} vistas: reforzar difusión o portales.`}
            status="poca_exposicion"
            points={lowExposure}
          />
        </div>
      </div>

      <details className="text-[13px]">
        <summary className="w-fit cursor-pointer rounded-sm text-muted-foreground underline decoration-border underline-offset-4 outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring">
          Ver todas las propiedades en tabla
        </summary>
        <div className="mt-3">
          <FullTable points={data.points} />
        </div>
      </details>
    </div>
  );
}
