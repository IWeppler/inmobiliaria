import { ImageResponse } from "next/og";
import {
  getSocialProperty,
  PropertySocialCard,
} from "@/features/social/propertyCard";
import { BRAND } from "@/lib/brand";

// E2.1: OG image dinámica por propiedad (WhatsApp, redes). Next la
// registra sola en <meta property="og:image"> de /propiedades/[slug].
export const runtime = "nodejs";
export const alt = "Propiedad";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function OpenGraphImage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const p = await getSocialProperty(slug);

  if (!p) {
    return new ImageResponse(
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
    );
  }

  return new ImageResponse(
    <PropertySocialCard p={p} width={size.width} height={size.height} />,
    size
  );
}
