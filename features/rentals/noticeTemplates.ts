// Plantillas de WhatsApp de los avisos de alquiler. Meta exige registrar y
// aprobar cada plantilla antes de usarla: el nombre y el cuerpo de acá son
// los que hay que cargar en WhatsApp Manager (categoría Utilidad, idioma
// Español (ARG) = es_AR). Las variables {{n}} se completan en este orden.
// Sin "use client" ni "server-only": lo usan el envío y la pantalla Ajustes.

export type NoticeKind = "RECIBO" | "AUMENTO" | "VENCIMIENTO" | "DEUDA";

export const RENTAL_TEMPLATES = {
  RECIBO: {
    name: "alquiler_recibo",
    label: "Recibo de cobro",
    body: "Hola {{1}}, registramos tu pago de {{2}} por {{3}} de {{4}}. Recibo {{5}}. ¡Gracias!",
    params: ["nombre del inquilino", "importe", "concepto", "propiedad", "n.º de recibo"],
  },
  AUMENTO: {
    name: "alquiler_aumento",
    label: "Aumento de alquiler",
    body: "Hola {{1}}, te informamos que desde el {{2}} el alquiler de {{3}} pasa a ser de {{4}}, según el ajuste pactado por {{5}}.",
    params: ["nombre", "fecha del ajuste", "propiedad", "nuevo canon", "índice"],
  },
  VENCIMIENTO: {
    name: "alquiler_vencimiento",
    label: "Recordatorio de vencimiento",
    body: "Hola {{1}}, te recordamos que el {{2}} vence {{3}} de {{4}} por {{5}}.",
    params: ["nombre del inquilino", "fecha de vencimiento", "concepto", "propiedad", "importe"],
  },
  DEUDA: {
    name: "alquiler_deuda",
    label: "Aviso de deuda",
    body: "Hola {{1}}, registramos un saldo pendiente de {{2}} por {{3}} de {{4}}, vencido el {{5}}. Por favor, contactanos para regularizarlo.",
    params: ["nombre del inquilino", "saldo", "concepto", "propiedad", "fecha de vencimiento"],
  },
} as const satisfies Record<NoticeKind, { name: string; label: string; body: string; params: readonly string[] }>;
