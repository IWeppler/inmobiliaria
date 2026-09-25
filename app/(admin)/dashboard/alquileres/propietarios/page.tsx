import { redirect } from "next/navigation";
import Link from "next/link";
import { createClientServer } from "@/lib/supabase";
import { ymdInAppTz } from "@/lib/dates";
import { formatDate, formatPeriod, money } from "@/features/rentals/logic";
import { Page, PageHeader } from "@/shared/components/PageShell";
import { Button } from "@/shared/components/ui/button";
import { PrintSummaryButton } from "@/features/rentals/PrintSummaryButton";

type Row = {
  id: string; period: string; rent_amount: number; other_collected_amount: number;
  commission_amount: number; expenses_amount: number; net_amount: number; currency: string; issued_at: string;
  contract: { id: string; owner_id: string; property: { title: string } | null } | null;
};

export default async function LiquidacionesPropietariosPage({ searchParams }: { searchParams: Promise<{ owner?: string; period?: string }> }) {
  const supabase = await createClientServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: ownersRaw } = await supabase.from("rental_contacts")
    .select("id, full_name").eq("kind", "owner").order("full_name");
  const owners = ownersRaw ?? [];
  const params = await searchParams;
  const ownerId = owners.some((owner) => owner.id === params.owner) ? params.owner! : owners[0]?.id;
  const period = /^\d{4}-\d{2}$/.test(params.period ?? "") ? params.period! : ymdInAppTz().slice(0, 7);
  const { data } = ownerId ? await supabase.from("rental_settlements")
    .select("id, period, rent_amount, other_collected_amount, commission_amount, expenses_amount, net_amount, currency, issued_at, contract:rental_contracts!inner(id, owner_id, property:properties(title))")
    .eq("contract.owner_id", ownerId).eq("period", `${period}-01`).order("issued_at") : { data: [] };
  const rows = (data ?? []) as unknown as Row[];
  const totals = [...new Set(rows.map((row) => row.currency))].map((currency) => ({
    currency, net: rows.filter((row) => row.currency === currency).reduce((sum, row) => sum + row.net_amount, 0),
  }));

  return <Page>
    <div className="print:hidden"><PageHeader backHref="/dashboard/alquileres" title="Liquidaciones por propietario" description="Un resumen por propietario, con el detalle de cada unidad." /></div>
    <form method="get" className="flex flex-wrap items-end gap-3 rounded-lg border border-border bg-card p-4 print:hidden">
      <label className="grid gap-1 text-sm">Propietario<select name="owner" defaultValue={ownerId} className="h-9 min-w-56 rounded-md border border-border bg-background px-3">{owners.map((owner) => <option key={owner.id} value={owner.id}>{owner.full_name}</option>)}</select></label>
      <label className="grid gap-1 text-sm">Período<input name="period" type="month" defaultValue={period} className="h-9 rounded-md border border-border bg-background px-3" /></label>
      <Button type="submit">Ver resumen</Button>
      <PrintSummaryButton />
    </form>
    <section id="print-summary" className="rounded-lg border border-border bg-card p-6 print:border-0 print:p-0">
      <div className="mb-6 flex items-start justify-between gap-4"><div><p className="text-sm text-muted-foreground">Resumen consolidado</p><h1 className="text-xl font-semibold">{owners.find((owner) => owner.id === ownerId)?.full_name ?? "Propietario"}</h1><p className="capitalize text-sm text-muted-foreground">{formatPeriod(`${period}-01`)}</p></div><p className="text-sm text-muted-foreground">{rows.length} {rows.length === 1 ? "unidad" : "unidades"}</p></div>
      {rows.length === 0 ? <p className="text-sm text-muted-foreground">No hay liquidaciones emitidas para este propietario y período.</p> : <div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr className="border-b border-border text-left"><th className="py-2">Unidad</th><th className="py-2 text-right">Cobrado</th><th className="py-2 text-right">Comisión</th><th className="py-2 text-right">Gastos</th><th className="py-2 text-right">Neto</th></tr></thead><tbody>{rows.map((row) => <tr key={row.id} className="border-b border-border-subtle"><td className="py-3"><Link href={`/dashboard/alquileres/${row.contract?.id}`} className="hover:underline print:no-underline">{row.contract?.property?.title ?? "Unidad"}</Link><span className="block text-xs text-muted-foreground">Emitida {formatDate(row.issued_at)}</span></td><td className="py-3 text-right tabular-nums">{money(row.rent_amount + row.other_collected_amount, row.currency)}</td><td className="py-3 text-right tabular-nums">{money(row.commission_amount, row.currency)}</td><td className="py-3 text-right tabular-nums">{money(row.expenses_amount, row.currency)}</td><td className="py-3 text-right font-medium tabular-nums">{money(row.net_amount, row.currency)}</td></tr>)}</tbody></table></div>}
      {totals.length > 0 && <div className="mt-5 space-y-1 border-t border-border pt-4 text-right">{totals.map((total) => <p key={total.currency} className="font-semibold">Neto a transferir · {money(total.net, total.currency)}</p>)}</div>}
      <p className="mt-8 text-xs text-muted-foreground">Resumen de liquidaciones emitidas. Cada unidad conserva su comprobante individual.</p>
    </section>
    <p className="text-xs text-muted-foreground print:hidden">Para entregar un único PDF al propietario, usá Imprimir → Guardar como PDF desde el navegador.</p>
  </Page>;
}
