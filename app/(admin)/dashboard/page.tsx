import { createClientServer } from "@/lib/supabase";
import { Button } from "@/shared/components/ui/button";
import { PlusCircle } from "lucide-react";
import Link from "next/link";
import { PropertyTable } from "@/features/dashboard/PropertyTable";
import type { PropertyWithDetails } from "@/app/types/entities";

// Esta función busca los datos del agente y las propiedades
async function getDashboardData() {
  const supabase = await createClientServer();

  // 1. Obtener el usuario/agente
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data: agent } = await supabase
    .from("agents")
    .select("*")
    .eq("id", user?.id || "")
    .single();

  // 2. Obtener las propiedades
  const { data: properties, error } = await supabase
    .from("properties")
    .select(
      `
      *,
      property_types ( name ),
      property_images ( image_url )
    `
    )
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Error fetching properties:", error);
    // Manejar el error elegantemente
  }

  // Tipamos los datos para pasarlos
  const typedProperties: PropertyWithDetails[] = properties || [];

  return {
    agentName: agent?.full_name,
    properties: typedProperties,
  };
}

// --- La Página ---
export default async function DashboardPage() {
  // 1. Cargamos los datos en el servidor
  const { agentName, properties } = await getDashboardData();

  return (
    <div className="flex min-h-screen items-start justify-center font-sans">
      <main className="w-full max-w-6xl p-4 md:p-8">
      {/* Encabezado y Saludo */}
      <div className="flex items-center justify-between space-y-8">
        <div>
          <h1 className="text-3xl mb-1 font-bold tracking-tight">
            ¡Bienvenido, {agentName}!
          </h1>
          <p className="text-muted-foreground">
            Aquí está un resumen de tus propiedades.
          </p>
        </div>
        <div className="flex items-center space-x-2">
          <Button asChild>
            <Link href="/dashboard/propiedades/nueva">
              <PlusCircle className="mr-2 h-4 w-4" />
              Agregar Propiedad
            </Link>
          </Button>
        </div>
      </div>

      <PropertyTable initialProperties={properties} />
    </main>
    </div>
  );
}
