"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { LayoutGrid, Map as MapIcon } from "lucide-react";
import { cn } from "@/lib/utils";

// Lista / Mapa en la URL (?vista=mapa): la vista se comparte con el link
// y sobrevive a los cambios de filtro.
export function ViewToggle({ current }: { current: "lista" | "mapa" }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const setView = (view: "lista" | "mapa") => {
    const params = new URLSearchParams(searchParams.toString());
    if (view === "lista") params.delete("vista");
    else params.set("vista", view);
    const qs = params.toString();
    // Volver arriba: la vista mapa ocupa el viewport y no debe quedar
    // cortada si se venía scrolleado en la lista.
    router.push(qs ? `${pathname}?${qs}` : pathname);
  };

  const option = (view: "lista" | "mapa", label: string, Icon: React.ElementType) => (
    <button
      type="button"
      onClick={() => setView(view)}
      aria-pressed={current === view}
      className={cn(
        "inline-flex h-9 items-center gap-1.5 rounded-sm px-3 text-sm font-medium transition-colors",
        current === view
          ? "bg-foreground text-background shadow-sm"
          : "text-muted-foreground hover:text-foreground",
      )}
    >
      <Icon className="h-4 w-4" />
      {label}
    </button>
  );

  return (
    <div
      role="group"
      aria-label="Tipo de vista"
      className="inline-flex h-10 items-center rounded-md border border-border bg-card p-0.5"
    >
      {option("lista", "Lista", LayoutGrid)}
      {option("mapa", "Mapa", MapIcon)}
    </div>
  );
}
