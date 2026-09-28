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
    router.push(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  };

  const option = (view: "lista" | "mapa", label: string, Icon: React.ElementType) => (
    <button
      type="button"
      onClick={() => setView(view)}
      aria-pressed={current === view}
      className={cn(
        "inline-flex h-9 items-center gap-1.5 rounded-md px-3 text-sm font-medium transition-colors",
        current === view
          ? "bg-zinc-900 text-white shadow-sm"
          : "text-zinc-600 hover:text-zinc-900",
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
      className="inline-flex rounded-lg border border-zinc-200 bg-white p-0.5"
    >
      {option("lista", "Lista", LayoutGrid)}
      {option("mapa", "Mapa", MapIcon)}
    </div>
  );
}
