"use client";

import { Suspense, use } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import type { NavCounts } from "@/shared/components/navCounts";
import {
  isRentalSectionActive, RENTAL_SECTION_GROUPS, RENTALS_BASE, type RentalSection,
} from "@/features/rentals/sections";

// Panel de sección al lado del sidebar principal (estilo Supabase): las
// sub-páginas del módulo quedan siempre a mano sin estirar el menú
// principal. Solo en desktop ancho; en pantallas chicas el módulo usa
// pestañas (RentalsNav).
export function SectionSidebar({ counts }: { counts: Promise<NavCounts> }) {
  const pathname = usePathname();
  if (pathname !== RENTALS_BASE && !pathname.startsWith(`${RENTALS_BASE}/`)) return null;

  return (
    <aside
      aria-label="Secciones de alquileres"
      className="sticky top-0 hidden h-svh w-52 shrink-0 flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground lg:flex print:hidden"
    >
      <div className="flex h-12 shrink-0 items-center border-b border-sidebar-border px-4">
        <span className="text-sm font-semibold tracking-tight text-foreground">Alquileres</span>
      </div>
      <nav className="flex-1 space-y-4 overflow-y-auto px-2 py-3">
        {RENTAL_SECTION_GROUPS.map((group) => (
          <div key={group.label ?? "inicio"}>
            {group.label && (
              <p className="px-2 pb-1 text-xs font-medium text-sidebar-foreground/70">{group.label}</p>
            )}
            <ul className="space-y-0.5">
              {group.items.map((item) => (
                <SectionLink key={item.href} item={item} active={isRentalSectionActive(pathname, item)} counts={counts} />
              ))}
            </ul>
          </div>
        ))}
      </nav>
    </aside>
  );
}

function SectionLink({ item, active, counts }: { item: RentalSection; active: boolean; counts: Promise<NavCounts> }) {
  return (
    <li>
      <Link
        href={item.href}
        aria-current={active ? "page" : undefined}
        className={cn(
          "flex h-8 items-center justify-between gap-2 rounded-md px-2 text-sm outline-hidden transition-colors",
          "focus-visible:ring-2 focus-visible:ring-sidebar-ring",
          active
            ? "bg-sidebar-accent font-medium text-sidebar-accent-foreground"
            : "hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground",
        )}
      >
        <span className="truncate">{item.label}</span>
        {item.countKey && (
          <Suspense fallback={null}>
            <SectionCount counts={counts} countKey={item.countKey} />
          </Suspense>
        )}
      </Link>
    </li>
  );
}

function SectionCount({ counts, countKey }: { counts: Promise<NavCounts>; countKey: keyof NavCounts }) {
  const n = use(counts)[countKey];
  if (!n) return null;
  return (
    <span className="text-xs font-medium tabular-nums text-danger" aria-label={`${n} ${n === 1 ? "tarea urgente" : "tareas urgentes"}`}>
      {n > 99 ? "99+" : n}
    </span>
  );
}
