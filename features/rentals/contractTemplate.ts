// Contrato desde plantilla (E4.16): variables, importes en letras y armado
// del texto. Módulo puro: lo usan el editor de plantillas (Ajustes) y el
// generador del contrato.

export type TemplatePerson = { full_name: string; document: string | null; address: string | null; share_pct?: number | null };

export type TemplateContract = {
  start_date: string;
  end_date: string;
  rent_amount: number;
  currency: string;
  adjustment_index: string;
  adjustment_months: number;
  adjustment_pct: number | null;
  index_lag_months: number;
  payment_due_day: number;
  deposit_amount: number;
  guarantee_type: string;
  guarantee_detail: string | null;
  late_fee_pct_daily: number;
  late_fee_fixed: number;
};

export type TemplateData = {
  contract: TemplateContract;
  property: { title: string; street_address: string | null; neighborhood: string | null; city: string | null; province: string | null } | null;
  owners: TemplatePerson[];
  tenants: TemplatePerson[];
  guarantors: TemplatePerson[];
  agencyName: string;
  today: string;
};

// Variables disponibles, con la etiqueta que se muestra si falta el dato.
export const TEMPLATE_VARIABLES: { key: string; label: string }[] = [
  { key: "inmobiliaria", label: "Nombre de la inmobiliaria" },
  { key: "ciudad_firma", label: "Ciudad de firma" },
  { key: "fecha_firma", label: "Fecha de firma (\"4 días del mes de octubre de 2026\")" },
  { key: "locadores", label: "Locadores con documento" },
  { key: "locador_nombre", label: "Nombre del locador principal" },
  { key: "locador_documento", label: "Documento del locador" },
  { key: "locador_domicilio", label: "Domicilio del locador" },
  { key: "locatarios", label: "Locatarios con documento" },
  { key: "locatario_nombre", label: "Nombre del locatario" },
  { key: "locatario_documento", label: "Documento del locatario" },
  { key: "locatario_domicilio", label: "Domicilio del locatario" },
  { key: "garantes", label: "Garantes con documento" },
  { key: "garantia", label: "Cláusula de garantía (según el tipo)" },
  { key: "inmueble_direccion", label: "Dirección del inmueble" },
  { key: "inmueble_titulo", label: "Título de la propiedad" },
  { key: "fecha_inicio", label: "Fecha de inicio" },
  { key: "fecha_fin", label: "Fecha de fin" },
  { key: "plazo_meses", label: "Plazo en meses" },
  { key: "canon", label: "Canon en números" },
  { key: "canon_letras", label: "Canon en letras" },
  { key: "moneda", label: "Moneda" },
  { key: "dia_vencimiento", label: "Día de vencimiento" },
  { key: "ajuste", label: "Cláusula de actualización (según el índice)" },
  { key: "deposito", label: "Depósito en números" },
  { key: "deposito_letras", label: "Depósito en letras" },
  { key: "punitorio", label: "Interés punitorio" },
];
const LABELS = new Map(TEMPLATE_VARIABLES.map((v) => [v.key, v.label]));

// === Números en letras (estilo de contratos: MAYÚSCULAS) ===

const UNITS = ["", "uno", "dos", "tres", "cuatro", "cinco", "seis", "siete", "ocho", "nueve", "diez", "once", "doce", "trece",
  "catorce", "quince", "dieciséis", "diecisiete", "dieciocho", "diecinueve", "veinte", "veintiuno", "veintidós", "veintitrés",
  "veinticuatro", "veinticinco", "veintiséis", "veintisiete", "veintiocho", "veintinueve"];
const TENS = ["", "", "", "treinta", "cuarenta", "cincuenta", "sesenta", "setenta", "ochenta", "noventa"];
const HUNDREDS = ["", "ciento", "doscientos", "trescientos", "cuatrocientos", "quinientos", "seiscientos", "setecientos", "ochocientos", "novecientos"];

function below1000(n: number): string {
  if (n === 100) return "cien";
  const rest = n % 100;
  const restWords = rest < 30 ? UNITS[rest] : `${TENS[Math.floor(rest / 10)]}${rest % 10 ? ` y ${UNITS[rest % 10]}` : ""}`;
  return [HUNDREDS[Math.floor(n / 100)], restWords].filter(Boolean).join(" ");
}

// "uno" delante de mil / millones / un sustantivo se apocopa.
const apocope = (words: string) => words.replace(/veintiuno$/, "veintiún").replace(/uno$/, "un");

export function integerToWords(n: number): string {
  if (n === 0) return "cero";
  const millions = Math.floor(n / 1_000_000);
  const rest = n % 1_000_000;
  const thousands = Math.floor(rest / 1000);
  const units = rest % 1000;
  const parts: string[] = [];
  if (millions) parts.push(millions === 1 ? "un millón" : `${apocope(integerToWords(millions))} millones`);
  if (thousands) parts.push(thousands === 1 ? "mil" : `${apocope(below1000(thousands))} mil`);
  if (units) parts.push(below1000(units));
  return parts.join(" ");
}

const CURRENCY_WORDS: Record<string, string> = { ARS: "PESOS", USD: "DÓLARES ESTADOUNIDENSES" };

export function amountInWords(amount: number, currency: string): string {
  const integer = Math.floor(Math.round(amount * 100) / 100);
  const cents = Math.round((amount - integer) * 100);
  const words = integerToWords(integer).toUpperCase();
  return `${CURRENCY_WORDS[currency] ?? currency} ${words}${cents ? ` CON ${String(cents).padStart(2, "0")}/100` : ""}`;
}

// === Fechas y montos ===

const MONTHS = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
const parts = (ymd: string) => ymd.split("-").map(Number) as [number, number, number];

export function longDate(ymd: string) {
  const [y, m, d] = parts(ymd);
  return `${d} de ${MONTHS[m - 1]} de ${y}`;
}

function signingDate(ymd: string) {
  const [y, m, d] = parts(ymd);
  return `${d} ${d === 1 ? "día" : "días"} del mes de ${MONTHS[m - 1]} de ${y}`;
}

// Meses entre inicio y fin (fin inclusive): 01/10/2026 a 30/09/2028 = 24.
export function termMonths(start: string, end: string) {
  const [sy, sm, sd] = parts(start);
  const [ey, em, ed] = parts(end);
  const next = new Date(Date.UTC(ey, em - 1, ed + 1));
  const months = (next.getUTCFullYear() - sy) * 12 + (next.getUTCMonth() + 1 - sm);
  return next.getUTCDate() === sd ? months : Math.round(months + (next.getUTCDate() - sd) / 30);
}

const formatMoney = (amount: number, currency: string) =>
  `${currency === "USD" ? "USD" : "$"} ${amount.toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const pct = (n: number) => n.toLocaleString("es-AR", { maximumFractionDigits: 3 });

const withDocument = (p: TemplatePerson) => (p.document ? `${p.full_name}, ${documentLabel(p.document)} ${p.document}` : p.full_name);

function documentLabel(document: string) {
  const digits = document.replace(/\D/g, "");
  return digits.length === 11 ? "CUIT/CUIL" : "DNI";
}

function joinPeople(people: TemplatePerson[]) {
  const items = people.map(withDocument);
  return items.length <= 1 ? items[0] ?? "" : `${items.slice(0, -1).join("; ")} y ${items[items.length - 1]}`;
}

// === Cláusulas que dependen de los datos ===

function adjustmentClause(c: TemplateContract) {
  const every = `cada ${c.adjustment_months} ${c.adjustment_months === 1 ? "mes" : "meses"}`;
  const lag = c.index_lag_months > 0
    ? `, tomando el último valor publicado con un rezago de ${c.index_lag_months} ${c.index_lag_months === 1 ? "mes" : "meses"} respecto del mes de ajuste`
    : "";
  switch (c.adjustment_index) {
    case "ICL": return `El canon locativo se actualizará ${every}, aplicando la variación del Índice para Contratos de Locación (ICL) publicado por el Banco Central de la República Argentina${lag}.`;
    case "IPC": return `El canon locativo se actualizará ${every}, aplicando la variación del Índice de Precios al Consumidor (IPC), nivel general, publicado por el INDEC${lag}.`;
    case "CASA_PROPIA": return `El canon locativo se actualizará ${every}, aplicando el coeficiente Casa Propia publicado por el Ministerio de Desarrollo Territorial y Hábitat de la Nación.`;
    case "FIJO": return `El canon locativo se incrementará ${every} en un ${pct(c.adjustment_pct ?? 0)} % sobre el valor vigente en el período anterior.`;
    case "NINGUNO": return "El canon locativo se mantendrá sin actualizaciones durante todo el plazo del contrato.";
    default: return `El canon locativo se actualizará ${every} según lo acordado entre las partes: [COMPLETAR: fórmula de actualización].`;
  }
}

function lateFeeClause(c: TemplateContract) {
  const items: string[] = [];
  if (c.late_fee_pct_daily > 0) items.push(`un interés punitorio del ${pct(c.late_fee_pct_daily)} % diario sobre el importe adeudado`);
  if (c.late_fee_fixed > 0) items.push(`una multa de ${formatMoney(c.late_fee_fixed, c.currency)}`);
  return items.length ? items.join(" y ") : "los intereses que fije la legislación vigente";
}

function guaranteeClause(c: TemplateContract, guarantors: TemplatePerson[]) {
  if (c.guarantee_type === "GARANTE") {
    const who = guarantors.length ? joinPeople(guarantors) : c.guarantee_detail || "[COMPLETAR: garante]";
    const plural = guarantors.length > 1;
    return `En garantía del cumplimiento de todas las obligaciones asumidas en este contrato, ${who} se ${plural ? "constituyen en fiadores solidarios, lisos, llanos y principales pagadores" : "constituye en fiador solidario, liso, llano y principal pagador"}, con renuncia a los beneficios de excusión y división, hasta la efectiva restitución del inmueble.`;
  }
  if (c.guarantee_type === "CAUCION") {
    return `LA PARTE LOCATARIA presenta seguro de caución ${c.guarantee_detail || "[COMPLETAR: aseguradora y póliza]"}, que cubre el cumplimiento de las obligaciones de este contrato durante toda su vigencia.`;
  }
  return "Las partes acuerdan no requerir garantía adicional al depósito previsto en este contrato.";
}

export function buildTemplateValues(data: TemplateData): Record<string, string> {
  const { contract: c, property: p } = data;
  const owner = data.owners[0];
  const tenant = data.tenants[0];
  return {
    inmobiliaria: data.agencyName,
    ciudad_firma: p?.city ?? "",
    fecha_firma: signingDate(data.today),
    locadores: joinPeople(data.owners),
    locador_nombre: owner?.full_name ?? "",
    locador_documento: owner?.document ?? "",
    locador_domicilio: owner?.address ?? "",
    locatarios: joinPeople(data.tenants),
    locatario_nombre: tenant?.full_name ?? "",
    locatario_documento: tenant?.document ?? "",
    locatario_domicilio: tenant?.address ?? "",
    garantes: joinPeople(data.guarantors),
    garantia: guaranteeClause(c, data.guarantors),
    inmueble_direccion: [p?.street_address, p?.neighborhood, p?.city, p?.province].filter(Boolean).join(", "),
    inmueble_titulo: p?.title ?? "",
    fecha_inicio: longDate(c.start_date),
    fecha_fin: longDate(c.end_date),
    plazo_meses: String(termMonths(c.start_date, c.end_date)),
    canon: formatMoney(c.rent_amount, c.currency),
    canon_letras: amountInWords(c.rent_amount, c.currency),
    moneda: c.currency === "USD" ? "dólares estadounidenses" : "pesos",
    dia_vencimiento: String(c.payment_due_day),
    ajuste: adjustmentClause(c),
    deposito: formatMoney(c.deposit_amount, c.currency),
    deposito_letras: amountInWords(c.deposit_amount, c.currency),
    punitorio: lateFeeClause(c),
  };
}

// Completa la plantilla. Lo que falta queda visible como [COMPLETAR: ...]
// para que nadie firme un contrato con huecos sin darse cuenta.
export function renderTemplate(body: string, values: Record<string, string>): { text: string; missing: string[] } {
  const missing = new Set<string>();
  const text = body.replace(/\{\{\s*([a-z_]+)\s*\}\}/g, (_, key: string) => {
    const value = values[key];
    if (value) return value;
    const label = LABELS.get(key) ?? key;
    missing.add(label);
    return `[COMPLETAR: ${label}]`;
  });
  for (const match of text.matchAll(/\[COMPLETAR: ([^\]]+)\]/g)) missing.add(match[1]);
  return { text, missing: [...missing] };
}

// Bloques para el PDF: "# " título, "## " cláusula, resto párrafos.
export type TemplateBlock = { kind: "title" | "heading" | "paragraph"; text: string };

export function toBlocks(text: string): TemplateBlock[] {
  return text.split(/\n{2,}/).map((chunk) => chunk.replace(/\s+$/, "")).filter((chunk) => chunk.trim()).map((chunk) => {
    if (chunk.startsWith("## ")) return { kind: "heading", text: chunk.slice(3).trim() };
    if (chunk.startsWith("# ")) return { kind: "title", text: chunk.slice(2).trim() };
    return { kind: "paragraph", text: chunk };
  });
}
