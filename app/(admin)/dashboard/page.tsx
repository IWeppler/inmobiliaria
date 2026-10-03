import { createClientServer } from "@/lib/supabase";
import { redirect } from "next/navigation";
import { dayStartISO, dayEndISO, ymdInAppTz, addDays, weekdayInAppTz } from "@/lib/dates";
import { DashboardStats } from "@/features/dashboard/DashboardStats";
import { DashboardAside } from "@/features/dashboard/DashboardAgenda";
import type { UpcomingEvent } from "@/features/dashboard/UpcomingEvents";
import { LeadConversion } from "@/features/dashboard/LeadConversion";
import { CollectionChart } from "@/features/dashboard/charts/CollectionChart";
import { buildCollectionSeries, type ChargeRow } from "@/features/dashboard/charts/collection";
import { CashFlowChart } from "@/features/finances/CashFlowChart";
import { buildCashFlowSeries, toArs, type MovementRow } from "@/features/finances/logic";
import {
  DashboardPropertyPerformance,
  type DashboardPropertyRow,
} from "@/features/dashboard/property/DashboardPropertyPerformance";
import { Button } from "@/shared/components/ui/button";
import Link from "next/link";
import { Plus } from "lucide-react";
import { Page, PageHeader } from "@/shared/components/PageShell";
import { addMonths, format } from "date-fns";
import { es } from "date-fns/locale";
import type { PropertyWithDetails } from "@/app/types/entities";
import { businessMinutes } from "@/features/dashboard/reports/responseTime";

const WEEKS = 12;
const MONTHS = 12;

// Lunes de la semana (zona de la app) de una fecha YYYY-MM-DD.
function weekStart(ymd: string) {
  const wd = weekdayInAppTz(ymd); // 0 = domingo
  return addDays(ymd, wd === 0 ? -6 : 1 - wd);
}

// Dashboard operativo: rendimiento y cartera en el cuerpo; recordatorios,
// calendario y próximos eventos en el lateral.
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
  const monthStart = `${today.slice(0, 7)}-01`;
  const monthAfterAgenda = format(
    addMonths(new Date(`${monthStart}T12:00:00`), 3),
    "yyyy-MM-dd",
  );
  const thisWeekStart = weekStart(today);
  const rangeStart = addDays(thisWeekStart, -7 * (WEEKS - 1));
  // Últimos 12 meses de cobranza, incluido el actual.
  const periods = Array.from({ length: MONTHS }, (_, i) =>
    format(addMonths(new Date(`${monthStart}T12:00:00`), i - (MONTHS - 1)), "yyyy-MM-dd"),
  );

  let propQuery = supabase
    .from("properties")
    .select(
      `*, property_types(name), property_images(image_url), agents!properties_agent_id_fkey(full_name), views_count`,
    )
    .order("created_at", { ascending: false });

  // E1.4: leads NUEVO (o sin status) -- después se descartan los que ya
  // tienen alguna nota.
  let untouchedQuery = supabase
    .from("leads")
    .select("id, name, created_at, lead_notes(id)")
    .or("status.is.null,status.eq.NUEVO")
    .order("created_at", { ascending: true });

  // Todos los leads visibles alimentan KPIs, conversión y rendimiento por
  // propiedad. created_at también permite construir la serie semanal.
  let leadsQuery = supabase
    .from("leads")
    .select("id, property_id, status, created_at");

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

  // Eventos del mes actual y de los próximos dos meses: el calendario usa
  // el rango completo y el listado inferior muestra solo los futuros.
  const agendaQuery = supabase
    .from("events")
    .select("id, date, time, title, type, lead_id, property_id")
    .gte("date", dayStartISO(monthStart))
    .lt("date", dayStartISO(monthAfterAgenda))
    .order("date", { ascending: true })
    .order("time", { ascending: true })
    .limit(200);

  // Cargos de alquiler de los últimos 12 meses con sus cobros. La policy
  // de rental_charges ya limita a los contratos visibles del agente.
  const chargesQuery = supabase
    .from("rental_charges")
    .select("period, due_date, amount, currency, rental_payment_entries(amount)")
    .gte("period", periods[0])
    .lte("period", monthStart);

  const rateQuery = supabase
    .from("exchange_rates")
    .select("usd_to_ars")
    .eq("id", 1)
    .single();

  // Flujo de caja del negocio: solo admin (RLS devuelve vacío al resto).
  // Antes de leer, registra los gastos fijos del mes que ya vencieron.
  const movementsQuery = isAdmin
    ? supabase.rpc("generate_recurring_expenses").then(() =>
        supabase
          .from("cash_movements")
          .select("occurred_on, category, nature, amount, currency")
          .gte("occurred_on", periods[0]),
      )
    : Promise.resolve({ data: [] as MovementRow[] });
  const recurringQuery = isAdmin
    ? supabase.from("recurring_expenses").select("amount, currency").eq("active", true)
    : Promise.resolve({ data: [] as { amount: number; currency: string }[] });

  // Alquileres para "Requiere tu atención". RLS ya limita a los contratos
  // del agente (admin ve todos).
  const openMaintenanceQuery = supabase
    .from("rental_maintenance")
    .select("id", { count: "exact", head: true })
    .in("status", ["ABIERTO", "EN_CURSO"]);
  const expiringContractsQuery = supabase
    .from("rental_contracts")
    .select("id", { count: "exact", head: true })
    .eq("status", "ACTIVO")
    .lte("end_date", addDays(today, 30));

  if (!isAdmin) {
    propQuery = propQuery.eq("agent_id", user.id);
    untouchedQuery = untouchedQuery.eq("agent_id", user.id);
    leadsQuery = leadsQuery.eq("agent_id", user.id);
  }

  const [
    { data: properties },
    { data: untouched },
    { data: visitsToday },
    { data: leads },
    { data: visitsHistory },
    { data: agendaEvents },
    { data: charges },
    { data: rate },
    { data: movements },
    { data: recurring },
    { count: openMaintenance },
    { count: expiringContracts },
  ] = await Promise.all([
    propQuery,
    untouchedQuery,
    visitsTodayQuery,
    leadsQuery,
    visitsHistoryQuery,
    agendaQuery,
    chargesQuery,
    rateQuery,
    movementsQuery,
    recurringQuery,
    openMaintenanceQuery,
    expiringContractsQuery,
  ]);

  const props = (properties || []) as PropertyWithDetails[];
  const untouchedLeads = (untouched ?? [])
    .filter((l) => !l.lead_notes || l.lead_notes.length === 0)
    .map(({ id, name, created_at }) => ({
      id,
      name,
      created_at,
      waitingMinutes: businessMinutes(new Date(created_at), new Date()),
    }));

  const leadRows = leads ?? [];
  const leadIds = leadRows.map((lead) => lead.id);
  const { data: closedThisMonthHistory } = leadIds.length
    ? await supabase
        .from("status_history")
        .select("entity_id")
        .eq("entity_type", "lead")
        .eq("status", "CERRADO")
        .gte("changed_at", dayStartISO(monthStart))
        .in("entity_id", leadIds)
    : { data: [] as { entity_id: string }[] };

  const usdToArs = Number(rate?.usd_to_ars ?? 0);
  const collection = buildCollectionSeries((charges ?? []) as ChargeRow[], periods, today, usdToArs);
  const cashFlow = isAdmin
    ? {
        series: buildCashFlowSeries(movements ?? [], periods, usdToArs),
        fixedMonthly: (recurring ?? []).reduce((sum, r) => sum + toArs(r.amount, r.currency, usdToArs), 0),
      }
    : null;

  // Visitas de la semana en curso para el KPI.
  const visitsThisWeek = (visitsHistory ?? []).filter(
    (v) => weekStart(v.date.slice(0, 10)) === thisWeekStart,
  ).length;

  const openLeads = leadRows.filter(
    (lead) => lead.status !== "CERRADO" && lead.status !== "DESCARTADO",
  );
  const closedLeads = leadRows.filter((lead) => lead.status === "CERRADO");
  const discardedLeads = leadRows.filter((lead) => lead.status === "DESCARTADO");
  const activeLeadsByProperty = new Map<string, number>();
  for (const lead of openLeads) {
    if (!lead.property_id) continue;
    activeLeadsByProperty.set(
      lead.property_id,
      (activeLeadsByProperty.get(lead.property_id) ?? 0) + 1,
    );
  }

  // Estancadas: activas hace más de 30 días y sin ninguna consulta en los
  // últimos 30. Se arma con los leads visibles del usuario (un agente ve
  // los suyos), igual que el resto del dashboard.
  const DAY_MS = 86_400_000;
  const recentLeadProperties = new Set(
    leadRows
      .filter((l) => l.property_id && Date.now() - new Date(l.created_at).getTime() < 30 * DAY_MS)
      .map((l) => l.property_id),
  );
  const stalledProperties = props
    .filter((p) => p.status === "EN_VENTA" || p.status === "EN_ALQUILER")
    .map((p) => ({ id: p.id, title: p.title, days: Math.floor((Date.now() - new Date(p.created_at).getTime()) / DAY_MS) }))
    .filter((p) => p.days >= 30 && !recentLeadProperties.has(p.id))
    .sort((a, b) => b.days - a.days);

  const propertyPerformance: DashboardPropertyRow[] = props
    .filter(
      (property) =>
        property.status === "EN_VENTA" || property.status === "EN_ALQUILER",
    )
    .map((property) => ({
      id: property.id,
      title: property.title,
      location: [property.street_address, property.city].filter(Boolean).join(" · "),
      type: property.property_types?.name ?? "Sin tipo",
      activeLeads: activeLeadsByProperty.get(property.id) ?? 0,
      views: property.views_count ?? 0,
      status: property.status,
      imageUrl: property.property_images?.[0]?.image_url ?? null,
    }))
    .sort(
      (a, b) =>
        b.activeLeads - a.activeLeads || b.views - a.views || a.title.localeCompare(b.title),
    )
    .slice(0, 5);

  return {
    agent,
    currentUserId: user.id,
    currentUserRole: agent?.role || "agente",
    collection,
    cashFlow,
    propertyPerformance,
    agendaEvents: (agendaEvents ?? []) as UpcomingEvent[],
    attention: {
      untouchedLeads,
      visitsToday: visitsToday ?? [],
      stalledProperties,
      rentals: {
        overdueCharges: ((charges ?? []) as ChargeRow[]).filter((charge) =>
          charge.due_date < today
          && charge.amount - charge.rental_payment_entries.reduce((sum, entry) => sum + entry.amount, 0) > 0.005,
        ).length,
        openMaintenance: openMaintenance ?? 0,
        expiringContracts: expiringContracts ?? 0,
      },
    },
    conversion: {
      closed: closedLeads.length,
      discarded: discardedLeads.length,
      open: openLeads.length,
    },
    stats: {
      activeProperties: props.filter((p) => p.status === "EN_VENTA" || p.status === "EN_ALQUILER").length,
      openLeads: openLeads.length,
      visitsThisWeek,
      closedThisMonth: new Set(
        (closedThisMonthHistory ?? []).map((item) => item.entity_id),
      ).size,
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

  const {
    agent,
    stats,
    attention,
    agendaEvents,
    collection,
    cashFlow,
    conversion,
    propertyPerformance,
  } = data;

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

      <div className="grid min-w-0 grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1fr)_320px] xl:items-start">
        <main className="flex min-w-0 flex-col gap-5">
          <DashboardStats stats={stats} />

          <div className="grid min-w-0 grid-cols-1 gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(260px,1fr)]">
            {cashFlow ? (
              <Section
                title="Flujo de caja"
                action={
                  <Link href="/dashboard/finanzas" className={sectionLink}>
                    Finanzas
                  </Link>
                }
              >
                <div className="p-4">
                  {cashFlow.series.some((point) => point.income > 0 || point.expense > 0) ? (
                    <CashFlowChart data={cashFlow.series} fixedMonthly={cashFlow.fixedMonthly} showSummary={false} />
                  ) : (
                    <p className="py-12 text-center text-sm text-muted-foreground">
                      Todavía no hay movimientos.{" "}
                      <Link href="/dashboard/finanzas" className="underline underline-offset-4">
                        Cargá ingresos y egresos
                      </Link>
                      .
                    </p>
                  )}
                </div>
              </Section>
            ) : (
            <Section
              title="Cobranza de alquileres"
              action={
                <Link href="/dashboard/alquileres" className={sectionLink}>
                  Alquileres
                </Link>
              }
            >
              <div className="p-4">
                {collection.some((point) => point.expected > 0) ? (
                  <CollectionChart data={collection} />
                ) : (
                  <p className="py-12 text-center text-sm text-muted-foreground">
                    Todavía no hay cuotas de alquiler en los últimos 12 meses.
                  </p>
                )}
              </div>
            </Section>
            )}
            <Section
              title="Conversión de leads"
              action={
                <Link href="/dashboard/reportes" className={sectionLink}>
                  Ver funnel
                </Link>
              }
            >
              <LeadConversion {...conversion} />
            </Section>
          </div>

          <Section
            title="Rendimiento de propiedades"
            action={
              <Link href="/dashboard/propiedades" className={sectionLink}>
                Ver todas
              </Link>
            }
          >
            <DashboardPropertyPerformance properties={propertyPerformance} />
          </Section>
        </main>

        <DashboardAside
          key={agendaEvents.map((event) => event.id).join(",")}
          initialEvents={agendaEvents}
          attention={attention}
        />
      </div>
    </Page>
  );
}
