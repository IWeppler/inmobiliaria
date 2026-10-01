"use client";

import { useId, useState } from "react";
import Link from "next/link";
import { motion, useReducedMotion } from "framer-motion";
import { ArrowRight } from "lucide-react";
import PropertyCard from "@/features/properties/PropertyCard";
import { Reveal } from "@/features/public/v2/Reveal";
import type { PropertyCardData } from "@/app/types/entities";
import { whatsappLink } from "@/lib/brand";
import { CONTACT_CTA_LABEL } from "@/features/public/v2/content";

type Operation = "venta" | "alquiler";

const TABS: { value: Operation; label: string }[] = [
  { value: "venta", label: "En venta" },
  { value: "alquiler", label: "En alquiler" },
];

// Filas completas: 3 columnas en desktop, así nunca queda una fila a medias.
function fullRows(list: PropertyCardData[]) {
  if (list.length <= 3) return list;
  return list.slice(0, Math.min(6, list.length - (list.length % 3)));
}

export function LatestListings({
  sale,
  rent,
}: {
  sale: PropertyCardData[];
  rent: PropertyCardData[];
}) {
  const [operation, setOperation] = useState<Operation>(sale.length === 0 && rent.length > 0 ? "alquiler" : "venta");
  const reduce = useReducedMotion();
  const baseId = useId();
  // El fade del panel solo corre al cambiar de tab, no en la carga (ahí entra con Reveal).
  const [switched, setSwitched] = useState(false);
  const select = (op: Operation) => {
    setSwitched(true);
    setOperation(op);
  };

  const items = fullRows(operation === "venta" ? sale : rent);
  const seeAllHref = `/propiedades?tipo=${operation}`;

  return (
    <section aria-labelledby={`${baseId}-title`} className="w-full bg-background">
      <div className="mx-auto w-full max-w-7xl px-4 py-16 md:px-6 md:py-24">
        <Reveal className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
          <h2
            id={`${baseId}-title`}
            className="font-clash text-4xl leading-[1.05] font-semibold tracking-tight text-foreground md:text-5xl"
          >
            Recién publicadas
          </h2>

          <div className="flex items-center gap-6">
            <div role="tablist" aria-label="Operación" className="flex rounded-md bg-muted p-1">
              {TABS.map((tab) => {
                const active = operation === tab.value;
                return (
                  <button
                    key={tab.value}
                    type="button"
                    role="tab"
                    id={`${baseId}-tab-${tab.value}`}
                    aria-selected={active}
                    aria-controls={`${baseId}-panel`}
                    tabIndex={active ? 0 : -1}
                    onClick={() => select(tab.value)}
                    onKeyDown={(e) => {
                      if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
                        const next = tab.value === "venta" ? "alquiler" : "venta";
                        select(next);
                        document.getElementById(`${baseId}-tab-${next}`)?.focus();
                      }
                    }}
                    className={`relative cursor-pointer rounded-sm px-4 py-2 text-sm font-semibold transition-colors ${
                      active ? "text-foreground" : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {active && (
                      <motion.span
                        layoutId={`${baseId}-pill`}
                        className="absolute inset-0 rounded-sm bg-card shadow-sm"
                        transition={reduce ? { duration: 0 } : { type: "spring", stiffness: 420, damping: 34 }}
                      />
                    )}
                    <span className="relative">{tab.label}</span>
                  </button>
                );
              })}
            </div>

            <Link
              href={seeAllHref}
              className="group hidden items-center gap-1.5 text-sm font-semibold text-foreground underline-offset-4 hover:underline md:inline-flex"
            >
              Ver todas
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
            </Link>
          </div>
        </Reveal>

        <Reveal delay={0.1}>
          <div
            id={`${baseId}-panel`}
            role="tabpanel"
            aria-labelledby={`${baseId}-tab-${operation}`}
            className="mt-10"
          >
            <motion.div
              key={operation}
              initial={reduce || !switched ? false : { opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
            >
              {items.length > 0 ? (
                <ul className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3 lg:gap-6">
                  {items.map((property, i) => (
                    // En móvil se muestran 3 para no alargar la página; el resto en "Ver todas".
                    <li key={property.id} className={i >= 3 ? "hidden md:block" : undefined}>
                      <PropertyCard property={property} showStatus={false} />
                    </li>
                  ))}
                </ul>
              ) : (
                <div className="flex flex-col items-start gap-4 rounded-lg border border-dashed border-border-strong px-6 py-12 md:items-center md:text-center">
                  <p className="font-clash text-2xl font-semibold text-foreground">
                    {operation === "venta" ? "No hay propiedades en venta por ahora" : "No hay propiedades en alquiler por ahora"}
                  </p>
                  <p className="max-w-[48ch] text-muted-foreground">
                    Contanos qué buscás y te avisamos apenas entre algo que encaje.
                  </p>
                  <a
                    href={whatsappLink("Hola, estoy buscando una propiedad y quería hacer una consulta.")}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex h-11 items-center rounded-md border border-border-strong px-5 text-sm font-semibold text-foreground transition-colors hover:bg-card"
                  >
                    {CONTACT_CTA_LABEL}
                  </a>
                </div>
              )}
            </motion.div>
          </div>
        </Reveal>

        {items.length > 0 && (
          <Link
            href={seeAllHref}
            className="mt-8 inline-flex h-11 w-full items-center justify-center gap-2 rounded-md border border-border-strong text-sm font-semibold text-foreground transition-colors hover:bg-card md:hidden"
          >
            Ver todas
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </Link>
        )}
      </div>
    </section>
  );
}
