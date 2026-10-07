import type { RiskLevel, TaskAction, TaskUrgency } from "@/features/rentals/tasks";

// Bandeja "Hoy" unificada: ventas + alquileres en una sola lista
// priorizada. Tipos puros, compartidos por el armado (servidor) y la vista.

// "general": tareas manuales sin propiedad, lead ni contrato.
export type TodayArea = "ventas" | "alquileres" | "general";

export type TodayCategory =
  // Ventas
  | "consultas" | "seguimiento" | "visitas" | "compradores" | "propiedades" | "operaciones" | "captaciones"
  // Alquileres (mismas categorías que su bandeja)
  | "mensajes" | "cobranzas" | "ajustes" | "liquidaciones" | "contratos" | "mantenimiento"
  // Motor de tareas: las cargadas a mano
  | "tareas";

export type TodayAction =
  | TaskAction
  | { type: "complete"; leadId: string; label: string }
  | { type: "task-done"; taskId: string; label: string };

export type TodayTask = {
  key: string;
  /** Tarea guardada del motor (las demás se derivan de los datos). */
  taskId?: string;
  area: TodayArea;
  category: TodayCategory;
  urgency: TaskUrgency;
  score: number;
  title: string;
  detail: string;
  /** Entidad principal (lead, propiedad, contrato) para el link "ver". */
  link?: { href: string; label: string };
  risk?: RiskLevel;
  actions: TodayAction[];
};

export const TODAY_CATEGORY_LABELS: Record<TodayCategory, string> = {
  consultas: "Consultas",
  seguimiento: "Seguimiento",
  visitas: "Visitas",
  compradores: "Compradores",
  propiedades: "Propiedades",
  operaciones: "Operaciones",
  captaciones: "Captaciones",
  mensajes: "Mensajes",
  cobranzas: "Cobranzas",
  ajustes: "Ajustes",
  liquidaciones: "Liquidaciones",
  contratos: "Contratos",
  mantenimiento: "Mantenimiento",
  tareas: "Tarea",
};

export const AREA_LABELS: Record<TodayArea, string> = { ventas: "Ventas", alquileres: "Alquileres", general: "Generales" };
