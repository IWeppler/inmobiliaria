"use client";

import { useState } from "react";
import Link from "next/link";
import { FileText, Undo2 } from "lucide-react";
import { Button } from "@/shared/components/ui/button";
import { StatusBadge, type StatusTone } from "@/shared/components/StatusBadge";
import { deleteRentalPaymentAction } from "@/features/rentals/actions";
import {
  CHARGE_LABELS, addMonths, daysBetween, formatDate, formatPeriod, formatPeriodTitle, lateFee, money, periodOf,
} from "@/features/rentals/logic";
import { AddChargeDialog } from "@/features/rentals/AddChargeDialog";
import { PaymentDialog } from "@/features/rentals/PaymentDialog";
import { useRunAction } from "@/features/rentals/useRunAction";

export type LedgerEntry = { id: string; amount: number; paid_at: string; method: string; account: string | null; receipt_number: number };
export type LedgerCharge = {
  id: string; period: string; due_date: string; kind: string; description: string;
  amount: number; currency: string; entries: LedgerEntry[];
};

type PeriodState = { label: string; tone: StatusTone };

const METHOD_LABELS: Record<string, string> = { TRANSFERENCIA: "Transferencia", EFECTIVO: "Efectivo", OTRO: "Otro" };

export function collected(charge: LedgerCharge) {
  return charge.entries.reduce((sum, entry) => sum + entry.amount, 0);
}

function periodState(charges: LedgerCharge[], settled: boolean, today: string): PeriodState {
  if (settled) return { label: "Liquidado", tone: "neutral" };
  const pending = charges.filter((charge) => charge.amount - collected(charge) > 0.005);
  if (pending.length === 0) return { label: "Cobrado", tone: "success" };
  if (pending.some((charge) => charge.due_date < today)) return { label: "Vencido", tone: "danger" };
  if (pending.length < charges.length || pending.some((charge) => collected(charge) > 0)) return { label: "Parcial", tone: "warning" };
  return { label: "Pendiente", tone: "info" };
}

// Cuenta corriente agrupada por mes. Los meses futuros (después del
// próximo) se pliegan: un contrato de 24 meses no debería ocupar 24 bloques.
export function LedgerTab({
  contractId, charges, settledPeriods, today, lateFeePctDaily, lateFeeFixed, currency, active,
  lateFeeMode, lateFeeGraceDays,
}: {
  contractId: string; charges: LedgerCharge[]; settledPeriods: string[]; today: string;
  lateFeePctDaily: number; lateFeeFixed: number; currency: string; active: boolean;
  lateFeeMode: "AUTO" | "MANUAL"; lateFeeGraceDays: number;
}) {
  const { busy, run } = useRunAction();
  const [showFuture, setShowFuture] = useState(false);

  const horizon = addMonths(periodOf(today), 1);
  const periods = [...new Set(charges.map((charge) => charge.period))].sort().reverse();
  const future = periods.filter((period) => period > horizon);
  const visible = showFuture ? periods : periods.filter((period) => period <= horizon);
  const settled = new Set(settledPeriods);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">
          Cuotas, cargos y cobros por mes. Cada cobro genera un recibo numerado.
          {lateFeeMode === "AUTO" && " Los punitorios se calculan solos y se actualizan cada día hasta que se cobran."}
        </p>
        {active && <AddChargeDialog contractId={contractId} currency={currency} today={today} settledPeriods={settledPeriods} />}
      </div>

      {periods.length === 0 && (
        <div className="rounded-lg border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
          Este contrato todavía no tiene cuotas generadas.
        </div>
      )}

      {/* Los meses futuros quedan arriba (orden descendente): el toggle va antes. */}
      {future.length > 0 && (
        <Button variant="ghost" size="sm" className="-ml-2" onClick={() => setShowFuture((prev) => !prev)}>
          {showFuture ? "Ocultar meses futuros" : `Ver ${future.length} ${future.length === 1 ? "mes futuro" : "meses futuros"}`}
        </Button>
      )}

      {visible.map((period) => {
        const rows = charges.filter((charge) => charge.period === period).sort((a, b) => a.due_date.localeCompare(b.due_date));
        const isSettled = settled.has(period);
        const state = periodState(rows, isSettled, today);
        const total = rows.reduce((sum, charge) => sum + charge.amount, 0);
        const balance = rows.reduce((sum, charge) => sum + Math.max(0, charge.amount - collected(charge)), 0);
        const hasFee = rows.some((charge) => charge.kind === "PUNITORIOS");

        return (
          <section key={period} className="overflow-hidden rounded-lg border border-border bg-card">
            <header className="flex flex-wrap items-center justify-between gap-2 border-b border-border bg-muted/40 px-4 py-2.5">
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-semibold">{formatPeriodTitle(period)}</h3>
                <StatusBadge tone={state.tone}>{state.label}</StatusBadge>
              </div>
              <p className="text-sm tabular-nums text-muted-foreground">
                {money(total, currency)}{balance > 0.005 && <> · saldo <span className="font-medium text-foreground">{money(balance, currency)}</span></>}
              </p>
            </header>
            <ul className="divide-y divide-border-subtle">
              {rows.map((charge) => {
                const paid = collected(charge);
                const chargeBalance = Math.max(0, charge.amount - paid);
                const late = chargeBalance > 0.005 && charge.due_date < today ? daysBetween(charge.due_date, today) : 0;
                // En AUTO el punitorio ya es un cargo más del mes (lo mantiene la base): no se ofrece cargarlo a mano.
                const fee = lateFeeMode === "MANUAL" && late > 0 && charge.kind === "ALQUILER" && !hasFee
                  ? lateFee({ amount: charge.amount, paid_amount: paid, paid_at: null, due_date: charge.due_date }, lateFeePctDaily, today, lateFeeFixed, lateFeeGraceDays)
                  : 0;
                return (
                  <li key={charge.id} className="px-4 py-3 text-sm">
                    <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-x-4 gap-y-2 md:grid-cols-[minmax(0,1fr)_120px_120px_auto]">
                      <div className="min-w-0">
                        <p className="truncate font-medium">{charge.description}</p>
                        <p className="text-xs text-muted-foreground">
                          {CHARGE_LABELS[charge.kind] ?? charge.kind} · vence {formatDate(charge.due_date)}
                          {late > 0 && <span className="font-medium text-danger"> · {late} días de atraso</span>}
                        </p>
                      </div>
                      <p className="text-right tabular-nums">{money(charge.amount, currency)}</p>
                      {/* Solo informa cuando agrega algo: cobrado o saldo de un pago parcial. */}
                      <p className="hidden text-right text-xs md:block">
                        {chargeBalance <= 0.005
                          ? <span className="text-success">Cobrado</span>
                          : paid > 0
                            ? <span className="tabular-nums text-muted-foreground">Saldo {money(chargeBalance, currency)}</span>
                            : null}
                      </p>
                      <div className="col-span-2 flex flex-wrap justify-end gap-2 md:col-span-1">
                        {fee > 0 && active && (
                          <AddChargeDialog
                            contractId={contractId} currency={currency} today={today} settledPeriods={settledPeriods}
                            preset={{ kind: "PUNITORIOS", description: `Punitorio ${formatPeriod(charge.period)}`, amount: fee, period: charge.period, label: `Punitorio ${money(fee, currency)}` }}
                          />
                        )}
                        {chargeBalance > 0.005 && !isSettled && (
                          <PaymentDialog chargeId={charge.id} description={charge.description} balance={chargeBalance} currency={currency} today={today} />
                        )}
                      </div>
                    </div>
                    {charge.entries.length > 0 && (
                      <ul className="mt-2 space-y-1">
                        {charge.entries.map((entry) => (
                          <li key={entry.id} className="flex flex-wrap items-center justify-between gap-2 rounded-md bg-muted/50 px-2.5 py-1.5 text-xs">
                            <span className="text-muted-foreground">
                              Recibo N.º {entry.receipt_number} · {formatDate(entry.paid_at)} · {METHOD_LABELS[entry.method] ?? entry.method}{entry.account ? ` (${entry.account})` : ""}
                            </span>
                            <span className="flex items-center gap-1">
                              <span className="font-medium tabular-nums">{money(entry.amount, currency)}</span>
                              <Button asChild size="icon" variant="ghost" className="size-7" aria-label={`Ver recibo ${entry.receipt_number}`}>
                                <Link href={`/dashboard/alquileres/${contractId}/recibo/${entry.id}`} target="_blank"><FileText className="size-3.5" /></Link>
                              </Button>
                              {!isSettled && (
                                <Button size="icon" variant="ghost" className="size-7" aria-label={`Revertir cobro ${entry.receipt_number}`} disabled={!!busy}
                                  onClick={() => run(`undo-${entry.id}`, () => deleteRentalPaymentAction(entry.id))}>
                                  <Undo2 className="size-3.5" />
                                </Button>
                              )}
                            </span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </li>
                );
              })}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
