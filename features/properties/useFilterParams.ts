"use client";

import { useCallback } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

// Filtros del listado público en la URL. Compartido por la barra lateral
// (vista lista) y la barra superior (vista mapa) para que ambas se
// comporten igual.
export const FILTER_KEYS = ["tipo", "typeId", "loc", "bedrooms", "bathrooms", "amenities"] as const;

// Filtros que admiten varios valores a la vez.
const MULTI_KEYS: string[] = ["amenities", "loc"];

export function useFilterParams() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const push = useCallback(
    (params: URLSearchParams) => {
      const qs = params.toString();
      router.push(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    [router, pathname],
  );

  // Valor único: si ya estaba seleccionado se quita. amenities y loc son
  // listas separadas por comas y alternan cada valor.
  const toggle = useCallback(
    (name: string, value: string) => {
      const params = new URLSearchParams(searchParams.toString());
      if (MULTI_KEYS.includes(name)) {
        const current = params.get(name)?.split(",").filter(Boolean) ?? [];
        const next = current.includes(value)
          ? current.filter((id) => id !== value)
          : [...current, value];
        if (next.length) params.set(name, next.join(","));
        else params.delete(name);
      } else if (params.get(name) === value) {
        params.delete(name);
      } else {
        params.set(name, value);
      }
      push(params);
    },
    [searchParams, push],
  );

  const clear = useCallback(
    (names: readonly string[] = FILTER_KEYS) => {
      const params = new URLSearchParams(searchParams.toString());
      for (const n of names) params.delete(n);
      push(params);
    },
    [searchParams, push],
  );

  const activeCount = FILTER_KEYS.reduce((n, key) => {
    const v = searchParams.get(key);
    if (!v) return n;
    return n + (MULTI_KEYS.includes(key) ? v.split(",").filter(Boolean).length : 1);
  }, 0);

  return { toggle, clear, activeCount, searchParams };
}
