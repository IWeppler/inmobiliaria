import "server-only";
import { supabaseAdmin } from "@/lib/supabase-admin";
import {
  addDays,
  dayStartISO,
  dayEndISO,
  weekdayInAppTz,
  ymdInAppTz,
} from "@/lib/dates";

// E3.2 — Disponibilidad para la booking page pública. Reglas fijas por
// ahora (sin configuración por agente): lunes a sábado, turnos de 1 h de
// 09:00 a 18:00 (sin 13:00), hasta 14 días hacia adelante, y nunca con
// menos de 2 h de anticipación. Un turno está ocupado si el agente ya
// tiene cualquier evento a esa fecha y hora (visita o no).
export const BOOKING_DAYS_AHEAD = 14;
export const BOOKING_SLOTS = [
  "09:00",
  "10:00",
  "11:00",
  "12:00",
  "14:00",
  "15:00",
  "16:00",
  "17:00",
  "18:00",
];
const MIN_LEAD_HOURS = 2;
const OFFSET = process.env.NEXT_PUBLIC_APP_UTC_OFFSET ?? "-03:00";

export type DayAvailability = {
  ymd: string;
  weekday: number;
  slots: { time: string; available: boolean }[];
};

export async function getAvailability(
  agentId: string
): Promise<DayAvailability[]> {
  const now = new Date();
  const todayYmd = ymdInAppTz(now);
  const lastYmd = addDays(todayYmd, BOOKING_DAYS_AHEAD);

  const { data: events } = await supabaseAdmin
    .from("events")
    .select("date, time")
    .eq("agent_id", agentId)
    .gte("date", dayStartISO(todayYmd))
    .lte("date", dayEndISO(lastYmd));

  const busy = new Set(
    (events ?? []).map(
      (e) => `${ymdInAppTz(new Date(e.date))} ${e.time.slice(0, 5)}`
    )
  );

  const days: DayAvailability[] = [];
  for (let i = 0; i <= BOOKING_DAYS_AHEAD; i++) {
    const ymd = addDays(todayYmd, i);
    const weekday = weekdayInAppTz(ymd);
    if (weekday === 0) continue; // domingo

    const slots = BOOKING_SLOTS.map((time) => {
      const slotStart = new Date(`${ymd}T${time}:00${OFFSET}`);
      const tooSoon =
        slotStart.getTime() - now.getTime() < MIN_LEAD_HOURS * 3600 * 1000;
      return { time, available: !tooSoon && !busy.has(`${ymd} ${time}`) };
    });
    days.push({ ymd, weekday, slots });
  }
  return days;
}

export function isSlotBookable(
  days: DayAvailability[],
  ymd: string,
  time: string
) {
  return days.some(
    (d) =>
      d.ymd === ymd && d.slots.some((s) => s.time === time && s.available)
  );
}
