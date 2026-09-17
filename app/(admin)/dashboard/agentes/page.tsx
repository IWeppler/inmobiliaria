import { createClientServer } from "@/lib/supabase";
import { redirect } from "next/navigation";
import { Page } from "@/shared/components/PageShell";
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
    <Page>
      <AgentsClientPage
        initialAgents={agents || []}
        currentUserId={user?.id || ""}
      />
    </Page>
  );
}
