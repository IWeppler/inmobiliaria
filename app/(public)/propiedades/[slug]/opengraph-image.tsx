import { ImageResponse } from "next/og";
import sharp from "sharp";
import {
  getSocialProperty,
  PropertySocialCard,
} from "@/features/social/propertyCard";
import { toRenderableImage } from "@/features/social/renderableImage";
import { BRAND } from "@/lib/brand";

// E2.1: OG image dinámica por propiedad (WhatsApp, redes). Next la
// registra sola en <meta property="og:image"> de /propiedades/[slug].
//
// Se entrega en JPEG: ImageResponse solo genera PNG, y con una foto de
// fondo el PNG pesa más de 1 MB. WhatsApp descarta las vistas previas
// pesadas (orientativamente, más de ~300 KB) y la tarjeta sale sin imagen.
export const runtime = "nodejs";
export const alt = "Propiedad";
export const size = { width: 1200, height: 630 };
export const contentType = "image/jpeg";

const JPEG_QUALITY = 78;

async function toJpeg(image: ImageResponse) {
  const png = Buffer.from(await image.arrayBuffer());
  const jpeg = await sharp(png).jpeg({ quality: JPEG_QUALITY, mozjpeg: true }).toBuffer();
  return new Response(new Uint8Array(jpeg), {
    headers: {
      "Content-Type": contentType,
      // Mismo cacheo que aplica ImageResponse: la URL ya trae un hash por build.
      "Cache-Control": image.headers.get("Cache-Control") ?? "public, max-age=3600",
    },
  });
}

export default async function OpenGraphImage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const p = await getSocialProperty(slug);

  if (!p) {
    return toJpeg(new ImageResponse(
      (
        <div
          style={{
            width: size.width,
            height: size.height,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: BRAND.color,
            color: "#fff",
            fontSize: 64,
            fontWeight: 800,
          }}
        >
          {BRAND.name}
        </div>
      ),
      size
    ));
  }

  // La tarjeta usa la primera foto: se pasa ya convertida (ver renderableImage).
  const photo = await toRenderableImage(p.images[0] ?? p.image, size.width, size.height);
  const card = { ...p, image: photo, images: photo ? [photo] : [] };

  return toJpeg(new ImageResponse(
    <PropertySocialCard p={card} width={size.width} height={size.height} />,
    size
  ));
}
