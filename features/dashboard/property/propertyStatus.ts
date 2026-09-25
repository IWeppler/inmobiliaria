import { Tag, KeyRound, Clock, CheckCircle2, Home } from "lucide-react";
import type { StatusIconComponent, StatusTone } from "@/shared/components/StatusBadge";

// Fuente única de metadata de estado de propiedad. Tono semántico:
// disponible = success, en transición = warning, cerrada = neutral.
export type PropertyStatus =
  | "EN_VENTA"
  | "EN_ALQUILER"
  | "RESERVADO"
  | "VENDIDO"
  | "ALQUILADO";

// Cada estado tiene color propio (ícono, borde del badge, donut): son 5
// categorías que se leen juntas, no 5 niveles de un mismo semáforo. Se usa
// la paleta categórica de gráficos de globals.css (--chart-1..5).
export const PROPERTY_STATUSES: {
  value: PropertyStatus;
  label: string;
  icon: StatusIconComponent;
  tone: StatusTone;
  color: string;
}[] = [
  { value: "EN_VENTA", label: "En venta", icon: Tag, tone: "success", color: "var(--chart-3)" },
  { value: "EN_ALQUILER", label: "En alquiler", icon: KeyRound, tone: "info", color: "var(--chart-1)" },
  { value: "RESERVADO", label: "Reservado", icon: Clock, tone: "warning", color: "var(--chart-4)" },
  { value: "VENDIDO", label: "Vendido", icon: CheckCircle2, tone: "neutral", color: "var(--chart-2)" },
  { value: "ALQUILADO", label: "Alquilado", icon: Home, tone: "neutral", color: "var(--chart-5)" },
];

const byValue = Object.fromEntries(PROPERTY_STATUSES.map((s) => [s.value, s]));

export function propertyStatusMeta(status: string | null | undefined) {
  return (
    byValue[status ?? ""] ?? {
      value: status,
      label: status ?? "—",
      icon: Tag,
      tone: "neutral" as StatusTone,
      color: "var(--neutral-vivid)",
    }
  );
}

export const OPERATION_LABELS: Record<string, string> = {
  venta: "Venta",
  alquiler: "Alquiler",
};

export function operationLabel(op: string | null | undefined) {
  if (!op) return "—";
  return OPERATION_LABELS[op.toLowerCase()] ?? op;
}

// "USD 140.000" — sin "$", con separador de miles es-AR, tabular en CSS.
export function formatPrice(price: number | null | undefined, currency: string | null | undefined) {
  if (typeof price !== "number" || price <= 0) return null;
  return `${currency ?? ""} ${new Intl.NumberFormat("es-AR", { maximumFractionDigits: 0 }).format(price)}`.trim();
}
