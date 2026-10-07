import { createClientServer } from "@/lib/supabase";
import { notFound, redirect } from "next/navigation";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { LeadDetailClient } from "@/features/dashboard/leads/LeadDetailClient";
import type { TimelineItem } from "@/features/dashboard/leads/LeadTimeline";
import { statusMeta } from "@/features/dashboard/leads/leadStatus";
import { findPropertyMatches } from "@/features/dashboard/buyers/queries";
import { demandFromLead } from "@/features/dashboard/buyers/matching";
import { EntityTasksCard } from "@/features/tasks/EntityTasksCard";

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

  const { data: propertyTypes } = await supabase
    .from("property_types")
    .select("id, name")
    .order("name", { ascending: true });

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
      properties ( id, title, operation_type, price, currency, status, agent_id ),
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

  const [propertyMatches, { data: history }, { data: visits }, { data: dealLink }] = await Promise.all([
    findPropertyMatches(supabase, demandFromLead(lead)),
    supabase.from("status_history").select("id, status, changed_at").eq("entity_type", "lead").eq("entity_id", lead.id),
    supabase.from("events").select("id, date, time, created_at").eq("lead_id", lead.id).eq("type", "visita"),
    // Link vigente del portal del comprador (el token no se guarda: solo sus datos de uso).
    supabase.from("deal_portal_links").select("created_at, expires_at, last_viewed_at, view_count")
      .eq("lead_id", lead.id).is("revoked_at", null).gt("expires_at", new Date().toISOString())
      .order("created_at", { ascending: false }).limit(1).maybeSingle(),
  ]);

  // Historial unificado: alta, cambios de estado, visitas agendadas y notas
  // (las de WhatsApp se marcan aparte). Más reciente primero.
  const timeline: TimelineItem[] = [
    { id: "alta", at: lead.created_at, kind: "alta" as const, text: `Lead creado${lead.source ? ` (${lead.source.toLowerCase().replaceAll("_", " ")})` : ""}` },
    ...(history ?? []).map((h) => ({ id: `estado-${h.id}`, at: h.changed_at, kind: "estado" as const, text: `Pasó a ${statusMeta(h.status).label}` })),
    ...(visits ?? []).map((v) => ({
      id: `visita-${v.id}`, at: v.created_at, kind: "visita" as const,
      text: `Visita agendada para el ${format(new Date(v.date), "d MMM", { locale: es })} a las ${v.time}`,
    })),
    ...((lead.lead_notes ?? []) as { id: string; created_at: string; content: string }[]).map((n) => {
      const whatsapp = n.content.startsWith("[WhatsApp]");
      return { id: `nota-${n.id}`, at: n.created_at, kind: whatsapp ? "whatsapp" as const : "nota" as const, text: whatsapp ? n.content.replace(/^\[WhatsApp\]\s*/, "") : n.content };
    }),
  ].sort((a, b) => b.at.localeCompare(a.at));

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
      propertyTypes={propertyTypes || []}
      propertyMatches={propertyMatches}
      timeline={timeline}
      dealLink={dealLink ?? null}
      tasksCard={<EntityTasksCard supabase={supabase} userId={user.id} isAdmin={isAdmin} entity={{ lead_id: lead.id, label: lead.name }} />}
    />
  );
}
