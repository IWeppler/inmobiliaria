import {
  HIGH_VIEWS,
  LOW_INQUIRY_RATE,
  MIN_WINDOW_DAYS,
  median,
} from "@/features/dashboard/property/performance";
import { phoneKey } from "@/features/dashboard/buyers/duplicates";

// Vistas contra consultas de cada propiedad activa, desde que se publicó.
// Separa dos problemas que piden acciones distintas:
//   no_convence      se ve pero casi nadie consulta: precio, fotos o título.
//                    Misma regla que el diagnóstico de la ficha de propiedad.
//   poca_exposicion  casi no se ve: difusión, portales, destacados.
// Las vistas son el contador acumulado del sitio (la serie diaria recién
// empieza), por eso este análisis no depende del período elegido.

export type ListingStatus =
  "no_convence" | "poca_exposicion" | "en_linea" | "reciente";

export type ListingPoint = {
  id: string;
  title: string;
  city: string | null;
  views: number;
  // Contactos únicos (mismo teléfono o email cuenta una vez).
  inquiries: number;
  ageDays: number;
  status: ListingStatus;
};

export type ListingConversion = {
  points: ListingPoint[];
  totalViews: number;
  totalInquiries: number;
  // Consultas cada 100 vistas del conjunto evaluado (sin las recientes).
  per100: number | null;
  // Por debajo de este número de vistas se considera poca exposición.
  lowViewsThreshold: number | null;
};

// Poca exposición: menos de la mitad de la mediana de vistas de la cartera.
const LOW_EXPOSURE_SHARE = 0.5;

export const LISTING_STATUS_LABEL: Record<ListingStatus, string> = {
  no_convence: "Se ve pero no consultan",
  poca_exposicion: "Poca exposición",
  en_linea: "En línea",
  reciente: "Recién publicada",
};

export function buildListingConversion(
  properties: {
    id: string;
    title: string;
    city: string | null;
    created_at: string;
    views_count: number | null;
  }[],
  leads: {
    property_id: string | null;
    phone: string | null;
    email: string | null;
    id: string;
  }[],
  asOf: Date,
): ListingConversion {
  const contacts = new Map<string, Set<string>>();
  for (const lead of leads) {
    if (!lead.property_id) continue;
    const key =
      phoneKey(lead.phone) ?? lead.email?.trim().toLowerCase() ?? lead.id;
    const set = contacts.get(lead.property_id) ?? new Set<string>();
    set.add(key);
    contacts.set(lead.property_id, set);
  }

  const base = properties.map((property) => ({
    id: property.id,
    title: property.title,
    city: property.city,
    views: property.views_count ?? 0,
    inquiries: contacts.get(property.id)?.size ?? 0,
    ageDays: Math.max(
      0,
      Math.floor(
        (asOf.getTime() - new Date(property.created_at).getTime()) / 86400000,
      ),
    ),
  }));

  const mature = base.filter((point) => point.ageDays >= MIN_WINDOW_DAYS);
  const medianViews = median(mature.map((point) => point.views));
  const lowViewsThreshold =
    medianViews === null ? null : Math.round(medianViews * LOW_EXPOSURE_SHARE);

  const points: ListingPoint[] = base.map((point) => {
    let status: ListingStatus = "en_linea";
    if (point.ageDays < MIN_WINDOW_DAYS) status = "reciente";
    else if (
      point.views >= HIGH_VIEWS &&
      point.inquiries / point.views < LOW_INQUIRY_RATE
    )
      status = "no_convence";
    else if (lowViewsThreshold !== null && point.views < lowViewsThreshold)
      status = "poca_exposicion";
    return { ...point, status };
  });

  const totalViews = mature.reduce((sum, point) => sum + point.views, 0);
  const totalInquiries = mature.reduce(
    (sum, point) => sum + point.inquiries,
    0,
  );
  return {
    points,
    totalViews,
    totalInquiries,
    per100: totalViews > 0 ? (totalInquiries / totalViews) * 100 : null,
    lowViewsThreshold,
  };
}

// "1 cada 207 vistas" se entiende mejor que "0,48 %".
export function viewsPerInquiry(
  point: Pick<ListingPoint, "views" | "inquiries">,
) {
  return point.inquiries > 0 ? Math.round(point.views / point.inquiries) : null;
}
