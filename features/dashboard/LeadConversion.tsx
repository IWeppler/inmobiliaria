"use client";

import { motion, useReducedMotion } from "framer-motion";

type LeadConversionProps = {
  closed: number;
  discarded: number;
  open: number;
};

const TOTAL_BARS = 32;

export function LeadConversion({
  closed,
  discarded,
  open,
}: LeadConversionProps) {
  const reduceMotion = useReducedMotion();
  const finalized = closed + discarded;
  const rate = finalized > 0 ? Math.round((closed / finalized) * 100) : 0;
  const filledBars = Math.round((rate / 100) * TOTAL_BARS);

  return (
    <div className="flex h-full flex-col justify-between gap-5 p-5">
      <div>
        <div className="flex items-end gap-2">
          <p className="text-5xl font-semibold tracking-tight tabular-nums text-card-foreground">
            {finalized > 0 ? `${rate}%` : "—"}
          </p>
          <span className="mb-1 text-sm text-fg-secondary">de cierre</span>
        </div>
        <p className="mt-1 text-xs text-muted-foreground">
          {finalized > 0
            ? `${finalized} ${finalized === 1 ? "lead finalizado" : "leads finalizados"}`
            : "Aún no hay leads finalizados"}
        </p>

        <div
          className="mt-2 flex h-10 w-full gap-[3px]"
          role="img"
          aria-label={`${closed} leads cerrados y ${discarded} descartados de ${finalized} finalizados: ${finalized > 0 ? `${rate}% de cierre` : "sin tasa de cierre"}`}
        >
          {Array.from({ length: TOTAL_BARS }, (_, index) => (
            <motion.div
              key={index}
              aria-hidden="true"
              initial={reduceMotion ? false : { scaleY: 0, opacity: 0 }}
              animate={{ scaleY: 1, opacity: 1 }}
              transition={{
                duration: 0.4,
                delay: index * 0.02,
                ease: "easeOut",
              }}
              style={{ originY: 1 }}
              className={`min-w-0 flex-1 rounded-[2px] ${index < filledBars ? "bg-primary" : "bg-muted"}`}
            />
          ))}
        </div>

        <dl className="mt-4 grid grid-cols-2 gap-3">
          <div>
            <dt className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <span
                className="size-2 rounded-sm bg-primary"
                aria-hidden="true"
              />
              Cerrados
            </dt>
            <dd className="mt-0.5 text-lg font-semibold tabular-nums">
              {closed}
            </dd>
          </div>
          <div className="text-right">
            <dt className="flex items-center justify-end gap-1.5 text-xs text-muted-foreground">
              <span
                className="size-2 rounded-sm bg-muted ring-1 ring-border"
                aria-hidden="true"
              />
              Descartados
            </dt>
            <dd className="mt-0.5 text-lg font-semibold tabular-nums">
              {discarded}
            </dd>
          </div>
        </dl>
      </div>

      <div className="flex items-center justify-between border-t border-border-subtle pt-3">
        <span className="text-xs text-muted-foreground">Leads en curso</span>
        <span className="text-sm font-semibold tabular-nums">{open}</span>
      </div>
    </div>
  );
}
