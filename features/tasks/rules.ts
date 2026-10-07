// Motor de tareas: tipos y metadatos puros, compartidos por el servidor y
// la vista. Las reglas viven en la tabla task_rules (las edita el admin);
// acá está lo que no es configurable: a dónde lleva cada una y cómo se
// cierra sola.

export type TaskStatus = "PENDIENTE" | "HECHA" | "CANCELADA";
export type TaskPriority = "alta" | "media" | "baja";

export type RuleKey = "PROP_COMPRADORES" | "PROP_FICHA" | "PROP_INSTAGRAM" | "PROP_PORTALES" | "PROP_CARTEL";

export const PRIORITY_LABELS: Record<TaskPriority, string> = { alta: "Alta", media: "Media", baja: "Baja" };

export const ROLE_LABELS: Record<string, string> = {
  admin: "Administrador",
  agente: "Agente",
  administracion: "Administración",
};
export const roleLabel = (role: string | null | undefined) => ROLE_LABELS[role ?? "agente"] ?? "Agente";

// Ficha completa: lo mismo que pide la regla PROP_FICHA.
export const LISTING_MIN_PHOTOS = 5;
export const LISTING_MIN_DESCRIPTION = 200;

export function listingGaps(photos: number, description: string | null) {
  const gaps: string[] = [];
  const missing = LISTING_MIN_PHOTOS - photos;
  if (missing > 0) gaps.push(missing === 1 ? "falta 1 foto" : `faltan ${missing} fotos`);
  if ((description ?? "").trim().length < LISTING_MIN_DESCRIPTION) gaps.push("descripción corta");
  return gaps;
}

// Acción principal de una tarea del motor, según la regla.
export function ruleAction(rule: string | null, propertyId: string | null): { label: string; href: string } | null {
  if (!propertyId) return null;
  switch (rule) {
    case "PROP_COMPRADORES": return { label: "Ver compradores", href: `/dashboard/propiedades/${propertyId}#compradores` };
    case "PROP_FICHA": return { label: "Completar", href: `/dashboard/propiedades/editar/${propertyId}` };
    case "PROP_INSTAGRAM": return { label: "Generar pieza", href: `/dashboard/propiedades/instagram/${propertyId}` };
    case "PROP_PORTALES": return { label: "Ver en el sitio", href: `/propiedades/${propertyId}` };
    default: return null;
  }
}

// Las que además se cierran solas cuando el dato lo confirma (igual se
// pueden marcar hechas a mano).
export const AUTO_RULES = new Set<string>(["PROP_COMPRADORES", "PROP_FICHA"]);
