import { redirect } from "next/navigation";
import { createClientServer } from "@/lib/supabase";
import { ymdInAppTz } from "@/lib/dates";
import { Page, PageHeader } from "@/shared/components/PageShell";
import { addMonths, formatPeriod, money, periodOf } from "@/features/rentals/logic";
import { RentalsNav } from "@/features/rentals/RentalsNav";
import { Stat, StatStrip } from "@/features/rentals/StatStrip";
import { CollectionsView, type CollectedEntry, type PendingCharge } from "@/features/rentals/CollectionsView";

type ContractRef = {
  id: string; status: string;
  properties: { title: string } | null;
  tenant: { full_name: string; phone: string | null } | null;
} | null;

type ChargeRow = {
  id: string; contract_id: string; kind: string; description: string; due_date: string; amount: number; currency: string;
  rental_payment_entries: { amount: number }[];
  contract: ContractRef;
};

type EntryRow = {
  id: string; paid_at: string; amount: number; method: string; receipt_number: number;
  charge: { description: string; currency: string; contract: ContractRef } | null;
};

const CONTRACT_SELECT = "id, status, properties(title), tenant:rental_contacts!rental_contracts_tenant_id_fkey(full_name, phone)";

function sumByCurrency(items: { amount: number; currency: string }[]) {
  const totals = new Map<string, number>();
  for (const item of items) totals.set(item.currency, (totals.get(item.currency) ?? 0) + item.amount);
  return totals.size ? [...totals.entries()].map(([currency, amount]) => money(amount, currency)).join(" + ") : "-";
}

// /dashboard/alquileres/cobranzas: la pantalla de trabajo diario. Todo lo
// que hay que cobrar (vencido + resto del mes) y lo que ya se cobró en el
// mes, a través de todos los contratos visibles para el usuario.
export default async function CobranzasPage() {
  const supabase = await createClientServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // Punitorios automáticos al día antes de listar la deuda.
  await supabase.rpc("rental_accrue_late_fees");
  const today = ymdInAppTz();
  const monthStart = periodOf(today);
  const nextMonth = addMonths(monthStart, 1);

  const [{ data: chargesRaw }, { data: entriesRaw }] = await Promise.all([
    supabase
      .from("rental_charges")
      .select(`id, contract_id, kind, description, due_date, amount, currency, rental_payment_entries(amount), contract:rental_contracts(${CONTRACT_SELECT})`)
      .lt("due_date", nextMonth)
      .order("due_date"),
    supabase
      .from("rental_payment_entries")
      .select(`id, paid_at, amount, method, receipt_number, charge:rental_charges(description, currency, contract:rental_contracts(${CONTRACT_SELECT}))`)
      .gte("paid_at", monthStart)
      .order("paid_at", { ascending: false }),
  ]);

  const pending: PendingCharge[] = ((chargesRaw ?? []) as unknown as ChargeRow[])
    .map((charge) => ({ charge, balance: charge.amount - charge.rental_payment_entries.reduce((sum, e) => sum + e.amount, 0) }))
    .filter(({ balance }) => balance > 0.005)
    .map(({ charge, balance }) => ({
      id: charge.id,
      contractId: charge.contract_id,
      propertyTitle: charge.contract?.properties?.title ?? "Contrato",
      tenantName: charge.contract?.tenant?.full_name ?? null,
      tenantPhone: charge.contract?.tenant?.phone ?? null,
      kind: charge.kind,
      description: charge.description,
      dueDate: charge.due_date,
      amount: charge.amount,
      balance: Math.round(balance * 100) / 100,
      currency: charge.currency,
    }));

  const collected: CollectedEntry[] = ((entriesRaw ?? []) as unknown as EntryRow[]).map((entry) => ({
    id: entry.id,
    contractId: entry.charge?.contract?.id ?? "",
    propertyTitle: entry.charge?.contract?.properties?.title ?? "Contrato",
    tenantName: entry.charge?.contract?.tenant?.full_name ?? null,
    description: entry.charge?.description ?? "Cobro",
    paidAt: entry.paid_at,
    amount: entry.amount,
    currency: entry.charge?.currency ?? "ARS",
    method: entry.method,
    receiptNumber: entry.receipt_number,
  }));

  const overdue = pending.filter((charge) => charge.dueDate < today);
  const upcoming = pending.filter((charge) => charge.dueDate >= today);

  return (
    <Page>
      <PageHeader title="Alquileres" description={`Cobranzas de ${formatPeriod(monthStart)}`} />
      <RentalsNav />

      <StatStrip>
        <Stat label="Vencido sin cobrar" value={overdue.length ? sumByCurrency(overdue.map((c) => ({ amount: c.balance, currency: c.currency }))) : "Al día"}
          tone={overdue.length ? "danger" : undefined} detail={`${overdue.length} ${overdue.length === 1 ? "cargo" : "cargos"}`} />
        <Stat label="Por vencer este mes" value={sumByCurrency(upcoming.map((c) => ({ amount: c.balance, currency: c.currency })))}
          detail={`${upcoming.length} ${upcoming.length === 1 ? "cargo" : "cargos"}`} />
        <Stat label="Cobrado este mes" value={sumByCurrency(collected)}
          detail={`${collected.length} ${collected.length === 1 ? "recibo emitido" : "recibos emitidos"}`} />
        <Stat label="Inquilinos en mora" value={new Set(overdue.map((c) => c.contractId)).size}
          tone={overdue.length ? "danger" : undefined} detail="Con al menos un cargo vencido" />
      </StatStrip>

      <CollectionsView pending={pending} collectedEntries={collected} today={today} />
    </Page>
  );
}
