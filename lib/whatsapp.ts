import "server-only";

// E3.3 — Cliente mínimo de WhatsApp Business (Meta Cloud API). Sin SDK:
// son dos endpoints HTTP. Se activa solo si están las credenciales; si
// no, todo es no-op (la app funciona igual sin WhatsApp). Requisitos en
// Meta: app de tipo Business, producto WhatsApp, número verificado,
// token permanente (System User) y, para plantillas, aprobación previa.
//
//   WHATSAPP_ACCESS_TOKEN      token permanente
//   WHATSAPP_PHONE_NUMBER_ID   id del número emisor (no el número)
//   WHATSAPP_VERIFY_TOKEN      string propio para verificar el webhook
//   WHATSAPP_API_VERSION       opcional, default v21.0
const TOKEN = process.env.WHATSAPP_ACCESS_TOKEN;
const PHONE_ID = process.env.WHATSAPP_PHONE_NUMBER_ID;
const VERSION = process.env.WHATSAPP_API_VERSION ?? "v21.0";

export const whatsappEnabled = Boolean(TOKEN && PHONE_ID);

// Meta exige E.164 sin "+". Normaliza lo que cargan los leads en AR:
// "0341 15 555-5555" -> "5493415555555" (se quita el 0 de área y el 15
// de móvil, se antepone 549).
export function normalizeArPhone(raw: string): string | null {
  let d = raw.replace(/\D/g, "");
  if (!d) return null;
  if (d.startsWith("549")) return d;
  if (d.startsWith("54")) d = d.slice(2);
  if (d.startsWith("0")) d = d.slice(1);
  // "15" tras el código de área (2 a 4 dígitos)
  d = d.replace(/^(\d{2,4})15(\d{6,8})$/, "$1$2");
  if (d.length < 10) return null;
  return `549${d}`;
}

type SendResult = { ok: true; id: string } | { ok: false; error: string };

async function call(body: unknown): Promise<SendResult> {
  if (!whatsappEnabled) return { ok: false, error: "WhatsApp no configurado" };
  const res = await fetch(
    `https://graph.facebook.com/${VERSION}/${PHONE_ID}/messages`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    }
  );
  const json = (await res.json().catch(() => ({}))) as {
    messages?: { id: string }[];
    error?: { message: string };
  };
  if (!res.ok || !json.messages?.[0]) {
    return { ok: false, error: json.error?.message ?? `HTTP ${res.status}` };
  }
  return { ok: true, id: json.messages[0].id };
}

// Texto libre: solo válido dentro de la ventana de 24 h desde el último
// mensaje del usuario. Fuera de esa ventana Meta lo rechaza -> plantilla.
export function sendText(to: string, text: string) {
  return call({
    messaging_product: "whatsapp",
    to,
    type: "text",
    text: { body: text, preview_url: true },
  });
}

// Plantilla aprobada en Meta. `params` son los {{1}}, {{2}}... del body,
// en orden. Las plantillas que usa la app (crearlas con estos nombres):
//   visita_confirmada  {{1}} nombre, {{2}} propiedad, {{3}} fecha, {{4}} hora
//   nueva_propiedad    {{1}} nombre, {{2}} título, {{3}} precio, {{4}} link
//   alquiler_*         ver RENTAL_TEMPLATES en features/rentals/notifications.ts
export type WhatsappTemplate =
  | "visita_confirmada" | "nueva_propiedad"
  | "alquiler_recibo" | "alquiler_aumento" | "alquiler_vencimiento" | "alquiler_deuda";

export function sendTemplate(
  to: string,
  template: WhatsappTemplate,
  params: string[],
  language = "es_AR"
) {
  return call({
    messaging_product: "whatsapp",
    to,
    type: "template",
    template: {
      name: template,
      language: { code: language },
      components: [
        {
          type: "body",
          parameters: params.map((text) => ({ type: "text", text })),
        },
      ],
    },
  });
}

// Marca un mensaje entrante como leído (doble tilde azul).
export function markRead(messageId: string) {
  return call({
    messaging_product: "whatsapp",
    status: "read",
    message_id: messageId,
  });
}

// Firma del webhook: Meta firma el cuerpo crudo con el App Secret
// (X-Hub-Signature-256: sha256=<hex>). Si WHATSAPP_APP_SECRET no está
// configurado no se puede verificar: se acepta y se avisa en el log.
export async function verifyWebhookSignature(rawBody: string, header: string | null): Promise<boolean> {
  const secret = process.env.WHATSAPP_APP_SECRET;
  if (!secret) {
    console.warn("[whatsapp] WHATSAPP_APP_SECRET sin configurar: el webhook no verifica la firma.");
    return true;
  }
  if (!header?.startsWith("sha256=")) return false;
  const { createHmac, timingSafeEqual } = await import("node:crypto");
  const expected = Buffer.from(createHmac("sha256", secret).update(rawBody, "utf8").digest("hex"));
  const received = Buffer.from(header.slice(7));
  return expected.length === received.length && timingSafeEqual(expected, received);
}

// Descarga un adjunto entrante: primero se pide la URL temporal del media
// y después el archivo, ambos con el token.
export async function downloadMedia(mediaId: string): Promise<{ bytes: ArrayBuffer; mime: string } | null> {
  if (!whatsappEnabled) return null;
  const meta = await fetch(`https://graph.facebook.com/${VERSION}/${mediaId}`, {
    headers: { Authorization: `Bearer ${TOKEN}` },
  });
  const info = (await meta.json().catch(() => ({}))) as { url?: string; mime_type?: string };
  if (!meta.ok || !info.url) return null;
  const file = await fetch(info.url, { headers: { Authorization: `Bearer ${TOKEN}` } });
  if (!file.ok) return null;
  return { bytes: await file.arrayBuffer(), mime: info.mime_type ?? file.headers.get("content-type") ?? "application/octet-stream" };
}

// Forma del webhook de mensajes entrantes (solo lo que usamos).
export type InboundMessage = {
  from: string; // wa_id, E.164 sin +
  id: string;
  timestamp: string;
  text?: string;
  profileName?: string;
  // Imagen o documento adjunto (el texto que lo acompaña va en `text`).
  media?: { id: string; mime: string; filename?: string };
};

export function parseInbound(payload: unknown): InboundMessage[] {
  const out: InboundMessage[] = [];
  const entries = (payload as { entry?: unknown[] })?.entry ?? [];
  for (const entry of entries as { changes?: unknown[] }[]) {
    for (const change of entry.changes ?? []) {
      const value = (change as { value?: Record<string, unknown> }).value ?? {};
      const contacts = (value.contacts ?? []) as {
        wa_id: string;
        profile?: { name?: string };
      }[];
      const messages = (value.messages ?? []) as {
        from: string;
        id: string;
        timestamp: string;
        type: string;
        text?: { body: string };
        image?: { id: string; mime_type: string; caption?: string };
        document?: { id: string; mime_type: string; caption?: string; filename?: string };
      }[];
      for (const m of messages) {
        const attachment = m.type === "image" ? m.image : m.type === "document" ? m.document : undefined;
        out.push({
          from: m.from,
          id: m.id,
          timestamp: m.timestamp,
          text: m.type === "text" ? m.text?.body : attachment?.caption,
          profileName: contacts.find((c) => c.wa_id === m.from)?.profile?.name,
          media: attachment ? { id: attachment.id, mime: attachment.mime_type, filename: m.document?.filename } : undefined,
        });
      }
    }
  }
  return out;
}
