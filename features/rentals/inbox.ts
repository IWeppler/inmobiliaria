import type { StatusTone } from "@/shared/components/StatusBadge";

// WhatsApp entrante (E4.18): tipos y etiquetas compartidas entre el
// webhook, la IA y la bandeja de Mensajes.

export type InboxKind = "PENDIENTE_IA" | "COMPROBANTE" | "RECLAMO" | "CONSULTA" | "OTRO";

export type InboxPayment = {
  amount: number | null;
  currency: "ARS" | "USD" | null;
  date: string | null;
  payer_name: string | null;
  reference: string | null;
};

export type InboxClaim = { title: string; description: string; priority: "BAJA" | "MEDIA" | "ALTA" | "URGENTE" };

export type InboxAiData = {
  payment: InboxPayment | null;
  claim: InboxClaim | null;
  suggested_reply: string | null;
};

export const KIND_LABELS: Record<InboxKind, string> = {
  PENDIENTE_IA: "Sin clasificar",
  COMPROBANTE: "Comprobante de pago",
  RECLAMO: "Reclamo",
  CONSULTA: "Consulta",
  OTRO: "Otro",
};

export const KIND_TONE: Record<InboxKind, StatusTone> = {
  PENDIENTE_IA: "neutral",
  COMPROBANTE: "success",
  RECLAMO: "warning",
  CONSULTA: "info",
  OTRO: "neutral",
};

// Adjuntos que se guardan y que la IA puede leer.
export const INBOX_MEDIA = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "application/pdf": "pdf",
} as const;

export type InboxMime = keyof typeof INBOX_MEDIA;

export const isInboxMime = (mime: string): mime is InboxMime => mime in INBOX_MEDIA;
