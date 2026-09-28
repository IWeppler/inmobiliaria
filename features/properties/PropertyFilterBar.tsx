"use client";

import {
  Bath,
  BedDouble,
  Building2,
  Check,
  ChevronDown,
  MapPin,
  Sparkles,
  Tag,
  X,
} from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/shared/components/ui/popover";
import { cn } from "@/lib/utils";
import { useFilterParams } from "@/features/properties/useFilterParams";

type Option = { value: string; label: string };

type Props = {
  types: { id: number; name: string }[];
  amenities: { id: number; name: string }[];
  cities: string[];
};

// Filtros en línea para la vista mapa: una píldora por filtro con su
// desplegable, así el mapa usa todo el ancho. Misma URL y lógica que la
// barra lateral de la vista lista.
export function PropertyFilterBar({ types, amenities, cities }: Props) {
  const { toggle, clear, activeCount, searchParams } = useFilterParams();

  const pill = (
    name: string,
    label: string,
    Icon: React.ElementType,
    options: Option[],
    multi = false,
  ) => {
    const raw = searchParams.get(name) ?? "";
    const selected = multi ? raw.split(",").filter(Boolean) : raw ? [raw] : [];
    const summary =
      selected.length === 0
        ? label
        : multi
          ? `${label} · ${selected.length}`
          : (options.find((o) => o.value === selected[0])?.label ?? label);

    return (
      <Popover key={name}>
        <PopoverTrigger asChild>
          <button
            type="button"
            className={cn(
              "inline-flex h-10 shrink-0 items-center gap-2 rounded-full border px-3.5 text-sm font-medium transition",
              selected.length
                ? "border-zinc-900 bg-zinc-900 text-white"
                : "border-zinc-200 bg-white text-zinc-800 hover:border-zinc-400",
            )}
          >
            <Icon className={cn("h-4 w-4", selected.length ? "text-white/80" : "text-zinc-400")} />
            {summary}
            <ChevronDown className="h-4 w-4 opacity-70" />
          </button>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-64 p-1.5">
          <ul className="max-h-72 overflow-y-auto">
            {options.map((o) => {
              const on = selected.includes(o.value);
              return (
                <li key={o.value}>
                  <button
                    type="button"
                    onClick={() => toggle(name, o.value)}
                    className={cn(
                      "flex w-full items-center justify-between gap-2 rounded-md px-2.5 py-2 text-left text-sm transition-colors hover:bg-zinc-100",
                      on && "font-semibold",
                    )}
                  >
                    {o.label}
                    {on && <Check className="h-4 w-4" />}
                  </button>
                </li>
              );
            })}
          </ul>
          {selected.length > 0 && (
            <button
              type="button"
              onClick={() => clear([name])}
              className="mt-1 w-full rounded-md border-t border-zinc-100 px-2.5 py-2 text-left text-xs text-zinc-500 hover:text-zinc-900"
            >
              Quitar filtro
            </button>
          )}
        </PopoverContent>
      </Popover>
    );
  };

  return (
    <div className="-mx-4 flex items-center gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] md:mx-0 md:flex-wrap md:overflow-visible md:px-0 [&::-webkit-scrollbar]:hidden">
      {pill("tipo", "Operación", Tag, [
        { value: "venta", label: "Venta" },
        { value: "alquiler", label: "Alquiler" },
      ])}
      {pill(
        "typeId",
        "Tipo",
        Building2,
        types.map((t) => ({ value: String(t.id), label: t.name })),
      )}
      {pill(
        "loc",
        "Ubicación",
        MapPin,
        cities.map((c) => ({ value: c, label: c })),
      )}
      {pill(
        "bedrooms",
        "Dormitorios",
        BedDouble,
        [1, 2, 3, 4].map((n) => ({ value: String(n), label: `${n}+ dormitorios` })),
      )}
      {pill(
        "bathrooms",
        "Baños",
        Bath,
        [1, 2, 3].map((n) => ({ value: String(n), label: `${n}+ baños` })),
      )}
      {pill(
        "amenities",
        "Amenities",
        Sparkles,
        amenities.map((a) => ({ value: String(a.id), label: a.name })),
        true,
      )}
      {activeCount > 0 && (
        <button
          type="button"
          onClick={() => clear()}
          className="inline-flex h-10 shrink-0 items-center gap-1 rounded-full px-3 text-sm font-medium text-zinc-600 hover:text-zinc-900"
        >
          <X className="h-4 w-4" />
          Limpiar ({activeCount})
        </button>
      )}
    </div>
  );
}
