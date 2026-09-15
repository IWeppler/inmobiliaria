import { generateObject } from "ai";
import { google } from "@ai-sdk/google";
import { z } from "zod";
import { createClientServer } from "@/lib/supabase";
import { getSocialProperty, operationLabel, specChips } from "@/features/social/propertyCard";
import { BRAND, formatLocation, formatPrice } from "@/lib/brand";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// E2.2: 3 variantes de copy para Instagram con hashtags locales. Mismo
// proveedor que la descripción con IA (Gemini via ai-sdk). Requiere
// sesión: herramienta interna del dashboard.
const copySchema = z.object({
  variants: z
    .array(
      z.object({
        tone: z
          .string()
          .describe("Nombre corto del enfoque, ej. 'Directo', 'Aspiracional', 'Urgencia'"),
        caption: z
          .string()
          .describe("Texto del post, 3 a 6 líneas, con saltos de línea, sin hashtags"),
        hashtags: z
          .array(z.string())
          .min(8)
          .max(15)
          .describe("Hashtags sin '#', mezcla de locales (ciudad/provincia) y de rubro"),
      })
    )
    .length(3),
});

export async function POST(req: Request) {
  const supabase = await createClientServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return new Response("No autenticado", { status: 401 });

  const { propertyId } = (await req.json()) as { propertyId?: string };
  if (!propertyId) return new Response("Falta propertyId", { status: 400 });

  const p = await getSocialProperty(propertyId);
  if (!p) return new Response("Propiedad no encontrada", { status: 404 });

  const { data: full } = await supabase
    .from("properties")
    .select("description")
    .eq("id", propertyId)
    .single();

  try {
    const { object } = await generateObject({
      model: google("gemini-2.5-flash"),
      schema: copySchema,
      system: `Sos community manager de una inmobiliaria argentina (${BRAND.name}). Escribís captions de Instagram en español rioplatense (voseo), naturales, sin exagerar, con 1 o 2 emojis como máximo por caption. Cada variante tiene un enfoque distinto. Terminás cada caption con un llamado a la acción (consultá por DM / WhatsApp${
        BRAND.instagram ? `, mencioná @${BRAND.instagram}` : ""
      }). Los hashtags van aparte, sin '#', y tienen que incluir la ciudad y la provincia (ej. "${(p.city ?? "").replace(/\s+/g, "")}", "inmobiliaria${(p.province ?? "").replace(/\s+/g, "")}") además de los del rubro.`,
      prompt: `Propiedad:
- Título: ${p.title}
- Operación: ${operationLabel(p)}
- Tipo: ${p.typeName ?? "-"}
- Precio: ${formatPrice(p.price, p.currency)}
- Ubicación: ${formatLocation(p) || "-"}
- Características: ${specChips(p).join(", ") || "-"}
- Descripción: ${(full?.description ?? "").slice(0, 800) || "-"}`,
    });

    return Response.json(object);
  } catch (error) {
    console.error("Error generando copy de Instagram:", error);
    return new Response("No se pudo generar el copy", { status: 500 });
  }
}
