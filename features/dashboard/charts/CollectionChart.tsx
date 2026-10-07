"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { compactArs, fullArs } from "@/features/finances/logic";
import type { CollectionPoint } from "./collection";

// Pila de abajo hacia arriba: lo cobrado es la base, lo impago se apila
// encima. La altura total de la columna es siempre lo esperado del mes.
const SERIES = [
  { key: "collected", label: "Cobrado", color: "var(--chart-4)" },
  { key: "overdue", label: "Vencido", color: "var(--danger-vivid)" },
  { key: "pending", label: "Por vencer", color: "var(--border-strong)" },
] as const;

function niceMax(n: number) {
  if (n <= 0) return 1;
  const pow = 10 ** Math.floor(Math.log10(n));
  const step = [1, 2, 2.5, 5, 10].find((s) => s * pow >= n)!;
  return step * pow;
}

function pct(part: number, total: number) {
  return total > 0 ? Math.round((part / total) * 100) : 0;
}

// Cobranza de alquileres por mes (12 por defecto). Mismo lenguaje visual que
// el resto de los gráficos del panel: columnas HTML ≤ 24px, extremo
// redondeado, un tooltip por mes y tabla equivalente para lectores.
export function CollectionChart({ data }: { data: CollectionPoint[] }) {
  const months = data.length;
  const [hover, setHover] = useState<number | null>(null);
  const max = niceMax(Math.max(...data.map((d) => d.expected)));
  const ticks = [0, max / 2, max];
  const lastIdx = data.length - 1;
  const current = data[lastIdx];
  const totalOverdue = data.reduce((sum, d) => sum + d.overdue, 0);

  return (
    <div className="flex flex-col gap-4">
      {/* Resumen: mes en curso + deuda vencida acumulada */}
      <div className="flex flex-wrap gap-x-8 gap-y-2">
        <div>
          <p className="text-xs text-muted-foreground">Cobrado este mes</p>
          <p className="text-lg font-semibold tabular-nums text-foreground">
            {fullArs(current.collected)}
            <span className="ml-1.5 text-sm font-normal text-fg-secondary">
              de {compactArs(current.expected)} · {pct(current.collected, current.expected)}%
            </span>
          </p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Deuda vencida ({months} meses)</p>
          <p className={cn("text-lg font-semibold tabular-nums", totalOverdue > 0 ? "text-danger" : "text-foreground")}>
            {fullArs(totalOverdue)}
          </p>
        </div>
      </div>

      {/* Leyenda: rect para columnas */}
      <div className="flex flex-wrap items-center gap-4 text-xs text-fg-secondary">
        {SERIES.map((s) => (
          <span key={s.key} className="inline-flex items-center gap-1.5">
            <span className="size-2.5 rounded-[2px]" style={{ backgroundColor: s.color }} aria-hidden />
            {s.label}
          </span>
        ))}
      </div>

      <div className="relative">
        {/* Eje Y */}
        <div className="absolute inset-0 flex flex-col justify-between" aria-hidden>
          {[...ticks].reverse().map((t) => (
            <div key={t} className="flex items-center gap-2">
              <span className="w-12 text-right text-[11px] leading-none text-muted-foreground">{compactArs(t)}</span>
              <div className="h-px flex-1 bg-border-subtle" />
            </div>
          ))}
        </div>

        {/* Columnas apiladas */}
        <div className="relative ml-14 flex h-40 items-end" role="img" aria-label={`Cobranza de alquileres por mes, últimos ${months} meses`}>
          {data.map((d, i) => {
            const isHover = hover === i;
            const rate = pct(d.collected, d.expected);
            return (
              <div
                key={d.period}
                className="relative flex h-full flex-1 items-end justify-center"
                onPointerEnter={() => setHover(i)}
                onPointerLeave={() => setHover(null)}
                tabIndex={0}
                onFocus={() => setHover(i)}
                onBlur={() => setHover(null)}
                aria-label={`${d.label}: cobrado ${fullArs(d.collected)} de ${fullArs(d.expected)}`}
              >
                <div className={cn("absolute inset-y-0 inset-x-0.5 rounded-sm transition-colors", isHover && "bg-muted/60")} aria-hidden />
                <div
                  className={cn(
                    "relative flex w-3.5 flex-col-reverse overflow-hidden rounded-t-[4px] transition-opacity sm:w-5 lg:w-6",
                    isHover && "opacity-80",
                  )}
                  style={{ height: `${(d.expected / max) * 100}%`, minHeight: d.expected > 0 ? 2 : 0 }}
                >
                  {SERIES.map((s) =>
                    d[s.key] > 0 ? (
                      <div key={s.key} style={{ height: `${(d[s.key] / d.expected) * 100}%`, backgroundColor: s.color }} />
                    ) : null,
                  )}
                </div>
                {i === lastIdx && d.expected > 0 && (
                  <span
                    className="absolute left-1/2 -translate-x-1/2 text-[11px] font-medium tabular-nums text-fg-secondary"
                    style={{ bottom: `calc(${(d.expected / max) * 100}% + 3px)` }}
                  >
                    {rate}%
                  </span>
                )}

                {isHover && (
                  <div
                    role="tooltip"
                    className={cn(
                      "pointer-events-none absolute bottom-full z-10 mb-1 w-max rounded-md border border-border bg-card px-2.5 py-1.5 text-xs shadow-md",
                      i > data.length / 2 ? "right-0" : "left-0",
                    )}
                  >
                    <p className="mb-1 capitalize text-muted-foreground">
                      {d.label} · {d.expected > 0 ? `${rate}% cobrado` : "sin cargos"}
                    </p>
                    {SERIES.map((s) => (
                      <p key={s.key} className="flex items-center gap-2">
                        <span className="h-0.5 w-3 rounded-full" style={{ backgroundColor: s.color }} aria-hidden />
                        <span className="font-semibold tabular-nums text-foreground">{fullArs(d[s.key])}</span>
                        <span className="text-fg-secondary">{s.label}</span>
                      </p>
                    ))}
                    <p className="mt-1 border-t border-border pt-1 text-fg-secondary">
                      Esperado <span className="font-semibold tabular-nums text-foreground">{fullArs(d.expected)}</span>
                    </p>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Eje X: un mes sí y otro no para que no colisionen */}
        <div className="ml-14 mt-1.5 flex">
          {data.map((d, i) => (
            <span key={d.period} className="flex-1 text-center text-[11px] capitalize text-muted-foreground">
              {i % 2 === lastIdx % 2 ? d.label : ""}
            </span>
          ))}
        </div>
      </div>

      <table className="sr-only">
        <caption>Cobranza de alquileres por mes</caption>
        <thead>
          <tr><th>Mes</th><th>Esperado</th><th>Cobrado</th><th>Vencido</th><th>Por vencer</th></tr>
        </thead>
        <tbody>
          {data.map((d) => (
            <tr key={d.period}>
              <td>{d.label}</td><td>{fullArs(d.expected)}</td><td>{fullArs(d.collected)}</td>
              <td>{fullArs(d.overdue)}</td><td>{fullArs(d.pending)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
