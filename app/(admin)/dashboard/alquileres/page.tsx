import Link from "next/link";
import { redirect } from "next/navigation";
import { AlertTriangle, Banknote, CalendarClock, Hand, Plus, TrendingUp, Upload, Wrench } from "lucide-react";
import { createClientServer } from "@/lib/supabase";
import { addDays, ymdInAppTz } from "@/lib/dates";
import { Button } from "@/shared/components/ui/button";
import { Page, PageHeader } from "@/shared/components/PageShell";
import {
  ADJUSTMENT_LABELS, addMonths, daysBetween, formatDate, money, periodOf,
  type AdjustmentIndex,
} from "@/features/rentals/logic";
import { DUE_SOON_DAYS, portfolioKpis } from "@/features/rentals/portfolioKpis";
import { CollectionChart } from "@/features/dashboard/charts/CollectionChart";
import { buildCollectionSeries } from "@/features/dashboard/charts/collection";
import { RentalsNav } from "@/features/rentals/RentalsNav";
import { Stat, StatStrip } from "@/features/rentals/StatStrip";
import { ContractsTable, type ContractListRow } from "@/features/rentals/ContractsTable";
import { getRentalAlertSettings } from "@/features/rentals/settings";

type ContractRow = {
  id: string; number: number; property_id: string; status: string; end_date: string; rent_amount: number; currency: string;
  next_adjustment_date: string | null; adjustment_index: string; renewed_from_id: string | null;
  properties: { title: string } | null;
  owner: { full_name: string } | null;
  tenant: { full_name: string } | null;
};
type ChargeRow = {
  contract_id: string; period: string; due_date: string; kind: string; amount: number; currency: string;
  rental_payment_entries: { amount: number }[];
};

const GROUP_LIMIT = 4;
const CHART_MONTHS = 6;

function totalsByCurrency(items: { amount: number; currency: string }[]) {
  const totals = new Map<string, number>();
  for (const item of items) totals.set(item.currency, (totals.get(item.currency) ?? 0) + item.amount);
  return [...totals.entries()].map(([currency, amount]) => money(amount, currency)).join(" + ");
}

const sumMap = (map: Map<string, number>) =>
  [...map].filter(([, amount]) => amount > 0).map(([currency, amount]) => money(amount, currency)).join(" + ");

// /dashboard/alquileres: indicadores, lo que requiere acción y la cartera de
// contratos. RLS: agente ve los suyos, admin todos.
export default async function AlquileresPage() {
  const supabase = await createClientServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  // Ajustes y punitorios al día antes de leer (el cron lo hace a diario;
  // acá cubre lo que pasó desde la última corrida). En orden: el ajuste
  // cambia las cuotas sobre las que se calcula el punitorio.
  await supabase.rpc("rental_apply_due_adjustments");
  await supabase.rpc("rental_accrue_late_fees");
  const alerts = await getRentalAlertSettings(supabase);

  const today = ymdInAppTz();
  const thisPeriod = periodOf(today);
  const chartPeriods = Array.from({ length: CHART_MONTHS }, (_, i) => addMonths(thisPeriod, i - (CHART_MONTHS - 1)));

  const [
    { data: contractsRaw }, { data: chargesRaw }, { data: isAdmin }, { data: isBackOffice },
    { data: openMaintenance }, { data: unpaidSettlements },
    { data: rentalProperties }, { data: toVerifyRaw }, { data: rate },
  ] = await Promise.all([
    supabase
      .from("rental_contracts")
      .select("id, number, property_id, status, end_date, rent_amount, currency, next_adjustment_date, adjustment_index, renewed_from_id, properties(title), owner:rental_contacts!rental_contracts_owner_id_fkey(full_name), tenant:rental_contacts!rental_contracts_tenant_id_fkey(full_name)")
      .order("end_date"),
    // Vencidos y por vencer en 7 días (mora y próximos cobros) y los de los
    // últimos meses (cobranza del período y su evolución).
    supabase
      .from("rental_charges")
      .select("contract_id, period, due_date, kind, amount, currency, rental_payment_entries(amount)")
      .or(`due_date.lte.${addDays(today, DUE_SOON_DAYS)},period.gte.${chartPeriods[0]}`),
    supabase.rpc("is_admin"),
    supabase.rpc("is_back_office"),
    supabase
      .from("rental_maintenance")
      .select("id, contract_id, title, priority, reported_at")
      .in("status", ["ABIERTO", "EN_CURSO"])
      .order("reported_at"),
    // Partes sin pagar: con co-propietarios una liquidación puede estar pagada a medias.
    supabase.from("rental_settlement_shares").select("id, amount, settlement:rental_settlements(currency)").is("paid_to_owner_at", null),
    // Ocupación: las propiedades de alquiler (las vendidas ya no cuentan).
    supabase.from("properties").select("id, status, agent_id").ilike("operation_type", "alquiler").neq("status", "VENDIDO"),
    // Pagos informados que esperan que alguien del equipo los confirme.
    supabase.from("rental_inbox").select("id, ai_data, contract:rental_contracts(currency)").eq("status", "PENDIENTE").eq("kind", "COMPROBANTE"),
    supabase.from("exchange_rates").select("usd_to_ars").eq("id", 1).maybeSingle(),
  ]);

  const contracts = (contractsRaw ?? []) as unknown as ContractRow[];
  const charges = ((chargesRaw ?? []) as ChargeRow[]).map((charge) => ({
    ...charge,
    balance: charge.amount - charge.rental_payment_entries.reduce((sum, entry) => sum + entry.amount, 0),
  }));
  const byId = new Map(contracts.map((c) => [c.id, c]));
  const active = contracts.filter((c) => c.status === "ACTIVO");
  const renewedIds = new Set(contracts.map((c) => c.renewed_from_id).filter(Boolean));

  const overdue = charges.filter((charge) => charge.due_date < today && charge.balance > 0.005);
  const overdueByContract = new Map<string, { count: number; balance: number }>();
  for (const charge of overdue) {
    const current = overdueByContract.get(charge.contract_id) ?? { count: 0, balance: 0 };
    overdueByContract.set(charge.contract_id, { count: current.count + 1, balance: current.balance + charge.balance });
  }

  const monthRent = charges.filter((charge) => charge.period === thisPeriod && charge.kind === "ALQUILER");
  const monthPaid = monthRent.filter((charge) => charge.balance <= 0.005).length;
  const expiring = active.filter((c) => !renewedIds.has(c.id) && daysBetween(today, c.end_date) <= alerts.expiryAlertDays);
  // El cron aplica solo los ajustes con índice cargado: los que siguen acá
  // con fecha pasada esperan el valor del índice o un monto manual.
  const adjusting = active.filter((c) => c.next_adjustment_date && daysBetween(today, c.next_adjustment_date) <= alerts.adjustmentAlertDays)
    .sort((a, b) => (a.next_adjustment_date ?? "").localeCompare(b.next_adjustment_date ?? ""));
  const maintenance = openMaintenance ?? [];
  const pendingPayouts = ((unpaidSettlements ?? []) as unknown as { id: string; amount: number; settlement: { currency: string } | null }[])
    .map((share) => ({ amount: share.amount, currency: share.settlement?.currency ?? "ARS" }));

  const rows: ContractListRow[] = contracts.map((c) => ({
    id: c.id,
    number: c.number,
    status: c.status,
    propertyTitle: c.properties?.title ?? "Propiedad sin título",
    tenantName: c.tenant?.full_name ?? null,
    ownerName: c.owner?.full_name ?? null,
    rentAmount: c.rent_amount,
    currency: c.currency,
    endDate: c.end_date,
    nextAdjustmentDate: c.status === "ACTIVO" ? c.next_adjustment_date : null,
    overdueBalance: overdueByContract.get(c.id)?.balance ?? 0,
    overdueCount: overdueByContract.get(c.id)?.count ?? 0,
    renewed: renewedIds.has(c.id),
  }));

  // Ocupación sobre la cartera visible: admin, toda; agente, las propiedades
  // a su cargo o con un contrato suyo. Ocupada = con contrato activo.
  const occupiedProps = new Set(active.map((c) => c.property_id));
  const ownContractProps = new Set(contracts.map((c) => c.property_id));
  const rentable = (rentalProperties ?? []).filter((p) => isBackOffice || p.agent_id === user.id || ownContractProps.has(p.id));
  const toVerify = (toVerifyRaw ?? []).map((i) => ({
    amount: Number((i.ai_data as { payment?: { amount?: number | null } } | null)?.payment?.amount) || null,
    currency: (i.contract as unknown as { currency: string } | null)?.currency ?? "ARS",
  }));
  const usdToArs = Number(rate?.usd_to_ars ?? 0);
  const kpis = portfolioKpis({
    charges: charges.map((c) => ({ ...c, paid: c.amount - c.balance })),
    today, period: thisPeriod, usdToArs, toVerify,
    occupancy: { rentable: rentable.length, occupied: rentable.filter((p) => occupiedProps.has(p.id)).length },
  });
  const collection = buildCollectionSeries(charges, chartPeriods, today, usdToArs);

  const hasActions = toVerify.length + overdue.length + adjusting.length + expiring.length + maintenance.length + pendingPayouts.length > 0;

  return (
    <Page>
      <PageHeader
        title="Alquileres"
        description={`${active.length} ${active.length === 1 ? "contrato activo" : "contratos activos"}`}
        actions={<>
          {isAdmin && <Button asChild variant="outline"><Link href="/dashboard/alquileres/importar"><Upload /> Importar</Link></Button>}
          <Button asChild><Link href="/dashboard/alquileres/nuevo"><Plus /> Nuevo contrato</Link></Button>
        </>}
      />
      <RentalsNav />

      {/* Indicadores de cartera: plata del período, no cantidad de cuotas. */}
      <StatStrip>
        <Stat
          label="Cobranza del período"
          value={kpis.period.rate !== null ? `${kpis.period.rate} %` : "Sin cargos"}
          detail={kpis.period.rate !== null
            ? `${sumMap(kpis.period.collected) || money(0, "ARS")} cobrado de ${sumMap(kpis.period.issued)} · ${monthPaid} de ${monthRent.length} alquileres`
            : "No hay cargos este mes"}
        />
        <Stat
          label="Deuda vencida"
          value={kpis.overdue.contracts ? sumMap(kpis.overdue.amounts) : "Al día"}
          tone={kpis.overdue.contracts ? "danger" : undefined}
          detail={kpis.overdue.contracts
            ? `${kpis.overdue.contracts} ${kpis.overdue.contracts === 1 ? "contrato" : "contratos"} en mora`
            : "Sin obligaciones vencidas"}
        />
        <Stat
          label={`Vence en ${DUE_SOON_DAYS} días`}
          value={kpis.dueSoon.count ? sumMap(kpis.dueSoon.amounts) : "Nada"}
          detail={kpis.dueSoon.count
            ? `${kpis.dueSoon.count} ${kpis.dueSoon.count === 1 ? "obligación" : "obligaciones"} · la próxima el ${formatDate(kpis.dueSoon.next)}`
            : "Sin vencimientos próximos"}
        />
        <Stat
          label="Ocupación"
          value={kpis.occupancy.rate !== null ? `${kpis.occupancy.rate} %` : "-"}
          tone={kpis.occupancy.available > 0 ? "warning" : undefined}
          detail={kpis.occupancy.rentable ? (
            <>
              {kpis.occupancy.occupied} de {kpis.occupancy.rentable} alquilables
              {kpis.occupancy.available > 0 && (
                <> · <Link href="/dashboard/alquileres/vacancia" className="font-medium text-foreground underline-offset-4 hover:underline">
                  {kpis.occupancy.available} {kpis.occupancy.available === 1 ? "disponible" : "disponibles"}
                </Link></>
              )}
            </>
          ) : "Sin propiedades de alquiler"}
        />
      </StatStrip>

      {collection.some((point) => point.expected > 0) && (
        <section className="overflow-hidden rounded-lg border border-border bg-card">
          <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-b border-border px-4 py-3">
            <h2 className="text-base font-semibold tracking-tight">Cobranza</h2>
            <p className="text-xs text-muted-foreground">
              Emitido contra cobrado confirmado · últimos {CHART_MONTHS} meses{usdToArs > 0 && " · USD a la cotización vigente"}
            </p>
          </div>
          <div className="p-4"><CollectionChart data={collection} /></div>
        </section>
      )}

      {hasActions && (
        <section className="overflow-hidden rounded-lg border border-border bg-card">
          <h2 className="border-b border-border px-4 py-3 text-base font-semibold tracking-tight">Requiere acción</h2>
          <ul className="divide-y divide-border-subtle text-sm">
            {toVerify.length > 0 && (
              <li className="flex items-center justify-between gap-3 px-4 py-2.5">
                <span className="flex min-w-0 items-center gap-2">
                  <Hand className="size-4 shrink-0 text-info" />
                  <span className="truncate">
                    {toVerify.length} {toVerify.length === 1 ? "pago informado por verificar" : "pagos informados por verificar"}
                    {kpis.toVerify.amounts.size > 0 && <span className="text-muted-foreground"> · {sumMap(kpis.toVerify.amounts)}</span>}
                  </span>
                </span>
                <Link href="/dashboard/alquileres/mensajes" className="shrink-0 font-medium underline-offset-4 hover:underline">Verificar</Link>
              </li>
            )}
            {overdue.length > 0 && (
              <li className="flex items-center justify-between gap-3 px-4 py-2.5">
                <span className="flex min-w-0 items-center gap-2">
                  <AlertTriangle className="size-4 shrink-0 text-danger" />
                  <span className="truncate">{overdue.length} {overdue.length === 1 ? "cuota vencida" : "cuotas vencidas"} en {overdueByContract.size} {overdueByContract.size === 1 ? "contrato" : "contratos"}</span>
                </span>
                <Link href="/dashboard/alquileres/cobranzas" className="shrink-0 font-medium underline-offset-4 hover:underline">Ir a cobranzas</Link>
              </li>
            )}
            {adjusting.slice(0, GROUP_LIMIT).map((c) => (
              <li key={`adj-${c.id}`} className="flex items-center justify-between gap-3 px-4 py-2.5">
                <span className="flex min-w-0 items-center gap-2">
                  <TrendingUp className={`size-4 shrink-0 ${c.next_adjustment_date! <= today ? "text-warning" : "text-info"}`} />
                  <span className="truncate"><span className="font-medium">{c.properties?.title ?? "Contrato"}</span><span className="text-muted-foreground">
                    {c.next_adjustment_date! <= today
                      ? ` · ajuste ${ADJUSTMENT_LABELS[c.adjustment_index as AdjustmentIndex] ?? c.adjustment_index} pendiente desde el ${formatDate(c.next_adjustment_date)}`
                      : ` · ajuste ${ADJUSTMENT_LABELS[c.adjustment_index as AdjustmentIndex] ?? c.adjustment_index} el ${formatDate(c.next_adjustment_date)}`}
                  </span></span>
                </span>
                <Link href={`/dashboard/alquileres/${c.id}`} className="shrink-0 font-medium underline-offset-4 hover:underline">
                  {c.next_adjustment_date && c.next_adjustment_date <= today ? "Aplicar" : "Ver"}
                </Link>
              </li>
            ))}
            {expiring.slice(0, GROUP_LIMIT).map((c) => (
              <li key={`exp-${c.id}`} className="flex items-center justify-between gap-3 px-4 py-2.5">
                <span className="flex min-w-0 items-center gap-2">
                  <CalendarClock className="size-4 shrink-0 text-warning" />
                  <span className="truncate"><span className="font-medium">{c.properties?.title ?? "Contrato"}</span><span className="text-muted-foreground"> · vence el {formatDate(c.end_date)} ({daysBetween(today, c.end_date)} días)</span></span>
                </span>
                <Link href={`/dashboard/alquileres/nuevo?renovar=${c.id}`} className="shrink-0 font-medium underline-offset-4 hover:underline">Renovar</Link>
              </li>
            ))}
            {maintenance.slice(0, GROUP_LIMIT).map((m) => (
              <li key={`mnt-${m.id}`} className="flex items-center justify-between gap-3 px-4 py-2.5">
                <span className="flex min-w-0 items-center gap-2">
                  <Wrench className={`size-4 shrink-0 ${m.priority === "URGENTE" || m.priority === "ALTA" ? "text-danger" : "text-warning"}`} />
                  <span className="truncate"><span className="font-medium">{byId.get(m.contract_id)?.properties?.title ?? "Contrato"}</span><span className="text-muted-foreground"> · {m.title} · hace {daysBetween(m.reported_at, today)} días</span></span>
                </span>
                <Link href={`/dashboard/alquileres/${m.contract_id}?tab=mantenimiento`} className="shrink-0 font-medium underline-offset-4 hover:underline">Ver</Link>
              </li>
            ))}
            {pendingPayouts.length > 0 && (
              <li className="flex items-center justify-between gap-3 px-4 py-2.5">
                <span className="flex min-w-0 items-center gap-2">
                  <Banknote className="size-4 shrink-0 text-info" />
                  <span className="truncate">
                    {pendingPayouts.length} {pendingPayouts.length === 1 ? "transferencia pendiente" : "transferencias pendientes"} a propietarios
                    <span className="text-muted-foreground"> · {totalsByCurrency(pendingPayouts)}</span>
                  </span>
                </span>
                <Link href="/dashboard/alquileres/propietarios?pendientes=1" className="shrink-0 font-medium underline-offset-4 hover:underline">Ver</Link>
              </li>
            )}
            {(adjusting.length > GROUP_LIMIT || expiring.length > GROUP_LIMIT || maintenance.length > GROUP_LIMIT) && (
              <li className="px-4 py-2.5 text-xs text-muted-foreground">
                Hay más pendientes: filtrá la tabla por situación o revisá Mantenimiento.
              </li>
            )}
          </ul>
        </section>
      )}

      <ContractsTable rows={rows} today={today} alerts={alerts} />
    </Page>
  );
}
