import { createClientServer } from "@/lib/supabase";
import { LeadsView } from "@/features/dashboard/leads/LeadsView";
import { enrichLeadsWithActivity } from "@/features/dashboard/leads/enrichLeads";
import type { LeadWithDetails } from "@/app/types";
import { redirect } from "next/navigation";

export default async function LeadsPage() {
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
      properties ( id, title ),
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
    <div className="theme-tn flex min-h-screen w-full min-w-0 flex-col">
      <main className="flex flex-1 min-w-0 flex-col gap-4 p-4 md:gap-8 md:p-8">
        <LeadsView leads={enriched} userRole={agentProfile?.role || "agente"} />
      </main>
    </div>
  );
}
