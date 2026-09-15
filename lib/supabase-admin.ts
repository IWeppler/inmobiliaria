import "server-only";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/app/types/supabase";

// Cliente service_role compartido por las Server Actions públicas
// (visitante anónimo, sin sesión). Bypassea RLS: solo usar desde código
// de servidor que valide su propia entrada (Zod) -- nunca exponer al
// cliente. Reemplaza las tres copias idénticas que había en
// features/actions/create*Lead*.
export const supabaseAdmin = createClient<Database>(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false, autoRefreshToken: false } }
);

// Asignación automática de leads públicos: reglas por ciudad / tipo de
// propiedad (E1.2, 20260915183722_lead_assignment_rules.sql) y, si
// ninguna matchea, round-robin general (E0.4). Devuelve null si no hay
// agentes cargados o falla el RPC.
export async function nextAgentForLead(opts?: {
  city?: string | null;
  propertyType?: string | null;
}): Promise<string | null> {
  const { data, error } = await supabaseAdmin.rpc("next_agent_for_lead", {
    p_city: opts?.city ?? null,
    p_property_type: opts?.propertyType ?? null,
  });
  if (error || !data) return null;
  return data;
}
