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
  image: string | null;
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

  const images = [...(data.property_images ?? [])].sort(
    (a, b) => (a.order ?? 0) - (b.order ?? 0)
  );
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
    image: images[0]?.image_url ?? null,
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

// Template white-label: foto a pantalla completa, degradé oscuro, datos
// abajo a la izquierda, marca abajo a la derecha. Mismo JSX para el OG
// (1200x630) y para Instagram (1080x1080 / 1080x1350); solo cambian las
// proporciones y el tamaño de tipografía. Solo estilos que soporta
// Satori (flex, sin grid, sin CSS vars).
export function PropertySocialCard({
  p,
  width,
  height,
}: {
  p: SocialProperty;
  width: number;
  height: number;
}) {
  const scale = width / 1080;
  const px = (n: number) => Math.round(n * scale);
  const location = formatLocation(p);
  const chips = specChips(p);

  return (
    <div
      style={{
        width,
        height,
        display: "flex",
        position: "relative",
        backgroundColor: BRAND.color,
        color: "#fff",
        fontFamily: "sans-serif",
        overflow: "hidden",
      }}
    >
      {p.image && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={p.image}
          alt=""
          width={width}
          height={height}
          style={{
            position: "absolute",
            inset: 0,
            width,
            height,
            objectFit: "cover",
          }}
        />
      )}
      <div
        style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          background:
            "linear-gradient(180deg, rgba(0,0,0,0.10) 25%, rgba(0,0,0,0.85) 100%)",
        }}
      />

      <div
        style={{
          position: "absolute",
          top: px(48),
          left: px(48),
          display: "flex",
          alignItems: "center",
          gap: px(12),
        }}
      >
        <span
          style={{
            backgroundColor: "#fff",
            color: BRAND.color,
            fontSize: px(26),
            fontWeight: 700,
            padding: `${px(10)}px ${px(22)}px`,
            borderRadius: px(999),
            letterSpacing: 1,
            textTransform: "uppercase",
          }}
        >
          {operationLabel(p)}
        </span>
        {p.typeName && (
          <span
            style={{
              backgroundColor: "rgba(0,0,0,0.45)",
              fontSize: px(26),
              fontWeight: 500,
              padding: `${px(10)}px ${px(22)}px`,
              borderRadius: px(999),
            }}
          >
            {p.typeName}
          </span>
        )}
      </div>

      <div
        style={{
          position: "absolute",
          left: px(48),
          right: px(48),
          bottom: px(48),
          display: "flex",
          flexDirection: "column",
          gap: px(14),
        }}
      >
        <div
          style={{
            fontSize: px(64),
            fontWeight: 800,
            lineHeight: 1.05,
            display: "flex",
          }}
        >
          {formatPrice(p.price, p.currency)}
        </div>
        <div
          style={{
            fontSize: px(38),
            fontWeight: 600,
            lineHeight: 1.15,
            display: "flex",
            maxWidth: width - px(96),
          }}
        >
          {p.title.length > 70 ? p.title.slice(0, 67) + "…" : p.title}
        </div>
        {location && (
          <div style={{ fontSize: px(28), opacity: 0.9, display: "flex" }}>
            {location}
          </div>
        )}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-end",
            marginTop: px(10),
          }}
        >
          <div style={{ display: "flex", gap: px(12) }}>
            {chips.map((c) => (
              <span
                key={c}
                style={{
                  fontSize: px(26),
                  fontWeight: 600,
                  padding: `${px(8)}px ${px(18)}px`,
                  borderRadius: px(10),
                  border: "2px solid rgba(255,255,255,0.7)",
                }}
              >
                {c}
              </span>
            ))}
          </div>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: px(12),
            }}
          >
            {BRAND.logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={BRAND.logoUrl}
                alt={BRAND.name}
                height={px(56)}
                style={{ height: px(56), objectFit: "contain" }}
              />
            ) : (
              <span
                style={{
                  fontSize: px(34),
                  fontWeight: 800,
                  letterSpacing: -1,
                }}
              >
                {BRAND.name}
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
