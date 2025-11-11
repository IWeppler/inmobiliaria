import { createClientServer } from "@/lib/supabase";
import { notFound } from "next/navigation";
import { LeadDetailClient } from "@/features/dashboard/LeadDetailClient";

type LeadDetailData = {
  id: string;
  created_at: string;
  name: string;
  email: string | null;
  phone: string | null;
  status: string;
  source: string;
  notes: string | null;
  properties: {
    id: string;
    title: string;
  } | null;
  lead_notes: {
    id: string;
    created_at: string;
    content: string;
  }[];
};

export default async function LeadDetailPage({
  params: paramsPromise,
}: {
  params: Promise<{ id: string }>;
}) {
  const params = await paramsPromise;

  const supabase = await createClientServer();

  // 1. Buscamos el usuario
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return <div>No autorizado</div>;

  // 2. Buscamos el lead, su propiedad y su historial de notas
  const { data: lead, error } = await supabase
    .from("leads")
    .select(
      `
      *,
      properties ( id, title ),
      lead_notes ( id, created_at, content )
    `
    )
    .eq("id", params.id)
    .eq("user_id", user.id)
    .order("created_at", { referencedTable: "lead_notes", ascending: false })
    .single();

  if (error || !lead) {
    notFound();
  }

  return <LeadDetailClient initialLead={lead as LeadDetailData} />;
}
