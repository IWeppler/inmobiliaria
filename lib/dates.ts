// Fechas de calendario (events.date). El Calendar del dashboard guarda
// "medianoche local del navegador" como ISO -- para agentes en Argentina
// eso es 03:00Z. El servidor (Vercel) corre en UTC, así que todo cálculo
// de "hoy" o "inicio del día" hecho en servidor tiene que usar la zona de
// la inmobiliaria, no la del proceso. Un solo TZ por deployment (white
// label, no multi-región).
export const APP_TZ = process.env.NEXT_PUBLIC_APP_TZ ?? "America/Argentina/Buenos_Aires";
const APP_UTC_OFFSET = process.env.NEXT_PUBLIC_APP_UTC_OFFSET ?? "-03:00";

// "2026-09-15" en la zona de la app para un instante dado.
export function ymdInAppTz(date: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: APP_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

// ISO de la medianoche local de ese día (lo que guarda events.date).
export function dayStartISO(ymd: string): string {
  return new Date(`${ymd}T00:00:00${APP_UTC_OFFSET}`).toISOString();
}

export function dayEndISO(ymd: string): string {
  return new Date(`${ymd}T23:59:59.999${APP_UTC_OFFSET}`).toISOString();
}

export function addDays(ymd: string, days: number): string {
  const d = new Date(`${ymd}T12:00:00${APP_UTC_OFFSET}`);
  d.setUTCDate(d.getUTCDate() + days);
  return ymdInAppTz(d);
}

// 0 = domingo ... 6 = sábado, en la zona de la app.
export function weekdayInAppTz(ymd: string): number {
  const d = new Date(`${ymd}T12:00:00${APP_UTC_OFFSET}`);
  const name = new Intl.DateTimeFormat("en-US", {
    timeZone: APP_TZ,
    weekday: "short",
  }).format(d);
  return ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(name);
}
