import { buildFeed } from "@/features/feed/buildFeed";
import { BRAND } from "@/lib/brand";

// E3.1: mismo feed en JSON, para portales/integraciones que lo prefieran.
export const revalidate = 3600;

export async function GET() {
  const items = await buildFeed();
  return Response.json(
    {
      generator: BRAND.name,
      generated_at: new Date().toISOString(),
      count: items.length,
      properties: items,
    },
    { headers: { "Cache-Control": "public, max-age=3600" } }
  );
}
