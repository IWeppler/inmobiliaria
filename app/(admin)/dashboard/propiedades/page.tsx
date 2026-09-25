import { createClientServer } from "@/lib/supabase";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Plus } from "lucide-react";
import { Button } from "@/shared/components/ui/button";
import { Page, PageHeader } from "@/shared/components/PageShell";
import { PropertyTable } from "@/features/dashboard/property/PropertyTable";
import type { PropertyWithDetails } from "@/app/types/entities";

// Listado operativo: los accesos rápidos y la tabla comparten el mismo
// conjunto de propiedades visible para cada rol.
export default async function PropiedadesPage({
  searchParams,
}: {
  searchParams: Promise<{ estado?: string }>;
}) {
  const { estado } = await searchParams;
  const supabase = await createClientServer();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: agent } = await supabase
    .from("agents")
    .select("role")
    .eq("id", user.id)
    .single();

  const isAdmin = agent?.role === "admin";

  const props: PropertyWithDetails[] = [];
  for (let from = 0; ; from += 1000) {
    let query = supabase
      .from("properties")
      .select(`*, property_types(name), property_images(image_url), agents(full_name), views_count`)
      .order("created_at", { ascending: false })
      .order("id", { ascending: false });
    if (!isAdmin) query = query.eq("agent_id", user.id);
    const { data, error } = await query.range(from, from + 999);
    if (error) return <p>Error al cargar propiedades: {error.message}</p>;
    props.push(...((data ?? []) as PropertyWithDetails[]));
    if (!data || data.length < 1000) break;
  }

  const asOf = new Date();
  const since = new Date(asOf.getTime() - 30 * 86400000).toISOString();
  const recentInquiryIds = new Set<string>();
  for (let from = 0; ; from += 1000) {
    let query = supabase
      .from("leads")
      .select("id, property_id")
      .gte("created_at", since)
      .not("property_id", "is", null)
      .order("id");
    if (!isAdmin) query = query.eq("agent_id", user.id);
    const { data, error } = await query.range(from, from + 999);
    if (error) return <p>Error al cargar consultas recientes: {error.message}</p>;
    for (const lead of data ?? []) if (lead.property_id) recentInquiryIds.add(lead.property_id);
    if (!data || data.length < 1000) break;
  }

  return (
    <Page>
      <PageHeader
        title="Propiedades"
        description={`${props.length} ${props.length === 1 ? "listada" : "listadas"}`}
        actions={
          <Button asChild>
            <Link href="/dashboard/propiedades/nueva">
              <Plus />
              Nueva propiedad
            </Link>
          </Button>
        }
      />

      <PropertyTable
        pageSize={12}
        initialStatus={estado}
        initialProperties={props}
        recentInquiryPropertyIds={[...recentInquiryIds]}
        asOf={asOf.toISOString()}
        currentUserId={user.id}
        currentUserRole={agent?.role || "agente"}
      />
    </Page>
  );
}
