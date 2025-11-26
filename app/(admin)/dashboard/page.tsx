import { createClientServer } from "@/lib/supabase";
import { Button } from "@/shared/components/ui/button";
import { PlusCircle } from "lucide-react";
import Link from "next/link";
import { PropertyTable } from "@/features/dashboard/PropertyTable";
import type { PropertyWithDetails } from "@/app/types/entities";
import { redirect } from "next/navigation";

async function getDashboardData() {
  const supabase = await createClientServer();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const { data: agent } = await supabase
    .from("agents")
    .select("*")
    .eq("id", user.id)
    .single();

  const { data: properties, error } = await supabase
    .from("properties")
    .select(
      `
      *,
      property_types ( name ),
      property_images ( image_url ),
      agents ( full_name )
      views_count
    `
    )
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Error fetching properties:", error);
  }

  const typedProperties: PropertyWithDetails[] = (properties as any) || [];

  return {
    currentUserId: user.id,
    currentUserRole: agent?.role || "agente",
    agentName: agent?.full_name || agent?.email,
    properties: typedProperties,
  };
}

export default async function DashboardPage() {
  const data = await getDashboardData();

  if (!data) {
    redirect("/login");
  }

  const { agentName, properties, currentUserId, currentUserRole } = data;

  return (
    <div className="flex min-h-screen items-start justify-center">
      <main className="w-full p-4 md:p-8">
        {/* Encabezado  */}
        <div className="flex items-center justify-between space-y-2 mb-6">
          <div>
            <h1 className="text-3xl mb-1 font-clash font-semibold tracking-tight">
              Hola, {agentName}!
            </h1>
            <p className="text-muted-foreground pr-4">
              Aquí está un resumen de las propiedades.
            </p>
          </div>
          <div className="flex items-center space-x-2">
            <Button
              asChild
              className="bg-foreground hover:bg-foreground/90 cursor-pointer"
            >
              <Link href="/dashboard/propiedades/nueva">
                <PlusCircle className="sm:mr-2 h-4 w-4" />
                <span className="hidden sm:inline">Agregar Propiedad</span>
              </Link>
            </Button>
          </div>
        </div>

        {/* Pasamos los datos de permisos a la tabla */}
        <PropertyTable
          initialProperties={properties}
          currentUserId={currentUserId}
          currentUserRole={currentUserRole}
        />
      </main>
    </div>
  );
}
