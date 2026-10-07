// Números legibles de alquileres: lo que se le dice al cliente por teléfono
// o se busca con Ctrl+K, en vez de un id interno. Módulo puro.

export type CodeKind = "contrato" | "recibo" | "liquidacion";

const PREFIX: Record<CodeKind, string> = { contrato: "ALQ", recibo: "R", liquidacion: "LIQ" };

const pad = (n: number) => String(n).padStart(4, "0");

export const contractCode = (n: number | null | undefined) => (n ? `${PREFIX.contrato}-${pad(n)}` : "");
export const receiptCode = (n: number | null | undefined) => (n ? `${PREFIX.recibo}-${pad(n)}` : "");
export const settlementCode = (n: number | null | undefined) => (n ? `${PREFIX.liquidacion}-${pad(n)}` : "");

// "ALQ-12", "alq 0012", "R-62", "liq12" → { kind, number }. Sin prefijo no
// se interpreta como código (un número suelto puede ser un teléfono).
export function parseCode(raw: string): { kind: CodeKind; number: number } | null {
  const match = raw.trim().toUpperCase().match(/^(ALQ|LIQ|R)[\s\-#]*0*(\d{1,9})$/);
  if (!match) return null;
  const kind = (Object.keys(PREFIX) as CodeKind[]).find((k) => PREFIX[k] === match[1])!;
  const number = Number(match[2]);
  return number > 0 ? { kind, number } : null;
}
