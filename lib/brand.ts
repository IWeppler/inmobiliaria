// Identidad white-label (Tier 2). Todo lo que se muestra "de cara al
// cliente" en piezas compartibles (OG image, pieza de Instagram, texto de
// WhatsApp) sale de acá, así cada inmobiliaria se configura por env sin
// tocar código. Los valores por defecto son los de la demo.
export const BRAND = {
  name: process.env.NEXT_PUBLIC_BRAND_NAME ?? "TerraNova",
  tagline:
    process.env.NEXT_PUBLIC_BRAND_TAGLINE ?? "Inmobiliaria Rural y Urbana",
  // URL absoluta a un logo (PNG/JPG). Opcional: si falta, se usa el nombre.
  logoUrl: process.env.NEXT_PUBLIC_BRAND_LOGO_URL ?? null,
  // Handle de Instagram sin "@", para el copy de las piezas.
  instagram: process.env.NEXT_PUBLIC_BRAND_INSTAGRAM ?? null,
  siteUrl:
    process.env.NEXT_PUBLIC_SITE_URL ?? "https://terranova-demo.vercel.app",
  // Color primario de la pieza (hex). Default: el navy del design system.
  color: process.env.NEXT_PUBLIC_BRAND_COLOR ?? "#111a2e",
};

export function formatPrice(
  price: number | null | undefined,
  currency: string | null | undefined
) {
  if (!price) return "Consultar precio";
  return `${currency ?? "USD"} ${price.toLocaleString("es-AR")}`;
}

export function formatLocation(p: {
  neighborhood?: string | null;
  city?: string | null;
  province?: string | null;
}) {
  return [p.neighborhood, p.city, p.province].filter(Boolean).join(", ");
}

export function propertyUrl(id: string) {
  return `${BRAND.siteUrl}/propiedades/${id}`;
}
