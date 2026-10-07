import { redirect } from "next/navigation";
import { createClientServer } from "@/lib/supabase";
import { ymdInAppTz } from "@/lib/dates";
import { Page, PageHeader } from "@/shared/components/PageShell";
import { CashFlowChart } from "@/features/finances/CashFlowChart";
import {
  MovementsPanel,
  type MovementListRow,
  type PendingSale,
  type RecurringExpenseRow,
} from "@/features/finances/MovementsPanel";
import { buildCashFlowSeries, lastPeriods, toArs } from "@/features/finances/logic";

const MONTHS = 12;

// Finanzas del negocio: flujo de caja mensual, gastos fijos y movimientos.
// Admin y administración (también lo exige la RLS de cash_movements).
export default async function FinanzasPage() {
  const supabase = await createClientServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: backOffice } = await supabase.rpc("is_back_office");
  if (!backOffice) redirect("/dashboard");

  // Registra los meses de gastos fijos que ya vencieron (idempotente).
  await supabase.rpc("generate_recurring_expenses");

  const today = ymdInAppTz();
  const periods = lastPeriods(`${today.slice(0, 7)}-01`, MONTHS);

  const [
    { data: movements },
    { data: recurring },
    { data: rate },
    { data: properties },
    { data: sold },
    { data: sales },
  ] = await Promise.all([
    supabase
      .from("cash_movements")
      .select(
        "id, occurred_on, direction, category, nature, description, amount, currency, settlement_id, sale_id, maintenance_id, recurring_expense_id, contract_id, properties(id, title)",
      )
      .gte("occurred_on", periods[0])
      .order("occurred_on", { ascending: false })
      .order("created_at", { ascending: false }),
    supabase
      .from("recurring_expenses")
      .select("id, description, category, amount, currency, day_of_month, active")
      .order("active", { ascending: false })
      .order("description"),
    supabase.from("exchange_rates").select("usd_to_ars").eq("id", 1).single(),
    supabase.from("properties").select("id, title, status, city, price, currency, agent_id").order("title"),
    supabase
      .from("status_history")
      .select("entity_id, changed_at")
      .eq("entity_type", "property")
      .eq("status", "VENDIDO")
      .gte("changed_at", `${periods[0]}T00:00:00Z`)
      .order("changed_at", { ascending: false }),
    supabase.from("property_sales").select("property_id"),
  ]);

  const usdToArs = Number(rate?.usd_to_ars ?? 0);
  const rows = (movements ?? []) as unknown as MovementListRow[];
  const recurringRows = (recurring ?? []) as RecurringExpenseRow[];
  const series = buildCashFlowSeries(rows, periods, usdToArs);
  const fixedMonthly = recurringRows
    .filter((r) => r.active)
    .reduce((sum, r) => sum + toArs(r.amount, r.currency, usdToArs), 0);

  // Propiedades vendidas en los últimos 12 meses (siguen VENDIDO) sin
  // cierre de venta registrado.
  const closed = new Set((sales ?? []).map((s) => s.property_id));
  const byId = new Map((properties ?? []).map((p) => [p.id, p]));
  const pendingSales: PendingSale[] = [];
  const seen = new Set<string>();
  for (const s of sold ?? []) {
    const property = byId.get(s.entity_id);
    if (seen.has(s.entity_id) || closed.has(s.entity_id) || property?.status !== "VENDIDO") continue;
    seen.add(s.entity_id);
    pendingSales.push({
      id: property.id,
      title: property.title,
      price: property.price,
      currency: property.currency,
      agent_id: property.agent_id,
      soldOn: ymdInAppTz(new Date(s.changed_at)),
    });
  }

  return (
    <Page>
      <PageHeader
        title="Finanzas"
        description={`Flujo de caja de los últimos ${MONTHS} meses, en ARS (USD a $ ${usdToArs.toLocaleString("es-AR")}).`}
      />
      <div className="flex min-w-0 flex-col gap-5">
        <section className="rounded-lg border border-border bg-card p-4">
          <CashFlowChart data={series} fixedMonthly={fixedMonthly} />
        </section>
        <MovementsPanel
          movements={rows}
          recurring={recurringRows}
          pendingSales={pendingSales}
          properties={(properties ?? []).map(({ id, title, city }) => ({ id, title, city }))}
          today={today}
          usdToArs={usdToArs}
        />
      </div>
    </Page>
  );
}
