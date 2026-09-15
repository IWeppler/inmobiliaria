import { createClientServer } from "@/lib/supabase";
import { redirect } from "next/navigation";
import { dayStartISO, dayEndISO, ymdInAppTz } from "@/lib/dates";
import { DashboardStats } from "@/features/dashboard/DashboardStats";
import { AttentionToday } from "@/features/dashboard/AttentionToday";
import { LeadsWidget } from "@/features/dashboard/LeadsWidget";
import { PropertyTable } from "@/features/dashboard/property/PropertyTable";
import { DashboardCalendar } from "@/features/dashboard/Calendar";
import { Button } from "@/shared/components/ui/button";
import Link from "next/link";
import { PlusCircle, BarChart3 } from "lucide-react";
import type { PropertyWithDetails } from "@/app/types/entities";

// E1.3: dashboard OPERATIVO -- lo indispensable del día a día. Lo
// analítico (funnel, ingresos, comparaciones) está en /dashboard/reportes.
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
  const now = new Date();

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

  // E1.4: leads NUEVO (o sin status) -- después se descartan los que ya
  // tienen alguna nota.
  let untouchedQuery = supabase
    .from("leads")
    .select("id, name, created_at, lead_notes(id)")
    .or("status.is.null,status.eq.NUEVO")
    .order("created_at", { ascending: true });

  // E1.4: visitas de hoy (events.type = 'visita'). La policy de events
  // ya limita a los eventos propios del agente.
  const visitsQuery = supabase
    .from("events")
    .select("id, time, title, lead_id")
    .eq("type", "visita")
    .gte("date", dayStartISO(ymdInAppTz(now)))
    .lte("date", dayEndISO(ymdInAppTz(now)))
    .order("time", { ascending: true });

  if (!isAdmin) {
    propQuery = propQuery.eq("agent_id", user.id);
    leadQuery = leadQuery.eq("agent_id", user.id);
    untouchedQuery = untouchedQuery.eq("agent_id", user.id);
  }

  const [
    { data: properties },
    { data: leads },
    { data: untouched },
    { data: visits },
  ] = await Promise.all([propQuery, leadQuery, untouchedQuery, visitsQuery]);

  const props = properties || [];

  const totalProperties = props.length;
  const totalViews = props.reduce(
    (acc, curr) => acc + (curr.views_count || 0),
    0,
  );
  const activeProperties = props.filter(
    (p) => p.status === "EN_VENTA" || p.status === "EN_ALQUILER",
  ).length;
  const newLeadsCount =
    leads?.filter((l) => !l.status || l.status === "NUEVO").length || 0;

  return {
    user,
    agent,
    currentUserId: user.id,
    currentUserRole: agent?.role || "agente",
    properties: props as PropertyWithDetails[],
    leads: leads || [],
    attention: {
      untouchedLeads: (untouched ?? [])
        .filter((l) => !l.lead_notes || l.lead_notes.length === 0)
        .map(({ id, name, created_at }) => ({ id, name, created_at })),
      visitsToday: visits ?? [],
    },
    stats: {
      totalProperties,
      totalViews,
      activeProperties,
      newLeadsCount,
    },
  };
}

export default async function DashboardPage() {
  const data = await getDashboardData();
  if (!data) redirect("/login");

  const {
    agent,
    properties,
    leads,
    stats,
    attention,
    currentUserId,
    currentUserRole,
  } = data;

  return (
    <div className="theme-tn flex flex-col w-full max-w-[1600px] mx-auto px-4 py-6 gap-6">
      {/* HEADER PRINCIPAL */}
      <div className="flex items-center justify-between shrink-0">
        <div>
          <h1 className="text-[26px] font-serif font-semibold tracking-tight text-foreground">
            Hola, {agent?.full_name?.split(" ")[0]}!
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Aquí está el resumen de tu negocio hoy.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button asChild variant="outline" className="rounded-sm shadow-none">
            <Link href="/dashboard/reportes">
              <BarChart3 className="mr-2 h-4 w-4" />
              <span className="hidden sm:inline">Reportes</span>
            </Link>
          </Button>
          <Button asChild className="rounded-sm shadow-none">
            <Link href="/dashboard/propiedades/nueva">
              <PlusCircle className="mr-2 h-4 w-4" />{" "}
              <span className="hidden sm:inline">Nueva Propiedad</span>
            </Link>
          </Button>
        </div>
      </div>

      {/* REQUIERE TU ATENCIÓN HOY (E1.4) */}
      <AttentionToday data={attention} />

      {/* MÉTRICAS OPERATIVAS */}
      <div className="shrink-0">
        <DashboardStats stats={stats} />
      </div>

      {/* CONTENIDO PRINCIPAL: TABLA Y LEADS/CALENDARIO */}
      <div className="flex flex-col lg:flex-row gap-6 w-full mt-2">
        {/* COLUMNA IZQUIERDA: TABLA */}
        <div className="flex flex-col flex-1 min-w-0 bg-card rounded-md border border-border shadow-none overflow-hidden">
          <div className="py-4 px-4 border-b border-border flex justify-between items-center shrink-0">
            <h3 className="font-serif font-semibold text-foreground">
              Mis Propiedades
            </h3>
            <Link
              href="/dashboard/propiedades"
              className="text-xs bg-secondary text-secondary-foreground px-3 py-1 rounded-full font-medium hover:bg-secondary/70"
            >
              {properties.length} listadas
            </Link>
          </div>

          <div className="p-2 w-full">
            <PropertyTable
              initialProperties={properties}
              currentUserId={currentUserId}
              currentUserRole={currentUserRole}
            />
          </div>
        </div>

        {/* COLUMNA DERECHA: CALENDARIO Y LEADS */}
        <div className="flex flex-col w-full lg:w-[320px] xl:w-[350px] shrink-0 gap-6 self-start">
          {/* WIDGET 1: CALENDARIO */}
          <DashboardCalendar />

          {/* WIDGET 2: LEADS */}
          <div className="flex flex-col bg-card rounded-md border border-border shadow-none overflow-hidden">
            <div className="py-4 px-4 border-b border-border shrink-0">
              <h3 className="font-serif font-semibold text-foreground">
                Consultas Recientes
              </h3>
            </div>

            <div className="p-0">
              <LeadsWidget leads={leads} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
