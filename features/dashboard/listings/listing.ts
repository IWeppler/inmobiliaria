import type { StatusTone } from "@/shared/components/StatusBadge";
import { addDays } from "@/lib/dates";
import { daysBetween } from "@/features/rentals/logic";

// Captación de propietarios: del primer contacto a la propiedad publicada.
// Módulo puro, compartido por el tablero, las acciones y la bandeja Hoy.

export type ListingStage = "CONTACTO" | "TASACION" | "PROPUESTA" | "AUTORIZACION" | "PUBLICADA" | "PERDIDA";

// Etapas del tablero, en orden. Cada una es la fase en curso.
export type PipelineStage = Exclude<ListingStage, "PUBLICADA" | "PERDIDA">;
export const LISTING_PIPELINE: PipelineStage[] = ["CONTACTO", "TASACION", "PROPUESTA", "AUTORIZACION"];
export const isPipelineStage = (stage: string): stage is PipelineStage => (LISTING_PIPELINE as string[]).includes(stage);

export const LISTING_STAGE_LABELS: Record<ListingStage, string> = {
  CONTACTO: "Primer contacto",
  TASACION: "Tasación",
  PROPUESTA: "Propuesta enviada",
  AUTORIZACION: "Autorización firmada",
  PUBLICADA: "Publicada",
  PERDIDA: "Perdida",
};

export const LISTING_STAGE_HINT: Record<ListingStage, string> = {
  CONTACTO: "Coordinar la visita para tasar",
  TASACION: "Preparar el informe de tasación",
  PROPUESTA: "Esperando respuesta del propietario",
  AUTORIZACION: "Fotos, ficha y publicación",
  PUBLICADA: "",
  PERDIDA: "",
};

export const LISTING_STAGE_TONE: Record<ListingStage, StatusTone> = {
  CONTACTO: "neutral", TASACION: "info", PROPUESTA: "warning", AUTORIZACION: "info", PUBLICADA: "success", PERDIDA: "danger",
};

export const LISTING_SOURCES = ["Referido", "Cliente anterior", "Cartel", "Portal", "Redes", "Puerta a puerta", "Otro"] as const;

export const LISTING_LOST_REASONS = [
  "Eligió otra inmobiliaria", "Precio pretendido fuera de mercado", "Decidió no vender", "Vende por su cuenta", "No respondió",
] as const;

// Días sin avanzar a partir de los cuales una etapa se considera frenada.
export const STALE_DAYS: Partial<Record<ListingStage, number>> = { CONTACTO: 7, TASACION: 7, PROPUESTA: 7, AUTORIZACION: 10 };

export const AUTHORIZATION_WARN_DAYS = 15;
export const DEFAULT_AUTHORIZATION_DAYS = 90;

export function defaultAuthorizationExpiry(signedAt: string) {
  return addDays(signedAt, DEFAULT_AUTHORIZATION_DAYS);
}

export type ProspectLike = {
  stage: string;
  stage_changed_at: string;
  next_action: string | null;
  next_action_at: string | null;
  authorization_expires_at: string | null;
  appraisal_value: number | null;
  owner_price: number | null;
};

export type ListingAlert = { kind: "paso" | "frenada" | "autorizacion" | "precio"; urgency: "alta" | "media" | "baja"; text: string; days: number };

// Lo que necesita atención en una captación. El orden es de mayor a menor
// prioridad; el tablero muestra la primera, la bandeja Hoy arma tareas.
export function listingAlerts(p: ProspectLike, today: string): ListingAlert[] {
  const stage = p.stage as ListingStage;
  const alerts: ListingAlert[] = [];
  if (p.next_action && p.next_action_at && p.next_action_at <= today) {
    const days = daysBetween(p.next_action_at, today);
    alerts.push({ kind: "paso", urgency: days > 0 ? "alta" : "media", days, text: days > 0 ? `${p.next_action} (vencido hace ${days} ${days === 1 ? "día" : "días"})` : `${p.next_action} (hoy)` });
  }
  if (p.authorization_expires_at && (stage === "AUTORIZACION" || stage === "PUBLICADA")) {
    const days = daysBetween(today, p.authorization_expires_at);
    if (days <= AUTHORIZATION_WARN_DAYS) {
      alerts.push({
        kind: "autorizacion", urgency: days <= 5 ? "alta" : "media", days,
        text: days < 0 ? `La autorización venció hace ${-days} días` : days === 0 ? "La autorización vence hoy" : `La autorización vence en ${days} días`,
      });
    }
  }
  const stale = STALE_DAYS[stage];
  const since = daysBetween(p.stage_changed_at.slice(0, 10), today);
  if (stale && since >= stale && !(p.next_action && p.next_action_at && p.next_action_at > today)) {
    alerts.push({ kind: "frenada", urgency: since >= stale * 2 ? "alta" : "media", days: since, text: `${LISTING_STAGE_HINT[stage]}: hace ${since} días en esta etapa` });
  }
  const gap = priceGap(p);
  if (stage === "PROPUESTA" && gap !== null && gap >= 15) {
    alerts.push({ kind: "precio", urgency: "baja", days: 0, text: `Pretende ${gap} % más que la tasación` });
  }
  return alerts;
}

// Diferencia porcentual entre lo que pretende el dueño y la tasación.
export function priceGap(p: { appraisal_value: number | null; owner_price: number | null }) {
  if (!p.appraisal_value || !p.owner_price) return null;
  return Math.round(((p.owner_price - p.appraisal_value) / p.appraisal_value) * 100);
}
