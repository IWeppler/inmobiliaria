import { after, NextRequest } from "next/server";
import { supabaseAdmin, nextAgentForLead } from "@/lib/supabase-admin";
import {
  markRead,
  parseInbound,
  verifyWebhookSignature,
  whatsappEnabled,
} from "@/lib/whatsapp";
import { findRentalContact, intakeRentalMessage, processInboxItem } from "@/features/rentals/inboxIntake";

// La clasificación con IA corre después de responder (after) y puede tardar.
export const maxDuration = 60;

// E3.3 / E3.4 — Webhook de WhatsApp Business.
//   GET  -> verificación del webhook (Meta manda hub.challenge)
//   POST -> mensajes entrantes. De inquilinos / propietarios: bandeja de
//           Mensajes de alquileres (E4.18). Del resto: nota en el lead (se
//           crea el lead si el teléfono no existe).
// Seguridad: con WHATSAPP_APP_SECRET se verifica la firma de Meta.
// Configurar en Meta: URL = <site>/api/whatsapp/webhook, campo "messages".
const VERIFY_TOKEN = process.env.WHATSAPP_VERIFY_TOKEN;

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams;
  if (
    q.get("hub.mode") === "subscribe" &&
    VERIFY_TOKEN &&
    q.get("hub.verify_token") === VERIFY_TOKEN
  ) {
    return new Response(q.get("hub.challenge") ?? "", { status: 200 });
  }
  return new Response("Forbidden", { status: 403 });
}

const WA_PREFIX = "[WhatsApp]";

async function findOrCreateLead(phone: string, profileName?: string) {
  // El teléfono guardado puede tener formato libre: se compara por los
  // últimos 10 dígitos (área + número, sin 549 / 0 / 15).
  const tail = phone.slice(-10);
  const { data: existing } = await supabaseAdmin
    .from("leads")
    .select("id, name, agent_id, status")
    .ilike("phone", `%${tail}`)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (existing) return { lead: existing, created: false };

  const agentId = await nextAgentForLead();
  const { data: lead } = await supabaseAdmin
    .from("leads")
    .insert({
      name: profileName || `WhatsApp +${phone}`,
      phone: `+${phone}`,
      agent_id: agentId,
      status: "NUEVO",
      source: "WHATSAPP",
      notes: "Lead creado automáticamente desde un mensaje entrante de WhatsApp.",
    })
    .select("id, name, agent_id, status")
    .single();
  return { lead, created: true };
}

async function addNote(leadId: string, content: string) {
  await supabaseAdmin.from("lead_notes").insert({ lead_id: leadId, content });
}

async function notifyAgent(agentId: string | null, leadId: string, title: string, message: string) {
  if (!agentId) return;
  await supabaseAdmin.from("notifications").insert({
    user_id: agentId,
    title,
    message,
    link: `/dashboard/leads/${leadId}`,
    type: "whatsapp",
  });
}

export async function POST(req: Request) {
  // La firma se calcula sobre el cuerpo crudo: se lee como texto antes de parsear.
  const raw = await req.text();
  if (!(await verifyWebhookSignature(raw, req.headers.get("x-hub-signature-256")))) {
    return new Response("Invalid signature", { status: 401 });
  }
  let payload: unknown = null;
  try { payload = JSON.parse(raw); } catch { /* cuerpo inválido */ }
  const inbound = parseInbound(payload);
  // Meta reintenta si no respondemos 200 rápido: se responde siempre 200
  // y se procesa lo que se pueda.
  if (inbound.length === 0) return new Response("ok");

  for (const msg of inbound) {
    if (!msg.text && !msg.media) continue; // audio, ubicación, stickers: no se procesan
    try {
      // Inquilinos y propietarios: bandeja de Mensajes de alquileres, con
      // clasificación por IA después de responder a Meta.
      const rental = await findRentalContact(msg.from);
      if (rental) {
        const inboxId = await intakeRentalMessage(msg, rental);
        if (inboxId) after(() => processInboxItem(inboxId, msg.media?.id).catch((e) => console.error("[inbox] IA", e)));
        continue;
      }
      if (!msg.text) continue; // adjuntos de números desconocidos: no se procesan
      const { lead, created } = await findOrCreateLead(msg.from, msg.profileName);
      if (!lead) continue;

      await addNote(lead.id, `${WA_PREFIX} ${msg.text}`);
      if (whatsappEnabled) void markRead(msg.id).catch(() => {});

      await notifyAgent(
        lead.agent_id,
        lead.id,
        created ? "Nuevo lead por WhatsApp" : "Mensaje de WhatsApp",
        `${lead.name}: ${msg.text.slice(0, 120)}`
      );
    } catch (e) {
      console.error("WhatsApp webhook error:", e);
    }
  }

  return new Response("ok");
}
