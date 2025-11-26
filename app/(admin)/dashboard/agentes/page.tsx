import { createClientServer } from "@/lib/supabase";
import { redirect } from "next/navigation";
import { AgentsClientPage } from "@/features/dashboard/agents/AgentsClientPage";

export default async function AgentsPage() {
  const supabase = await createClientServer();

  // 1. Verificar seguridad
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: agentProfile } = await supabase
    .from("agents")
    .select("role")
    .eq("id", user.id)
    .single();

  if (agentProfile?.role !== "admin") {
    redirect("/dashboard");
  }

  // 2. Cargar Agentes
  const { data: agents } = await supabase
    .from("agents")
    .select("*")
    .order("created_at", { ascending: false });

  return (
    <div className="p-6">
      <div className="flex flex-col justify-between items-center mb-2">
          <h1 className="text-3xl font-clash font-semibold text-foreground">
            Gestión de Equipo
          </h1>
          <p className="text-muted-foreground">
            Administra a tus agentes y administradores.
          </p>
      </div>

      {/* Pasamos la data al cliente */}
      <AgentsClientPage
        initialAgents={agents || []}
        currentUserId={user?.id || ""}
      />
    </div>
  );
}
