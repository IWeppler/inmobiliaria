import "server-only";
import { generateObject } from "ai";
import { google } from "@ai-sdk/google";
import { z } from "zod";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { BRAND, formatLocation, formatPrice } from "@/lib/brand";

// E3.4 — Agente IA en WhatsApp. Responde consultas sobre el catálogo,
// perfila al lead (qué busca, zona, presupuesto) y, cuando quiere
// visitar, lo manda a la booking page (E3.2) en vez de negociar turnos
// por chat -- ahí ya está la disponibilidad real del asesor. Si pide
// hablar con una persona o el modelo no está seguro, deriva al agente
// humano con una notificación en el dashboard. Se activa con
// WHATSAPP_AI_AGENT=true (además de las credenciales de E3.3).
export const aiAgentEnabled = process.env.WHATSAPP_AI_AGENT === "true";

const replySchema = z.object({
  reply: z
    .string()
    .describe("Respuesta para WhatsApp: corta (máx. 4 líneas), voseo, sin markdown, sin emojis excesivos"),
  intent: z
    .enum(["consulta", "agendar", "humano", "otro"])
    .describe("consulta = pregunta sobre propiedades; agendar = quiere visitar; humano = pide hablar con alguien o hay que derivar; otro = saludo / no relacionado"),
  propertyId: z
    .string()
    .nullable()
    .describe("id de la propiedad del catálogo a la que se refiere, o null"),
  profile: z
    .object({
      operation: z.enum(["venta", "alquiler"]).nullable(),
      propertyType: z.string().nullable(),
      zone: z.string().nullable(),
      budget: z.string().nullable(),
    })
    .describe("Lo que se pudo inferir del lead hasta ahora (null si no se sabe)"),
});

export type AgentReply = z.infer<typeof replySchema>;

async function catalog() {
  const { data } = await supabaseAdmin
    .from("properties")
    .select("id, title, price, currency, city, province, neighborhood, operation_type, bedrooms, total_area, property_types(name)")
    .in("status", ["EN_VENTA", "EN_ALQUILER"])
    .order("created_at", { ascending: false })
    .limit(60);
  return (data ?? []).map((p) => ({
    id: p.id,
    title: p.title,
    type: p.property_types?.name ?? "",
    operation: p.operation_type?.toUpperCase() === "ALQUILER" ? "alquiler" : "venta",
    price: formatPrice(p.price, p.currency),
    location: formatLocation(p),
    bedrooms: p.bedrooms,
    area: p.total_area,
    url: `${BRAND.siteUrl}/propiedades/${p.id}`,
  }));
}

export async function generateAgentReply(opts: {
  leadName: string;
  history: { role: "lead" | "agente"; text: string }[];
  message: string;
}): Promise<AgentReply> {
  const items = await catalog();

  const { object } = await generateObject({
    model: google("gemini-2.5-flash"),
    schema: replySchema,
    system: `Sos el asistente de WhatsApp de ${BRAND.name}, una inmobiliaria argentina. Hablás en español rioplatense (voseo), cordial y directo, mensajes cortos como en un chat real. Solo respondés con información del catálogo que te paso; si no hay algo que encaje, lo decís y ofrecés que un asesor lo contacte. Nunca inventás precios ni direcciones. Si el lead quiere visitar una propiedad, intent = "agendar" y en reply le decís que le mandás el link para elegir día y horario (el link se agrega automáticamente, no lo escribas). Si pide hablar con una persona, se queja, o el tema excede el catálogo (contratos, financiación, tasación), intent = "humano". Cuando compartas una propiedad incluí su url del catálogo.`,
    prompt: `Catálogo (JSON):
${JSON.stringify(items)}

Lead: ${opts.leadName}
Conversación previa (más antigua primero):
${opts.history.map((h) => `${h.role === "lead" ? "LEAD" : "AGENTE"}: ${h.text}`).join("\n") || "(sin historial)"}

Mensaje nuevo del lead:
${opts.message}`,
  });

  return object;
}
