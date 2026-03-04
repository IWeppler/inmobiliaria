import { createClientServer } from "@/lib/supabase";
import { redirect } from "next/navigation";
import { DashboardStats } from "@/features/dashboard/DashboardStats";
import { LeadsWidget } from "@/features/dashboard/LeadsWidget";
import { PropertyTable } from "@/features/dashboard/property/PropertyTable";
import { Button } from "@/shared/components/ui/button";
import Link from "next/link";
import { PlusCircle } from "lucide-react";
import type { PropertyWithDetails } from "@/app/types/entities";

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

  const isAdmin = agent?.role === "admin";

  let propQuery = supabase
    .from("properties")
    .select(
      `*, property_types(name), property_images(image_url), agents(full_name), views_count`,
    )
    .order("created_at", { ascending: false });

  let leadQuery = supabase
    .from("leads")
    .select(`*, properties(title)`)
    .order("created_at", { ascending: false })
    .limit(20);

  if (!isAdmin) {
    propQuery = propQuery.eq("agent_id", user.id);
    leadQuery = leadQuery.eq("agent_id", user.id);
  }

  const [{ data: properties }, { data: leads }] = await Promise.all([
    propQuery,
    leadQuery,
  ]);

  const props = properties || [];
  const totalProperties = props.length;
  const totalViews = props.reduce(
    (acc, curr) => acc + (curr.views_count || 0),
    0,
  );
  const totalLeads = leads?.length || 0;
  const activeProperties = props.filter(
    (p) => p.status === "EN_VENTA" || p.status === "EN_ALQUILER",
  ).length;

  return {
    user,
    agent,
    currentUserId: user.id,
    currentUserRole: agent?.role || "agente",
    properties: props as PropertyWithDetails[],
    leads: leads || [],
    stats: {
      totalProperties,
      totalViews,
      activeProperties,
      recentLeadsCount: totalLeads,
    },
  };
}

export default async function DashboardPage() {
  const data = await getDashboardData();
  if (!data) redirect("/login");

  const { agent, properties, leads, stats, currentUserId, currentUserRole } =
    data;

  return (
    <div className="flex flex-col w-full max-w-[1600px] mx-auto px-4 py-6 gap-3">
      {/* SECCIÓN SUPERIOR */}
      <div className="flex flex-col gap-4 shrink-0">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-clash font-semibold text-zinc-900">
              Hola, {agent?.full_name?.split(" ")[0]}!
            </h1>
          </div>
          <Button
            asChild
            className="bg-zinc-900 text-white hover:bg-zinc-800 shadow-sm"
          >
            <Link href="/dashboard/propiedades/nueva">
              <PlusCircle className="mr-2 h-4 w-4" />{" "}
              <span className="hidden sm:inline">Nueva Propiedad</span>
            </Link>
          </Button>
        </div>

        {/* Stats Cards */}
        <DashboardStats stats={stats} />
      </div>

      <div className="flex flex-col lg:flex-row gap-3 w-full">
        {/* COLUMNA IZQUIERDA: TABLA */}
        <div className="flex flex-col flex-1 min-w-0 bg-white rounded-xl border border-zinc-200 shadow-sm overflow-hidden">
          <div className="py-4 px-4 border-b border-zinc-100 bg-white flex justify-between items-center shrink-0">
            <h3 className="font-semibold text-zinc-900">Mis Propiedades</h3>
            <span className="text-xs bg-zinc-100 text-zinc-600 px-3 py-1 rounded-full font-medium">
              {properties.length} listadas
            </span>
          </div>

          <div className="p-2 w-full">
            <PropertyTable
              initialProperties={properties}
              currentUserId={currentUserId}
              currentUserRole={currentUserRole}
            />
          </div>
        </div>

        {/* COLUMNA DERECHA: LEADS */}
        <div className="flex flex-col w-full lg:w-[260px] xl:w-[400px] shrink-0 bg-white rounded-xl border border-zinc-200 shadow-sm self-start overflow-hidden">
          <div className="py-4 px-4 border-b border-zinc-100 bg-zinc-50 shrink-0">
            <h3 className="font-semibold text-zinc-900">Consultas Recientes</h3>
          </div>

          <div className="p-0">
            <LeadsWidget leads={leads} />
          </div>
        </div>
      </div>
    </div>
  );
}
