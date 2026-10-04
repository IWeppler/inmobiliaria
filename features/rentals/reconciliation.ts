// Conciliación bancaria (E4.15): lógica pura, compartida entre el navegador
// (lee el extracto y muestra la propuesta) y el servidor (vuelve a calcular
// el reparto al confirmar). Sin dependencias de Supabase.

export type Cell = string | number | boolean | Date | null;

export type BankMovement = { date: string; description: string; amount: number };

export type ColumnMap = { header: number; date: number; description: number; credit: number; debit: number | null };

export type OpenCharge = { id: string; due_date: string; description: string; outstanding: number };

export type ContractCandidate = {
  id: string;
  label: string;
  currency: string;
  names: string[];
  documents: string[];
  open: OpenCharge[];
};

export type Suggestion = {
  contractId: string;
  score: number;
  confidence: "alta" | "media" | "baja";
  reasons: string[];
};

// === Lectura del extracto ===

const norm = (value: string) =>
  value.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/\s+/g, " ").trim();

const DATE_HEADERS = ["fecha", "fecha valor", "fecha operacion", "fecha mov"];
const DESCRIPTION_HEADERS = ["concepto", "descripcion", "detalle", "movimiento", "referencia", "leyenda"];
const CREDIT_HEADERS = ["credito", "creditos", "haber", "ingreso", "deposito"];
const DEBIT_HEADERS = ["debito", "debitos", "debe", "egreso"];
const AMOUNT_HEADERS = ["importe", "monto", "valor"];

const findColumn = (headers: string[], candidates: string[]) =>
  headers.findIndex((h) => candidates.some((c) => h === c || h.startsWith(`${c} `) || h.startsWith(c)));

// Busca la fila de encabezados (los bancos suelen poner datos de la cuenta
// arriba) y adivina las columnas. Devuelve null si no encuentra fecha e
// importe: en ese caso el agente elige a mano.
export function detectColumns(rows: Cell[][]): ColumnMap | null {
  for (let header = 0; header < Math.min(rows.length, 25); header++) {
    const headers = rows[header].map((cell) => (typeof cell === "string" ? norm(cell) : ""));
    const date = findColumn(headers, DATE_HEADERS);
    if (date < 0) continue;
    const credit = findColumn(headers, CREDIT_HEADERS);
    const amount = findColumn(headers, AMOUNT_HEADERS);
    const debit = findColumn(headers, DEBIT_HEADERS);
    const description = findColumn(headers, DESCRIPTION_HEADERS);
    if (credit < 0 && amount < 0) continue;
    return {
      header,
      date,
      description: description >= 0 ? description : -1,
      credit: credit >= 0 ? credit : amount,
      debit: credit >= 0 && debit >= 0 ? debit : null,
    };
  }
  return null;
}

// "1.234.567,89" / "1,234,567.89" / "-1234.5" / "$ 1.234" → número.
export function parseAmount(cell: Cell): number | null {
  if (typeof cell === "number") return Number.isFinite(cell) ? cell : null;
  if (typeof cell !== "string") return null;
  let text = cell.replace(/[^\d.,\-()]/g, "");
  if (!text) return null;
  const negative = text.startsWith("-") || (text.startsWith("(") && text.endsWith(")"));
  text = text.replace(/[-()]/g, "");
  const lastComma = text.lastIndexOf(",");
  const lastDot = text.lastIndexOf(".");
  if (lastComma > lastDot) text = text.replace(/\./g, "").replace(",", ".");
  else if (lastDot > lastComma && lastComma >= 0) text = text.replace(/,/g, "");
  else if (lastDot >= 0 && text.split(".").length > 2) text = text.replace(/\./g, "");
  else if (lastDot >= 0 && /^\d{1,3}\.\d{3}$/.test(text)) text = text.replace(".", ""); // 1.500 = mil quinientos
  const value = Number(text);
  if (!Number.isFinite(value)) return null;
  return negative ? -value : value;
}

const pad = (n: number) => String(n).padStart(2, "0");

// dd/mm/aaaa, dd-mm-aa, aaaa-mm-dd o Date de Excel → aaaa-mm-dd.
export function parseDate(cell: Cell): string | null {
  if (cell instanceof Date && !Number.isNaN(cell.getTime())) {
    return `${cell.getUTCFullYear()}-${pad(cell.getUTCMonth() + 1)}-${pad(cell.getUTCDate())}`;
  }
  if (typeof cell !== "string") return null;
  const text = cell.trim();
  let match = text.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (match) return `${match[1]}-${match[2]}-${match[3]}`;
  match = text.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})/);
  if (!match) return null;
  const [, d, m, y] = match;
  const year = y.length === 2 ? 2000 + Number(y) : Number(y);
  if (Number(m) < 1 || Number(m) > 12 || Number(d) < 1 || Number(d) > 31) return null;
  return `${year}-${pad(Number(m))}-${pad(Number(d))}`;
}

// Solo créditos: lo que entró a la cuenta.
export function extractMovements(rows: Cell[][], map: ColumnMap): BankMovement[] {
  const movements: BankMovement[] = [];
  for (const row of rows.slice(map.header + 1)) {
    const date = parseDate(row[map.date] ?? null);
    if (!date) continue;
    let amount = parseAmount(row[map.credit] ?? null);
    if (map.debit !== null && (amount === null || amount === 0)) continue;
    if (amount === null || amount <= 0) continue;
    amount = Math.round(amount * 100) / 100;
    const description = map.description >= 0 ? String(row[map.description] ?? "").trim() : "";
    movements.push({ date, description: description || "Sin concepto", amount });
  }
  return movements;
}

// Identidad del movimiento para no conciliarlo dos veces. Si el mismo
// extracto trae dos movimientos idénticos, el segundo lleva #2.
export function movementHashes(movements: BankMovement[], account: string): string[] {
  const seen = new Map<string, number>();
  return movements.map((m) => {
    const base = `${m.date}|${m.amount.toFixed(2)}|${norm(m.description).slice(0, 160)}|${norm(account)}`;
    const n = (seen.get(base) ?? 0) + 1;
    seen.set(base, n);
    return n === 1 ? base : `${base}#${n}`;
  });
}

// === Coincidencias ===

const round2 = (n: number) => Math.round(n * 100) / 100;
const digits = (value: string) => value.replace(/\D/g, "");

// Un DNI aparece dentro del CUIT/CUIL (posiciones 3 a 10).
function documentVariants(document: string): string[] {
  const d = digits(document);
  if (d.length === 11) return [d, d.slice(2, 10)];
  if (d.length >= 7 && d.length <= 8) return [d];
  return [];
}

// Deudas que un pago con esa fecha puede estar cubriendo: vencidas o que
// vencen en los próximos 20 días (pago adelantado del mes).
export function chargesDueBy(open: OpenCharge[], date: string): OpenCharge[] {
  const limit = new Date(`${date}T00:00:00Z`);
  limit.setUTCDate(limit.getUTCDate() + 20);
  const max = limit.toISOString().slice(0, 10);
  return open.filter((c) => c.due_date <= max && c.outstanding > 0).sort((a, b) => a.due_date.localeCompare(b.due_date));
}

export function suggestContract(movement: BankMovement, contracts: ContractCandidate[]): Suggestion | null {
  const text = norm(movement.description);
  const textDigits = digits(movement.description);
  let best: Suggestion | null = null;

  for (const contract of contracts) {
    const reasons: string[] = [];
    let score = 0;

    if (contract.documents.some((doc) => documentVariants(doc).some((v) => v.length >= 7 && textDigits.includes(v)))) {
      score += 50; reasons.push("CUIT/DNI del inquilino");
    }
    let nameHits = 0;
    for (const name of contract.names) {
      const tokens = norm(name).split(" ").filter((t) => t.length >= 4);
      nameHits = Math.max(nameHits, tokens.filter((t) => new RegExp(`\\b${t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`).test(text)).length);
    }
    if (nameHits) { score += Math.min(45, nameHits * 25); reasons.push("nombre del inquilino"); }

    const due = chargesDueBy(contract.open, movement.date);
    const total = round2(due.reduce((s, c) => s + c.outstanding, 0));
    let prefix = 0;
    let prefixMatch = false;
    for (const charge of due) {
      prefix = round2(prefix + charge.outstanding);
      if (Math.abs(prefix - movement.amount) < 0.01) { prefixMatch = true; break; }
    }
    if (total > 0 && Math.abs(total - movement.amount) < 0.01) { score += 40; reasons.push("importe igual a la deuda"); }
    else if (prefixMatch) { score += 35; reasons.push("importe igual a las cuotas más viejas"); }
    else if (due.some((c) => Math.abs(c.outstanding - movement.amount) < 0.01)) { score += 30; reasons.push("importe igual a un cargo"); }
    else if (score > 0 && total > 0 && movement.amount < total) { score += 5; reasons.push("pago parcial"); }

    if (score === 0 || total === 0) continue;
    if (!best || score > best.score) {
      best = { contractId: contract.id, score, reasons, confidence: score >= 80 ? "alta" : score >= 50 ? "media" : "baja" };
    }
  }
  return best;
}

// Reparto del importe sobre las deudas más viejas primero. `used` lleva lo
// ya aplicado en esta misma tanda para no cobrar dos veces el mismo cargo.
export function allocate(
  open: OpenCharge[],
  amount: number,
  date: string,
  used: Map<string, number> = new Map(),
): { allocations: { charge: OpenCharge; amount: number }[]; leftover: number } {
  let rest = round2(amount);
  const allocations: { charge: OpenCharge; amount: number }[] = [];
  // Primero lo exigible a esa fecha; si sobra, lo que vence después.
  const ordered = [...chargesDueBy(open, date), ...open.filter((c) => !chargesDueBy(open, date).includes(c))
    .sort((a, b) => a.due_date.localeCompare(b.due_date))];
  for (const charge of ordered) {
    if (rest <= 0) break;
    const available = round2(charge.outstanding - (used.get(charge.id) ?? 0));
    if (available <= 0) continue;
    const take = Math.min(available, rest);
    allocations.push({ charge, amount: round2(take) });
    used.set(charge.id, round2((used.get(charge.id) ?? 0) + take));
    rest = round2(rest - take);
  }
  return { allocations, leftover: rest };
}
