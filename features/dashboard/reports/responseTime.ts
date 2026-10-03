// Tiempo de primera respuesta a un lead, contado en horas hábiles. Se calcula
// al leer a partir de datos que ya existen (alta del lead, notas del asesor y
// cambios de estado): no hay nada que guardar ni proceso en segundo plano.

// Horario de atención: lunes a sábado, 9 a 18 hs, hora argentina (UTC-3,
// sin horario de verano). Es el mismo que usa la página de reservas.
const OFFSET_MS = 3 * 3_600_000;
const OPEN_MIN = 9 * 60;
const CLOSE_MIN = 18 * 60;
const DAY_MS = 86_400_000;

// Minutos hábiles entre dos instantes. Un lead que entra a las 23 hs no
// "tarda" toda la noche: el reloj arranca cuando abre la oficina.
export function businessMinutes(from: Date, to: Date): number {
  if (to <= from) return 0;
  // Se trabaja en "hora local como UTC" para poder usar los getters UTC.
  const start = from.getTime() - OFFSET_MS;
  const end = to.getTime() - OFFSET_MS;
  let total = 0;
  for (
    let day = Math.floor(start / DAY_MS) * DAY_MS;
    day <= end && total < 1e7;
    day += DAY_MS
  ) {
    if (new Date(day).getUTCDay() === 0) continue; // domingo cerrado
    const open = day + OPEN_MIN * 60_000;
    const close = day + CLOSE_MIN * 60_000;
    const overlap = Math.min(end, close) - Math.max(start, open);
    if (overlap > 0) total += overlap / 60_000;
  }
  return total;
}

// Respuesta dentro de este tiempo hábil se considera "a tiempo".
export const ON_TIME_MINUTES = 120;

export type ResponseLead = {
  id: string;
  created_at: string;
  created_by: string | null;
  source: string | null;
  agent_id: string | null;
};

// Solo cuentan las consultas que entraron solas (formularios, WhatsApp,
// alertas): las que carga un asesor a mano ya nacen atendidas. Las reservas
// de visita tampoco: el comprador ya agendó y no espera respuesta.
export function isMeasurable(lead: ResponseLead): boolean {
  return (
    lead.created_by === null &&
    (lead.source ?? "").trim().toUpperCase() !== "BOOKING"
  );
}

const EPSILON_MS = 5_000;

// Primer momento en que un asesor respondió: su primera nota o el primer
// cambio de estado posterior al alta (el estado inicial se registra en el
// mismo instante de la creación y no cuenta).
export function firstResponseAt(
  lead: Pick<ResponseLead, "created_at">,
  agentNotes: string[],
  history: { status: string; changed_at: string }[],
): string | null {
  const created = new Date(lead.created_at).getTime();
  const candidates = [
    ...agentNotes,
    ...history
      .filter(
        (h) =>
          h.status !== "NUEVO" &&
          new Date(h.changed_at).getTime() - created > EPSILON_MS,
      )
      .map((h) => h.changed_at),
  ].sort();
  return candidates[0] ?? null;
}

export type ResponseGroup = {
  key: string;
  label: string;
  total: number;
  answered: number;
  pending: number;
  medianMinutes: number | null;
  onTimePct: number | null; // % de respondidas a tiempo
};

type Sample = { minutes: number; answered: boolean };

function median(values: number[]): number | null {
  if (!values.length) return null;
  const s = [...values].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

// Con menos respuestas que esto, la mediana y el porcentaje no se muestran.
export const MIN_RESPONSES = 5;

export function summarize(
  key: string,
  label: string,
  samples: Sample[],
): ResponseGroup {
  const answered = samples.filter((s) => s.answered);
  const enough = answered.length >= MIN_RESPONSES;
  return {
    key,
    label,
    total: samples.length,
    answered: answered.length,
    pending: samples.length - answered.length,
    medianMinutes: enough ? median(answered.map((s) => s.minutes)) : null,
    onTimePct: enough
      ? (answered.filter((s) => s.minutes <= ON_TIME_MINUTES).length /
          answered.length) *
        100
      : null,
  };
}
