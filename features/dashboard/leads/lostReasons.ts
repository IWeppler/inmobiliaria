// Motivos de pérdida de un lead. Las claves matchean el check de
// leads.lost_reason (migración 20261003120000_lead_lost_reason). El orden es
// el del selector al descartar: primero los motivos comerciales.
export const LOST_REASONS = [
  { value: "PRECIO", label: "Precio fuera de su presupuesto" },
  { value: "FINANCIACION", label: "No consiguió financiación" },
  { value: "OTRA_PROPIEDAD", label: "Eligió otra propiedad" },
  { value: "NO_CUMPLE", label: "La propiedad no cumple lo que busca" },
  { value: "NO_RESPONDE", label: "Dejó de responder" },
  { value: "POSTERGO", label: "Postergó la búsqueda" },
  { value: "NO_CALIFICA", label: "No califica (garantía, requisitos)" },
  { value: "DUPLICADO", label: "Duplicado o dato inválido" },
  { value: "OTRO", label: "Otro motivo" },
] as const;

export type LostReason = (typeof LOST_REASONS)[number]["value"];

export function lostReasonLabel(value: string | null | undefined) {
  return LOST_REASONS.find((reason) => reason.value === value)?.label ?? null;
}
