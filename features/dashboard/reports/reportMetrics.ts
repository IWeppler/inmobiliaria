export type LeadHistoryEntry = { status: string; changed_at: string };

const SEQUENCE = ["CONTACTADO", "VISITA PROGRAMADA", "NEGOCIACIÓN", "CERRADO"] as const;

// Solo cuenta pasos efectivamente registrados y en orden. Un salto de
// NUEVO a VISITA PROGRAMADA no inventa un contacto previo.
export function leadJourney(history: LeadHistoryEntry[], currentStatus: string) {
  const ordered = [...history].sort((a, b) => a.changed_at.localeCompare(b.changed_at));
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
    firstContactAt: ordered.find((entry) => entry.status === "CONTACTADO")?.changed_at ?? null,
  };
}

export function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const ordered = [...values].sort((a, b) => a - b);
  const center = Math.floor(ordered.length / 2);
  return ordered.length % 2 ? ordered[center] : (ordered[center - 1] + ordered[center]) / 2;
}
