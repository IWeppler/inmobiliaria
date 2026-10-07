import "server-only";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { downloadMedia, markRead, whatsappEnabled, type InboundMessage } from "@/lib/whatsapp";
import { ymdInAppTz } from "@/lib/dates";
import { money } from "@/features/rentals/logic";
import { classifyInboxMessage } from "@/features/rentals/inboxAi";
import {
  INBOX_MEDIA, isInboxMime, type InboxAiData, type InboxKind, type InboxMime, type InboxPayment,
} from "@/features/rentals/inbox";
import { loadReconciliationCandidates } from "@/features/rentals/reconciliationData";

// WhatsApp entrante de alquileres: si el número es de un inquilino o
// propietario cargado, el mensaje va a la bandeja de Mensajes (no a leads).

const BUCKET = "rental-docs";
const MAX_MEDIA_BYTES = 10 * 1024 * 1024;

type RentalMatch = { contactId: string; name: string; kind: string; contractId: string | null; agentId: string | null };

// El teléfono del contacto tiene formato libre: se compara por los últimos
// 10 dígitos (área + número). Prioriza a quien tiene un contrato activo.
export async function findRentalContact(phone: string): Promise<RentalMatch | null> {
  const tail = phone.replace(/\D/g, "").slice(-10);
  if (tail.length < 10) return null;
  const { data: contacts } = await supabaseAdmin.from("rental_contacts")
    .select("id, full_name, kind, phone").ilike("phone", `%${tail.slice(-4)}%`);
  const matches = (contacts ?? []).filter((c) => (c.phone ?? "").replace(/\D/g, "").endsWith(tail));
  if (!matches.length) return null;

  const ids = matches.map((c) => c.id);
  const [{ data: contracts }, { data: parties }] = await Promise.all([
    supabaseAdmin.from("rental_contracts").select("id, status, start_date, agent_id, tenant_id, owner_id")
      .or(`tenant_id.in.(${ids.join(",")}),owner_id.in.(${ids.join(",")})`),
    supabaseAdmin.from("rental_contract_parties").select("contact_id, contract:rental_contracts(id, status, start_date, agent_id)").in("contact_id", ids),
  ]);
  type C = { id: string; status: string; start_date: string; agent_id: string | null };
  const linked: { contactId: string; contract: C }[] = [
    ...(contracts ?? []).flatMap((c) => ids.filter((id) => id === c.tenant_id || id === c.owner_id).map((contactId) => ({ contactId, contract: c }))),
    ...(parties ?? []).flatMap((p) => (p.contract ? [{ contactId: p.contact_id, contract: p.contract as unknown as C }] : [])),
  ].sort((a, b) => Number(b.contract.status === "ACTIVO") - Number(a.contract.status === "ACTIVO") || b.contract.start_date.localeCompare(a.contract.start_date));

  const best = linked[0];
  const contact = matches.find((c) => c.id === (best?.contactId ?? matches[0].id))!;
  return {
    contactId: contact.id, name: contact.full_name, kind: contact.kind,
    contractId: best?.contract.id ?? null, agentId: best?.contract.agent_id ?? null,
  };
}

// Registra el mensaje (idempotente por id de WhatsApp: Meta reintenta).
export async function intakeRentalMessage(msg: InboundMessage, match: RentalMatch): Promise<string | null> {
  const { data, error } = await supabaseAdmin.from("rental_inbox").insert({
    wa_message_id: msg.id,
    contact_id: match.contactId,
    contract_id: match.contractId,
    received_at: new Date(Number(msg.timestamp) * 1000 || Date.now()).toISOString(),
    text: msg.text?.slice(0, 4000) ?? null,
    media_mime: msg.media?.mime ?? null,
  }).select("id").single();
  if (error) {
    if (error.code !== "23505") console.error("[inbox] alta", error.message);
    return null;
  }
  if (whatsappEnabled) void markRead(msg.id).catch(() => {});
  return data.id;
}

// Descarga el adjunto, lo guarda, clasifica con IA y avisa al agente. Corre
// después de responder al webhook; también se puede reintentar.
// `forcedKind`: el remitente ya eligió qué envía (portal); la IA solo
// completa los datos y no cambia el tipo.
export async function processInboxItem(inboxId: string, mediaId?: string, opts: { forcedKind?: InboxKind } = {}) {
  const { data: item } = await supabaseAdmin.from("rental_inbox")
    .select("id, contact_id, contract_id, text, media_path, media_mime, ai_data, source, contact:rental_contacts(full_name, kind)")
    .eq("id", inboxId).single();
  if (!item) return;

  // Adjunto: se baja de Meta la primera vez; en un reintento se lee de storage.
  let media: { bytes: ArrayBuffer; mime: InboxMime } | null = null;
  let mediaPath = item.media_path;
  if (mediaId && !mediaPath) {
    const file = await downloadMedia(mediaId).catch(() => null);
    if (file && isInboxMime(file.mime) && file.bytes.byteLength <= MAX_MEDIA_BYTES) {
      mediaPath = `inbox/${inboxId}.${INBOX_MEDIA[file.mime]}`;
      const { error } = await supabaseAdmin.storage.from(BUCKET).upload(mediaPath, file.bytes, { contentType: file.mime, upsert: true });
      if (error) mediaPath = null;
      else media = { bytes: file.bytes, mime: file.mime };
    }
  } else if (mediaPath && item.media_mime && isInboxMime(item.media_mime)) {
    const { data } = await supabaseAdmin.storage.from(BUCKET).download(mediaPath);
    if (data) media = { bytes: await data.arrayBuffer(), mime: item.media_mime };
  }

  const contact = item.contact as unknown as { full_name: string; kind: string } | null;
  const context = await buildContext(contact, item.contract_id);
  const result = await classifyInboxMessage({ text: item.text, media, context });

  const previous = (item.ai_data as InboxAiData | null) ?? { payment: null, claim: null, suggested_reply: null };
  const kind = opts.forcedKind ?? ("error" in result ? (media ? "COMPROBANTE" : "PENDIENTE_IA") : result.kind);
  // Con tipo forzado, lo que cargó el remitente se completa con lo que leyó la IA.
  const data: InboxAiData | null = "error" in result ? (opts.forcedKind ? previous : null) : opts.forcedKind ? {
    payment: kind === "COMPROBANTE" ? mergePayment(previous.payment, result.data.payment) : previous.payment,
    claim: previous.claim ?? result.data.claim,
    suggested_reply: result.data.suggested_reply,
  } : result.data;

  await supabaseAdmin.from("rental_inbox").update("error" in result
    ? { media_path: mediaPath, ai_error: result.error, kind, ...(data ? { ai_data: data } : {}) }
    : { media_path: mediaPath, ai_error: null, kind, ai_summary: result.summary, ai_data: data },
  ).eq("id", inboxId);

  await notifyAgent(item.contract_id, contact?.full_name ?? "Contacto", "error" in result ? null : result.summary,
    item.source === "PORTAL" ? "PORTAL" : "WHATSAPP");
}

// Lo informado por el inquilino tiene prioridad; la IA completa lo que falte.
function mergePayment(given: InboxPayment | null, read: InboxPayment | null): InboxPayment | null {
  if (!given) return read;
  if (!read) return given;
  return {
    amount: given.amount ?? read.amount, currency: given.currency ?? read.currency, date: given.date ?? read.date,
    payer_name: given.payer_name ?? read.payer_name, reference: given.reference ?? read.reference,
  };
}

async function buildContext(contact: { full_name: string; kind: string } | null, contractId: string | null) {
  const role = contact?.kind === "owner" ? "propietario" : contact?.kind === "tenant" ? "inquilino" : "contacto";
  const lines = [`Remitente: ${contact?.full_name ?? "desconocido"} (${role}).`];
  if (contractId) {
    const { data: contract } = await supabaseAdmin.from("rental_contracts")
      .select("rent_amount, currency, property:properties(title)").eq("id", contractId).single();
    const [candidate] = await loadReconciliationCandidates(supabaseAdmin, ymdInAppTz(), [contractId]);
    const debt = candidate?.open.filter((c) => c.due_date <= ymdInAppTz()).reduce((s, c) => s + c.outstanding, 0) ?? 0;
    const property = contract?.property as unknown as { title: string } | null;
    if (contract) lines.push(`Propiedad: ${property?.title ?? "sin título"}. Alquiler mensual: ${money(contract.rent_amount, contract.currency)}.`);
    if (contract) lines.push(`Saldo vencido a hoy: ${money(Math.round(debt * 100) / 100, contract.currency)}.`);
  }
  return lines.join("\n");
}

export async function notifyAgent(contractId: string | null, name: string, summary: string | null, source: "WHATSAPP" | "PORTAL" = "WHATSAPP") {
  let userId: string | null = null;
  if (contractId) {
    const { data } = await supabaseAdmin.from("rental_contracts").select("agent_id").eq("id", contractId).single();
    userId = data?.agent_id ?? null;
  }
  if (!userId) return;
  await supabaseAdmin.from("notifications").insert({
    user_id: userId,
    title: source === "PORTAL" ? `Portal: ${name}` : `WhatsApp de ${name}`,
    message: (summary ?? "Mensaje nuevo en la bandeja de alquileres.").slice(0, 200),
    link: "/dashboard/alquileres/mensajes",
    type: "whatsapp",
  });
}
