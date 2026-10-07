import type { StatusTone } from "@/shared/components/StatusBadge";

// Postventa: de la reserva a la escritura. El comprador sigue siendo un
// lead; la operación son columnas de `leads` (deal_*). Módulo puro,
// compartido por el detalle del lead, el tablero de Operaciones y la
// bandeja Hoy.

export type DealStage = "RESERVA" | "BOLETO" | "FINANCIACION" | "ESCRITURA" | "ESCRITURADA" | "CAIDA";
export const ACTIVE_DEAL_STAGES: DealStage[] = ["RESERVA", "BOLETO", "FINANCIACION", "ESCRITURA"];

export const DEAL_STAGE_LABELS: Record<DealStage, string> = {
  RESERVA: "Reserva",
  BOLETO: "Boleto",
  FINANCIACION: "Financiación",
  ESCRITURA: "Escritura",
  ESCRITURADA: "Escriturada",
  CAIDA: "Caída",
};

export const DEAL_STAGE_TONE: Record<DealStage, StatusTone> = {
  RESERVA: "warning", BOLETO: "info", FINANCIACION: "info", ESCRITURA: "info", ESCRITURADA: "success", CAIDA: "danger",
};

// Orden de etapas; Financiación solo si la compra es con crédito.
export function dealSteps(financing: boolean): DealStage[] {
  return financing ? ["RESERVA", "BOLETO", "FINANCIACION", "ESCRITURA", "ESCRITURADA"] : ["RESERVA", "BOLETO", "ESCRITURA", "ESCRITURADA"];
}

export function nextDealStage(stage: DealStage, financing: boolean): DealStage | null {
  const steps = dealSteps(financing);
  const i = steps.indexOf(stage);
  return i >= 0 && i < steps.length - 1 ? steps[i + 1] : null;
}

// Checklist por etapa: lo que hay que tener antes de avanzar.
export const DEAL_CHECKLIST: Record<Exclude<DealStage, "ESCRITURADA" | "CAIDA">, { key: string; label: string }[]> = {
  RESERVA: [
    { key: "reserva_firmada", label: "Recibo de reserva firmado" },
    { key: "sena_recibida", label: "Seña recibida o depositada" },
    { key: "aceptacion_propietario", label: "Aceptación del propietario" },
    { key: "titulo_pedido", label: "Título y documentación del inmueble pedidos" },
  ],
  BOLETO: [
    { key: "informe_dominio", label: "Informe de dominio e inhibición" },
    { key: "libre_deuda", label: "Libre deuda de impuestos y servicios" },
    { key: "libre_expensas", label: "Libre deuda de expensas (si corresponde)" },
    { key: "boleto_firmado", label: "Boleto firmado por las partes" },
  ],
  FINANCIACION: [
    { key: "preaprobacion", label: "Pre-aprobación del banco" },
    { key: "tasacion_banco", label: "Tasación del banco" },
    { key: "credito_aprobado", label: "Crédito aprobado" },
  ],
  ESCRITURA: [
    { key: "escribano_designado", label: "Escribano designado" },
    { key: "certificados", label: "Certificados pedidos por el escribano" },
    { key: "fondos", label: "Fondos del comprador confirmados" },
    { key: "turno", label: "Turno de escritura confirmado" },
  ],
};

export type DealChecklist = Record<string, boolean>;

export function checklistProgress(stage: DealStage, checklist: DealChecklist) {
  const items = stage in DEAL_CHECKLIST ? DEAL_CHECKLIST[stage as keyof typeof DEAL_CHECKLIST] : [];
  const done = items.filter((i) => checklist[i.key]).length;
  return { done, total: items.length, pending: items.filter((i) => !checklist[i.key]) };
}

// Cada etapa es la fase en curso: "Boleto" = preparando y firmando el
// boleto. La fecha que importa es la que vence o la firma de esa fase.
export function dealDueDate(deal: { deal_stage: string | null; reserva_expires_at: string | null; boleto_at: string | null; escritura_at: string | null }) {
  switch (deal.deal_stage) {
    case "RESERVA": return { date: deal.reserva_expires_at, label: "Vence la reserva" };
    case "BOLETO": return { date: deal.boleto_at, label: "Firma del boleto" };
    case "FINANCIACION": return { date: deal.escritura_at, label: "Escritura prevista" };
    case "ESCRITURA": return { date: deal.escritura_at, label: "Escritura" };
    default: return { date: null, label: "" };
  }
}

export const LOAN_STATUS_LABELS: Record<string, string> = { EN_TRAMITE: "En trámite", APROBADO: "Aprobado", RECHAZADO: "Rechazado" };

// Portal del comprador: lo mismo, contado para quien compra. Cada paso del
// checklist dice de quién depende, para que el comprador vea qué le toca.
export type DealParty = "comprador" | "inmobiliaria" | "vendedor" | "banco" | "escribania";

export const DEAL_PARTY_LABELS: Record<DealParty, string> = {
  comprador: "Vos", inmobiliaria: "Inmobiliaria", vendedor: "Vendedor", banco: "Banco", escribania: "Escribanía",
};

export const BUYER_CHECKLIST: Record<string, { label: string; who: DealParty }> = {
  reserva_firmada: { label: "Firma de la reserva", who: "comprador" },
  sena_recibida: { label: "Entrega de la reserva", who: "comprador" },
  aceptacion_propietario: { label: "Aceptación de tu oferta por el vendedor", who: "vendedor" },
  titulo_pedido: { label: "Título y documentación del inmueble", who: "inmobiliaria" },
  informe_dominio: { label: "Informe de dominio e inhibición", who: "escribania" },
  libre_deuda: { label: "Libre deuda de impuestos y servicios", who: "vendedor" },
  libre_expensas: { label: "Libre deuda de expensas (si corresponde)", who: "vendedor" },
  boleto_firmado: { label: "Firma del boleto de compraventa", who: "comprador" },
  preaprobacion: { label: "Pre-aprobación del crédito", who: "banco" },
  tasacion_banco: { label: "Tasación del banco", who: "banco" },
  credito_aprobado: { label: "Aprobación del crédito", who: "banco" },
  escribano_designado: { label: "Designación del escribano", who: "comprador" },
  certificados: { label: "Certificados para la escritura", who: "escribania" },
  fondos: { label: "Fondos para la escritura disponibles", who: "comprador" },
  turno: { label: "Turno de firma confirmado", who: "escribania" },
};

export const BUYER_STAGE_TEXT: Record<DealStage, string> = {
  RESERVA: "Tu reserva está firmada. Ahora reunimos la documentación del inmueble para preparar el boleto.",
  BOLETO: "Estamos preparando el boleto de compraventa: se revisan el dominio y las deudas del inmueble antes de firmarlo.",
  FINANCIACION: "El banco está evaluando tu crédito hipotecario. Cuando lo apruebe, coordinamos la escritura.",
  ESCRITURA: "Se está preparando la escritura con la escribanía. Al firmarla, la propiedad pasa a tu nombre.",
  ESCRITURADA: "¡Felicitaciones! La escritura está firmada y la propiedad ya es tuya.",
  CAIDA: "Esta operación ya no está activa. Si tenés dudas, escribile a tu asesor.",
};
