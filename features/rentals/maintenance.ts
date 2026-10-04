import type { StatusTone } from "@/shared/components/StatusBadge";

// Tipos y etiquetas de mantenimiento compartidos entre páginas de servidor
// y componentes de cliente (por eso no viven en MaintenanceCard).
export type MaintenancePriority = "BAJA" | "MEDIA" | "ALTA" | "URGENTE";
export type MaintenanceStatus = "ABIERTO" | "EN_CURSO" | "RESUELTO" | "CANCELADO";
export type MaintenancePayer = "INQUILINO" | "PROPIETARIO" | "INMOBILIARIA";

export type MaintenanceItem = {
  id: string; title: string; description: string | null; priority: MaintenancePriority; status: MaintenanceStatus;
  payer: MaintenancePayer | null; provider: string | null; cost: number | null; reported_at: string;
  resolved_at: string | null; charge_id: string | null;
  /** Liquidación en la que se descontó (reclamos a cargo del propietario). */
  settlement_id: string | null;
};

export const MAINTENANCE_STATUS: Record<MaintenanceStatus, { label: string; tone: StatusTone }> = {
  ABIERTO: { label: "Abierto", tone: "warning" },
  EN_CURSO: { label: "En curso", tone: "info" },
  RESUELTO: { label: "Resuelto", tone: "success" },
  CANCELADO: { label: "Cancelado", tone: "neutral" },
};
