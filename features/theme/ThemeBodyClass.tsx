"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

// Rutas ya migradas al nuevo design system ("tinta y papel"). Se van sumando
// acá a medida que se migra cada pantalla nueva (Etapas 3, 4, 5, ...).
const MIGRATED_ROUTES = [
  "/dashboard",
  "/dashboard/ajustes",
  "/dashboard/agentes",
  "/dashboard/propiedades/nueva",
  "/dashboard/propiedades/editar",
  "/dashboard/leads",
];

function isMigratedRoute(pathname: string): boolean {
  return MIGRATED_ROUTES.some((route) => {
    if (pathname === route) return true;
    // "/dashboard" es la home del panel: es una ruta hoja, no un namespace.
    // Matchearla por prefijo capturaría /dashboard/leads, /dashboard/propiedades,
    // etc. — justamente las rutas que todavía NO están migradas, ya que en esta
    // app todas las secciones del panel cuelgan de ese mismo prefijo de URL.
    // Las demás entradas sí pueden tener sub-rutas dinámicas propias (ej. un
    // futuro ".../editar/[id]"), así que para esas sí matcheamos por prefijo.
    if (route === "/dashboard") return false;
    return pathname.startsWith(`${route}/`);
  });
}

// Aplica/retira la clase theme-tn en <body> según la ruta activa, para que
// el contenido que Radix portea fuera del árbol de la página (Dialog, Select,
// DropdownMenu) también herede el scope de tokens — sin tocar los primitivos
// de shadcn/ui.
export function ThemeBodyClass() {
  const pathname = usePathname();

  useEffect(() => {
    if (isMigratedRoute(pathname)) {
      document.body.classList.add("theme-tn");
    }
    return () => {
      document.body.classList.remove("theme-tn");
    };
  }, [pathname]);

  return null;
}
