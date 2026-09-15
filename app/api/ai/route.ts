import { streamText } from "ai";
import { google } from "@ai-sdk/google";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(req: Request) {
  try {
    const { prompt } = await req.json();
    const propertyData = JSON.parse(prompt);

    const systemPrompt = `
      Eres un experto copywriter inmobiliario de Argentina (usa vocabulario local como "ambientes", "expensas", "cocheras"). 
      Escribe una descripción persuasiva, profesional y optimizada para SEO para una propiedad. 
      Usa un tono elegante pero directo para cerrar ventas. 
      No uses emojis excesivos ni listas largas. Escribe 2 o 3 párrafos fluidos y atractivos.
    `;

    const userPrompt = `
      Escribe la descripción de marketing para esta propiedad:
      - Operación: ${propertyData.operation_type}
      - Ubicación: ${propertyData.city}, ${propertyData.province}
      - Dormitorios: ${propertyData.bedrooms}
      - Baños: ${propertyData.bathrooms}
      - Metros Totales: ${propertyData.total_area} m2
      - Título del aviso: ${propertyData.title}
      
      Haz que el comprador sienta que es una oportunidad única.
    `;

    const result = await streamText({
      model: google("gemini-2.5-flash"),
      system: systemPrompt,
      prompt: userPrompt,
      onFinish: ({ text }) => {
        console.log("3. ✅ ¡Texto generado con éxito por Gemini!");
        console.log(text.substring(0, 100) + "...");
      },
    });

    console.log("4. Enviando el Stream al Frontend...");
    return result.toTextStreamResponse();
  } catch (error) {
    console.error("❌ ERROR CRÍTICO EN EL BACKEND:", error);
    return new Response("Error interno del servidor", { status: 500 });
  }
}
