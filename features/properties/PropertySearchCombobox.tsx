"use client";

import { useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Loader2 } from "lucide-react";
import {
  LocationCombobox,
  type LocationSuggestion,
  type SearchValue,
} from "@/features/properties/LocationCombobox";

// Buscador de la barra de /propiedades: las zonas elegidas van a `loc`
// (varias, separadas por coma) y el texto libre a `q`. La URL es la fuente
// de verdad, así los chips quedan en sync con los filtros de Ubicación.
export function PropertySearchCombobox({ locations }: { locations: LocationSuggestion[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [pending, startTransition] = useTransition();

  const value: SearchValue = {
    locs: searchParams.get("loc")?.split(",").filter(Boolean) ?? [],
    q: searchParams.get("q") ?? "",
  };

  const onChange = (next: SearchValue) => {
    const params = new URLSearchParams(searchParams.toString());
    if (next.locs.length) params.set("loc", next.locs.join(","));
    else params.delete("loc");
    if (next.q) params.set("q", next.q);
    else params.delete("q");
    const qs = params.toString();
    startTransition(() => router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false }));
  };

  return (
    <div className="relative flex w-full items-center rounded-md border border-border bg-card px-3 py-1 transition-colors focus-within:border-main focus-within:ring-3 focus-within:ring-ring/15">
      <LocationCombobox
        locations={locations}
        value={value}
        onChange={onChange}
        className="flex-1"
        inputClassName="text-sm"
      />
      {pending && <Loader2 className="ml-2 h-4 w-4 shrink-0 animate-spin text-muted-foreground" aria-label="Buscando" />}
    </div>
  );
}
