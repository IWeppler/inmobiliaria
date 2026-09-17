import { createClientServer } from "@/lib/supabase";
import { redirect } from "next/navigation";
import { dayStartISO, dayEndISO, ymdInAppTz, addDays, weekdayInAppTz } from "@/lib/dates";
import { DashboardStats } from "@/features/dashboard/DashboardStats";
import { AttentionToday, DASHBOARD_CARD_H } from "@/features/dashboard/AttentionToday";
import { PropertyTable } from "@/features/dashboard/property/PropertyTable";
import { UpcomingEvents, type UpcomingEvent } from "@/features/dashboard/UpcomingEvents";
import { ActivityChart, type WeekPoint } from "@/features/dashboard/charts/ActivityChart";
import { PortfolioChart } from "@/features/dashboard/charts/PortfolioChart";
import { Button } from "@/shared/components/ui/button";
import Link from "next/link";
import { Plus } from "lucide-react";
import { Page, PageHeader } from "@/shared/components/PageShell";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import type { PropertyWithDetails } from "@/app/types/entities";

const WEEKS = 12;

// Lunes de la semana (zona de la app) de una fecha YYYY-MM-DD.
function weekStart(ymd: string) {
  const wd = weekdayInAppTz(ymd); // 0 = domingo
  return addDays(ymd, wd === 0 ? -6 : 1 - wd);
}

// E1.3: dashboard OPERATIVO -- lo indispensable del día a día más dos
// lecturas rápidas del negocio (actividad semanal y cartera). Lo analítico
// fino (funnel, ingresos) sigue en /dashboard/reportes.
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
  const today = ymdInAppTz(now);
  const thisWeekStart = weekStart(today);
  const rangeStart = addDays(thisWeekStart, -7 * (WEEKS - 1));

  let propQuery = supabase
    .from("properties")
    .select(
      `*, property_types(name), property_images(image_url), agents(full_name), views_count`,
    )
    .order("created_at", { ascending: false });

  // E1.4: leads NUEVO (o sin status) -- después se descartan los que ya
  // tienen alguna nota.
  let untouchedQuery = supabase
    .from("leads")
    .select("id, name, created_at, lead_notes(id)")
    .or("status.is.null,status.eq.NUEVO")
    .order("created_at", { ascending: true });

  // Consultas de las últimas 12 semanas (para el gráfico de actividad).
  let leadsHistoryQuery = supabase
    .from("leads")
    .select("created_at")
    .gte("created_at", dayStartISO(rangeStart));

  // Visitas de hoy y visitas de las últimas 12 semanas. La policy de
  // events ya limita a los eventos propios del agente.
  const visitsTodayQuery = supabase
    .from("events")
    .select("id, time, title, lead_id")
    .eq("type", "visita")
    .gte("date", dayStartISO(today))
    .lte("date", dayEndISO(today))
    .order("time", { ascending: true });

  const visitsHistoryQuery = supabase
    .from("events")
    .select("date")
    .eq("type", "visita")
    .gte("date", dayStartISO(rangeStart))
    .lte("date", dayEndISO(addDays(thisWeekStart, 6)));

  // Próximos 7 días (todos los tipos de evento).
  const upcomingQuery = supabase
    .from("events")
    .select("id, date, time, title, type, lead_id, property_id")
    .gte("date", dayStartISO(today))
    .lte("date", dayEndISO(addDays(today, 6)))
    .order("date", { ascending: true })
    .order("time", { ascending: true })
    .limit(20);

  if (!isAdmin) {
    propQuery = propQuery.eq("agent_id", user.id);
    untouchedQuery = untouchedQuery.eq("agent_id", user.id);
    leadsHistoryQuery = leadsHistoryQuery.eq("agent_id", user.id);
  }

  const [
    { data: properties },
    { data: untouched },
    { data: visitsToday },
    { data: leadsHistory },
    { data: visitsHistory },
    { data: upcoming },
  ] = await Promise.all([
    propQuery,
    untouchedQuery,
    visitsTodayQuery,
    leadsHistoryQuery,
    visitsHistoryQuery,
    upcomingQuery,
  ]);

  const props = (properties || []) as PropertyWithDetails[];
  const untouchedLeads = (untouched ?? [])
    .filter((l) => !l.lead_notes || l.lead_notes.length === 0)
    .map(({ id, name, created_at }) => ({ id, name, created_at }));

  // Serie semanal: 12 buckets fijos (semanas sin datos quedan en 0).
  const weeks: WeekPoint[] = Array.from({ length: WEEKS }, (_, i) => {
    const week = addDays(rangeStart, 7 * i);
    return { week, label: format(new Date(`${week}T12:00:00`), "d MMM", { locale: es }), leads: 0, visits: 0 };
  });
  const idx = new Map(weeks.map((w, i) => [w.week, i]));
  for (const l of leadsHistory ?? []) {
    const i = idx.get(weekStart(ymdInAppTz(new Date(l.created_at))));
    if (i !== undefined) weeks[i].leads++;
  }
  for (const v of visitsHistory ?? []) {
    const i = idx.get(weekStart(v.date.slice(0, 10)));
    if (i !== undefined) weeks[i].visits++;
  }

  const statusCounts: Record<string, number> = {};
  for (const p of props) statusCounts[p.status] = (statusCounts[p.status] ?? 0) + 1;

  return {
    agent,
    currentUserId: user.id,
    currentUserRole: agent?.role || "agente",
    properties: props,
    weeks,
    statusCounts,
    upcoming: (upcoming ?? []) as UpcomingEvent[],
    attention: { untouchedLeads, visitsToday: visitsToday ?? [] },
    stats: {
      totalProperties: props.length,
      activeProperties: props.filter((p) => p.status === "EN_VENTA" || p.status === "EN_ALQUILER").length,
      totalViews: props.reduce((acc, p) => acc + (p.views_count || 0), 0),
      newLeadsCount: untouchedLeads.length,
      visitsThisWeek: weeks[WEEKS - 1].visits,
    },
  };
}

function Section({
  title,
  action,
  children,
  className,
}: {
  title: string;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={`flex min-w-0 flex-col overflow-hidden rounded-lg border border-border bg-card ${className ?? ""}`}>
      <div className="flex h-11 shrink-0 items-center justify-between border-b border-border px-4">
        <h2 className="text-base font-semibold tracking-tight">{title}</h2>
        {action}
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto">{children}</div>
    </section>
  );
}

const sectionLink = "text-xs text-fg-secondary underline-offset-4 hover:underline";

export default async function DashboardPage() {
  const data = await getDashboardData();
  if (!data) redirect("/login");

  const { agent, properties, stats, attention, upcoming, weeks, statusCounts, currentUserId, currentUserRole } = data;

  return (
    <Page>
      <PageHeader
        title={`Hola ${agent?.full_name?.split(" ")[0] ?? ""} 👋`}
        description={format(new Date(), "EEEE d 'de' MMMM", { locale: es })}
        actions={
          <Button asChild>
            <Link href="/dashboard/propiedades/nueva">
              <Plus />
              Nueva propiedad
            </Link>
          </Button>
        }
      />

      {/* KPIs: una fila baja */}
      <DashboardStats stats={stats} />

      {/* Operativo: qué hacer hoy y esta semana */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <AttentionToday data={attention} />
        <Section title="Próximos 7 días" className={DASHBOARD_CARD_H} action={<Link href="/dashboard/agenda" className={sectionLink}>Agenda</Link>}>
          <UpcomingEvents events={upcoming} />
        </Section>
      </div>

      {/* Analítico: dos lecturas rápidas del negocio */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <Section title="Consultas y visitas por semana" action={<Link href="/dashboard/reportes" className={sectionLink}>Reportes</Link>}>
          <div className="p-4">
            <ActivityChart data={weeks} />
          </div>
        </Section>
        <Section title="Cartera por estado" action={<span className="text-xs text-muted-foreground">{stats.totalProperties} propiedades</span>}>
          <div className="p-4">
            <PortfolioChart counts={statusCounts} />
          </div>
        </Section>
      </div>

      {/* Propiedades */}
      <section className="flex min-w-0 flex-col gap-3">
        <div className="flex items-baseline justify-between">
          <h2 className="text-lg font-semibold tracking-tight">Propiedades</h2>
          <Link href="/dashboard/propiedades" className="text-sm text-fg-secondary underline-offset-4 hover:underline">
            Ver todas
          </Link>
        </div>
        <PropertyTable
          compact
          pageSize={12}
          initialProperties={properties}
          currentUserId={currentUserId}
          currentUserRole={currentUserRole}
        />
      </section>
    </Page>
  );
}
