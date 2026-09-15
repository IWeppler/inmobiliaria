import { NextRequest } from "next/server";
import { supabaseAdmin, nextAgentForLead } from "@/lib/supabase-admin";
import {
  markRead,
  parseInbound,
  sendText,
  whatsappEnabled,
} from "@/lib/whatsapp";
import { aiAgentEnabled, generateAgentReply } from "@/features/whatsapp/agent";
import { BRAND } from "@/lib/brand";

// E3.3 / E3.4 — Webhook de WhatsApp Business.
//   GET  -> verificación del webhook (Meta manda hub.challenge)
//   POST -> mensajes entrantes: se registran como nota en el lead (se crea
//           el lead si el teléfono no existe) y, si el agente IA está
//           activo, se responde.
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
const WA_BOT_PREFIX = "[WhatsApp · asistente]";

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
  const payload = await req.json().catch(() => null);
  const inbound = parseInbound(payload);
  // Meta reintenta si no respondemos 200 rápido: se responde siempre 200
  // y se procesa lo que se pueda.
  if (inbound.length === 0) return new Response("ok");

  for (const msg of inbound) {
    if (!msg.text) continue; // audio/imagen/etc.: por ahora no se procesan
    try {
      const { lead, created } = await findOrCreateLead(msg.from, msg.profileName);
      if (!lead) continue;

      await addNote(lead.id, `${WA_PREFIX} ${msg.text}`);
      if (whatsappEnabled) void markRead(msg.id).catch(() => {});

      if (!aiAgentEnabled || !whatsappEnabled) {
        await notifyAgent(
          lead.agent_id,
          lead.id,
          created ? "Nuevo lead por WhatsApp" : "Mensaje de WhatsApp",
          `${lead.name}: ${msg.text.slice(0, 120)}`
        );
        continue;
      }

      // E3.4: historial reciente (notas de WhatsApp) para dar contexto.
      const { data: notes } = await supabaseAdmin
        .from("lead_notes")
        .select("content")
        .eq("lead_id", lead.id)
        .order("created_at", { ascending: false })
        .limit(12);
      const history = (notes ?? [])
        .map((n) => n.content ?? "")
        .filter((c) => c.startsWith(WA_PREFIX) || c.startsWith(WA_BOT_PREFIX))
        .reverse()
        .slice(0, -1) // el último es el mensaje actual
        .map((c) =>
          c.startsWith(WA_BOT_PREFIX)
            ? { role: "agente" as const, text: c.slice(WA_BOT_PREFIX.length).trim() }
            : { role: "lead" as const, text: c.slice(WA_PREFIX.length).trim() }
        );

      const ai = await generateAgentReply({
        leadName: lead.name,
        history,
        message: msg.text,
      });

      let reply = ai.reply.trim();
      if (ai.intent === "agendar" && ai.propertyId) {
        reply += `\n\nElegí día y horario acá: ${BRAND.siteUrl}/agendar/${ai.propertyId}`;
      }

      const sent = await sendText(msg.from, reply);
      await addNote(
        lead.id,
        `${WA_BOT_PREFIX} ${reply}${sent.ok ? "" : `\n(no enviado: ${sent.error})`}`
      );

      // Perfilado: se guarda como nota estructurada si se infirió algo.
      const profile = Object.entries(ai.profile).filter(([, v]) => v);
      if (profile.length > 0) {
        await addNote(
          lead.id,
          `[Perfil IA] ${profile.map(([k, v]) => `${k}: ${v}`).join(" · ")}`
        );
      }

      if (ai.intent === "humano" || created) {
        await notifyAgent(
          lead.agent_id,
          lead.id,
          ai.intent === "humano" ? "WhatsApp: pide hablar con un asesor" : "Nuevo lead por WhatsApp",
          `${lead.name}: ${msg.text.slice(0, 120)}`
        );
      }
      if (ai.intent === "agendar" && lead.status === "NUEVO") {
        await supabaseAdmin.from("leads").update({ status: "CONTACTADO" }).eq("id", lead.id);
      }
    } catch (e) {
      console.error("WhatsApp webhook error:", e);
    }
  }

  return new Response("ok");
}
