import type { StatusTone } from "@/shared/components/StatusBadge";

// Vacancia (E4.17): tipos y etapas. Lógica pura, la arma vacancyData.ts y
// la muestra VacancyView.

export type RenewalIntent = "RENUEVA" | "NO_RENUEVA" | null;

export type ExpiringItem = {
  contractId: string;
  propertyId: string;
  propertyTitle: string;
  tenantName: string | null;
  tenantPhone: string | null;
  endDate: string;
  daysLeft: number;
  intent: RenewalIntent;
  intentNote: string | null;
  published: boolean;
  availableFrom: string | null;
  rent: number;
  currency: string;
  leads30: number;
  canPublish: boolean;
};

export type VacancyStage = "SIN_PUBLICAR" | "SIN_CONSULTAS" | "CON_CONSULTAS" | "VISITAS" | "RESERVADA";

export type VacantItem = {
  propertyId: string;
  propertyTitle: string;
  status: string;
  stage: VacancyStage;
  vacantSince: string;
  daysVacant: number;
  lastContractId: string | null;
  askingRent: number | null;
  currency: string;
  lostRent: number | null;
  neverRented: boolean;
  leads30: number;
  lastLeadAt: string | null;
  nextVisit: string | null;
  canPublish: boolean;
};

export const STAGE_LABELS: Record<VacancyStage, string> = {
  SIN_PUBLICAR: "Sin publicar",
  SIN_CONSULTAS: "Publicada, sin consultas",
  CON_CONSULTAS: "Con consultas",
  VISITAS: "Visitas agendadas",
  RESERVADA: "Reservada",
};

export const STAGE_TONE: Record<VacancyStage, StatusTone> = {
  SIN_PUBLICAR: "danger",
  SIN_CONSULTAS: "warning",
  CON_CONSULTAS: "info",
  VISITAS: "info",
  RESERVADA: "success",
};

export function vacancyStage(input: { status: string; leads30: number; nextVisit: string | null }): VacancyStage {
  if (input.status === "RESERVADO") return "RESERVADA";
  if (input.status !== "EN_ALQUILER") return "SIN_PUBLICAR";
  if (input.nextVisit) return "VISITAS";
  return input.leads30 > 0 ? "CON_CONSULTAS" : "SIN_CONSULTAS";
}

// Alquiler que se deja de cobrar mientras la propiedad está vacía.
export function lostRent(monthlyRent: number | null, daysVacant: number) {
  if (!monthlyRent || daysVacant <= 0) return null;
  return Math.round((monthlyRent * daysVacant) / 30);
}

export function renewalMessage(input: { tenantName: string; propertyTitle: string; endDate: string }) {
  const firstName = input.tenantName.split(" ")[0] ?? input.tenantName;
  const [y, m, d] = input.endDate.split("-");
  return `Hola ${firstName}, ¿cómo estás? Te escribimos porque el contrato de ${input.propertyTitle} vence el ${d}/${m}/${y}. ¿Tenés pensado renovar? Así nos organizamos con el propietario con tiempo. ¡Gracias!`;
}
