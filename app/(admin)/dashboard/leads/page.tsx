import { createClientServer } from "@/lib/supabase";
import { LeadsView } from "@/features/dashboard/leads/LeadsView";
import { enrichLeadsWithActivity } from "@/features/dashboard/leads/enrichLeads";
import type { LeadWithDetails } from "@/app/types";
import { Page } from "@/shared/components/PageShell";
import { redirect } from "next/navigation";

export default async function LeadsPage({
  searchParams,
}: {
  searchParams: Promise<{ estado?: string }>;
}) {
  const { estado } = await searchParams;
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

  return (
    <Page>
      <LeadsView leads={enriched} userRole={agentProfile?.role || "agente"} initialStatus={estado} />
    </Page>
  );
}
