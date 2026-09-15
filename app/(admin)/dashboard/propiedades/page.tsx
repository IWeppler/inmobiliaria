import { createClientServer } from "@/lib/supabase";
import { redirect } from "next/navigation";
import Link from "next/link";
import { PlusCircle } from "lucide-react";
import { Button } from "@/shared/components/ui/button";
import { PropertyTable } from "@/features/dashboard/property/PropertyTable";
import type { PropertyWithDetails } from "@/app/types/entities";

// E0.3: ruta propia para el listado de propiedades. Misma query y mismos
// permisos que el bloque "Mis Propiedades" del Dashboard (admin ve todo,
// agente solo lo suyo), pero a pantalla completa y sin los widgets.
export default async function PropiedadesPage() {
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
    <div className="theme-tn flex flex-col w-full max-w-[1600px] mx-auto px-4 py-6 gap-6">
      <div className="flex items-center justify-between shrink-0">
        <div>
          <h1 className="text-[26px] font-serif font-semibold tracking-tight text-foreground">
            Propiedades
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            {props.length} {props.length === 1 ? "listada" : "listadas"}
          </p>
        </div>
        <Button asChild className="rounded-sm shadow-none">
          <Link href="/dashboard/propiedades/nueva">
            <PlusCircle className="mr-2 h-4 w-4" />
            <span className="hidden sm:inline">Nueva Propiedad</span>
          </Link>
        </Button>
      </div>

      <div className="bg-card rounded-md border border-border shadow-none overflow-hidden">
        <div className="p-2 w-full">
          <PropertyTable
            initialProperties={props}
            currentUserId={user.id}
            currentUserRole={agent?.role || "agente"}
          />
        </div>
      </div>
    </div>
  );
}
