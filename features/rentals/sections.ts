// Secciones del módulo de alquileres. Las usan el panel lateral (desktop) y
// las pestañas (mobile), así que viven en un módulo neutro.

export const RENTALS_BASE = "/dashboard/alquileres";

export type RentalSection = {
  href: string;
  label: string;
  group: string | null;
  countKey?: "rentals";
};

// Orden de las pestañas en mobile.
export const RENTAL_SECTIONS: RentalSection[] = [
  { href: `${RENTALS_BASE}/hoy`, label: "Hoy", group: null, countKey: "rentals" },
  { href: RENTALS_BASE, label: "Contratos", group: "Cartera" },
  { href: `${RENTALS_BASE}/cobranzas`, label: "Cobranzas", group: "Cobros y pagos" },
  { href: `${RENTALS_BASE}/conciliacion`, label: "Conciliación", group: "Cobros y pagos" },
  { href: `${RENTALS_BASE}/propietarios`, label: "Liquidaciones", group: "Cobros y pagos" },
  { href: `${RENTALS_BASE}/mantenimiento`, label: "Mantenimiento", group: "Operación" },
  { href: `${RENTALS_BASE}/contactos`, label: "Contactos", group: "Cartera" },
];

// Agrupado para el panel lateral, en este orden.
export const RENTAL_SECTION_GROUPS = [null, "Cartera", "Cobros y pagos", "Operación"].map((group) => ({
  label: group,
  items: RENTAL_SECTIONS.filter((s) => s.group === group),
}));

// Contratos cubre el listado, el alta y el detalle de cada contrato; el resto,
// su propia ruta y lo que cuelga de ella.
export function isRentalSectionActive(pathname: string, section: RentalSection) {
  if (section.href !== RENTALS_BASE) return pathname === section.href || pathname.startsWith(`${section.href}/`);
  if (pathname === RENTALS_BASE) return true;
  if (!pathname.startsWith(`${RENTALS_BASE}/`)) return false;
  return !RENTAL_SECTIONS.some((s) => s.href !== RENTALS_BASE && (pathname === s.href || pathname.startsWith(`${s.href}/`)));
}
