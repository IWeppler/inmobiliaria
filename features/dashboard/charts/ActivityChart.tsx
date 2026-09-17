"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";

export type WeekPoint = {
  /** Lunes de la semana, YYYY-MM-DD. */
  week: string;
  /** Etiqueta corta del eje, ej. "16 sep". */
  label: string;
  leads: number;
  visits: number;
};

// Series categóricas validadas contra superficie blanca (ΔE CVD 22).
const SERIES = [
  { key: "leads", label: "Consultas", color: "#1e4fd8" },
  { key: "visits", label: "Visitas", color: "#0d9488" },
] as const;

function niceMax(n: number) {
  if (n <= 4) return 4;
  if (n <= 8) return 8;
  if (n <= 12) return 12;
  return Math.ceil(n / 5) * 5;
}

// Consultas y visitas por semana, últimas 12. Columnas agrupadas en HTML
// (responsive sin distorsionar texto): ≤ 24px de ancho, extremo redondeado
// 4px, base cuadrada, 2px de aire entre columnas. Hover por semana con un
// solo tooltip para ambas series; la tabla equivalente va en <caption>
// oculta para lectores de pantalla.
export function ActivityChart({ data }: { data: WeekPoint[] }) {
  const [hover, setHover] = useState<number | null>(null);
  const max = niceMax(Math.max(1, ...data.map((d) => Math.max(d.leads, d.visits))));
  const ticks = [0, max / 2, max];
  const lastIdx = data.length - 1;
  const total = data.reduce((a, d) => ({ leads: a.leads + d.leads, visits: a.visits + d.visits }), { leads: 0, visits: 0 });

  return (
    <div className="flex flex-col gap-3">
      {/* Leyenda: rect para columnas */}
      <div className="flex items-center gap-4 text-xs text-fg-secondary">
        {SERIES.map((s) => (
          <span key={s.key} className="inline-flex items-center gap-1.5">
            <span className="size-2.5 rounded-[2px]" style={{ backgroundColor: s.color }} aria-hidden />
            {s.label}
            <span className="text-muted-foreground">· {total[s.key]}</span>
          </span>
        ))}
      </div>

      <div className="relative">
        {/* Eje Y: ticks limpios, hairline sólido */}
        <div className="absolute inset-0 flex flex-col justify-between" aria-hidden>
          {[...ticks].reverse().map((t) => (
            <div key={t} className="flex items-center gap-2">
              <span className="w-5 text-right text-[11px] leading-none text-muted-foreground">{t}</span>
              <div className="h-px flex-1 bg-border-subtle" />
            </div>
          ))}
        </div>

        {/* Columnas */}
        <div className="relative ml-7 flex h-40 items-end" role="img" aria-label="Consultas y visitas por semana, últimas 12 semanas">
          {data.map((d, i) => {
            const isHover = hover === i;
            const labelValues = i === lastIdx;
            return (
              <div
                key={d.week}
                className="group relative flex h-full flex-1 items-end justify-center"
                onPointerEnter={() => setHover(i)}
                onPointerLeave={() => setHover(null)}
                tabIndex={0}
                onFocus={() => setHover(i)}
                onBlur={() => setHover(null)}
                aria-label={`Semana del ${d.label}: ${d.leads} consultas, ${d.visits} visitas`}
              >
                {/* Fondo de hover: la semana entera es el hit target */}
                <div className={cn("absolute inset-y-0 inset-x-0.5 rounded-sm transition-colors", isHover && "bg-muted/60")} aria-hidden />
                <div className="relative flex h-full items-end gap-0.5">
                  {SERIES.map((s) => {
                    const v = d[s.key];
                    const h = (v / max) * 100;
                    return (
                      <div key={s.key} className="relative flex h-full w-3 items-end sm:w-4 lg:w-5">
                        {labelValues && v > 0 && (
                          <span
                            className="absolute left-1/2 -translate-x-1/2 text-[11px] font-medium tabular-nums text-fg-secondary"
                            style={{ bottom: `calc(${h}% + 3px)` }}
                          >
                            {v}
                          </span>
                        )}
                        <div
                          className={cn("w-full rounded-t-[4px] transition-opacity", isHover && "opacity-80")}
                          style={{ height: `${h}%`, backgroundColor: s.color, minHeight: v > 0 ? 2 : 0 }}
                        />
                      </div>
                    );
                  })}
                </div>

                {isHover && (
                  <div
                    role="tooltip"
                    className={cn(
                      "pointer-events-none absolute bottom-full z-10 mb-1 w-max rounded-md border border-border bg-card px-2.5 py-1.5 text-xs shadow-md",
                      i > data.length / 2 ? "right-0" : "left-0",
                    )}
                  >
                    <p className="mb-1 text-muted-foreground">Semana del {d.label}</p>
                    {SERIES.map((s) => (
                      <p key={s.key} className="flex items-center gap-2">
                        <span className="h-0.5 w-3 rounded-full" style={{ backgroundColor: s.color }} aria-hidden />
                        <span className="font-semibold tabular-nums text-foreground">{d[s.key]}</span>
                        <span className="text-fg-secondary">{s.label}</span>
                      </p>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Eje X: una etiqueta cada 2 semanas para que no colisionen */}
        <div className="ml-7 mt-1.5 flex">
          {data.map((d, i) => (
            <span key={d.week} className="flex-1 text-center text-[11px] text-muted-foreground">
              {(i % 2 === lastIdx % 2) ? d.label : ""}
            </span>
          ))}
        </div>
      </div>

      <table className="sr-only">
        <caption>Consultas y visitas por semana</caption>
        <thead>
          <tr><th>Semana</th><th>Consultas</th><th>Visitas</th></tr>
        </thead>
        <tbody>
          {data.map((d) => (
            <tr key={d.week}><td>{d.label}</td><td>{d.leads}</td><td>{d.visits}</td></tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
