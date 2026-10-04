"use server";

import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { z } from "zod";
import { createClientServer } from "@/lib/supabase";
import type { ActionResult, ContractInput } from "@/features/rentals/actions";
import { isOwnDraft } from "@/features/rentals/contractDrafts";
import { getPropertyOwners, ownersLabel } from "@/features/rentals/propertyOwners";
import { ADJUSTMENT_INDEXES, DEFAULT_INDEX_LAG } from "@/features/rentals/logic";

// Carga de contratos desde el PDF firmado. Claude lee el contrato y devuelve
// los datos con un esquema fijo; el agente revisa el formulario prellenado
// antes de guardar. Nada se crea solo: esto únicamente propone valores.

const MODEL = "claude-opus-5-5";

const partySchema = z.object({
  full_name: z.string().describe("Nombre y apellido o razón social, como figura en el contrato"),
  document: z.string().nullable().describe("DNI, CUIT o CUIL tal como figura (con o sin puntos/guiones)"),
  phone: z.string().nullable(),
  email: z.string().nullable(),
  address: z.string().nullable().describe("Domicilio constituido o real de la parte"),
});

const extractionSchema = z.object({
  is_rental_contract: z.boolean().describe("false si el documento no es un contrato de locación"),
  owners: z.array(partySchema).describe("Locadores / propietarios"),
  tenants: z.array(partySchema).describe("Locatarios / inquilinos"),
  guarantors: z.array(partySchema).describe("Fiadores / garantes personales"),
  property_address: z.string().nullable().describe("Domicilio del inmueble locado (calle, número, piso/depto, localidad)"),
  property_id: z.string().nullable().describe("id de la propiedad candidata que coincide con el inmueble, o null"),
  start_date: z.string().nullable().describe("Inicio de la locación, YYYY-MM-DD"),
  end_date: z.string().nullable().describe("Fin de la locación, YYYY-MM-DD"),
  rent_amount: z.number().nullable().describe("Canon mensual del primer período"),
  currency: z.enum(["ARS", "USD"]).nullable(),
  adjustment_index: z.enum(ADJUSTMENT_INDEXES).nullable(),
  adjustment_months: z.number().int().nullable().describe("Cada cuántos meses se ajusta"),
  adjustment_pct: z.number().nullable().describe("Solo FIJO: porcentaje de cada ajuste"),
  payment_due_day: z.number().int().nullable().describe("Último día del mes para pagar sin mora"),
  deposit_amount: z.number().nullable().describe("Depósito en garantía, en la moneda del contrato"),
  guarantee_type: z.enum(["NINGUNA", "GARANTE", "CAUCION"]).nullable(),
  guarantee_detail: z.string().nullable().describe("Garante(s) o aseguradora y número de póliza"),
  late_fee_pct_daily: z.number().nullable().describe("Interés punitorio expresado como % diario"),
  late_fee_fixed: z.number().nullable().describe("Multa fija por mora, si la hay"),
  commission_pct: z.number().nullable().describe("Honorarios de administración como % del canon, solo si el contrato los fija"),
  notes: z.string().describe("Resumen breve de cláusulas relevantes para la administración (expensas, servicios, rescisión, destino, mascotas...)"),
  warnings: z.array(z.string()).describe("Datos dudosos, ilegibles, contradictorios o que no encajan en los campos"),
});

export type ExtractedParty = z.infer<typeof partySchema> & { matched_id: string | null };

export type ContractExtraction = {
  initial: Partial<ContractInput>;
  owner: ExtractedParty | null;
  tenant: ExtractedParty | null;
  property_address: string | null;
  property_matched: boolean;
  warnings: string[];
};

const SYSTEM = `Sos un asistente de una inmobiliaria argentina que administra alquileres. Vas a leer un contrato de locación firmado y extraer sus datos para cargarlo en el sistema de administración. Un agente revisa todo antes de guardar, así que es preferible dejar un campo en null y avisarlo en warnings que inventar un valor.

Criterios:
- Fechas en formato YYYY-MM-DD. Si el contrato da inicio y plazo pero no fecha de fin, calculá el fin como inicio + plazo - 1 día y avisalo en warnings.
- rent_amount es el canon mensual del primer período, sin expensas ni servicios. Si el contrato fija montos escalonados por período, usá el primero, adjustment_index = MANUAL y detallá la escala en notes.
- adjustment_index: ICL si ajusta por el Índice para Contratos de Locación (BCRA); IPC si ajusta por el índice de precios al consumidor (INDEC); CASA_PROPIA si usa el coeficiente Casa Propia; FIJO si son aumentos de un porcentaje fijo (adjustment_pct); MANUAL para cualquier otra fórmula; NINGUNO si no hay ajuste.
- adjustment_months: periodicidad del ajuste en meses (trimestral = 3, cuatrimestral = 4, semestral = 6, anual = 12).
- payment_due_day: si dice "del 1 al 10 de cada mes", es 10. Entre 1 y 28; si el contrato dice un día mayor, poné 28 y avisalo.
- late_fee_pct_daily: convertí a porcentaje diario (un 3% mensual es 0.1). Si la mora se calcula con otra tasa (por ejemplo, la activa del Banco Nación), dejalo en null y explicalo en warnings.
- deposit_amount: si se expresa como "un mes de alquiler", calculá el monto.
- guarantee_type: GARANTE para fianza personal o garantía propietaria (detallá nombres en guarantee_detail), CAUCION para seguro de caución (aseguradora y póliza), NINGUNA si no hay.
- property_id: elegí de la lista de propiedades candidatas solo si el domicilio coincide claramente con el inmueble locado; si no, null.
- Copiá los nombres y documentos exactamente como figuran.
- notes y warnings en español rioplatense, breves y concretos.`;

export async function extractContractFromPdfAction(input: { path: string; file_name: string }): Promise<ActionResult<ContractExtraction>> {
  const supabase = await createClientServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false, message: "No autenticado" };
  if (!isOwnDraft(input.path, user.id) || !input.path.endsWith(".pdf")) return { success: false, message: "Archivo inválido." };
  if (!process.env.ANTHROPIC_API_KEY) {
    return { success: false, message: "La lectura con IA no está configurada (falta ANTHROPIC_API_KEY)." };
  }

  const [{ data: file, error: downloadError }, { data: properties }, { data: contacts }] = await Promise.all([
    supabase.storage.from("rental-docs").download(input.path),
    supabase.from("properties").select("id, title, street_address, neighborhood, city").ilike("operation_type", "alquiler"),
    supabase.from("rental_contacts").select("id, full_name, kind, document"),
  ]);
  if (downloadError || !file) return { success: false, message: "No se pudo leer el PDF subido." };

  const candidates = (properties ?? [])
    .map((p) => `- ${p.id}: ${[p.street_address, p.neighborhood, p.city].filter(Boolean).join(", ") || "sin domicilio"} (${p.title})`)
    .join("\n");

  let extracted: z.infer<typeof extractionSchema>;
  try {
    const client = new Anthropic();
    const response = await client.beta.messages.parse({
      model: MODEL,
      max_tokens: 16000,
      // Si el modelo declina por política, la API reintenta con el modelo
      // de respaldo recomendado dentro del mismo request.
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      thinking: { type: "adaptive" },
      output_config: { effort: "medium", format: betaZodOutputFormat(extractionSchema) },
      system: SYSTEM,
      messages: [{
        role: "user",
        content: [
          {
            type: "document",
            source: { type: "base64", media_type: "application/pdf", data: Buffer.from(await file.arrayBuffer()).toString("base64") },
          },
          { type: "text", text: `Propiedades candidatas (id: domicilio):\n${candidates || "(ninguna)"}\n\nExtraé los datos de este contrato.` },
        ],
      }],
    });

    if (response.stop_reason === "refusal") return { success: false, message: "La IA no pudo procesar este documento. Cargalo a mano." };
    if (response.stop_reason === "max_tokens" || !response.parsed_output) {
      return { success: false, message: "No se pudo interpretar el contrato. Probá de nuevo o cargalo a mano." };
    }
    extracted = response.parsed_output;
  } catch (error) {
    console.error("[contractExtraction]", error);
    if (error instanceof Anthropic.RateLimitError) return { success: false, message: "La IA está saturada. Probá en un minuto." };
    if (error instanceof Anthropic.BadRequestError) return { success: false, message: "El PDF no se pudo procesar (¿protegido o dañado?)." };
    if (error instanceof Anthropic.AuthenticationError) return { success: false, message: "La clave de la IA es inválida." };
    if (error instanceof Anthropic.APIError) return { success: false, message: "La IA no respondió. Probá de nuevo." };
    return { success: false, message: "No se pudo leer el contrato." };
  }

  if (!extracted.is_rental_contract) {
    return { success: false, message: "El PDF no parece un contrato de locación." };
  }

  const people = (contacts ?? []) as { id: string; full_name: string; kind: string; document: string | null }[];
  let owner: ExtractedParty | null = extracted.owners[0] ? { ...extracted.owners[0], matched_id: matchContact(extracted.owners[0], people, "owner") } : null;
  const tenant = extracted.tenants[0] ? { ...extracted.tenants[0], matched_id: matchContact(extracted.tenants[0], people, "tenant") } : null;
  const propertyId = extracted.property_id && properties?.some((p) => p.id === extracted.property_id) ? extracted.property_id : null;

  const warnings = [...extracted.warnings];
  // Si la propiedad ya tiene dueños, mandan ellos: el locador del PDF solo
  // se compara y, si no coincide, se avisa.
  const registered = propertyId ? (await getPropertyOwners(supabase, [propertyId]))[propertyId] : undefined;
  if (registered?.length) {
    const registeredIds = new Set(registered.map((o) => o.contact_id));
    const unknown = extracted.owners
      .map((party) => ({ party, id: matchContact(party, people, "owner") }))
      .filter(({ id }) => !id || !registeredIds.has(id));
    if (unknown.length) {
      warnings.push(`El contrato nombra como locador a ${unknown.map((u) => u.party.full_name).join(", ")}, pero la propiedad tiene registrado a ${ownersLabel(registered)}. Se usa el dueño de la propiedad; si cambió, actualizalo en la propiedad antes de guardar.`);
    }
    owner = null;
  } else if (extracted.owners.length > 1) {
    warnings.push(`Hay ${extracted.owners.length} locadores: se cargó ${extracted.owners[0].full_name}. Después cargá los dueños con sus porcentajes en la propiedad.`);
  }
  if (extracted.tenants.length > 1) warnings.push(`Hay ${extracted.tenants.length} locatarios: se cargó ${extracted.tenants[0].full_name}.`);

  const guaranteeDetail = extracted.guarantee_detail
    ?? (extracted.guarantors.length ? extracted.guarantors.map((g) => g.document ? `${g.full_name} (${g.document})` : g.full_name).join(", ") : null);

  const index = extracted.adjustment_index;
  const initial: Partial<ContractInput> = {
    property_id: propertyId ?? "",
    owner_id: owner?.matched_id ?? "",
    tenant_id: tenant?.matched_id ?? "",
    ...(validYmd(extracted.start_date) && { start_date: extracted.start_date! }),
    ...(validYmd(extracted.end_date) && { end_date: extracted.end_date! }),
    ...(extracted.rent_amount && extracted.rent_amount > 0 && { rent_amount: extracted.rent_amount }),
    ...(extracted.currency && { currency: extracted.currency }),
    ...(index && { adjustment_index: index, index_lag_months: DEFAULT_INDEX_LAG[index] ?? 0 }),
    ...(inRange(extracted.adjustment_months, 1, 36) && { adjustment_months: extracted.adjustment_months! }),
    ...(index === "FIJO" && inRange(extracted.adjustment_pct, 0, 500) && { adjustment_pct: extracted.adjustment_pct! }),
    ...(inRange(extracted.payment_due_day, 1, 28) && { payment_due_day: extracted.payment_due_day! }),
    ...(inRange(extracted.deposit_amount, 0, Infinity) && { deposit_amount: extracted.deposit_amount! }),
    ...(extracted.guarantee_type && { guarantee_type: extracted.guarantee_type }),
    ...(guaranteeDetail && { guarantee_detail: guaranteeDetail.slice(0, 200) }),
    ...(inRange(extracted.late_fee_pct_daily, 0, 10) && { late_fee_pct_daily: extracted.late_fee_pct_daily! }),
    ...(inRange(extracted.late_fee_fixed, 0, Infinity) && { late_fee_fixed: extracted.late_fee_fixed! }),
    ...(inRange(extracted.commission_pct, 0, 100) && { commission_pct: extracted.commission_pct! }),
    notes: extracted.notes.slice(0, 2000),
    source_pdf_path: input.path,
    source_pdf_name: input.file_name.slice(0, 200),
  };

  return {
    success: true,
    message: "Contrato leído. Revisá los datos antes de guardar.",
    data: {
      initial, owner, tenant,
      property_address: extracted.property_address,
      property_matched: !!propertyId,
      warnings,
    },
  };
}

function validYmd(value: string | null) {
  return !!value && /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(value));
}

function inRange(value: number | null, min: number, max: number) {
  return value !== null && Number.isFinite(value) && value >= min && value <= max;
}

// Busca el contacto ya cargado: primero por documento (el DNI está dentro
// del CUIT), después por nombre normalizado.
function matchContact(
  party: z.infer<typeof partySchema>,
  people: { id: string; full_name: string; kind: string; document: string | null }[],
  kind: "owner" | "tenant",
): string | null {
  const sameKind = people.filter((p) => p.kind === kind);
  const doc = dni(party.document);
  if (doc) {
    const byDoc = sameKind.find((p) => dni(p.document) === doc);
    if (byDoc) return byDoc.id;
  }
  const name = normalizeName(party.full_name);
  return sameKind.find((p) => normalizeName(p.full_name) === name)?.id ?? null;
}

function dni(document: string | null) {
  const digits = (document ?? "").replace(/\D/g, "");
  if (digits.length === 11) return digits.slice(2, 10).replace(/^0+/, "");
  return digits.length >= 7 && digits.length <= 8 ? digits.replace(/^0+/, "") : null;
}

function normalizeName(name: string) {
  return name.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase()
    .replace(/[^a-z\s]/g, " ").split(/\s+/).filter(Boolean).sort().join(" ");
}
