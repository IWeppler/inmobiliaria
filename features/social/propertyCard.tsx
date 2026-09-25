import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/app/types/supabase";
import { BRAND, formatLocation, formatPrice } from "@/lib/brand";

// Datos mínimos para renderizar una pieza social de una propiedad. Se
// leen con la anon key (properties es pública por diseño) para que las
// rutas de imagen no dependan de cookies.
export type SocialProperty = {
  id: string;
  title: string;
  description: string | null;
  street_address: string | null;
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
      "id, title, description, street_address, price, currency, status, operation_type, city, province, neighborhood, bedrooms, bathrooms, total_area, covered_area, property_types(name), property_images(image_url, order)"
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
    description: data.description,
    street_address: data.street_address,
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

export const LAYOUTS = ["photo", "split", "minimal", "editorial", "framed"] as const;
export type Layout = (typeof LAYOUTS)[number];

export const FONT_STYLES = ["sans", "serif", "mono"] as const;
export type FontStyle = (typeof FONT_STYLES)[number];

export const THEMES = ["dark", "light"] as const;
export type Theme = (typeof THEMES)[number];

export const SHOW_KEYS = ["price", "title", "location", "specs", "type", "brand"] as const;
export type ShowKey = (typeof SHOW_KEYS)[number];

export type CardOptions = {
  layout: Layout;
  font: FontStyle;
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
  copy: { title?: string; description?: string; location?: string; phone?: string; operation?: "venta" | "alquiler" };
};

export const DEFAULT_OPTIONS: CardOptions = {
  layout: "photo",
  font: "sans",
  theme: "dark",
  accent: BRAND.color,
  photo: 0,
  show: { price: true, title: true, location: true, specs: true, type: true, brand: true },
  badge: "",
  noBadge: false,
  copy: {},
};

export function optionsToSearch(o: CardOptions): URLSearchParams {
  const q = new URLSearchParams();
  if (o.layout !== DEFAULT_OPTIONS.layout) q.set("layout", o.layout);
  if (o.font !== DEFAULT_OPTIONS.font) q.set("font", o.font);
  if (o.theme !== DEFAULT_OPTIONS.theme) q.set("theme", o.theme);
  if (o.accent.toLowerCase() !== DEFAULT_OPTIONS.accent.toLowerCase()) q.set("accent", o.accent.replace("#", ""));
  if (o.photo) q.set("photo", String(o.photo));
  const hidden = SHOW_KEYS.filter((k) => !o.show[k]);
  if (hidden.length) q.set("hide", hidden.join(","));
  if (o.noBadge) q.set("badge", "none");
  else if (o.badge.trim()) q.set("badge", o.badge.trim().slice(0, 24));
  for (const key of ["title", "description", "location", "phone"] as const) {
    const value = o.copy[key];
    if (value !== undefined) q.set(key, value);
  }
  if (o.copy.operation) q.set("operation", o.copy.operation);
  return q;
}

export function parseOptions(q: URLSearchParams): CardOptions {
  const layout = q.get("layout");
  const font = q.get("font");
  const theme = q.get("theme");
  const accent = q.get("accent");
  const photo = Number(q.get("photo") ?? 0);
  const hidden = new Set((q.get("hide") ?? "").split(",").filter(Boolean));
  const badge = q.get("badge") ?? "";
  return {
    layout: LAYOUTS.includes(layout as Layout) ? (layout as Layout) : DEFAULT_OPTIONS.layout,
    font: FONT_STYLES.includes(font as FontStyle) ? (font as FontStyle) : DEFAULT_OPTIONS.font,
    theme: THEMES.includes(theme as Theme) ? (theme as Theme) : DEFAULT_OPTIONS.theme,
    accent: accent && /^[0-9a-fA-F]{6}$/.test(accent) ? `#${accent}` : DEFAULT_OPTIONS.accent,
    photo: Number.isFinite(photo) && photo >= 0 ? Math.floor(photo) : 0,
    show: Object.fromEntries(SHOW_KEYS.map((k) => [k, !hidden.has(k)])) as Record<ShowKey, boolean>,
    badge: badge === "none" ? "" : badge.slice(0, 24),
    noBadge: badge === "none",
    copy: {
      ...(q.has("title") ? { title: (q.get("title") ?? "").slice(0, 100) } : {}),
      ...(q.has("description") ? { description: (q.get("description") ?? "").slice(0, 240) } : {}),
      ...(q.has("location") ? { location: (q.get("location") ?? "").slice(0, 140) } : {}),
      ...(q.has("phone") ? { phone: (q.get("phone") ?? "").slice(0, 60) } : {}),
      ...(["venta", "alquiler"].includes(q.get("operation") ?? "") ? { operation: q.get("operation") as "venta" | "alquiler" } : {}),
    },
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
  const location = (o.copy.location ?? [p.street_address, formatLocation(p)].filter(Boolean).join(", ")).trim().slice(0, 140);
  const chips = o.show.specs ? specChips(p) : [];
  const image = p.images[o.photo] ?? p.images[0] ?? p.image;
  const badgeText = o.noBadge ? null : o.badge.trim() || (o.copy.operation === "alquiler" ? "En alquiler" : o.copy.operation === "venta" ? "En venta" : operationLabel(p));
  const priceText = formatPrice(p.price, p.currency);
  const rawTitle = (o.copy.title ?? p.title).trim();
  const titleLimit = o.layout === "editorial" ? 56 : 72;
  const titleText = rawTitle.length > titleLimit ? rawTitle.slice(0, titleLimit - 3) + "…" : rawTitle;
  const descriptionLimit = o.layout === "editorial" || o.layout === "framed" ? 120 : 155;
  const descriptionText = (o.copy.description ?? p.description ?? "").trim().replace(/\s+/g, " ").slice(0, descriptionLimit);
  const phoneText = (o.copy.phone ?? "").trim().slice(0, 60);
  const fontFamily = o.font === "serif" ? "Crimson Text" : o.font === "mono" ? "IBM Plex Mono" : "sans-serif";
  const isStory = height / width > 1.5;

  const description = (color: string, size = 27) =>
    descriptionText && height >= width ? <div style={{ display: "flex", fontSize: px(size), lineHeight: 1.25, color, maxWidth: "100%" }}>{descriptionText}</div> : null;
  const phone = (color: string) => phoneText ? <span style={{ display: "flex", fontSize: px(25), fontWeight: 700, color }}>Consultas: {phoneText}</span> : null;

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
    const panelH = Math.round(height * (isStory ? 0.38 : height > width ? 0.48 : 0.54));
    const photoH = height - panelH;
    const light = o.theme === "light";
    const panelBg = light ? "#ffffff" : o.accent;
    const text = light ? "#111418" : "#ffffff";
    const muted = light ? "#5d6470" : "rgba(255,255,255,0.8)";
    return (
      <div style={{ width, height, display: "flex", flexDirection: "column", position: "relative", backgroundColor: panelBg, fontFamily, overflow: "hidden" }}>
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
          {o.show.brand && <div style={{ position: "absolute", top: px(40), right: px(40), display: "flex", padding: `${px(10)}px ${px(16)}px`, backgroundColor: "rgba(0,0,0,0.55)" }}>{brand("#fff", 48)}</div>}
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
            {description(muted, 24)}
          </div>
          <div style={{ display: "flex", marginTop: px(16) }}>
            <div style={{ display: "flex", flexDirection: "column", gap: px(10) }}>{chipsRow(text, light ? "#c9cfd6" : "rgba(255,255,255,0.6)")}{phone(text)}</div>
          </div>
        </div>
      </div>
    );
  }

  // ---- Layout "minimal": solo foto, precio y marca -------------------
  if (o.layout === "minimal") {
    return (
      <div style={{ width, height, display: "flex", position: "relative", backgroundColor: o.accent, color: "#fff", fontFamily, overflow: "hidden" }}>
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
          {o.show.title && titleText && <div style={{ fontSize: px(34), fontWeight: 600, display: "flex" }}>{titleText}</div>}
          {o.show.location && location && (
            <div style={{ fontSize: px(30), opacity: 0.9, display: "flex" }}>{location}</div>
          )}
          {description("rgba(255,255,255,0.9)", 24)}
          {phone("#fff")}
        </div>
      </div>
    );
  }

  // ---- Layout editorial: foto lateral y bloque tipográfico ------------
  if (o.layout === "editorial") {
    const photoW = Math.round(width * (isStory ? 0.42 : 0.54));
    return (
      <div style={{ width, height, display: "flex", backgroundColor: "#f6f2eb", color: "#18202a", fontFamily, overflow: "hidden" }}>
        <div style={{ width: photoW, height, display: "flex", position: "relative", backgroundColor: "#d9dde3", overflow: "hidden" }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {image && <img src={image} alt="" width={photoW} height={height} style={{ width: photoW, height, objectFit: "cover" }} />}
        </div>
        <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "space-between", padding: `${px(52)}px ${px(44)}px`, borderTop: `${px(20)}px solid ${o.accent}` }}>
          <div style={{ display: "flex", flexDirection: "column", gap: px(28) }}>
            {badge(o.accent, "#fff")}
            {o.show.type && p.typeName && <span style={{ display: "flex", fontSize: px(24), textTransform: "uppercase", letterSpacing: 2 }}>{p.typeName}</span>}
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: px(20) }}>
            {o.show.title && <div style={{ display: "flex", fontSize: px(46), lineHeight: 1.12, fontWeight: 700 }}>{titleText}</div>}
            {o.show.price && <div style={{ display: "flex", fontSize: px(56), fontWeight: 800, color: o.accent }}>{priceText}</div>}
            {o.show.location && location && <div style={{ display: "flex", fontSize: px(26) }}>{location}</div>}
            {description("#4f5660", 25)}
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: px(14) }}>{phone(o.accent)}{brand(o.accent, 52)}</div>
        </div>
      </div>
    );
  }

  // ---- Layout enmarcado: imagen contenida y pie de información --------
  if (o.layout === "framed") {
    const photoH = Math.round(height * (isStory ? 0.57 : 0.49));
    return (
      <div style={{ width, height, display: "flex", flexDirection: "column", backgroundColor: o.theme === "light" ? "#f7f7f3" : o.accent, color: o.theme === "light" ? "#171b22" : "#fff", fontFamily, padding: px(38), overflow: "hidden" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", height: px(62), marginBottom: px(22) }}>{brand(o.theme === "light" ? o.accent : "#fff", 46)}{badge(o.theme === "light" ? o.accent : "#fff", o.theme === "light" ? "#fff" : o.accent)}</div>
        <div style={{ width: "100%", height: photoH, display: "flex", position: "relative", overflow: "hidden", backgroundColor: "#d9dde3" }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {image && <img src={image} alt="" width={width - px(76)} height={photoH} style={{ width: width - px(76), height: photoH, objectFit: "cover" }} />}
        </div>
        <div style={{ display: "flex", flex: 1, flexDirection: "column", justifyContent: "space-between", paddingTop: px(25) }}>
          <div style={{ display: "flex", flexDirection: "column", gap: px(10) }}>
            {o.show.title && <div style={{ display: "flex", fontSize: px(38), fontWeight: 700 }}>{titleText}</div>}
            {o.show.location && location && <div style={{ display: "flex", fontSize: px(25), opacity: 0.85 }}>{location}</div>}
            {description(o.theme === "light" ? "#4f5660" : "rgba(255,255,255,0.85)", 24)}
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: px(8) }}>
            {o.show.price && <span style={{ display: "flex", fontSize: px(54), fontWeight: 800 }}>{priceText}</span>}
            {phone(o.theme === "light" ? o.accent : "#fff")}
          </div>
        </div>
      </div>
    );
  }

  // ---- Layout "photo" (default): foto completa, degradé, datos abajo ---
  return (
    <div style={{ width, height, display: "flex", position: "relative", backgroundColor: o.accent, color: "#fff", fontFamily, overflow: "hidden" }}>
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
        {description("rgba(255,255,255,0.9)")}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginTop: px(10) }}>
          <div style={{ display: "flex", flexDirection: "column", gap: px(10) }}>{chipsRow("#fff", "rgba(255,255,255,0.7)")}{phone("#fff")}</div>
          {brand("#fff", 56)}
        </div>
      </div>
    </div>
  );
}
