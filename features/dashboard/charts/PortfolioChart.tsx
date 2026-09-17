"use client";

import { useState } from "react";
import Link from "next/link";
import { PROPERTY_STATUSES } from "@/features/dashboard/property/propertyStatus";
import { cn } from "@/lib/utils";

// Cartera por estado como donut: parte-de-un-todo con 5 categorías, cada
// una con su color propio (el mismo del badge de estado). Segmentos
// separados por 2px de superficie, total en el centro, leyenda con
// conteo y % (la identidad nunca depende solo del color). Hover por
// segmento y por fila de leyenda, sincronizados.
const SIZE = 168;
const STROKE = 22;
const R = (SIZE - STROKE) / 2;
const C = 2 * Math.PI * R;
const GAP = 2;

export function PortfolioChart({ counts }: { counts: Record<string, number> }) {
  const [active, setActive] = useState<string | null>(null);

  const rows = PROPERTY_STATUSES.map((s) => ({
    status: s.value,
    label: s.label,
    color: s.color,
    count: counts[s.value] ?? 0,
  }));
  const total = rows.reduce((a, r) => a + r.count, 0);

  if (total === 0) {
    return <p className="text-sm text-muted-foreground">Sin propiedades cargadas.</p>;
  }

  const present = rows.filter((r) => r.count > 0);
  // Inicio de cada segmento = suma acumulada de los anteriores.
  const segments = present.map((r, i) => {
    const start = present.slice(0, i).reduce((a, x) => a + (x.count / total) * C, 0);
    const len = (r.count / total) * C;
    return { ...r, start, len: Math.max(0, len - (present.length > 1 ? GAP : 0)) };
  });
  const focus = rows.find((r) => r.status === active) ?? null;

  return (
    <div className="flex flex-col items-center gap-4 sm:flex-row sm:gap-6">
      <div className="relative shrink-0" style={{ width: SIZE, height: SIZE }}>
        <svg
          width={SIZE}
          height={SIZE}
          viewBox={`0 0 ${SIZE} ${SIZE}`}
          role="img"
          aria-label={`Propiedades por estado: ${present.map((r) => `${r.label} ${r.count}`).join(", ")}`}
        >
          <g transform={`rotate(-90 ${SIZE / 2} ${SIZE / 2})`}>
            {segments.map((s) => (
              <circle
                key={s.status}
                cx={SIZE / 2}
                cy={SIZE / 2}
                r={R}
                fill="none"
                stroke={s.color}
                strokeWidth={STROKE}
                strokeDasharray={`${s.len} ${C - s.len}`}
                strokeDashoffset={-s.start}
                className={cn(
                  "cursor-pointer transition-opacity",
                  active !== null && active !== s.status && "opacity-35",
                )}
                onPointerEnter={() => setActive(s.status)}
                onPointerLeave={() => setActive(null)}
              >
                <title>{`${s.label}: ${s.count} (${Math.round((s.count / total) * 100)}%)`}</title>
              </circle>
            ))}
          </g>
        </svg>
        {/* Centro: total, o el segmento activo */}
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
          <span className="text-2xl font-semibold tracking-tight text-foreground">
            {focus ? focus.count : total}
          </span>
          <span className="max-w-[96px] truncate text-xs text-muted-foreground">
            {focus ? focus.label : "propiedades"}
          </span>
        </div>
      </div>

      <ul className="flex w-full min-w-0 flex-col">
        {rows.map((r) => {
          const pct = Math.round((r.count / total) * 100);
          return (
            <li key={r.status}>
              <Link
                href={`/dashboard/propiedades?estado=${r.status}`}
                className={cn(
                  "flex h-8 items-center gap-2.5 rounded-md px-2 text-sm transition-colors",
                  active === r.status ? "bg-muted" : "hover:bg-muted/50",
                )}
                onPointerEnter={() => r.count > 0 && setActive(r.status)}
                onPointerLeave={() => setActive(null)}
              >
                <span
                  className={cn("size-2.5 shrink-0 rounded-[2px]", r.count === 0 && "opacity-30")}
                  style={{ backgroundColor: r.color }}
                  aria-hidden
                />
                <span className={cn("flex-1 truncate", r.count === 0 ? "text-muted-foreground" : "text-fg-secondary")}>
                  {r.label}
                </span>
                <span className="w-7 text-right font-medium tabular-nums text-foreground">{r.count}</span>
                <span className="w-9 text-right text-xs tabular-nums text-muted-foreground">{pct}%</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
