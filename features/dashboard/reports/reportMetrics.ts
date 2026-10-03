export type LeadHistoryEntry = { status: string; changed_at: string };

const SEQUENCE = [
  "CONTACTADO",
  "VISITA PROGRAMADA",
  "NEGOCIACIÓN",
  "CERRADO",
] as const;

// Solo cuenta pasos efectivamente registrados y en orden. Un salto de
// NUEVO a VISITA PROGRAMADA no inventa un contacto previo.
export function leadJourney(
  history: LeadHistoryEntry[],
  currentStatus: string,
) {
  const ordered = [...history].sort((a, b) =>
    a.changed_at.localeCompare(b.changed_at),
  );
  const reached = new Set(ordered.map((entry) => entry.status));
  let progress = 0;
  for (const entry of ordered) {
    if (entry.status === SEQUENCE[progress]) progress += 1;
  }
  // Un cierre histórico reabierto ya no se informa como cierre actual.
  const historicalProgress = progress;
  if (currentStatus !== "CERRADO") progress = Math.min(progress, 3);
  return {
    progress,
    historicalProgress,
    reachedContact: reached.has("CONTACTADO"),
    reachedVisit: reached.has("VISITA PROGRAMADA"),
    reachedNegotiation: reached.has("NEGOCIACIÓN"),
    firstContactAt:
      ordered.find((entry) => entry.status === "CONTACTADO")?.changed_at ??
      null,
  };
}

export function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const ordered = [...values].sort((a, b) => a - b);
  const center = Math.floor(ordered.length / 2);
  return ordered.length % 2
    ? ordered[center]
    : (ordered[center - 1] + ordered[center]) / 2;
}

// Fuentes de lead normalizadas: la clave canónica y su nombre visible.
export const SOURCE_LABELS = [
  ["ZONAPROP", "Zonaprop"],
  ["ARGENPROP", "Argenprop"],
  ["MERCADOLIBRE", "MercadoLibre"],
  ["INSTAGRAM", "Instagram"],
  ["FACEBOOK", "Facebook"],
  ["WEB", "Web"],
  ["WHATSAPP", "WhatsApp directo"],
  ["REFERIDO", "Referido"],
  ["CARTEL_OFICINA", "Cartel/Oficina"],
  ["TELEFONO", "Teléfono"],
  ["EMAIL", "Email"],
  ["OTROS", "Otros"],
  ["SIN_REGISTRAR", "Sin origen"],
] as const;

export function sourceKey(source: string | null): string {
  if (!source?.trim()) return "SIN_REGISTRAR";
  const normalized = (source ?? "")
    .trim()
    .toUpperCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[\s/-]+/g, "_");
  if (
    [
      "ZONAPROP",
      "ARGENPROP",
      "INSTAGRAM",
      "FACEBOOK",
      "REFERIDO",
      "TELEFONO",
      "EMAIL",
    ].includes(normalized)
  )
    return normalized;
  if (["MERCADOLIBRE", "MERCADO_LIBRE", "ML"].includes(normalized))
    return "MERCADOLIBRE";
  if (["WHATSAPP", "WHATSAPP_DIRECTO", "WA"].includes(normalized))
    return "WHATSAPP";
  if (["CARTEL", "OFICINA", "CARTEL_OFICINA"].includes(normalized))
    return "CARTEL_OFICINA";
  if (["WEB", "CONTACTO", "BOOKING", "SITIO_WEB"].includes(normalized))
    return "WEB";
  return "OTROS";
}
