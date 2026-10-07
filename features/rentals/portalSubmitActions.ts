"use server";

import { z } from "zod";
import { after } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { ymdInAppTz } from "@/lib/dates";
import type { ActionResult } from "@/features/rentals/actions";
import { formatDate, money } from "@/features/rentals/logic";
import { INBOX_MEDIA, isInboxMime, type InboxAiData } from "@/features/rentals/inbox";
import { notifyAgent, processInboxItem } from "@/features/rentals/inboxIntake";
import { resolvePortalLink, type PortalAccess } from "@/features/rentals/portal";

// Portal etapa 2 (E4.20): acciones públicas, autorizadas solo por el token
// del link. Lo que manda el inquilino entra a la bandeja de Mensajes y el
// agente lo confirma: el portal no registra cobros ni reclamos por sí solo.

const BUCKET = "rental-docs";
const MAX_BYTES = 10 * 1024 * 1024;
// Tope de envíos sin revisar por persona: evita que un link filtrado llene la bandeja.
const MAX_PENDING = 10;

const tokenSchema = z.string().regex(/^[A-Za-z0-9_-]{20,64}$/);

async function access(token: string): Promise<PortalAccess | { error: string }> {
  if (!tokenSchema.safeParse(token).success) return { error: "Link inválido." };
  const portal = await resolvePortalLink(token);
  if (!portal) return { error: "El link venció o fue reemplazado. Pedile uno nuevo a la inmobiliaria." };
  if (!portal.activeTenantContractId) return { error: "No tenés un alquiler vigente para enviar esto." };
  const { count } = await supabaseAdmin.from("rental_inbox").select("id", { count: "exact", head: true })
    .eq("contact_id", portal.contactId).eq("source", "PORTAL").eq("status", "PENDIENTE");
  if ((count ?? 0) >= MAX_PENDING) return { error: "Tenés varios envíos esperando revisión. Esperá a que los procesemos o escribinos por WhatsApp." };
  return portal;
}

// Paso 1: URL firmada para que el navegador suba el archivo directo a
// storage (las fotos superan el límite de tamaño de las acciones).
export async function createPortalUploadAction(input: { token: string; mime: string; size: number }): Promise<ActionResult<{ path: string; uploadToken: string }>> {
  const portal = await access(input.token);
  if ("error" in portal) return { success: false, message: portal.error };
  if (!isInboxMime(input.mime)) return { success: false, message: "Subí una foto (JPG, PNG o WebP) o un PDF." };
  if (!(input.size > 0) || input.size > MAX_BYTES) return { success: false, message: "El archivo supera los 10 MB." };
  const path = `inbox/portal/${portal.contactId}/${crypto.randomUUID()}.${INBOX_MEDIA[input.mime]}`;
  const { data, error } = await supabaseAdmin.storage.from(BUCKET).createSignedUploadUrl(path);
  if (error || !data) return { success: false, message: "No se pudo preparar la subida. Probá de nuevo." };
  return { success: true, message: "ok", data: { path, uploadToken: data.token } };
}

// El archivo tiene que ser de esta persona y existir de verdad en storage.
async function verifyUpload(portal: PortalAccess, path?: string, mime?: string) {
  if (!path) return { path: null, mime: null };
  const prefix = `inbox/portal/${portal.contactId}/`;
  if (!path.startsWith(prefix) || path.includes("..") || !mime || !isInboxMime(mime)) return null;
  const { data } = await supabaseAdmin.storage.from(BUCKET).list(prefix.slice(0, -1), { search: path.slice(prefix.length) });
  return data?.some((f) => `${prefix}${f.name}` === path) ? { path, mime } : null;
}

const paymentSchema = z.object({
  token: z.string(),
  path: z.string().max(300).optional(),
  mime: z.string().max(60).optional(),
  amount: z.number().positive().max(1e12).optional(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  note: z.string().trim().max(500).optional(),
}).refine((v) => v.path || v.amount, { message: "Adjuntá el comprobante o indicá el monto." });

export async function submitPortalPaymentAction(input: z.input<typeof paymentSchema>): Promise<ActionResult> {
  const parsed = paymentSchema.safeParse(input);
  if (!parsed.success) return { success: false, message: parsed.error.issues[0]?.message ?? "Revisá los datos." };
  const portal = await access(parsed.data.token);
  if ("error" in portal) return { success: false, message: portal.error };
  const file = await verifyUpload(portal, parsed.data.path, parsed.data.mime);
  if (!file) return { success: false, message: "No encontramos el archivo subido. Volvé a adjuntarlo." };

  const { amount, date, note } = parsed.data;
  const { data: contract } = await supabaseAdmin.from("rental_contracts").select("currency").eq("id", portal.activeTenantContractId!).single();
  const currency = contract?.currency === "USD" ? "USD" : "ARS";
  const text = [
    "Pago informado desde el portal.",
    amount ? `Monto: ${money(amount, currency)}.` : null,
    date ? `Fecha: ${formatDate(date)}.` : null,
    note ? `Nota: ${note}` : null,
  ].filter(Boolean).join(" ");
  const aiData: InboxAiData = {
    payment: { amount: amount ?? null, currency: amount ? currency : null, date: date && date <= ymdInAppTz() ? date : null, payer_name: null, reference: null },
    claim: null,
    suggested_reply: null,
  };

  const { data: item, error } = await supabaseAdmin.from("rental_inbox").insert({
    wa_message_id: `portal:${crypto.randomUUID()}`, source: "PORTAL", contact_id: portal.contactId,
    contract_id: portal.activeTenantContractId, text, media_path: file.path, media_mime: file.mime,
    kind: "COMPROBANTE", ai_data: aiData, ai_summary: amount ? `Pago informado por ${money(amount, currency)}` : "Comprobante enviado desde el portal",
  }).select("id").single();
  if (error || !item) return { success: false, message: "No se pudo enviar. Probá de nuevo." };

  // La IA lee el comprobante (si hay archivo) y avisa al agente.
  after(async () => {
    if (file.path) await processInboxItem(item.id, undefined, { forcedKind: "COMPROBANTE" }).catch((e) => console.error("[portal] IA", e));
    else await notifyAgent(portal.activeTenantContractId, "pago informado", text, "PORTAL").catch(() => {});
  });
  return { success: true, message: "Recibimos tu pago. Lo verificamos y te enviamos el recibo." };
}

const claimSchema = z.object({
  token: z.string(),
  description: z.string().trim().min(10, "Contanos un poco más qué pasa.").max(2000),
  urgency: z.enum(["BAJA", "MEDIA", "ALTA", "URGENTE"]),
  path: z.string().max(300).optional(),
  mime: z.string().max(60).optional(),
});

export async function submitPortalClaimAction(input: z.input<typeof claimSchema>): Promise<ActionResult> {
  const parsed = claimSchema.safeParse(input);
  if (!parsed.success) return { success: false, message: parsed.error.issues[0]?.message ?? "Revisá los datos." };
  const portal = await access(parsed.data.token);
  if ("error" in portal) return { success: false, message: portal.error };
  const file = await verifyUpload(portal, parsed.data.path, parsed.data.mime);
  if (!file) return { success: false, message: "No encontramos la foto subida. Volvé a adjuntarla." };

  const { description, urgency } = parsed.data;
  const title = description.split(/[.\n]/)[0].slice(0, 80);
  const { data: contact } = await supabaseAdmin.from("rental_contacts").select("full_name").eq("id", portal.contactId).single();
  const { error } = await supabaseAdmin.from("rental_inbox").insert({
    wa_message_id: `portal:${crypto.randomUUID()}`, source: "PORTAL", contact_id: portal.contactId,
    contract_id: portal.activeTenantContractId, text: description, media_path: file.path, media_mime: file.mime,
    kind: "RECLAMO", ai_summary: `Reclamo: ${title}`,
    ai_data: { payment: null, claim: { title, description, priority: urgency }, suggested_reply: null } satisfies InboxAiData,
  });
  if (error) return { success: false, message: "No se pudo enviar. Probá de nuevo." };

  after(() => notifyAgent(portal.activeTenantContractId, contact?.full_name ?? "Inquilino", `Reclamo: ${title}`, "PORTAL").catch(() => {}));
  return {
    success: true,
    message: urgency === "URGENTE"
      ? "Recibimos tu reclamo. Si hay riesgo (gas, agua, electricidad), llamanos además por teléfono."
      : "Recibimos tu reclamo. Te vamos a contactar para coordinar.",
  };
}
