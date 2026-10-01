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
  // Contacto de la inmobiliaria para el sitio público. WhatsApp en
  // formato internacional, solo dígitos (ej. 5491154702118).
  whatsapp: process.env.NEXT_PUBLIC_BRAND_WHATSAPP ?? "541154702118",
  email: process.env.NEXT_PUBLIC_BRAND_EMAIL ?? "info@terranova.com",
  // Teléfono tal como se muestra en el sitio.
  phoneDisplay: process.env.NEXT_PUBLIC_BRAND_PHONE_DISPLAY ?? "+54 11 5470-2118",
  // Dirección de la oficina. Opcional: si falta, no se muestra.
  address: process.env.NEXT_PUBLIC_BRAND_ADDRESS ?? null,
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

export function whatsappLink(message: string) {
  return `https://wa.me/${BRAND.whatsapp}?text=${encodeURIComponent(message)}`;
}

export function propertyUrl(id: string) {
  return `${BRAND.siteUrl}/propiedades/${id}`;
}
