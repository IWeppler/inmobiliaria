import { ImageResponse } from "next/og";
import { NextRequest } from "next/server";
import { createClientServer } from "@/lib/supabase";
import {
  getSocialProperty,
  PropertySocialCard,
} from "@/features/social/propertyCard";

export const runtime = "nodejs";

// E2.2: pieza para Instagram. ?format=square (1080x1080, default) |
// portrait (1080x1350, feed 4:5) | story (1080x1920). ?download=1 fuerza
// descarga con nombre de archivo. Requiere sesión: es una herramienta
// del dashboard, no un endpoint público.
const FORMATS = {
  square: { width: 1080, height: 1080 },
  portrait: { width: 1080, height: 1350 },
  story: { width: 1080, height: 1920 },
} as const;

export type SocialFormat = keyof typeof FORMATS;

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClientServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return new Response("No autenticado", { status: 401 });

  const { id } = await params;
  const p = await getSocialProperty(id);
  if (!p) return new Response("Propiedad no encontrada", { status: 404 });

  const formatParam = req.nextUrl.searchParams.get("format") ?? "square";
  const format = (formatParam in FORMATS ? formatParam : "square") as SocialFormat;
  const { width, height } = FORMATS[format];
  const download = req.nextUrl.searchParams.get("download") === "1";

  const image = new ImageResponse(
    <PropertySocialCard p={p} width={width} height={height} />,
    { width, height }
  );

  if (!download) return image;

  const slug = p.title
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 50);
  const headers = new Headers(image.headers);
  headers.set(
    "Content-Disposition",
    `attachment; filename="${slug || "propiedad"}-${format}.png"`
  );
  return new Response(image.body, { status: 200, headers });
}
