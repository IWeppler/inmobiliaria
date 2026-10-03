// Resultado de contactar a un comprador por una propiedad.
export const OUTCOMES = [
  { value: "contactado", label: "Contactado" },
  { value: "respondio", label: "Respondió" },
  { value: "visita", label: "Visita" },
  { value: "no_interesado", label: "No interesado" },
] as const;

export type Outcome = (typeof OUTCOMES)[number]["value"];

export const outcomeLabel = (v: string | null | undefined) =>
  OUTCOMES.find((o) => o.value === v)?.label ?? null;

// Motivos de "no interesado": ayudan a ajustar la búsqueda del lead.
export const NO_INTEREST_REASONS = [
  { value: "precio", label: "Precio" },
  { value: "zona", label: "Zona" },
  { value: "otro", label: "Otro" },
] as const;
