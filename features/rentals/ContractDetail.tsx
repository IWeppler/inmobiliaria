"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { FileText, Loader2, MessageCircle, Plus, Trash2, TrendingUp } from "lucide-react";
import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import { Label } from "@/shared/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/shared/components/ui/select";
import { Page, PageHeader } from "@/shared/components/PageShell";
import { StatusBadge } from "@/shared/components/StatusBadge";
import {
  addRentalChargeAction, applyAdjustmentAction, createSettlementAction,
  deleteRentalPaymentAction, recordRentalPaymentAction,
} from "@/features/rentals/actions";
import { PayoutButton } from "@/features/rentals/PayoutButton";
import {
  ADJUSTMENT_LABELS, CHARGE_LABELS, CONTRACT_STATUS_LABELS, CONTRACT_STATUS_TONE,
  computeSettlement, daysBetween, formatDate, formatPeriod, lateFee, money, periodOf,
  type AdjustmentIndex, type ManualChargeKind, type SettlementExpense,
} from "@/features/rentals/logic";
import { CloseContractDialog } from "@/features/rentals/CloseContractDialog";
import { EditContractDialog, type ContactData } from "@/features/rentals/EditContractDialog";
import { PartiesCard, type Party } from "@/features/rentals/PartiesCard";
import { DepositCard, type DepositData } from "@/features/rentals/DepositCard";
import { MaintenanceCard, type MaintenanceItem } from "@/features/rentals/MaintenanceCard";
import { DocumentsCard, type RentalDocument } from "@/features/rentals/DocumentsCard";

type Entry = { id: string; amount: number; paid_at: string; method: string; account: string | null; receipt_number: number };
type Charge = { id: string; period: string; due_date: string; kind: string; description: string; amount: number; currency: string; entries: Entry[] };

export type ContractDetailData = {
  id: string; status: string; start_date: string; end_date: string; rent_amount: number; currency: string;
  adjustment_index: string; adjustment_months: number; adjustment_pct: number | null;
  base_period: string; next_adjustment_date: string | null; last_adjustment_date: string | null;
  commission_pct: number; late_fee_pct_daily: number; late_fee_fixed: number; payment_due_day: number;
  guarantee_type: string; guarantee_detail: string | null; notes: string | null;
  renewed_from_id: string | null;
  property: { id: string; title: string } | null;
  owner: ContactData | null;
  tenant: ContactData | null;
  charges: Charge[];
  settlements: { id: string; period: string; net_amount: number; currency: string; issued_at: string; paid_to_owner_at: string | null }[];
  adjustments: { id: string; effective_date: string; previous_amount: number; new_amount: number; index_code: string }[];
  adjustmentPreview: { amount: number; factor: number } | { error: string } | null;
  parties: Party[];
  deposit: DepositData;
  maintenance: MaintenanceItem[];
  documents: RentalDocument[];
  contacts: { id: string; label: string; kind: string }[];
  today: string;
};

function collected(charge: Charge) {
  return charge.entries.reduce((sum, entry) => sum + entry.amount, 0);
}

function whatsappLink(phone: string | null | undefined, message: string) {
  const digits = phone?.replace(/\D/g, "") ?? "";
  return digits ? `https://wa.me/${digits}?text=${encodeURIComponent(message)}` : null;
}

export function ContractDetail({ c }: { c: ContractDetailData }) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [payingId, setPayingId] = useState<string | null>(null);
  const [pay, setPay] = useState({ paid_at: c.today, amount: 0, method: "TRANSFERENCIA", account: "", notes: "" });
  const [newCharge, setNewCharge] = useState({ kind: "EXPENSAS", description: "", amount: 0, due_date: c.today, period: periodOf(c.today) });
  const [settlingPeriod, setSettlingPeriod] = useState<string | null>(null);
  const [expenses, setExpenses] = useState<SettlementExpense[]>([]);
  const [manualAmount, setManualAmount] = useState(0);

  const run = async (key: string, fn: () => Promise<{ success: boolean; message: string }>) => {
    setBusy(key);
    try {
      const result = await fn();
      if (result.success) { toast.success(result.message); router.refresh(); }
      else toast.error(result.message);
      return result.success;
    } catch { toast.error("No se pudo completar la operación."); return false; }
    finally { setBusy(null); }
  };

  const settledPeriods = new Set(c.settlements.map((item) => item.period));
  const periods = [...new Set(c.charges.map((item) => item.period))].sort().reverse();
  const eligiblePeriods = periods.filter((period) => !settledPeriods.has(period)
    && c.charges.filter((charge) => charge.period === period).every((charge) => collected(charge) + 0.005 >= charge.amount));
  const overdue = c.charges.filter((charge) => charge.due_date < c.today && charge.amount - collected(charge) > 0.005);
  const overdueTotal = overdue.reduce((sum, charge) => sum + charge.amount - collected(charge), 0);
  const settlingCharges = c.charges.filter((charge) => charge.period === settlingPeriod);
  const rentCollected = settlingCharges.filter((charge) => charge.kind === "ALQUILER").reduce((sum, charge) => sum + collected(charge), 0);
  const otherCollected = settlingCharges.filter((charge) => charge.kind !== "ALQUILER").reduce((sum, charge) => sum + collected(charge), 0);
  const settlement = computeSettlement(rentCollected + otherCollected, c.commission_pct, expenses, rentCollected);
  const entries = c.charges.flatMap((charge) => charge.entries.map((entry) => ({ ...entry, charge })))
    .sort((a, b) => b.receipt_number - a.receipt_number);
  const nextAdjustment = c.next_adjustment_date;
  const previewAmount = c.adjustment_index === "MANUAL" && manualAmount > 0 ? manualAmount
    : c.adjustmentPreview && "amount" in c.adjustmentPreview ? c.adjustmentPreview.amount : null;
  const adjustmentMessage = nextAdjustment && previewAmount != null
    ? `Hola ${c.tenant?.full_name ?? ""}, te informamos que desde el ${formatDate(nextAdjustment)} el alquiler de ${c.property?.title ?? "la propiedad"} será de ${money(previewAmount, c.currency)} según el ajuste pactado. Ante cualquier consulta, escribinos.`
    : null;
  const adjustmentWa = adjustmentMessage ? whatsappLink(c.tenant?.phone, adjustmentMessage) : null;
  const overdueWa = whatsappLink(c.tenant?.phone,
    `Hola ${c.tenant?.full_name ?? ""}, registramos un saldo pendiente de ${money(overdueTotal, c.currency)} correspondiente a ${c.property?.title ?? "tu alquiler"}. Por favor, contactanos para coordinar el pago.`);

  return (
    <Page>
      <PageHeader
        backHref="/dashboard/alquileres"
        title={c.property ? <Link href={`/dashboard/propiedades/${c.property.id}`} className="hover:underline">{c.property.title}</Link> : "Contrato"}
        aside={<StatusBadge tone={CONTRACT_STATUS_TONE[c.status] ?? "neutral"}>{CONTRACT_STATUS_LABELS[c.status] ?? c.status}</StatusBadge>}
        description={`${formatDate(c.start_date)} → ${formatDate(c.end_date)} · ${ADJUSTMENT_LABELS[c.adjustment_index as AdjustmentIndex]} cada ${c.adjustment_months} meses`}
        actions={<div className="flex flex-wrap gap-2">
          <EditContractDialog
            contractId={c.id}
            owners={c.contacts.filter((o) => o.kind === "owner")}
            tenants={c.contacts.filter((o) => o.kind === "tenant")}
            initial={{
              owner_id: c.owner?.id ?? "", tenant_id: c.tenant?.id ?? "", commission_pct: c.commission_pct,
              late_fee_pct_daily: c.late_fee_pct_daily, late_fee_fixed: c.late_fee_fixed,
              guarantee_type: c.guarantee_type as "NINGUNA" | "GARANTE" | "CAUCION",
              guarantee_detail: c.guarantee_detail ?? "", notes: c.notes ?? "",
            }}
          />
          <Button asChild variant="outline"><Link href={`/dashboard/alquileres/nuevo?renovar=${c.id}`}>Renovar</Link></Button>
          {c.status === "ACTIVO" && <CloseContractDialog contractId={c.id} startDate={c.start_date} endDate={c.end_date} today={c.today} currency={c.currency} />}
        </div>}
      />

      {overdue.length > 0 && <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-danger/30 bg-danger/5 p-4 text-sm">
        <span><strong>{overdue.length} cargos vencidos</strong> · saldo {money(overdueTotal, c.currency)} · mayor atraso: {Math.max(...overdue.map((charge) => daysBetween(charge.due_date, c.today)))} días</span>
        {overdueWa && <Button asChild size="sm" variant="outline"><a href={overdueWa} target="_blank" rel="noopener noreferrer"><MessageCircle /> Reclamar por WhatsApp</a></Button>}
      </div>}

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(280px,1fr)]">
        <div className="space-y-6">
          <Card>
            <CardHeader><CardTitle>Cuenta corriente</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              {c.charges.length === 0 && <p className="text-sm text-muted-foreground">Todavía no hay cargos.</p>}
              {c.charges.map((charge) => {
                const paid = collected(charge);
                const balance = Math.max(0, charge.amount - paid);
                const lateDays = balance > 0 && charge.due_date < c.today ? daysBetween(charge.due_date, c.today) : 0;
                const fee = charge.kind === "ALQUILER" ? lateFee({ amount: charge.amount, paid_amount: paid, paid_at: null, due_date: charge.due_date }, c.late_fee_pct_daily, c.today, c.late_fee_fixed) : 0;
                const hasFeeCharge = c.charges.some((item) => item.period === charge.period && item.kind === "PUNITORIOS");
                return <div key={charge.id} className="rounded-md border border-border p-3 text-sm">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div><p className="font-medium">{charge.description}</p><p className="text-xs text-muted-foreground">{CHARGE_LABELS[charge.kind]} · {formatPeriod(charge.period)} · vence {formatDate(charge.due_date)}</p></div>
                    <div className="text-right"><p className="font-semibold tabular-nums">{money(charge.amount, charge.currency)}</p><p className="text-xs text-muted-foreground">Cobrado {money(paid, charge.currency)} · saldo {money(balance, charge.currency)}</p></div>
                  </div>
                  {lateDays > 0 && <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-danger"><span>{lateDays} días de atraso{fee > 0 && !hasFeeCharge ? ` · punitorio estimado ${money(fee, charge.currency)}` : ""}</span>{fee > 0 && !hasFeeCharge && <Button size="sm" variant="outline" disabled={!!busy} onClick={() => run(`fee-${charge.id}`, () => addRentalChargeAction({ contract_id: c.id, period: charge.period, due_date: c.today, kind: "PUNITORIOS", description: `Punitorio ${formatPeriod(charge.period)}`, amount: fee }))}>Cargar punitorio</Button>}</div>}
                  {balance > 0.005 && !settledPeriods.has(charge.period) && <div className="mt-3 border-t border-border pt-3">
                    {payingId === charge.id ? <div className="grid gap-2 sm:grid-cols-2">
                      <div><Label>Fecha</Label><Input type="date" value={pay.paid_at} onChange={(event) => setPay({ ...pay, paid_at: event.target.value })} /></div>
                      <div><Label>Importe</Label><Input type="number" min="0.01" max={balance} step="0.01" value={pay.amount || ""} onChange={(event) => setPay({ ...pay, amount: Number(event.target.value) })} /></div>
                      <div><Label>Medio</Label><Select value={pay.method} onValueChange={(value) => setPay({ ...pay, method: value, account: value === "EFECTIVO" ? "Caja" : "" })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="TRANSFERENCIA">Transferencia</SelectItem><SelectItem value="EFECTIVO">Efectivo</SelectItem><SelectItem value="OTRO">Otro</SelectItem></SelectContent></Select></div>
                      <div><Label>Cuenta de ingreso</Label><Input value={pay.account} placeholder="Banco / caja" onChange={(event) => setPay({ ...pay, account: event.target.value })} /></div>
                      <div className="sm:col-span-2"><Label>Nota</Label><Input value={pay.notes} onChange={(event) => setPay({ ...pay, notes: event.target.value })} /></div>
                      <div className="flex gap-2 sm:col-span-2"><Button size="sm" disabled={!!busy || pay.amount <= 0 || pay.amount > balance || !pay.account.trim()} onClick={async () => {
                        const ok = await run(`pay-${charge.id}`, () => recordRentalPaymentAction({ charge_id: charge.id, ...pay, method: pay.method as "TRANSFERENCIA" | "EFECTIVO" | "OTRO" }));
                        if (ok) setPayingId(null);
                      }}>{busy === `pay-${charge.id}` ? <Loader2 className="size-4 animate-spin" /> : "Registrar cobro"}</Button><Button size="sm" variant="ghost" onClick={() => setPayingId(null)}>Cancelar</Button></div>
                    </div> : <Button size="sm" variant="outline" onClick={() => { setPayingId(charge.id); setPay({ paid_at: c.today, amount: balance, method: "TRANSFERENCIA", account: "", notes: "" }); }}>Registrar pago</Button>}
                  </div>}
                </div>;
              })}
            </CardContent>
          </Card>

          <Card><CardHeader><CardTitle>Agregar cargo</CardTitle></CardHeader><CardContent className="grid gap-3 sm:grid-cols-2">
            <div><Label>Concepto</Label><Select value={newCharge.kind} onValueChange={(value) => setNewCharge({ ...newCharge, kind: value })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{Object.entries(CHARGE_LABELS).filter(([key]) => key !== "ALQUILER").map(([key, label]) => <SelectItem key={key} value={key}>{label}</SelectItem>)}</SelectContent></Select></div>
            <div><Label>Descripción</Label><Input value={newCharge.description} onChange={(event) => setNewCharge({ ...newCharge, description: event.target.value })} /></div>
            <div><Label>Importe</Label><Input type="number" min="0.01" step="0.01" value={newCharge.amount || ""} onChange={(event) => setNewCharge({ ...newCharge, amount: Number(event.target.value) })} /></div>
            <div><Label>Vencimiento</Label><Input type="date" value={newCharge.due_date} onChange={(event) => setNewCharge({ ...newCharge, due_date: event.target.value, period: periodOf(event.target.value) })} /></div>
            <Button size="sm" className="sm:col-span-2 sm:justify-self-end" disabled={!!busy || newCharge.description.trim().length < 3 || newCharge.amount <= 0} onClick={async () => {
              const ok = await run("charge", () => addRentalChargeAction({ contract_id: c.id, ...newCharge, kind: newCharge.kind as ManualChargeKind }));
              if (ok) setNewCharge({ kind: "EXPENSAS", description: "", amount: 0, due_date: c.today, period: periodOf(c.today) });
            }}><Plus /> Agregar cargo</Button>
          </CardContent></Card>

          <Card><CardHeader><CardTitle>Recibos de cobro</CardTitle></CardHeader><CardContent className="space-y-2 text-sm">
            {entries.length === 0 ? <p className="text-muted-foreground">Todavía no hay cobros.</p> : entries.map((entry) => <div key={entry.id} className="flex flex-wrap items-center justify-between gap-2 border-b border-border pb-2 last:border-0">
              <div><p className="font-medium">Recibo N.º {entry.receipt_number} · {entry.charge.description}</p><p className="text-xs text-muted-foreground">{formatDate(entry.paid_at)} · {entry.method} · {entry.account ?? "Sin cuenta"}</p></div>
              <div className="flex items-center gap-2"><span className="tabular-nums">{money(entry.amount, c.currency)}</span><Button asChild size="sm" variant="outline"><Link href={`/dashboard/alquileres/${c.id}/recibo/${entry.id}`} target="_blank"><FileText /> PDF</Link></Button><Button size="icon" variant="ghost" aria-label="Revertir cobro" disabled={!!busy || settledPeriods.has(entry.charge.period)} onClick={() => run(`undo-${entry.id}`, () => deleteRentalPaymentAction(entry.id))}><Trash2 /></Button></div>
            </div>)}
          </CardContent></Card>

          <Card><CardHeader><CardTitle>Liquidación al propietario</CardTitle></CardHeader><CardContent className="space-y-4">
            {eligiblePeriods.length > 0 && <><div><Label>Período completamente cobrado</Label><Select value={settlingPeriod ?? ""} onValueChange={(value) => { setSettlingPeriod(value); setExpenses([]); }}><SelectTrigger><SelectValue placeholder="Seleccionar período" /></SelectTrigger><SelectContent>{eligiblePeriods.map((period) => <SelectItem key={period} value={period}>{formatPeriod(period)}</SelectItem>)}</SelectContent></Select></div>
              {settlingPeriod && <div className="space-y-3 rounded-md border border-border p-3"><p className="text-sm font-medium">Gastos a cargo del propietario</p>{expenses.map((expense, index) => <div key={index} className="flex gap-2"><Input placeholder="Descripción" value={expense.description} onChange={(event) => setExpenses(expenses.map((item, i) => i === index ? { ...item, description: event.target.value } : item))} /><Input className="w-32" type="number" min="0" step="0.01" value={expense.amount || ""} onChange={(event) => setExpenses(expenses.map((item, i) => i === index ? { ...item, amount: Number(event.target.value) } : item))} /><Button size="icon" variant="ghost" onClick={() => setExpenses(expenses.filter((_, i) => i !== index))}><Trash2 /></Button></div>)}<Button size="sm" variant="outline" onClick={() => setExpenses([...expenses, { description: "", amount: 0 }])}><Plus /> Agregar gasto</Button>
                <dl className="grid grid-cols-2 gap-1 text-sm"><dt>Cobrado</dt><dd className="text-right">{money(rentCollected + otherCollected, c.currency)}</dd><dt>Comisión</dt><dd className="text-right">− {money(settlement.commission, c.currency)}</dd><dt>Gastos</dt><dd className="text-right">− {money(settlement.expensesAmount, c.currency)}</dd><dt className="border-t border-border pt-1 font-semibold">Neto</dt><dd className="border-t border-border pt-1 text-right font-semibold">{money(settlement.net, c.currency)}</dd></dl>
                <Button disabled={!!busy || expenses.some((item) => !item.description.trim())} onClick={async () => { const ok = await run("settle", () => createSettlementAction({ contract_id: c.id, period: settlingPeriod, expenses })); if (ok) setSettlingPeriod(null); }}>{busy === "settle" ? <Loader2 className="size-4 animate-spin" /> : "Generar liquidación"}</Button>
              </div>}
            </>}
            {eligiblePeriods.length === 0 && <p className="text-sm text-muted-foreground">Los períodos completamente cobrados aparecen aquí para liquidar.</p>}
            {c.settlements.length > 0 && <div className="space-y-2 border-t border-border pt-3 text-sm">{c.settlements.map((item) => <div key={item.id} className="flex flex-wrap items-center justify-between gap-2">
              <span className="capitalize">{formatPeriod(item.period)} · {money(item.net_amount, item.currency)}</span>
              <div className="flex items-center gap-2">
                <PayoutButton settlementId={item.id} paidAt={item.paid_to_owner_at} today={c.today} />
                <Button asChild size="sm" variant="outline"><Link href={`/dashboard/alquileres/${c.id}/liquidacion/${item.id}`} target="_blank"><FileText /> PDF</Link></Button>
              </div>
            </div>)}</div>}
          </CardContent></Card>

          <MaintenanceCard contractId={c.id} currency={c.currency} items={c.maintenance} today={c.today} />
        </div>

        <div className="space-y-6">
          <Card><CardHeader><CardTitle className="flex items-center gap-2"><TrendingUp className="size-4" /> Canon y ajuste</CardTitle></CardHeader><CardContent className="space-y-3 text-sm">
            <p className="text-2xl font-semibold tabular-nums">{money(c.rent_amount, c.currency)}</p>
            <p className="text-muted-foreground">{ADJUSTMENT_LABELS[c.adjustment_index as AdjustmentIndex]}{nextAdjustment ? ` · próximo ${formatDate(nextAdjustment)}` : " · sin próximos ajustes"}</p>
            {c.last_adjustment_date && <p className="text-xs text-muted-foreground">Último ajuste: {formatDate(c.last_adjustment_date)}</p>}
            {c.adjustmentPreview && "amount" in c.adjustmentPreview && <p>Nuevo canon previsto: <strong>{money(c.adjustmentPreview.amount, c.currency)}</strong></p>}
            {c.adjustmentPreview && "error" in c.adjustmentPreview && c.adjustment_index !== "MANUAL" && <p className="text-xs text-warning">{c.adjustmentPreview.error} <Link href="/dashboard/ajustes" className="underline">Cargar índice</Link></p>}
            {c.adjustment_index === "MANUAL" && nextAdjustment && <div><Label>Nuevo canon manual</Label><Input type="number" min="0.01" step="0.01" value={manualAmount || ""} onChange={(event) => setManualAmount(Number(event.target.value))} /></div>}
            {nextAdjustment && <Button className="w-full" disabled={!!busy || c.status !== "ACTIVO" || nextAdjustment > c.today || (c.adjustment_index === "MANUAL" && manualAmount <= 0) || (c.adjustment_index !== "MANUAL" && !!c.adjustmentPreview && "error" in c.adjustmentPreview)} onClick={() => run("adjust", () => applyAdjustmentAction(c.id, c.adjustment_index === "MANUAL" ? manualAmount : undefined))}>{busy === "adjust" ? <Loader2 className="size-4 animate-spin" /> : "Aplicar ajuste"}</Button>}
            {adjustmentWa && nextAdjustment && daysBetween(c.today, nextAdjustment) <= 30 && daysBetween(c.today, nextAdjustment) >= 0 && <Button asChild className="w-full" variant="outline"><a href={adjustmentWa} target="_blank" rel="noopener noreferrer"><MessageCircle /> Avisar al inquilino</a></Button>}
            {c.adjustments.length > 0 && <div className="space-y-1 border-t border-border pt-3 text-xs text-muted-foreground">{c.adjustments.map((item) => <p key={item.id}>{formatDate(item.effective_date)} · {item.index_code} · {money(item.previous_amount, c.currency)} → {money(item.new_amount, c.currency)}</p>)}</div>}
          </CardContent></Card>

          <PartiesCard contractId={c.id} owner={c.owner} tenant={c.tenant} parties={c.parties} contacts={c.contacts} editable={c.status === "ACTIVO"} />

          <DepositCard contractId={c.id} currency={c.currency} deposit={c.deposit} today={c.today} />

          <Card><CardHeader><CardTitle>Condiciones</CardTitle></CardHeader><CardContent className="space-y-3 text-sm">
            <div><p className="text-xs text-muted-foreground">Garantía</p><p>{c.guarantee_type === "GARANTE" ? "Garante" : c.guarantee_type === "CAUCION" ? "Seguro de caución" : "Sin garantía"}{c.guarantee_detail ? ` · ${c.guarantee_detail}` : ""}</p></div>
            <div><p className="text-xs text-muted-foreground">Administración</p><p>{c.commission_pct} % del alquiler cobrado</p></div>
            <div><p className="text-xs text-muted-foreground">Punitorio</p><p>{c.late_fee_pct_daily} % diario{c.late_fee_fixed > 0 ? ` + ${money(c.late_fee_fixed, c.currency)} fijo` : ""}</p></div>
            {c.notes && <div><p className="text-xs text-muted-foreground">Notas</p><p className="whitespace-pre-line">{c.notes}</p></div>}
          </CardContent></Card>

          <DocumentsCard contractId={c.id} documents={c.documents} />
        </div>
      </div>
    </Page>
  );
}
