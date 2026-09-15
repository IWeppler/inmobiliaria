import { NextRequest } from "next/server";
import { createClientServer } from "@/lib/supabase";
import { BRAND } from "@/lib/brand";

// E2.3: geocoding server-side. Antes el form llamaba a Nominatim directo
// desde el browser, con query de texto libre y limit=1: sin User-Agent
// (Nominatim lo exige y bloquea sin él), sin acotar a Argentina, y sin
// forma de saber si el resultado era la calle o solo la ciudad. Acá:
//   - búsqueda estructurada (street / city / state) con countrycodes=ar
//   - hasta 5 candidatos para que el agente elija si hay ambigüedad
//   - "precision" según lo que Nominatim resolvió realmente
//   - fallback a texto libre si la estructurada no devuelve nada
//   - cache 24 h por query (los pueblos no se mueven)
export type GeocodeCandidate = {
  lat: number;
  lon: number;
  label: string;
  precision: "street" | "locality" | "region";
};

const NOMINATIM = "https://nominatim.openstreetmap.org/search";
const UA = `${BRAND.name}-CRM/1.0 (${BRAND.siteUrl})`;

type NominatimRow = {
  lat: string;
  lon: string;
  display_name: string;
  category?: string; // jsonv2
  class?: string; // json clásico
  type: string;
  addresstype?: string;
};

async function search(params: Record<string, string>) {
  const url = new URL(NOMINATIM);
  Object.entries({
    format: "jsonv2",
    countrycodes: "ar",
    limit: "5",
    addressdetails: "0",
    "accept-language": "es",
    ...params,
  }).forEach(([k, v]) => url.searchParams.set(k, v));

  const res = await fetch(url, {
    headers: { "User-Agent": UA },
    next: { revalidate: 60 * 60 * 24 },
  });
  if (!res.ok) return [] as NominatimRow[];
  return (await res.json()) as NominatimRow[];
}

function precisionOf(row: NominatimRow): GeocodeCandidate["precision"] {
  const t = row.addresstype ?? row.type;
  const cat = row.category ?? row.class;
  if (
    cat === "building" ||
    cat === "highway" ||
    ["house", "road", "street", "residential", "building"].includes(t)
  )
    return "street";
  if (["city", "town", "village", "hamlet", "suburb", "neighbourhood", "locality"].includes(t))
    return "locality";
  return "region";
}

export async function GET(req: NextRequest) {
  const supabase = await createClientServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return new Response("No autenticado", { status: 401 });

  const q = req.nextUrl.searchParams;
  const street = q.get("street")?.trim() ?? "";
  const city = q.get("city")?.trim() ?? "";
  const province = q.get("province")?.trim() ?? "";
  if (!city && !province) {
    return Response.json({ candidates: [] });
  }

  let rows: NominatimRow[] = [];
  try {
    if (street) {
      rows = await search({ street, city, state: province });
    }
    if (rows.length === 0) {
      rows = await search({ city, state: province });
    }
    if (rows.length === 0) {
      rows = await search({ q: [street, city, province].filter(Boolean).join(", ") });
    }
  } catch (e) {
    console.error("Geocode error:", e);
    return new Response("Error consultando el servicio de mapas", { status: 502 });
  }

  const seen = new Set<string>();
  const candidates: GeocodeCandidate[] = [];
  for (const r of rows) {
    const key = `${Number(r.lat).toFixed(4)},${Number(r.lon).toFixed(4)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    candidates.push({
      lat: parseFloat(r.lat),
      lon: parseFloat(r.lon),
      label: r.display_name,
      precision: precisionOf(r),
    });
  }

  return Response.json({ candidates });
}
