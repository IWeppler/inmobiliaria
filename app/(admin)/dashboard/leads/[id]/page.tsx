import { createClientServer } from "@/lib/supabase";
import { notFound, redirect } from "next/navigation";
import { LeadDetailClient } from "@/features/dashboard/LeadDetailClient";

export default async function LeadDetailPage({
  params: paramsPromise,
}: {
  params: Promise<{ id: string }>;
}) {
  const params = await paramsPromise;
  const supabase = await createClientServer();

  // 1. Usuario actual
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // 2. Buscar rol
  const { data: agent } = await supabase
    .from("agents")
    .select("role")
    .eq("id", user.id)
    .single();
  const isAdmin = agent?.role === "admin";

  const { data: allProperties } = await supabase
    .from("properties")
    .select("id, title")
    .order("title", { ascending: true });

  // 3. Query del Lead
  const { data: lead, error } = await supabase
    .from("leads")
    .select(
      `
      *,
      properties ( id, title ),
      lead_notes ( id, created_at, content, user_id ),
      agents ( id, full_name ) 
    `
    )
    .eq("id", params.id)
    .order("created_at", { referencedTable: "lead_notes", ascending: false })
    .single();

  if (error || !lead) {
    notFound();
  }

  let allAgents: { id: string; full_name: string }[] = [];
  if (isAdmin) {
    const { data } = await supabase
      .from("agents")
      .select("id, full_name")
      .order("full_name", { ascending: true });
    allAgents = data || [];
  }

  return (
    <LeadDetailClient
      initialLead={lead}
      currentUser={user}
      userRole={agent?.role || "agente"}
      allAgents={allAgents}
      allProperties={allProperties || []}
    />
  );
}
