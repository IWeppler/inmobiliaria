import type { StatusTone } from "@/shared/components/StatusBadge";

// CRM: próximo paso del lead y resultado de las visitas. Módulo puro,
// compartido entre el detalle del lead, la ficha de propiedad y la bandeja.

export type VisitOutcome = "INTERESADO" | "SEGUNDA_VISITA" | "CARO" | "NO_LE_GUSTO" | "NO_ASISTIO" | "OTRO";

export const OUTCOME_LABELS: Record<VisitOutcome, string> = {
  INTERESADO: "Quedó interesado",
  SEGUNDA_VISITA: "Quiere volver",
  CARO: "Le pareció caro",
  NO_LE_GUSTO: "No le gustó",
  NO_ASISTIO: "No vino",
  OTRO: "Otro",
};

export const OUTCOME_TONE: Record<VisitOutcome, StatusTone> = {
  INTERESADO: "success",
  SEGUNDA_VISITA: "info",
  CARO: "warning",
  NO_LE_GUSTO: "neutral",
  NO_ASISTIO: "danger",
  OTRO: "neutral",
};

// Próximo paso sugerido según cómo salió la visita (el agente lo puede cambiar).
export const OUTCOME_NEXT_STEP: Record<VisitOutcome, { action: string; inDays: number } | null> = {
  INTERESADO: { action: "Llamar para avanzar con una propuesta", inDays: 2 },
  SEGUNDA_VISITA: { action: "Coordinar la segunda visita", inDays: 1 },
  CARO: { action: "Ofrecer propiedades en su presupuesto", inDays: 3 },
  NO_LE_GUSTO: { action: "Enviar otras opciones compatibles", inDays: 3 },
  NO_ASISTIO: { action: "Contactar para reprogramar la visita", inDays: 1 },
  OTRO: null,
};

export const NEXT_ACTION_PRESETS = [
  "Llamar",
  "Enviar propiedades",
  "Confirmar visita",
  "Pedir respuesta",
  "Enviar propuesta",
];

export const DUE_PRESETS = [
  { label: "Hoy", days: 0 },
  { label: "Mañana", days: 1 },
  { label: "En 3 días", days: 3 },
  { label: "En una semana", days: 7 },
];

export type NextActionState = "vencido" | "hoy" | "pendiente" | "sin_definir";

export function nextActionState(at: string | null | undefined, today: string): NextActionState {
  if (!at) return "sin_definir";
  if (at < today) return "vencido";
  return at === today ? "hoy" : "pendiente";
}

// Estados donde el lead sigue abierto y necesita un próximo paso.
export const OPEN_LEAD_STATUSES = ["NUEVO", "CONTACTADO", "VISITA PROGRAMADA", "NEGOCIACIÓN"];
