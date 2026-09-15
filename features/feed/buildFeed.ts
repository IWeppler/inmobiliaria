import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/app/types/supabase";
import { BRAND, propertyUrl } from "@/lib/brand";

// E3.1 — Feed de propiedades para portales (Zonaprop / Argenprop / etc.).
// Los portales argentinos onboardean un feed por URL: se les da la URL,
// ellos la leen cada N horas y mapean campos. Cada portal tiene su propio
// esquema exacto; este feed usa un esquema genérico y explícito (un tag
// por dato, sin abreviaturas) que cubre los campos que todos piden. El
// mapeo fino se hace en el onboarding con cada portal; si alguno exige
// nombres de tag específicos, se agrega un serializer por portal sobre
// el mismo FeedProperty. Solo propiedades activas (EN_VENTA / EN_ALQUILER).

export type FeedProperty = {
  id: string;
  reference: string; // id corto, el que ve el usuario en la ficha
  url: string;
  title: string;
  description: string;
  operation: "venta" | "alquiler";
  type: string;
  price: number | null;
  currency: string;
  expenses: number | null;
  address: string;
  neighborhood: string;
  city: string;
  province: string;
  country: "Argentina";
  latitude: number | null;
  longitude: number | null;
  bedrooms: number | null;
  bathrooms: number | null;
  rooms: number | null;
  garages: string;
  total_area: number | null;
  covered_area: number | null;
  age: string;
  amenities: string[];
  images: string[];
  agent: { name: string; phone: string; email: string };
  created_at: string;
};

export async function buildFeed(): Promise<FeedProperty[]> {
  const supabase = createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  const { data } = await supabase
    .from("properties")
    .select(
      `id, title, description, operation_type, price, currency, expensas,
       street_address, neighborhood, city, province, latitude, longitude,
       bedrooms, bathrooms, rooms, cocheras, total_area, covered_area,
       antiguedad, created_at,
       property_types(name),
       property_images(image_url, order),
       property_amenities(amenities(name)),
       agents(full_name, phone, email)`
    )
    .in("status", ["EN_VENTA", "EN_ALQUILER"])
    .order("created_at", { ascending: false });

  return (data ?? []).map((p) => ({
    id: p.id,
    reference: p.id.slice(0, 8).toUpperCase(),
    url: propertyUrl(p.id),
    title: p.title,
    description: p.description ?? "",
    operation: p.operation_type?.toUpperCase() === "ALQUILER" ? "alquiler" : "venta",
    type: p.property_types?.name ?? "Otro",
    price: p.price,
    currency: p.currency ?? "USD",
    expenses: p.expensas,
    address: p.street_address ?? "",
    neighborhood: p.neighborhood ?? "",
    city: p.city ?? "",
    province: p.province ?? "",
    country: "Argentina",
    latitude: p.latitude,
    longitude: p.longitude,
    bedrooms: p.bedrooms,
    bathrooms: p.bathrooms,
    rooms: p.rooms,
    garages: p.cocheras ?? "",
    total_area: p.total_area,
    covered_area: p.covered_area,
    age: p.antiguedad ?? "",
    amenities: (p.property_amenities ?? [])
      .map((a) => a.amenities?.name)
      .filter((n): n is string => !!n),
    images: [...(p.property_images ?? [])]
      .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
      .map((i) => i.image_url)
      .filter((u): u is string => !!u),
    agent: {
      name: p.agents?.full_name ?? BRAND.name,
      phone: p.agents?.phone ?? "",
      email: p.agents?.email ?? "",
    },
    created_at: p.created_at,
  }));
}

function esc(v: string | number | null | undefined) {
  if (v === null || v === undefined) return "";
  return String(v)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function feedToXml(items: FeedProperty[]) {
  const tag = (name: string, v: string | number | null | undefined) =>
    `<${name}>${esc(v)}</${name}>`;
  const cdata = (name: string, v: string) =>
    `<${name}><![CDATA[${v.replace(/]]>/g, "]]]]><![CDATA[>")}]]></${name}>`;

  const body = items
    .map(
      (p) => `  <property>
    ${tag("id", p.id)}
    ${tag("reference", p.reference)}
    ${tag("url", p.url)}
    ${cdata("title", p.title)}
    ${cdata("description", p.description)}
    ${tag("operation", p.operation)}
    ${tag("type", p.type)}
    ${tag("price", p.price)}
    ${tag("currency", p.currency)}
    ${tag("expenses", p.expenses)}
    <location>
      ${tag("address", p.address)}
      ${tag("neighborhood", p.neighborhood)}
      ${tag("city", p.city)}
      ${tag("province", p.province)}
      ${tag("country", p.country)}
      ${tag("latitude", p.latitude)}
      ${tag("longitude", p.longitude)}
    </location>
    <features>
      ${tag("bedrooms", p.bedrooms)}
      ${tag("bathrooms", p.bathrooms)}
      ${tag("rooms", p.rooms)}
      ${tag("garages", p.garages)}
      ${tag("total_area", p.total_area)}
      ${tag("covered_area", p.covered_area)}
      ${tag("age", p.age)}
    </features>
    <amenities>
${p.amenities.map((a) => `      ${tag("amenity", a)}`).join("\n")}
    </amenities>
    <images>
${p.images.map((u) => `      ${tag("image", u)}`).join("\n")}
    </images>
    <agent>
      ${tag("name", p.agent.name)}
      ${tag("phone", p.agent.phone)}
      ${tag("email", p.agent.email)}
    </agent>
    ${tag("created_at", p.created_at)}
  </property>`
    )
    .join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>
<feed generator="${esc(BRAND.name)}" generated_at="${new Date().toISOString()}" count="${items.length}">
${body}
</feed>
`;
}
