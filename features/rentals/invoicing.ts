// Facturación electrónica ARCA (E4.19): reglas fiscales puras, compartidas
// entre servidor (emisión) y navegador (vista previa y PDF).

export type IvaCondition = "RI" | "MONOTRIBUTO" | "EXENTO" | "CONSUMIDOR_FINAL";
export type EmitterCondition = "RI" | "MONOTRIBUTO";
export type InvoiceKind = "FACTURA" | "NOTA_CREDITO";

export const IVA_LABELS: Record<IvaCondition, string> = {
  RI: "Responsable inscripto",
  MONOTRIBUTO: "Monotributista",
  EXENTO: "IVA exento",
  CONSUMIDOR_FINAL: "Consumidor final",
};

// CondicionIVAReceptorId de WSFEv1 (obligatorio desde RG 5616).
export const IVA_RECEPTOR_ID: Record<IvaCondition, number> = { RI: 1, EXENTO: 4, CONSUMIDOR_FINAL: 5, MONOTRIBUTO: 6 };

export const CBTE_LABELS: Record<number, string> = {
  1: "Factura A", 6: "Factura B", 11: "Factura C",
  3: "Nota de crédito A", 8: "Nota de crédito B", 13: "Nota de crédito C",
};

export const cbteLetter = (tipo: number) => (({ 1: "A", 3: "A", 6: "B", 8: "B", 11: "C", 13: "C" }) as Record<number, string>)[tipo] ?? "";

// Monotributo emite C. Responsable inscripto: A a otro RI, B al resto.
export function invoiceType(emitter: EmitterCondition, receptor: IvaCondition, kind: InvoiceKind): number {
  const letter = emitter === "MONOTRIBUTO" ? "C" : receptor === "RI" ? "A" : "B";
  return { FACTURA: { A: 1, B: 6, C: 11 }, NOTA_CREDITO: { A: 3, B: 8, C: 13 } }[kind][letter];
}

// DocTipo de ARCA: 80 CUIT, 96 DNI, 99 sin identificar (consumidor final).
export function receptorDocument(document: string | null): { tipo: 80 | 96 | 99; nro: string } {
  const digits = (document ?? "").replace(/\D/g, "");
  if (digits.length === 11) return { tipo: 80, nro: digits };
  if (digits.length >= 7 && digits.length <= 8) return { tipo: 96, nro: digits };
  return { tipo: 99, nro: "0" };
}

const round2 = (n: number) => Math.round(n * 100) / 100;

// La comisión de la liquidación se toma como importe final (IVA incluido).
// Con A y B se discrimina el 21 %; con C no hay IVA.
export function splitVat(total: number, cbteTipo: number): { net: number; vat: number } {
  if (cbteLetter(cbteTipo) === "C") return { net: round2(total), vat: 0 };
  const net = round2(total / 1.21);
  return { net, vat: round2(total - net) };
}

// Honorarios por titular según su %; los centavos de redondeo van al
// principal (mismo criterio que el reparto de la liquidación).
export function shareFees<T extends { share_pct: number; is_primary: boolean }>(commission: number, shares: T[]): (T & { fee: number })[] {
  const out = shares.map((s) => ({ ...s, fee: round2((commission * s.share_pct) / 100) }));
  const diff = round2(commission - out.reduce((sum, s) => sum + s.fee, 0));
  const primary = out.find((s) => s.is_primary) ?? out[0];
  if (primary) primary.fee = round2(primary.fee + diff);
  return out;
}

// Validaciones antes de pedir el CAE, con mensajes para el agente.
export function receptorProblem(receptor: { name: string; iva: IvaCondition | null; document: string | null }, emitter: EmitterCondition): string | null {
  if (!receptor.iva) return `Cargá la condición frente al IVA de ${receptor.name}.`;
  const doc = receptorDocument(receptor.document);
  if (emitter === "RI" && receptor.iva === "RI" && doc.tipo !== 80) return `${receptor.name} es responsable inscripto: falta su CUIT.`;
  if (receptor.iva !== "CONSUMIDOR_FINAL" && doc.tipo === 99) return `Falta el CUIT o DNI de ${receptor.name}.`;
  return null;
}

// QR obligatorio (RG 4291): JSON en base64 sobre la URL de ARCA.
export function afipQrUrl(input: {
  date: string; cuit: string; ptoVta: number; cbteTipo: number; cbteNro: number; total: number;
  currency: string; rate: number; docTipo: number; docNro: string; cae: string;
}) {
  const payload = {
    ver: 1, fecha: input.date, cuit: Number(input.cuit), ptoVta: input.ptoVta, tipoCmp: input.cbteTipo, nroCmp: input.cbteNro,
    importe: input.total, moneda: input.currency === "USD" ? "DOL" : "PES", ctz: input.rate,
    tipoDocRec: input.docTipo, nroDocRec: Number(input.docNro), tipoCodAut: "E", codAut: Number(input.cae),
  };
  const json = JSON.stringify(payload);
  const base64 = typeof Buffer !== "undefined" ? Buffer.from(json).toString("base64") : btoa(json);
  return `https://www.afip.gob.ar/fe/qr/?p=${base64}`;
}

export const formatInvoiceNumber = (ptoVta: number, nro: number) => `${String(ptoVta).padStart(5, "0")}-${String(nro).padStart(8, "0")}`;
