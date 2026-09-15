import { buildFeed, feedToXml } from "@/features/feed/buildFeed";

// E3.1: feed XML público para portales. Se cachea 1 h (los portales lo
// leen cada varias horas; no hace falta más frescura).
export const revalidate = 3600;

export async function GET() {
  const items = await buildFeed();
  return new Response(feedToXml(items), {
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Cache-Control": "public, max-age=3600",
    },
  });
}
