// Días enteros desde una fecha ISO; null si no hay fecha.
export function daysAgo(iso: string | null | undefined, now = new Date()) {
  if (!iso) return null;
  return Math.max(0, Math.floor((now.getTime() - new Date(iso).getTime()) / 86_400_000));
}

// Pasado este plazo sin confirmar, una búsqueda se considera vencida (y pesa menos en el matching).
export const STALE_DAYS = 180;
