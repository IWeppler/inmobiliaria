import { createClientServer } from "@/lib/supabase";
import { LeadsView } from "@/features/dashboard/leads/LeadsView";
import { enrichLeadsWithActivity } from "@/features/dashboard/leads/enrichLeads";
import { findDemandGaps } from "@/features/dashboard/buyers/queries";
import type { LeadWithDetails } from "@/app/types";
import { Page } from "@/shared/components/PageShell";
import { redirect } from "next/navigation";

export default async function LeadsPage({
  searchParams,
}: {
  searchParams: Promise<{ estado?: string; vista?: string; nuevo?: string }>;
}) {
  const { estado, vista, nuevo } = await searchParams;
  const supabase = await createClientServer();

  // 1. Usuario
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError || !user) {
    redirect("/login");
  }

  // 2. Perfil y Rol
  const { data: agentProfile } = await supabase
    .from("agents")
    .select("role")
    .eq("id", user.id)
    .single();

  const isAdmin = agentProfile?.role === "admin";

  // 3. Construcción de Query
  let query = supabase
    .from("leads")
    .select(
      `
      *,
      properties ( id, title, operation_type ),
      agents ( full_name )
    `
    )
    .order("created_at", { ascending: false });

  // LOGICA DE FILTRADO
  if (!isAdmin) {
    query = query.eq("agent_id", user.id);
  }

  // 4. Ejecución
  const { data: leads, error } = await query;

  if (error) {
    return <p>Error al cargar: {error.message}</p>;
  }

  // 5. Actividad (status_since / last_activity_at) para Kanban y
  // temperatura (E1.8).
  const enriched = await enrichLeadsWithActivity(
    supabase,
    (leads ?? []) as LeadWithDetails[]
  );

  // Buyer Intelligence: demanda sin oferta de toda la base. Solo se calcula
  // si hay alguna búsqueda cargada, para no frenar el tablero.
  const hasDemand = enriched.some((lead) => lead.search_operation);
  const [demandGaps, { data: propertyTypes }] = await Promise.all([
    hasDemand ? findDemandGaps(supabase) : Promise.resolve([]),
    supabase.from("property_types").select("id, name").order("name", { ascending: true }),
  ]);

  return (
    <Page>
      <LeadsView
        leads={enriched}
        userRole={agentProfile?.role || "agente"}
        initialStatus={estado}
        initialView={vista === "demanda" ? "demand" : vista === "lista" ? "list" : "board"}
        demandGaps={demandGaps}
        propertyTypes={propertyTypes ?? []}
        initialCreateOpen={nuevo === "1"}
      />
    </Page>
  );
}
