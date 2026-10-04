"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { isRentalSectionActive, RENTAL_SECTIONS } from "@/features/rentals/sections";

// Pestañas del módulo de alquileres para pantallas chicas. En desktop las
// secciones viven en el panel lateral (SectionSidebar), así que se ocultan.
export function RentalsNav() {
  const pathname = usePathname();

  return (
    <nav aria-label="Secciones de alquileres" className="-mx-4 overflow-x-auto px-4 md:mx-0 md:px-0 lg:hidden print:hidden">
      <ul className="inline-flex h-9 items-center rounded-lg bg-muted p-[3px] text-muted-foreground">
        {RENTAL_SECTIONS.map((item) => {
          const active = isRentalSectionActive(pathname, item);
          return (
            <li key={item.href} className="h-full">
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "inline-flex h-full items-center gap-1.5 whitespace-nowrap rounded-md border border-transparent px-3 text-sm font-medium transition-[color,box-shadow]",
                  "focus-visible:outline-1 focus-visible:outline-ring focus-visible:ring-[3px] focus-visible:ring-ring/50",
                  active
                    ? "bg-background text-foreground shadow-sm dark:border-input dark:bg-input/30"
                    : "text-foreground/70 hover:text-foreground",
                )}
              >
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
