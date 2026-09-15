import {
  Sparkles,
  PhoneCall,
  CalendarClock,
  Handshake,
  CheckCircle2,
  XCircle,
  Circle,
  Flame,
  Thermometer,
  Snowflake,
} from "lucide-react";
import type { Database } from "@/app/types/supabase";

export type LeadStatus = Database["public"]["Enums"]["lead_status"];

export type StatusIcon = React.ComponentType<{
  className?: string;
  style?: React.CSSProperties;
}>;

// Fuente única de verdad para la metadata de estados de lead (antes vivía
// duplicada en LeadTable y LeadDetailClient). Las claves matchean el enum
// "lead_status" de la DB tal cual, con espacio y tilde incluidos:
// "VISITA PROGRAMADA" y "NEGOCIACIÓN". El orden del array es el orden de
// las columnas del Kanban y del funnel.
export const LEAD_STATUSES: {
  value: LeadStatus;
  label: string;
  icon: StatusIcon;
  color: string;
  bg: string;
}[] = [
  {
    value: "NUEVO",
    label: "Nuevo",
    icon: Sparkles,
    color: "var(--color-lead-nuevo)",
    bg: "var(--color-lead-nuevo-bg)",
  },
  {
    value: "CONTACTADO",
    label: "Contactado",
    icon: PhoneCall,
    color: "var(--color-lead-contactado)",
    bg: "var(--color-lead-contactado-bg)",
  },
  {
    value: "VISITA PROGRAMADA",
    label: "Visita Programada",
    icon: CalendarClock,
    color: "var(--color-lead-visita)",
    bg: "var(--color-lead-visita-bg)",
  },
  {
    value: "NEGOCIACIÓN",
    label: "Negociación",
    icon: Handshake,
    color: "var(--color-lead-negociacion)",
    bg: "var(--color-lead-negociacion-bg)",
  },
  {
    value: "CERRADO",
    label: "Cerrado",
    icon: CheckCircle2,
    color: "var(--color-lead-cerrado)",
    bg: "var(--color-lead-cerrado-bg)",
  },
  {
    value: "DESCARTADO",
    label: "Descartado",
    icon: XCircle,
    color: "var(--color-lead-descartado)",
    bg: "var(--color-lead-descartado-bg)",
  },
];

const byValue = Object.fromEntries(LEAD_STATUSES.map((s) => [s.value, s]));

// leads.status es nullable: null se trata como NUEVO en toda la app.
export function normalizeStatus(status: string | null | undefined): LeadStatus {
  return (status && byValue[status] ? status : "NUEVO") as LeadStatus;
}

export function statusMeta(status: string | null | undefined) {
  return byValue[normalizeStatus(status)];
}

export const statusLabels: Record<string, string> = Object.fromEntries(
  LEAD_STATUSES.map((s) => [s.value, s.label])
);

export const statusIcons: Record<string, StatusIcon> = Object.fromEntries(
  LEAD_STATUSES.map((s) => [s.value, s.icon])
);

export const statusIconColors: Record<string, string> = Object.fromEntries(
  LEAD_STATUSES.map((s) => [s.value, s.color])
);

export const FallbackStatusIcon = Circle;

export const TERMINAL_STATUSES: LeadStatus[] = ["CERRADO", "DESCARTADO"];

export function isTerminal(status: string | null | undefined) {
  return TERMINAL_STATUSES.includes(normalizeStatus(status));
}

// === E1.8 — Temperatura automática ===
// Reglas simples (sin IA) a partir de la última interacción y el estado.
// "Última interacción" = máximo entre creación del lead, último cambio de
// status (status_history) y última nota (lead_notes).
//
//   caliente: en VISITA PROGRAMADA o NEGOCIACIÓN con actividad en los
//             últimos 7 días.
//   frío:     sin actividad hace más de 14 días (cualquier estado abierto).
//   tibio:    todo lo demás.
//   null:     estados terminales (CERRADO / DESCARTADO) -- no aplica.
export type LeadTemperature = "caliente" | "tibio" | "frio";

const DAY_MS = 24 * 60 * 60 * 1000;

export function getLeadTemperature(
  status: string | null | undefined,
  lastActivityAt: string | Date,
  now: Date = new Date()
): LeadTemperature | null {
  const s = normalizeStatus(status);
  if (isTerminal(s)) return null;

  const daysSince =
    (now.getTime() - new Date(lastActivityAt).getTime()) / DAY_MS;

  if (
    (s === "VISITA PROGRAMADA" || s === "NEGOCIACIÓN") &&
    daysSince <= 7
  ) {
    return "caliente";
  }
  if (daysSince > 14) return "frio";
  return "tibio";
}

export const TEMPERATURE_META: Record<
  LeadTemperature,
  { label: string; icon: StatusIcon; className: string }
> = {
  caliente: {
    label: "Caliente",
    icon: Flame,
    className: "text-orange-600 bg-orange-50 border-orange-200",
  },
  tibio: {
    label: "Tibio",
    icon: Thermometer,
    className: "text-amber-600 bg-amber-50 border-amber-200",
  },
  frio: {
    label: "Frío",
    icon: Snowflake,
    className: "text-sky-600 bg-sky-50 border-sky-200",
  },
};

export function daysBetween(from: string | Date, to: Date = new Date()) {
  return Math.max(
    0,
    Math.floor((to.getTime() - new Date(from).getTime()) / DAY_MS)
  );
}
