"use client";

import { useState } from "react";
import Link from "next/link";
import { FileText, Loader2, Plus, Trash2, Wrench } from "lucide-react";
import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import { Label } from "@/shared/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/shared/components/ui/select";
import { createSettlementAction } from "@/features/rentals/actions";
import {
  computeSettlement, formatDate, formatPeriodTitle, money, splitNet, type OwnerShare, type SettlementExpense,
} from "@/features/rentals/logic";
import { collected, type LedgerCharge } from "@/features/rentals/LedgerTab";
import { PayoutButton } from "@/features/rentals/PayoutButton";
import { useRunAction } from "@/features/rentals/useRunAction";
import { settlementCode } from "@/features/rentals/codes";
import { creditInvoiceAction, issueSettlementInvoicesAction } from "@/features/rentals/invoiceActions";
import { CBTE_LABELS, formatInvoiceNumber } from "@/features/rentals/invoicing";

export type SettlementShareRow = {
  id: string; share_pct: number; amount: number; is_primary: boolean;
  paid_to_owner_at: string | null; payout_method: string | null; payout_reference: string | null;
  contact: { full_name: string } | null;
};
export type SettlementInvoice = {
  id: string; kind: string; cbte_tipo: number; pto_vta: number; cbte_nro: number; total: number;
  voided: boolean; receptor_name: string; share_id: string | null; environment: string;
};
export type SettlementRow = {
  id: string; number: number; period: string; net_amount: number; commission_amount: number; currency: string; issued_at: string; paid_to_owner_at: string | null;
  shares: SettlementShareRow[];
  invoices: SettlementInvoice[];
};

// Liquidación al propietario: solo meses completamente cobrados. Arriba se
// emite la del mes elegido (con el reparto entre titulares si hay
// co-propietarios); abajo, el historial con el pago de cada parte.
// Reclamo a cargo del propietario todavía no descontado: se sugiere como gasto.
export type OwnerMaintenance = { id: string; title: string; cost: number; resolved: boolean };

export function SettlementsTab({
  contractId, charges, settlements, commissionPct, currency, today, owners, ownerMaintenance, invoicingEnabled,
}: {
  contractId: string; charges: LedgerCharge[]; settlements: SettlementRow[];
  commissionPct: number; currency: string; today: string; owners: OwnerShare[]; ownerMaintenance: OwnerMaintenance[];
  invoicingEnabled: boolean;
}) {
  const ownerLabel = owners.length > 1 ? "los propietarios" : owners[0]?.name ?? "el propietario";
  const { busy, run } = useRunAction();
  const settled = new Set(settlements.map((item) => item.period));
  const eligible = [...new Set(charges.map((charge) => charge.period))].sort().reverse()
    .filter((period) => !settled.has(period)
      && charges.filter((charge) => charge.period === period).every((charge) => collected(charge) + 0.005 >= charge.amount));

  const [period, setPeriod] = useState<string>(eligible[0] ?? "");
  const [expenses, setExpenses] = useState<SettlementExpense[]>([]);
  const current = eligible.includes(period) ? period : eligible[0] ?? "";

  const periodCharges = charges.filter((charge) => charge.period === current);
  const rent = periodCharges.filter((charge) => charge.kind === "ALQUILER").reduce((sum, charge) => sum + collected(charge), 0);
  const other = periodCharges.filter((charge) => charge.kind !== "ALQUILER").reduce((sum, charge) => sum + collected(charge), 0);
  const calc = computeSettlement(rent + other, commissionPct, expenses, rent);
  const included = new Set(expenses.map((item) => item.maintenance_id).filter(Boolean));
  const suggestions = ownerMaintenance.filter((item) => !included.has(item.id));

  return (
    <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
      <section className="rounded-lg border border-border bg-card p-4">
        <h3 className="text-base font-semibold">Nueva liquidación</h3>
        {eligible.length === 0 ? (
          <p className="mt-2 text-sm text-muted-foreground">
            No hay meses listos. Un mes se puede liquidar cuando todos sus cargos están cobrados.
          </p>
        ) : (
          <div className="mt-4 space-y-4">
            <div className="grid gap-1.5">
              <Label>Mes</Label>
              <Select value={current} onValueChange={(value) => { setPeriod(value); setExpenses([]); }}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{eligible.map((p) => <SelectItem key={p} value={p} >{formatPeriodTitle(p)}</SelectItem>)}</SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <p className="text-sm font-medium">Gastos a cargo de {ownerLabel}</p>
              {suggestions.length > 0 && (
                <div className="space-y-1.5 rounded-md border border-dashed border-border p-2.5">
                  <p className="text-xs text-muted-foreground">Reclamos a cargo del propietario sin descontar</p>
                  {suggestions.map((item) => (
                    <div key={item.id} className="flex items-center justify-between gap-2 text-sm">
                      <span className="min-w-0 truncate">
                        <Wrench className="mr-1.5 inline size-3.5 text-muted-foreground" aria-hidden />
                        {item.title}
                        {!item.resolved && <span className="text-xs text-warning"> · todavía abierto</span>}
                      </span>
                      <span className="flex shrink-0 items-center gap-2">
                        <span className="tabular-nums">{money(item.cost, currency)}</span>
                        <Button size="sm" variant="outline" className="h-7"
                          onClick={() => setExpenses([...expenses, { description: item.title, amount: item.cost, maintenance_id: item.id }])}>
                          Descontar
                        </Button>
                      </span>
                    </div>
                  ))}
                </div>
              )}
              {expenses.map((expense, index) => (
                <div key={index} className="flex gap-2">
                  {/* Un gasto que viene de un reclamo no se edita: el monto es el costo cargado en el reclamo. */}
                  <Input placeholder="Concepto" aria-label="Concepto del gasto" value={expense.description} readOnly={!!expense.maintenance_id}
                    className={expense.maintenance_id ? "bg-muted/50" : undefined}
                    onChange={(e) => setExpenses(expenses.map((item, i) => i === index ? { ...item, description: e.target.value } : item))} />
                  <Input className={`w-32 ${expense.maintenance_id ? "bg-muted/50" : ""}`} type="number" min="0" step="0.01" aria-label="Importe del gasto"
                    value={expense.amount || ""} readOnly={!!expense.maintenance_id}
                    onChange={(e) => setExpenses(expenses.map((item, i) => i === index ? { ...item, amount: Number(e.target.value) } : item))} />
                  <Button size="icon" variant="ghost" aria-label="Quitar gasto" onClick={() => setExpenses(expenses.filter((_, i) => i !== index))}><Trash2 /></Button>
                </div>
              ))}
              <Button size="sm" variant="ghost" className="-ml-2" onClick={() => setExpenses([...expenses, { description: "", amount: 0 }])}><Plus /> Agregar gasto</Button>
            </div>

            <dl className="grid grid-cols-[1fr_auto] gap-y-1 rounded-md bg-muted/50 p-3 text-sm tabular-nums">
              <dt className="text-muted-foreground">Alquiler cobrado</dt><dd className="text-right">{money(rent, currency)}</dd>
              {other > 0 && <><dt className="text-muted-foreground">Otros cargos cobrados</dt><dd className="text-right">{money(other, currency)}</dd></>}
              <dt className="text-muted-foreground">Comisión ({commissionPct} %)</dt><dd className="text-right">- {money(calc.commission, currency)}</dd>
              {calc.expensesAmount > 0 && <><dt className="text-muted-foreground">Gastos</dt><dd className="text-right">- {money(calc.expensesAmount, currency)}</dd></>}
              <dt className="mt-1 border-t border-border pt-1.5 font-semibold">Neto a transferir</dt>
              <dd className="mt-1 border-t border-border pt-1.5 text-right font-semibold">{money(calc.net, currency)}</dd>
              {owners.length > 1 && splitNet(calc.net, owners).map((part) => (
                <div key={part.name} className="contents">
                  <dt className="pl-3 text-muted-foreground">{part.name} ({part.pct} %)</dt>
                  <dd className="text-right">{money(part.amount, currency)}</dd>
                </div>
              ))}
            </dl>

            <Button className="w-full" disabled={!!busy || expenses.some((item) => !item.description.trim())} onClick={async () => {
              const ok = await run("settle", () => createSettlementAction({ contract_id: contractId, period: current, expenses }));
              if (ok) setExpenses([]);
            }}>{busy === "settle" ? <Loader2 className="size-4 animate-spin" /> : "Emitir liquidación"}</Button>
          </div>
        )}
      </section>

      <section className="overflow-hidden rounded-lg border border-border bg-card">
        <h3 className="border-b border-border px-4 py-3 text-base font-semibold">Emitidas</h3>
        {settlements.length === 0 ? (
          <p className="px-4 py-6 text-sm text-muted-foreground">Todavía no se emitieron liquidaciones.</p>
        ) : (
          <ul className="divide-y divide-border-subtle">
            {settlements.map((item) => {
              const shares = [...item.shares].sort((a, b) => Number(b.is_primary) - Number(a.is_primary) || b.share_pct - a.share_pct);
              const single = shares.length === 1;
              return (
                <li key={item.id} className="space-y-2 px-4 py-3 text-sm">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="font-medium">{formatPeriodTitle(item.period)}</p>
                      <p className="text-xs text-muted-foreground"><span className="tabular-nums">{settlementCode(item.number)}</span> · emitida {formatDate(item.issued_at)}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="font-medium tabular-nums">{money(item.net_amount, item.currency)}</span>
                      {single && (
                        <PayoutButton today={today} share={{
                          id: shares[0].id, ownerName: shares[0].contact?.full_name ?? "Propietario", amount: shares[0].amount,
                          currency: item.currency, paidAt: shares[0].paid_to_owner_at, method: shares[0].payout_method, reference: shares[0].payout_reference,
                        }} />
                      )}
                      <Button asChild size="icon" variant="ghost" className="size-8" aria-label={`PDF de ${formatPeriodTitle(item.period)}`}>
                        <Link href={`/dashboard/alquileres/${contractId}/liquidacion/${item.id}`} target="_blank"><FileText className="size-4" /></Link>
                      </Button>
                    </div>
                  </div>
                  {!single && (
                    <ul className="space-y-1.5 rounded-md bg-muted/40 p-2.5">
                      {shares.map((share) => (
                        <li key={share.id} className="flex flex-wrap items-center justify-between gap-2">
                          <span className="min-w-0 truncate">{share.contact?.full_name ?? "Propietario"} <span className="text-muted-foreground">({share.share_pct} %)</span></span>
                          <span className="flex items-center gap-2">
                            <span className="tabular-nums">{money(share.amount, item.currency)}</span>
                            <PayoutButton today={today} share={{
                              id: share.id, ownerName: share.contact?.full_name ?? "Propietario", amount: share.amount,
                              currency: item.currency, paidAt: share.paid_to_owner_at, method: share.payout_method, reference: share.payout_reference,
                            }} />
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                  <InvoiceStrip settlement={item} enabled={invoicingEnabled} />
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}

// Facturas ARCA de los honorarios de la liquidación (una por titular).
function InvoiceStrip({ settlement, enabled }: { settlement: SettlementRow; enabled: boolean }) {
  const { busy, run } = useRunAction();
  if (!(settlement.commission_amount > 0)) return null;
  const active = settlement.invoices.filter((inv) => inv.kind === "FACTURA" && !inv.voided);
  const credits = settlement.invoices.filter((inv) => inv.kind === "NOTA_CREDITO");
  const pending = settlement.shares.filter((share) => !active.some((inv) => inv.share_id === share.id)).length;

  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 border-t border-border-subtle pt-2 text-xs">
      <span className="text-muted-foreground">Honorarios {money(settlement.commission_amount, settlement.currency)}</span>
      {[...active, ...credits].map((inv) => (
        <span key={inv.id} className="inline-flex items-center gap-1.5">
          <Link href={`/dashboard/alquileres/factura/${inv.id}`} target="_blank" className="font-medium underline-offset-4 hover:underline">
            {CBTE_LABELS[inv.cbte_tipo]} {formatInvoiceNumber(inv.pto_vta, inv.cbte_nro)}
          </Link>
          {settlement.shares.length > 1 && <span className="text-muted-foreground">{inv.receptor_name}</span>}
          {inv.environment === "HOMOLOGACION" && <span className="text-warning">(prueba)</span>}
          {inv.kind === "FACTURA" && enabled && (
            <button type="button" className="text-muted-foreground underline-offset-4 hover:text-danger hover:underline" disabled={!!busy}
              onClick={() => window.confirm("Se emite una nota de crédito por el mismo importe. ¿Anular la factura?")
                && run(`nc-${inv.id}`, () => creditInvoiceAction(inv.id))}>
              {busy === `nc-${inv.id}` ? "Anulando..." : "Anular"}
            </button>
          )}
        </span>
      ))}
      {pending > 0 && (enabled ? (
        <Button size="sm" variant="outline" className="ml-auto h-7" disabled={!!busy}
          onClick={() => run("invoice", () => issueSettlementInvoicesAction(settlement.id))}>
          {busy === "invoice" && <Loader2 className="size-3.5 animate-spin" />} Facturar honorarios
        </Button>
      ) : (
        <span className="ml-auto text-muted-foreground">Facturación ARCA sin configurar</span>
      ))}
    </div>
  );
}
