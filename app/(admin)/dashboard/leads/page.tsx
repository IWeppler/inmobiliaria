import { createClientServer } from "@/lib/supabase";
import { LeadTable } from "@/features/dashboard/LeadTable";
import { redirect } from "next/navigation";

export default async function LeadsPage() {
  
  const supabase = await createClientServer();

  // 1. Usuario
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    redirect("/login");
  }

  // 2. Perfil y Rol
  const { data: agentProfile, error: profileError } = await supabase
    .from("agents")
    .select("role")
    .eq("id", user.id)
    .single();

  const isAdmin = agentProfile?.role === "admin";

  // 3. Construcción de Query
  let query = supabase
    .from("leads")
    .select(`
      *,
      properties ( title ),
      agents ( full_name ) 
    `)
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

  return (
    <div className="flex min-h-screen w-full flex-col">
      <main className="flex flex-1 flex-col gap-4 p-4 md:gap-8 md:p-8">
        <LeadTable 
            initialLeads={leads as any[]} 
            userRole={agentProfile?.role || 'agente'} 
        />
      </main>
    </div>
  );
}