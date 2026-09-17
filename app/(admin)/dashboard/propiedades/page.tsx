import { createClientServer } from "@/lib/supabase";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Plus } from "lucide-react";
import { Button } from "@/shared/components/ui/button";
import { Page, PageHeader } from "@/shared/components/PageShell";
import { PropertyTable } from "@/features/dashboard/property/PropertyTable";
import type { PropertyWithDetails } from "@/app/types/entities";

// E0.3: ruta propia para el listado de propiedades. Misma query y mismos
// permisos que el bloque "Mis Propiedades" del Dashboard (admin ve todo,
// agente solo lo suyo), pero a pantalla completa y sin los widgets.
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

  let query = supabase
    .from("properties")
    .select(
      `*, property_types(name), property_images(image_url), agents(full_name), views_count`,
    )
    .order("created_at", { ascending: false });

  if (!isAdmin) {
    query = query.eq("agent_id", user.id);
  }

  const { data: properties, error } = await query;

  if (error) {
    return <p>Error al cargar: {error.message}</p>;
  }

  const props = (properties || []) as PropertyWithDetails[];

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
        initialStatus={estado}
        initialProperties={props}
        currentUserId={user.id}
        currentUserRole={agent?.role || "agente"}
      />
    </Page>
  );
}
