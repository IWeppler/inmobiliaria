"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/shared/components/ui/table";
import {
  GRAIN_NOUN,
  type LeadTrend,
} from "@/features/dashboard/reports/leadTrend";
import { niceScale } from "@/features/dashboard/reports/chartScale";

// Dos pasos del mismo tono (validados: ΔE ≈ 34 en tema claro y oscuro).
// El paso claro tiene poco contraste contra la tarjeta, por eso la
// identidad también va en leyenda, tooltip y tabla.
const CLOSED_COLOR = "var(--primary)";
const OPEN_COLOR = "color-mix(in oklab, var(--primary) 35%, var(--card))";

function Swatch({ color }: { color: string }) {
  return (
    <span
      aria-hidden
      className="inline-block size-2.5 rounded-[3px]"
      style={{ backgroundColor: color }}
    />
  );
}

export function LeadTrendChart({ trend }: { trend: LeadTrend }) {
  const { points, grain } = trend;
  const [active, setActive] = useState<number | null>(null);
  const [grown, setGrown] = useState(false);

  // Las barras crecen desde la base una vez montadas (sin animación si el
  // usuario pidió movimiento reducido: ver motion-reduce abajo).
  useEffect(() => {
    const frame = requestAnimationFrame(() => setGrown(true));
    return () => cancelAnimationFrame(frame);
  }, []);

  const total = points.reduce((sum, point) => sum + point.captured, 0);
  if (!total)
    return (
      <p className="rounded-md border border-dashed border-border p-4 text-sm text-muted-foreground">
        Todavía no hay leads en este período.
      </p>
    );

  const { top, ticks } = niceScale(
    Math.max(...points.map((point) => point.captured)),
  );
  // Etiquetas del eje X: menos en mobile para que no se pisen.
  const wideStep = Math.ceil(points.length / 12);
  const narrowStep = Math.ceil(points.length / 5);
  const activePoint = active === null ? null : points[active];
  const activeLeft =
    active === null ? 0 : ((active + 0.5) / points.length) * 100;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[13px] text-fg-secondary">
        <span className="inline-flex items-center gap-1.5">
          <Swatch color={CLOSED_COLOR} />
          Cerrados
        </span>
        <span className="inline-flex items-center gap-1.5">
          <Swatch color={OPEN_COLOR} />
          En curso o descartados
        </span>
      </div>

      <div className="grid grid-cols-[2rem_minmax(0,1fr)] gap-x-2">
        {/* Eje Y */}
        <div className="relative h-56" aria-hidden>
          {ticks.map((tick) => (
            <span
              key={tick}
              className="absolute right-0 translate-y-1/2 text-xs tabular-nums text-muted-foreground"
              style={{ bottom: `${(tick / top) * 100}%` }}
            >
              {tick.toLocaleString("es-AR")}
            </span>
          ))}
        </div>

        {/* Área del gráfico */}
        <div className="relative h-56" onPointerLeave={() => setActive(null)}>
          {ticks.map((tick) => (
            <div
              key={tick}
              aria-hidden
              className={cn(
                "absolute inset-x-0 h-px",
                tick === 0 ? "bg-border-strong" : "bg-border",
              )}
              style={{ bottom: `${(tick / top) * 100}%` }}
            />
          ))}

          <ul className="absolute inset-0 flex">
            {points.map((point, index) => {
              const open = point.captured - point.closed;
              const height = (point.captured / top) * 100;
              const inProgress = open - point.discarded;
              return (
                <li key={point.key} className="h-full min-w-0 flex-1">
                  <button
                    type="button"
                    className={cn(
                      "flex h-full w-full items-end justify-center rounded-sm outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring",
                      active === index && "bg-muted/70",
                    )}
                    onPointerEnter={() => setActive(index)}
                    onFocus={() => setActive(index)}
                    onBlur={() => setActive(null)}
                    aria-label={`${point.longLabel}: ${point.captured} leads captados, ${point.closed} cerrados, ${point.discarded} descartados, ${inProgress} en curso`}
                  >
                    {point.captured > 0 && (
                      <span
                        aria-hidden
                        className={cn(
                          "flex w-[min(24px,62%)] origin-bottom flex-col gap-[2px] transition-transform duration-500 ease-out motion-reduce:transition-none",
                          grown ? "scale-y-100" : "scale-y-0",
                        )}
                        style={{ height: `${height}%` }}
                      >
                        {open > 0 && (
                          <span
                            className="min-h-[2px] rounded-t-[4px]"
                            style={{
                              flexGrow: open,
                              backgroundColor: OPEN_COLOR,
                            }}
                          />
                        )}
                        {point.closed > 0 && (
                          <span
                            className={cn(
                              "min-h-[2px]",
                              open === 0 && "rounded-t-[4px]",
                            )}
                            style={{
                              flexGrow: point.closed,
                              backgroundColor: CLOSED_COLOR,
                            }}
                          />
                        )}
                      </span>
                    )}
                  </button>
                </li>
              );
            })}
          </ul>

          {activePoint && (
            <div
              role="status"
              className="pointer-events-none absolute top-0 z-10 w-max min-w-40 rounded-md border border-border bg-card px-3 py-2 text-xs shadow-md"
              style={{
                left: `${activeLeft}%`,
                transform:
                  activeLeft < 18
                    ? "translateX(0)"
                    : activeLeft > 82
                      ? "translateX(-100%)"
                      : "translateX(-50%)",
              }}
            >
              <p className="capitalize text-muted-foreground">
                {activePoint.longLabel}
              </p>
              <p className="mt-0.5 text-sm">
                <span className="font-semibold tabular-nums">
                  {activePoint.captured}
                </span>{" "}
                <span className="text-muted-foreground">leads captados</span>
              </p>
              <dl className="mt-1.5 space-y-0.5">
                {[
                  ["Cerrados", activePoint.closed, CLOSED_COLOR],
                  [
                    "En curso",
                    activePoint.captured -
                      activePoint.closed -
                      activePoint.discarded,
                    OPEN_COLOR,
                  ],
                  ["Descartados", activePoint.discarded, OPEN_COLOR],
                ].map(([label, value, color]) => (
                  <div key={label} className="flex items-center gap-2">
                    <span
                      aria-hidden
                      className="h-0.5 w-3 rounded-full"
                      style={{ backgroundColor: color as string }}
                    />
                    <dt className="text-muted-foreground">{label}</dt>
                    <dd className="ml-auto pl-3 font-medium tabular-nums">
                      {value}
                    </dd>
                  </div>
                ))}
              </dl>
            </div>
          )}
        </div>

        {/* Eje X */}
        <div aria-hidden />
        <div className="flex pt-2" aria-hidden>
          {points.map((point, index) => (
            <span
              key={point.key}
              className={cn(
                "min-w-0 flex-1 overflow-visible whitespace-nowrap text-center text-xs text-muted-foreground",
                index % narrowStep === 0
                  ? ""
                  : index % wideStep === 0
                    ? "invisible md:visible"
                    : "invisible",
              )}
            >
              {point.label}
            </span>
          ))}
        </div>
      </div>

      <details className="group text-[13px]">
        <summary className="w-fit cursor-pointer rounded-sm text-muted-foreground underline decoration-border underline-offset-4 outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring">
          Ver datos en tabla
        </summary>
        <div className="mt-3 max-h-72 overflow-y-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="capitalize">
                  {GRAIN_NOUN[grain]}
                </TableHead>
                <TableHead className="text-right">Captados</TableHead>
                <TableHead className="text-right">Cerrados</TableHead>
                <TableHead className="text-right">Descartados</TableHead>
                <TableHead className="text-right">En curso</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {points.map((point) => (
                <TableRow key={point.key}>
                  <TableCell className="capitalize">
                    {point.longLabel}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {point.captured}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {point.closed}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {point.discarded}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {point.captured - point.closed - point.discarded}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </details>
    </div>
  );
}
