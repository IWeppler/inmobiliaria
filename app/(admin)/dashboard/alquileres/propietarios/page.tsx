import { redirect } from "next/navigation";
import Link from "next/link";
import { createClientServer } from "@/lib/supabase";
import { ymdInAppTz } from "@/lib/dates";
import { formatDate, formatPeriod, formatPeriodTitle, money } from "@/features/rentals/logic";
import { Page, PageHeader } from "@/shared/components/PageShell";
import { Button } from "@/shared/components/ui/button";
import { PrintSummaryButton } from "@/features/rentals/PrintSummaryButton";
import { PayoutButton } from "@/features/rentals/PayoutButton";
import { RentalsNav } from "@/features/rentals/RentalsNav";

// Una fila por parte de liquidación (rental_settlement_shares): con
// co-propietarios, cada titular ve y cobra solo lo suyo.
type Row = {
  id: string; share_pct: number; amount: number; paid_to_owner_at: string | null;
  payout_method: string | null; payout_reference: string | null;
  contact: { full_name: string } | null;
  settlement: {
    id: string; period: string; rent_amount: number; other_collected_amount: number;
    commission_amount: number; expenses_amount: number; net_amount: number; currency: string; issued_at: string;
    contract: { id: string; property: { title: string } | null } | null;
  } | null;
};

const SELECT = "id, share_pct, amount, paid_to_owner_at, payout_method, payout_reference, contact:rental_contacts(full_name), settlement:rental_settlements!inner(id, period, rent_amount, other_collected_amount, commission_amount, expenses_amount, net_amount, currency, issued_at, contract:rental_contracts(id, property:properties(title)))";

function totalsByCurrency(rows: Row[]) {
  return [...new Set(rows.map((row) => row.settlement?.currency ?? "ARS"))].map((currency) => ({
    currency,
    amount: rows.filter((row) => (row.settlement?.currency ?? "ARS") === currency).reduce((sum, row) => sum + row.amount, 0),
  }));
}

export default async function LiquidacionesPropietariosPage({ searchParams }: { searchParams: Promise<{ owner?: string; period?: string; pendientes?: string }> }) {
  const supabase = await createClientServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const today = ymdInAppTz();
  const params = await searchParams;
  const pendingOnly = params.pendientes === "1";

  const { data: ownersRaw } = await supabase.from("rental_contacts")
    .select("id, full_name").eq("kind", "owner").order("full_name");
  const owners = ownersRaw ?? [];
  const ownerId = owners.some((owner) => owner.id === params.owner) ? params.owner! : owners[0]?.id;
  const period = /^\d{4}-\d{2}$/.test(params.period ?? "") ? params.period! : today.slice(0, 7);

  const { data } = pendingOnly
    ? await supabase.from("rental_settlement_shares").select(SELECT).is("paid_to_owner_at", null).order("created_at")
    : ownerId
      ? await supabase.from("rental_settlement_shares").select(SELECT)
        .eq("contact_id", ownerId).eq("settlement.period", `${period}-01`).order("created_at")
      : { data: [] };
  const rows = (data ?? []) as unknown as Row[];
  const totals = totalsByCurrency(rows);
  const pendingTotals = totalsByCurrency(rows.filter((row) => !row.paid_to_owner_at));
  const anyShared = rows.some((row) => row.share_pct < 100);

  return <Page>
    <div className="print:hidden"><PageHeader title="Alquileres" description="Liquidaciones a propietarios y transferencias pendientes" /></div>
    <RentalsNav />
    <form method="get" className="flex flex-wrap items-end gap-3 rounded-lg border border-border bg-card p-4 print:hidden">
      <label className="grid gap-1 text-sm">Propietario<select name="owner" defaultValue={ownerId} className="h-9 min-w-56 rounded-md border border-border bg-background px-3">{owners.map((owner) => <option key={owner.id} value={owner.id}>{owner.full_name}</option>)}</select></label>
      <label className="grid gap-1 text-sm">Período<input name="period" type="month" defaultValue={period} className="h-9 rounded-md border border-border bg-background px-3" /></label>
      <Button type="submit">Ver resumen</Button>
      <PrintSummaryButton />
      <Button asChild variant={pendingOnly ? "default" : "outline"} className="ml-auto">
        <Link href={pendingOnly ? "/dashboard/alquileres/propietarios" : "/dashboard/alquileres/propietarios?pendientes=1"}>
          {pendingOnly ? "Ver por propietario" : "Pendientes de transferir"}
        </Link>
      </Button>
    </form>
    <section id="print-summary" className="rounded-lg border border-border bg-card p-6 print:border-0 print:p-0">
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <p className="text-sm text-muted-foreground">{pendingOnly ? "Todas las liquidaciones" : "Resumen consolidado"}</p>
          <h1 className="text-xl font-semibold">{pendingOnly ? "Pendientes de transferir" : owners.find((owner) => owner.id === ownerId)?.full_name ?? "Propietario"}</h1>
          {!pendingOnly && <p className="text-sm text-muted-foreground">{formatPeriodTitle(`${period}-01`)}</p>}
        </div>
        <p className="text-sm text-muted-foreground">{rows.length} {rows.length === 1 ? "liquidación" : "liquidaciones"}</p>
      </div>
      {rows.length === 0 ? <p className="text-sm text-muted-foreground">{pendingOnly ? "No hay transferencias pendientes." : "No hay liquidaciones emitidas para este propietario y período."}</p> : <div className="overflow-x-auto"><table className="w-full text-sm">
        <thead><tr className="border-b border-border text-left">
          <th className="py-2">Unidad</th>
          <th className="py-2 text-right">Cobrado</th>
          <th className="py-2 text-right">Comisión</th>
          <th className="py-2 text-right">Gastos</th>
          <th className="py-2 text-right">Neto</th>
          {(anyShared || pendingOnly) && <th className="py-2 text-right">Participación</th>}
          <th className="py-2 text-right">{anyShared || pendingOnly ? "Le corresponde" : "A transferir"}</th>
          <th className="py-2 text-right print:hidden">Pago</th>
        </tr></thead>
        <tbody>{rows.map((row) => {
          const s = row.settlement;
          const currency = s?.currency ?? "ARS";
          return <tr key={row.id} className="border-b border-border-subtle">
            <td className="py-3">
              <Link href={`/dashboard/alquileres/${s?.contract?.id}?tab=liquidaciones`} className="hover:underline print:no-underline">{s?.contract?.property?.title ?? "Unidad"}</Link>
              <span className="block text-xs text-muted-foreground">
                {pendingOnly && <>{row.contact?.full_name ?? "Propietario"} · {s ? formatPeriod(s.period) : ""} · </>}
                Emitida {s ? formatDate(s.issued_at) : "—"}
              </span>
            </td>
            <td className="py-3 text-right tabular-nums">{s ? money(s.rent_amount + s.other_collected_amount, currency) : "—"}</td>
            <td className="py-3 text-right tabular-nums">{s ? money(s.commission_amount, currency) : "—"}</td>
            <td className="py-3 text-right tabular-nums">{s ? money(s.expenses_amount, currency) : "—"}</td>
            <td className="py-3 text-right tabular-nums">{s ? money(s.net_amount, currency) : "—"}</td>
            {(anyShared || pendingOnly) && <td className="py-3 text-right tabular-nums">{row.share_pct} %</td>}
            <td className="py-3 text-right font-medium tabular-nums">{money(row.amount, currency)}</td>
            <td className="py-3 text-right print:hidden">
              <PayoutButton today={today} share={{
                id: row.id, ownerName: row.contact?.full_name ?? "Propietario", amount: row.amount, currency,
                paidAt: row.paid_to_owner_at, method: row.payout_method, reference: row.payout_reference,
              }} />
            </td>
          </tr>;
        })}</tbody>
      </table></div>}
      {totals.length > 0 && <div className="mt-5 space-y-1 border-t border-border pt-4 text-right">
        {totals.map((total) => <p key={total.currency} className="font-semibold">{pendingOnly ? "Total pendiente" : "Total a transferir"} · {money(total.amount, total.currency)}</p>)}
        {!pendingOnly && pendingTotals.map((total) => <p key={`p-${total.currency}`} className="text-sm text-muted-foreground print:hidden">Pendiente de transferir · {money(total.amount, total.currency)}</p>)}
      </div>}
      <p className="mt-8 text-xs text-muted-foreground">Resumen de liquidaciones emitidas. Cada unidad conserva su comprobante individual.</p>
    </section>
    <p className="text-xs text-muted-foreground print:hidden">Para entregar un único PDF al propietario, usá Imprimir → Guardar como PDF desde el navegador.</p>
  </Page>;
}
