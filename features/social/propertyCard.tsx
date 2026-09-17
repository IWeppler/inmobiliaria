import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/app/types/supabase";
import { BRAND, formatLocation, formatPrice } from "@/lib/brand";

// Datos mínimos para renderizar una pieza social de una propiedad. Se
// leen con la anon key (properties es pública por diseño) para que las
// rutas de imagen no dependan de cookies.
export type SocialProperty = {
  id: string;
  title: string;
  price: number | null;
  currency: string | null;
  status: string;
  operation_type: string | null;
  city: string | null;
  province: string | null;
  neighborhood: string | null;
  bedrooms: number | null;
  bathrooms: number | null;
  total_area: number | null;
  covered_area: number | null;
  /** Primera foto (compatibilidad con el OG image). */
  image: string | null;
  /** Todas las fotos, en orden. */
  images: string[];
  typeName: string | null;
};

export async function getSocialProperty(
  id: string
): Promise<SocialProperty | null> {
  const supabase = createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
  const { data } = await supabase
    .from("properties")
    .select(
      "id, title, price, currency, status, operation_type, city, province, neighborhood, bedrooms, bathrooms, total_area, covered_area, property_types(name), property_images(image_url, order)"
    )
    .eq("id", id)
    .single();
  if (!data) return null;

  const images = [...(data.property_images ?? [])]
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
    .map((i) => i.image_url)
    .filter((u): u is string => !!u);
  return {
    id: data.id,
    title: data.title,
    price: data.price,
    currency: data.currency,
    status: data.status,
    operation_type: data.operation_type,
    city: data.city,
    province: data.province,
    neighborhood: data.neighborhood,
    bedrooms: data.bedrooms,
    bathrooms: data.bathrooms,
    total_area: data.total_area,
    covered_area: data.covered_area,
    image: images[0] ?? null,
    images,
    typeName: data.property_types?.name ?? null,
  };
}

export function operationLabel(p: SocialProperty) {
  if (p.status === "VENDIDO") return "Vendido";
  if (p.status === "ALQUILADO") return "Alquilado";
  if (p.status === "RESERVADO") return "Reservado";
  return p.operation_type?.toUpperCase() === "ALQUILER" ? "En alquiler" : "En venta";
}

// Campos y lotes grandes se leen mejor en hectáreas (>= 1 ha = 10.000 m²).
export function formatArea(m2: number, covered = false) {
  if (m2 >= 10000) return `${(m2 / 10000).toLocaleString("es-AR", { maximumFractionDigits: 1 })} ha`;
  return `${m2.toLocaleString("es-AR")} m²${covered ? " cub." : ""}`;
}

export function specChips(p: SocialProperty) {
  const chips: string[] = [];
  if (p.bedrooms) chips.push(`${p.bedrooms} dorm.`);
  if (p.bathrooms) chips.push(`${p.bathrooms} ${p.bathrooms === 1 ? "baño" : "baños"}`);
  const area = p.total_area ?? p.covered_area;
  if (area) chips.push(formatArea(area, !p.total_area));
  return chips;
}

// ---------------------------------------------------------------------
// Opciones de la pieza. Se serializan en la query de /api/social/[id] y
// se parsean acá, así cliente y servidor comparten una sola definición.
// ---------------------------------------------------------------------

export const LAYOUTS = ["photo", "split", "minimal"] as const;
export type Layout = (typeof LAYOUTS)[number];

export const THEMES = ["dark", "light"] as const;
export type Theme = (typeof THEMES)[number];

export const SHOW_KEYS = ["price", "title", "location", "specs", "type", "brand"] as const;
export type ShowKey = (typeof SHOW_KEYS)[number];

export type CardOptions = {
  layout: Layout;
  theme: Theme;
  /** Color de acento (hex). */
  accent: string;
  /** Índice de la foto en p.images. */
  photo: number;
  show: Record<ShowKey, boolean>;
  /** Texto de la etiqueta; vacío = etiqueta automática (En venta / En alquiler…). */
  badge: string;
  /** Sin etiqueta. */
  noBadge: boolean;
};

export const DEFAULT_OPTIONS: CardOptions = {
  layout: "photo",
  theme: "dark",
  accent: BRAND.color,
  photo: 0,
  show: { price: true, title: true, location: true, specs: true, type: true, brand: true },
  badge: "",
  noBadge: false,
};

export function optionsToSearch(o: CardOptions): URLSearchParams {
  const q = new URLSearchParams();
  if (o.layout !== DEFAULT_OPTIONS.layout) q.set("layout", o.layout);
  if (o.theme !== DEFAULT_OPTIONS.theme) q.set("theme", o.theme);
  if (o.accent.toLowerCase() !== DEFAULT_OPTIONS.accent.toLowerCase()) q.set("accent", o.accent.replace("#", ""));
  if (o.photo) q.set("photo", String(o.photo));
  const hidden = SHOW_KEYS.filter((k) => !o.show[k]);
  if (hidden.length) q.set("hide", hidden.join(","));
  if (o.noBadge) q.set("badge", "none");
  else if (o.badge.trim()) q.set("badge", o.badge.trim().slice(0, 24));
  return q;
}

export function parseOptions(q: URLSearchParams): CardOptions {
  const layout = q.get("layout");
  const theme = q.get("theme");
  const accent = q.get("accent");
  const photo = Number(q.get("photo") ?? 0);
  const hidden = new Set((q.get("hide") ?? "").split(",").filter(Boolean));
  const badge = q.get("badge") ?? "";
  return {
    layout: LAYOUTS.includes(layout as Layout) ? (layout as Layout) : DEFAULT_OPTIONS.layout,
    theme: THEMES.includes(theme as Theme) ? (theme as Theme) : DEFAULT_OPTIONS.theme,
    accent: accent && /^[0-9a-fA-F]{6}$/.test(accent) ? `#${accent}` : DEFAULT_OPTIONS.accent,
    photo: Number.isFinite(photo) && photo >= 0 ? Math.floor(photo) : 0,
    show: Object.fromEntries(SHOW_KEYS.map((k) => [k, !hidden.has(k)])) as Record<ShowKey, boolean>,
    badge: badge === "none" ? "" : badge.slice(0, 24),
    noBadge: badge === "none",
  };
}

// ---------------------------------------------------------------------
// Template. Mismo JSX para el OG (1200x630) y para Instagram (1080x1080,
// 1080x1350, 1080x1920); solo cambian proporciones y tamaño de tipografía.
// Solo estilos que soporta Satori (flex, sin grid, sin CSS vars).
// ---------------------------------------------------------------------

export function PropertySocialCard({
  p,
  width,
  height,
  options = DEFAULT_OPTIONS,
}: {
  p: SocialProperty;
  width: number;
  height: number;
  options?: CardOptions;
}) {
  const o = options;
  const scale = width / 1080;
  const px = (n: number) => Math.round(n * scale);
  const location = formatLocation(p);
  const chips = o.show.specs ? specChips(p) : [];
  const image = p.images[o.photo] ?? p.images[0] ?? p.image;
  const badgeText = o.noBadge ? null : o.badge.trim() || operationLabel(p);
  const priceText = formatPrice(p.price, p.currency);
  const titleText = p.title.length > 70 ? p.title.slice(0, 67) + "…" : p.title;
  const isStory = height / width > 1.5;

  const brand = (color: string, size: number) =>
    o.show.brand ? (
      BRAND.logoUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={BRAND.logoUrl} alt={BRAND.name} height={px(size)} style={{ height: px(size), objectFit: "contain" }} />
      ) : (
        <span style={{ fontSize: px(size * 0.6), fontWeight: 800, letterSpacing: -1, color }}>{BRAND.name}</span>
      )
    ) : null;

  const badge = (bg: string, color: string) =>
    badgeText ? (
      <span
        style={{
          backgroundColor: bg,
          color,
          fontSize: px(26),
          fontWeight: 700,
          padding: `${px(10)}px ${px(22)}px`,
          borderRadius: px(999),
          letterSpacing: 1,
          textTransform: "uppercase",
        }}
      >
        {badgeText}
      </span>
    ) : null;

  const chipsRow = (color: string, border: string) =>
    chips.length ? (
      <div style={{ display: "flex", gap: px(12) }}>
        {chips.map((c) => (
          <span
            key={c}
            style={{
              fontSize: px(26),
              fontWeight: 600,
              padding: `${px(8)}px ${px(18)}px`,
              borderRadius: px(10),
              border: `2px solid ${border}`,
              color,
            }}
          >
            {c}
          </span>
        ))}
      </div>
    ) : null;

  const photo = (h: number) =>
    image ? (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={image} alt="" width={width} height={h} style={{ position: "absolute", top: 0, left: 0, width, height: h, objectFit: "cover" }} />
    ) : null;

  // ---- Layout "split": foto arriba, panel abajo -----------------------
  if (o.layout === "split") {
    const panelH = Math.round(height * (isStory ? 0.34 : 0.4));
    const photoH = height - panelH;
    const light = o.theme === "light";
    const panelBg = light ? "#ffffff" : o.accent;
    const text = light ? "#111418" : "#ffffff";
    const muted = light ? "#5d6470" : "rgba(255,255,255,0.8)";
    return (
      <div style={{ width, height, display: "flex", flexDirection: "column", position: "relative", backgroundColor: panelBg, fontFamily: "sans-serif", overflow: "hidden" }}>
        <div style={{ position: "relative", width, height: photoH, display: "flex", backgroundColor: "#d9dde3", overflow: "hidden" }}>
          {photo(photoH)}
          <div style={{ position: "absolute", top: px(40), left: px(40), display: "flex", gap: px(12) }}>
            {badge(light ? o.accent : "#ffffff", light ? "#ffffff" : o.accent)}
            {o.show.type && p.typeName && (
              <span style={{ backgroundColor: "rgba(0,0,0,0.45)", color: "#fff", fontSize: px(26), fontWeight: 500, padding: `${px(10)}px ${px(22)}px`, borderRadius: px(999) }}>
                {p.typeName}
              </span>
            )}
          </div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", justifyContent: "space-between", flex: 1, padding: `${px(40)}px ${px(48)}px ${px(44)}px`, color: text }}>
          <div style={{ display: "flex", flexDirection: "column", gap: px(10) }}>
            {o.show.price && (
              <div style={{ fontSize: px(64), fontWeight: 800, lineHeight: 1.05, display: "flex", color: light ? o.accent : "#fff" }}>{priceText}</div>
            )}
            {o.show.title && (
              <div style={{ fontSize: px(36), fontWeight: 600, lineHeight: 1.15, display: "flex" }}>{titleText}</div>
            )}
            {o.show.location && location && (
              <div style={{ fontSize: px(26), color: muted, display: "flex" }}>{location}</div>
            )}
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginTop: px(16) }}>
            {chipsRow(text, light ? "#c9cfd6" : "rgba(255,255,255,0.6)")}
            {brand(text, 56)}
          </div>
        </div>
      </div>
    );
  }

  // ---- Layout "minimal": solo foto, precio y marca -------------------
  if (o.layout === "minimal") {
    return (
      <div style={{ width, height, display: "flex", position: "relative", backgroundColor: o.accent, color: "#fff", fontFamily: "sans-serif", overflow: "hidden" }}>
        {photo(height)}
        <div style={{ position: "absolute", top: 0, left: 0, width, height, display: "flex", background: "linear-gradient(180deg, rgba(0,0,0,0.25) 0%, rgba(0,0,0,0) 30%, rgba(0,0,0,0) 60%, rgba(0,0,0,0.75) 100%)" }} />
        <div style={{ position: "absolute", top: px(44), left: px(48), right: px(48), display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          {brand("#fff", 52)}
          {badge("rgba(255,255,255,0.92)", o.accent)}
        </div>
        <div style={{ position: "absolute", left: px(48), right: px(48), bottom: px(48), display: "flex", flexDirection: "column", gap: px(8) }}>
          {o.show.price && (
            <div style={{ fontSize: px(84), fontWeight: 800, lineHeight: 1, display: "flex", letterSpacing: -2 }}>{priceText}</div>
          )}
          {o.show.location && location && (
            <div style={{ fontSize: px(30), opacity: 0.9, display: "flex" }}>{location}</div>
          )}
        </div>
      </div>
    );
  }

  // ---- Layout "photo" (default): foto completa, degradé, datos abajo ---
  return (
    <div style={{ width, height, display: "flex", position: "relative", backgroundColor: o.accent, color: "#fff", fontFamily: "sans-serif", overflow: "hidden" }}>
      {photo(height)}
      <div style={{ position: "absolute", top: 0, left: 0, width, height, display: "flex", background: "linear-gradient(180deg, rgba(0,0,0,0.10) 25%, rgba(0,0,0,0.85) 100%)" }} />

      <div style={{ position: "absolute", top: px(48), left: px(48), display: "flex", alignItems: "center", gap: px(12) }}>
        {badge("#ffffff", o.accent)}
        {o.show.type && p.typeName && (
          <span style={{ backgroundColor: "rgba(0,0,0,0.45)", fontSize: px(26), fontWeight: 500, padding: `${px(10)}px ${px(22)}px`, borderRadius: px(999) }}>
            {p.typeName}
          </span>
        )}
      </div>

      <div style={{ position: "absolute", left: px(48), right: px(48), bottom: px(48), display: "flex", flexDirection: "column", gap: px(14) }}>
        {o.show.price && (
          <div style={{ fontSize: px(64), fontWeight: 800, lineHeight: 1.05, display: "flex" }}>{priceText}</div>
        )}
        {o.show.title && (
          <div style={{ fontSize: px(38), fontWeight: 600, lineHeight: 1.15, display: "flex", maxWidth: width - px(96) }}>{titleText}</div>
        )}
        {o.show.location && location && (
          <div style={{ fontSize: px(28), opacity: 0.9, display: "flex" }}>{location}</div>
        )}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginTop: px(10) }}>
          {chipsRow("#fff", "rgba(255,255,255,0.7)")}
          {brand("#fff", 56)}
        </div>
      </div>
    </div>
  );
}
