"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { GROUPS, compactArs, fullArs, type CashFlowPoint } from "./logic";

const INCOME = GROUPS.filter((g) => g.direction === "INGRESO");
const EXPENSE = GROUPS.filter((g) => g.direction === "EGRESO");

function niceMax(n: number) {
  if (n <= 0) return 0;
  const pow = 10 ** Math.floor(Math.log10(n));
  const step = [1, 2, 2.5, 5, 10].find((s) => s * pow >= n)!;
  return step * pow;
}

// Flujo de caja mensual: ingresos apilados hacia arriba, egresos hacia
// abajo desde una línea de cero, y el resultado neto como línea encima.
// Columnas HTML (responsive sin deformar texto) + un SVG solo para la
// línea, con vector-effect para que el trazo no se estire.
export function CashFlowChart({
  data,
  fixedMonthly = 0,
  showSummary = true,
}: {
  data: CashFlowPoint[];
  /** Gastos fijos activos por mes (ARS): punto de equilibrio. */
  fixedMonthly?: number;
  showSummary?: boolean;
}) {
  const [hover, setHover] = useState<number | null>(null);
  const top = niceMax(Math.max(0, fixedMonthly, ...data.map((d) => d.income), ...data.map((d) => d.net)));
  const bottom = niceMax(Math.max(0, ...data.map((d) => d.expense), ...data.map((d) => -d.net)));
  const span = top + bottom || 1;
  const zeroPct = (top / span) * 100; // distancia del cero al borde superior
  const y = (v: number) => ((top - v) / span) * 100; // % desde arriba
  const ticks = [top, 0, -bottom].filter((t, i, a) => a.indexOf(t) === i);

  const totals = data.reduce(
    (a, d) => ({ income: a.income + d.income, expense: a.expense + d.expense }),
    { income: 0, expense: 0 },
  );
  const net = totals.income - totals.expense;
  const n = data.length;
  const lastIdx = n - 1;
  // Cobertura: cuánto de los gastos fijos cubren los ingresos del mes.
  const coverage = fixedMonthly > 0 ? Math.round((data[lastIdx].income / fixedMonthly) * 100) : null;

  return (
    <div className="flex flex-col gap-4">
      {showSummary && (
        <div className="grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-4">
          {[
            { label: "Ingresos", value: fullArs(totals.income), tone: "text-foreground" },
            { label: "Egresos", value: fullArs(totals.expense), tone: "text-foreground" },
            { label: "Resultado", value: fullArs(net), tone: net < 0 ? "text-danger" : "text-success" },
          ].map((kpi) => (
            <div key={kpi.label}>
              <p className="text-xs text-muted-foreground">{kpi.label} · {n} meses</p>
              <p className={cn("text-lg font-semibold tabular-nums", kpi.tone)}>{kpi.value}</p>
            </div>
          ))}
          <div>
            <p className="text-xs text-muted-foreground">Gastos fijos / mes</p>
            <p className="text-lg font-semibold tabular-nums text-foreground">
              {fullArs(fixedMonthly)}
              {coverage !== null && (
                <span className={cn("ml-1.5 text-sm font-normal", coverage < 100 ? "text-danger" : "text-fg-secondary")}>
                  {coverage}% cubierto
                </span>
              )}
            </p>
          </div>
        </div>
      )}

      {/* Leyenda: rect para columnas, trazo para la línea */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-fg-secondary">
        {GROUPS.map((g) => (
          <span key={g.key} className="inline-flex items-center gap-1.5">
            <span className="size-2.5 rounded-[2px]" style={{ backgroundColor: g.color }} aria-hidden />
            {g.label}
          </span>
        ))}
        <span className="inline-flex items-center gap-1.5">
          <span className="h-0.5 w-3.5 rounded-full bg-foreground" aria-hidden />
          Resultado neto
        </span>
        {fixedMonthly > 0 && (
          <span className="inline-flex items-center gap-1.5">
            <span className="w-3.5 border-t border-dashed border-fg-secondary" aria-hidden />
            Punto de equilibrio
          </span>
        )}
      </div>

      <div className="relative">
        {/* Eje Y: cero más marcado que el resto */}
        <div className="absolute inset-0" aria-hidden>
          {ticks.map((t) => (
            <div key={t} className="absolute inset-x-0 flex -translate-y-1/2 items-center gap-2" style={{ top: `${y(t)}%` }}>
              <span className="w-12 text-right text-[11px] leading-none text-muted-foreground">{compactArs(t)}</span>
              <div className={cn("h-px flex-1", t === 0 ? "bg-border-strong" : "bg-border-subtle")} />
            </div>
          ))}
        </div>

        <div className="relative ml-14 h-56" role="img" aria-label={`Flujo de caja mensual, últimos ${n} meses`}>
          <div className="absolute inset-0 flex">
            {data.map((d, i) => {
              const isHover = hover === i;
              return (
                <div
                  key={d.period}
                  className="relative h-full flex-1"
                  onPointerEnter={() => setHover(i)}
                  onPointerLeave={() => setHover(null)}
                  tabIndex={0}
                  onFocus={() => setHover(i)}
                  onBlur={() => setHover(null)}
                  aria-label={`${d.label}: ingresos ${fullArs(d.income)}, egresos ${fullArs(d.expense)}, resultado ${fullArs(d.net)}`}
                >
                  <div className={cn("absolute inset-y-0 inset-x-0.5 rounded-sm transition-colors", isHover && "bg-muted/60")} aria-hidden />

                  {/* Ingresos: de cero hacia arriba */}
                  <div
                    className="absolute left-1/2 flex w-3.5 -translate-x-1/2 flex-col-reverse overflow-hidden rounded-t-[4px] sm:w-5 lg:w-6"
                    style={{ bottom: `${100 - zeroPct}%`, height: `${(d.income / span) * 100}%` }}
                  >
                    {INCOME.map((g) =>
                      d.groups[g.key] > 0 ? (
                        <div key={g.key} style={{ height: `${(d.groups[g.key] / d.income) * 100}%`, backgroundColor: g.color }} />
                      ) : null,
                    )}
                  </div>

                  {/* Egresos: de cero hacia abajo */}
                  <div
                    className="absolute left-1/2 flex w-3.5 -translate-x-1/2 flex-col overflow-hidden rounded-b-[4px] sm:w-5 lg:w-6"
                    style={{ top: `${zeroPct}%`, height: `${(d.expense / span) * 100}%` }}
                  >
                    {EXPENSE.map((g) =>
                      d.groups[g.key] > 0 ? (
                        <div key={g.key} style={{ height: `${(d.groups[g.key] / d.expense) * 100}%`, backgroundColor: g.color }} />
                      ) : null,
                    )}
                  </div>

                  {isHover && (
                    <div
                      role="tooltip"
                      className={cn(
                        "pointer-events-none absolute bottom-full z-10 mb-1 w-max rounded-md border border-border bg-card px-2.5 py-1.5 text-xs shadow-md",
                        i > n / 2 ? "right-0" : "left-0",
                      )}
                    >
                      <p className="mb-1 capitalize text-muted-foreground">{d.label}</p>
                      {GROUPS.filter((g) => d.groups[g.key] > 0).map((g) => (
                        <p key={g.key} className="flex items-center gap-2">
                          <span className="size-2 rounded-[2px]" style={{ backgroundColor: g.color }} aria-hidden />
                          <span className="font-semibold tabular-nums text-foreground">
                            {g.direction === "EGRESO" ? "−" : ""}{fullArs(d.groups[g.key])}
                          </span>
                          <span className="text-fg-secondary">{g.label}</span>
                        </p>
                      ))}
                      <p className="mt-1 border-t border-border pt-1 text-fg-secondary">
                        Resultado{" "}
                        <span className={cn("font-semibold tabular-nums", d.net < 0 ? "text-danger" : "text-foreground")}>
                          {fullArs(d.net)}
                        </span>
                      </p>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Punto de equilibrio: ingresos por encima cubren los gastos fijos */}
          {fixedMonthly > 0 && (
            <div
              className="pointer-events-none absolute inset-x-0 border-t border-dashed border-fg-secondary"
              style={{ top: `${y(fixedMonthly)}%` }}
              aria-hidden
            />
          )}

          {/* Resultado neto */}
          <svg className="pointer-events-none absolute inset-0 size-full overflow-visible" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden>
            <polyline
              fill="none"
              stroke="var(--foreground)"
              strokeWidth={1.5}
              strokeLinejoin="round"
              vectorEffect="non-scaling-stroke"
              points={data.map((d, i) => `${((i + 0.5) / n) * 100},${y(d.net)}`).join(" ")}
            />
          </svg>
          {data.map((d, i) => (
            <span
              key={d.period}
              className={cn(
                "pointer-events-none absolute size-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full border border-card",
                d.net < 0 ? "bg-danger" : "bg-foreground",
                hover === i && "size-2",
              )}
              style={{ left: `${((i + 0.5) / n) * 100}%`, top: `${y(d.net)}%` }}
              aria-hidden
            />
          ))}
        </div>

        {/* Eje X */}
        <div className="ml-14 mt-1.5 flex">
          {data.map((d, i) => (
            <span key={d.period} className="flex-1 text-center text-[11px] capitalize text-muted-foreground">
              {i % 2 === lastIdx % 2 ? d.label : ""}
            </span>
          ))}
        </div>
      </div>

      <table className="sr-only">
        <caption>Flujo de caja mensual</caption>
        <thead>
          <tr><th>Mes</th><th>Ingresos</th><th>Egresos</th><th>Resultado</th></tr>
        </thead>
        <tbody>
          {data.map((d) => (
            <tr key={d.period}>
              <td>{d.label}</td><td>{fullArs(d.income)}</td><td>{fullArs(d.expense)}</td><td>{fullArs(d.net)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
