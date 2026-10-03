"use server";

import { createClientServer } from "@/lib/supabase";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { findBuyerMatches } from "./queries";

// Match fuerte: a partir de acá vale avisar al asesor.
const STRONG = 70;

// Al crear una propiedad: avisa a cada asesor cuántos de SUS compradores
// encajan fuerte. Usa service_role para ver la base completa (cada asesor
// solo recibe el aviso de sus propios leads). No falla la creación si algo
// sale mal: es un aviso, no parte del alta.
export async function notifyBuyerMatchesAction(propertyId: string): Promise<{ notified: number }> {
  const supabase = await createClientServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { notified: 0 };

  const { data: property } = await supabaseAdmin
    .from("properties")
    .select("id, title, status, operation_type, property_type_id, city, neighborhood, price, currency, bedrooms, bathrooms")
    .eq("id", propertyId)
    .single();
  if (!property || (property.status !== "EN_VENTA" && property.status !== "EN_ALQUILER")) {
    return { notified: 0 };
  }

  const strong = (await findBuyerMatches(supabaseAdmin, property)).filter((m) => m.score >= STRONG);

  const perAgent = new Map<string, number>();
  for (const m of strong) {
    if (m.lead.agent_id) perAgent.set(m.lead.agent_id, (perAgent.get(m.lead.agent_id) ?? 0) + 1);
  }
  if (perAgent.size === 0) return { notified: 0 };

  const { error } = await supabaseAdmin.from("notifications").insert(
    [...perAgent].map(([agentId, count]) => ({
      user_id: agentId,
      title: "Compradores para una propiedad nueva",
      message: `${property.title}: ${count} ${count === 1 ? "comprador tuyo encaja" : "compradores tuyos encajan"} con más de ${STRONG}%.`,
      link: `/dashboard/propiedades/${property.id}`,
      type: "buyer_match",
    })),
  );
  if (error) {
    console.error("Aviso de compradores: no se pudo notificar.", error.message);
    return { notified: 0 };
  }
  return { notified: perAgent.size };
}
