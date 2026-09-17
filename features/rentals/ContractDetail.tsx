"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  CheckCircle2,
  FileText,
  Loader2,
  TrendingUp,
  Undo2,
  Plus,
  Trash2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import { Label } from "@/shared/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/shared/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/components/ui/select";
import {
  applyAdjustmentAction,
  createSettlementAction,
  registerPaymentAction,
  setContractStatusAction,
  undoPaymentAction,
} from "@/features/rentals/actions";
import { Page, PageHeader } from "@/shared/components/PageShell";
import { StatusBadge, type StatusTone } from "@/shared/components/StatusBadge";
import {
  ADJUSTMENT_LABELS,
  CONTRACT_STATUS_LABELS,
  CONTRACT_STATUS_TONE,
  PAYMENT_STATUS_LABELS,
  computeSettlement,
  formatDate,
  formatPeriod,
  lateFee,
  money,
  paymentStatus,
  type AdjustmentIndex,
  type SettlementExpense,
} from "@/features/rentals/logic";

export type ContractDetailData = {
  id: string;
  status: string;
  start_date: string;
  end_date: string;
  rent_amount: number;
  currency: string;
  adjustment_index: string;
  adjustment_months: number;
  adjustment_pct: number | null;
  base_period: string;
  next_adjustment_date: string | null;
  commission_pct: number;
  late_fee_pct_daily: number;
  payment_due_day: number;
  notes: string | null;
  property: { id: string; title: string } | null;
  owner: { id: string; full_name: string; phone: string | null; email: string | null } | null;
  tenant: { id: string; full_name: string; phone: string | null; email: string | null } | null;
  payments: {
    id: string;
    period: string;
    due_date: string;
    amount: number;
    currency: string;
    paid_at: string | null;
    paid_amount: number | null;
    method: string | null;
  }[];
  settlements: {
    id: string;
    period: string;
    net_amount: number;
    currency: string;
    issued_at: string;
  }[];
  adjustmentPreview: { amount: number; factor: number } | { error: string } | null;
  today: string;
};

// Estado de cuota → tono semántico (StatusBadge).
const PAYMENT_TONE: Record<string, StatusTone> = {
  pagado: "success",
  parcial: "warning",
  vencido: "danger",
  pendiente: "neutral",
};

export function ContractDetail({ c }: { c: ContractDetailData }) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [payingId, setPayingId] = useState<string | null>(null);
  const [payForm, setPayForm] = useState({ paid_at: c.today, paid_amount: 0, method: "Transferencia" });
  const [settlingPeriod, setSettlingPeriod] = useState<string | null>(null);
  const [expenses, setExpenses] = useState<SettlementExpense[]>([]);

  const run = async (key: string, fn: () => Promise<{ success: boolean; message: string }>) => {
    setBusy(key);
    const res = await fn();
    setBusy(null);
    if (res.success) {
      toast.success(res.message);
      router.refresh();
    } else toast.error(res.message);
    return res.success;
  };

  const settledPeriods = new Set(c.settlements.map((s) => s.period));
  const paidTotal = c.payments.reduce((a, p) => a + (p.paid_amount ?? 0), 0);
  const overdueCount = c.payments.filter((p) => paymentStatus(p, c.today) === "vencido").length;

  const openPay = (p: ContractDetailData["payments"][number]) => {
    setPayingId(p.id);
    setPayForm({
      paid_at: c.today,
      paid_amount: p.amount + lateFee(p, c.late_fee_pct_daily, c.today),
      method: "Transferencia",
    });
  };

  const settlingPayment = c.payments.find((p) => p.period === settlingPeriod);
  const settlementCalc = settlingPayment
    ? computeSettlement(settlingPayment.paid_amount ?? settlingPayment.amount, c.commission_pct, expenses)
    : null;

  return (
    <Page>
      <PageHeader
        backHref="/dashboard/alquileres"
        title={
          c.property ? (
            <Link href={`/dashboard/propiedades/${c.property.id}`} className="underline-offset-4 hover:underline">
              {c.property.title}
            </Link>
          ) : (
            "Contrato"
          )
        }
        aside={
          <StatusBadge tone={CONTRACT_STATUS_TONE[c.status] ?? "neutral"}>
            {CONTRACT_STATUS_LABELS[c.status] ?? c.status}
          </StatusBadge>
        }
        description={
          <>
            {formatDate(c.start_date)} → {formatDate(c.end_date)} · vence el día {c.payment_due_day} ·{" "}
            {ADJUSTMENT_LABELS[c.adjustment_index as AdjustmentIndex]} cada {c.adjustment_months} meses
          </>
        }
        actions={
          c.status === "ACTIVO" ? (
            <Select
              onValueChange={(s) =>
                run("status", () => setContractStatusAction(c.id, s as "FINALIZADO" | "RESCINDIDO"))
              }
            >
              <SelectTrigger className="w-[160px]">
                <SelectValue placeholder="Cerrar contrato" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="FINALIZADO">Finalizar</SelectItem>
                <SelectItem value="RESCINDIDO">Rescindir</SelectItem>
              </SelectContent>
            </Select>
          ) : undefined
        }
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        <div className="lg:col-span-2 space-y-6">
          {/* E4.3 — Cobranzas */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Cuotas</CardTitle>
              <span className="text-xs text-muted-foreground">
                Cobrado {money(paidTotal, c.currency)}
                {overdueCount > 0 && (
                  <span className="ml-2 text-sm font-normal text-danger">· {overdueCount} en mora</span>
                )}
              </span>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Período</TableHead>
                    <TableHead className="hidden md:table-cell">Vence</TableHead>
                    <TableHead className="text-right">Canon</TableHead>
                    <TableHead className="text-right hidden md:table-cell">Punitorio</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead className="w-[120px]" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {c.payments.map((p) => {
                    const st = paymentStatus(p, c.today);
                    const fee = lateFee(p, c.late_fee_pct_daily, c.today);
                    const isPaying = payingId === p.id;
                    return (
                      <TableRow key={p.id} className={cn(isPaying && "bg-secondary/40")}>
                        <TableCell className="font-medium capitalize">{formatPeriod(p.period)}</TableCell>
                        <TableCell className="hidden md:table-cell text-muted-foreground">
                          {formatDate(p.due_date)}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {money(p.amount, p.currency)}
                          {p.paid_at && p.paid_amount !== p.amount && (
                            <span className="block text-xs text-muted-foreground">
                              cobrado {money(p.paid_amount, p.currency)}
                            </span>
                          )}
                        </TableCell>
                        <TableCell className="text-right tabular-nums hidden md:table-cell text-muted-foreground">
                          {fee > 0 ? money(fee, p.currency) : "—"}
                        </TableCell>
                        <TableCell>
                          <StatusBadge tone={PAYMENT_TONE[st] ?? "neutral"}>
                            {PAYMENT_STATUS_LABELS[st]}
                          </StatusBadge>
                        </TableCell>
                        <TableCell className="text-right">
                          {p.paid_at ? (
                            <div className="flex items-center justify-end gap-1">
                              {!settledPeriods.has(p.period) && c.status === "ACTIVO" && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-7 text-xs"
                                  onClick={() => {
                                    setSettlingPeriod(p.period);
                                    setExpenses([]);
                                  }}
                                >
                                  <FileText className="size-3.5 mr-1" />
                                  Liquidar
                                </Button>
                              )}
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 text-muted-foreground"
                                title="Revertir pago"
                                disabled={settledPeriods.has(p.period)}
                                onClick={() => run(`undo-${p.id}`, () => undoPaymentAction(p.id))}
                              >
                                <Undo2 className="size-3.5" />
                              </Button>
                            </div>
                          ) : (
                            <Button
                              variant={st === "vencido" ? "default" : "outline"}
                              size="sm"
                              className="h-7 text-xs"
                              onClick={() => (isPaying ? setPayingId(null) : openPay(p))}
                            >
                              <CheckCircle2 className="size-3.5 mr-1" />
                              {isPaying ? "Cerrar" : "Cobrar"}
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>

              {payingId && (
                <div className="border-t border-border p-4 grid grid-cols-1 sm:grid-cols-4 gap-3 items-end bg-secondary/30">
                  <div className="space-y-1.5">
                    <Label>Fecha de pago</Label>
                    <Input
                      type="date"
                      value={payForm.paid_at}
                      onChange={(e) => setPayForm({ ...payForm, paid_at: e.target.value })}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Importe cobrado</Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={payForm.paid_amount}
                      onChange={(e) => setPayForm({ ...payForm, paid_amount: Number(e.target.value) })}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Medio</Label>
                    <Input
                      value={payForm.method}
                      onChange={(e) => setPayForm({ ...payForm, method: e.target.value })}
                    />
                  </div>
                  <Button
                    disabled={busy === "pay"}
                    onClick={async () => {
                      const ok = await run("pay", () =>
                        registerPaymentAction({ payment_id: payingId, ...payForm })
                      );
                      if (ok) setPayingId(null);
                    }}
                  >
                    {busy === "pay" ? <Loader2 className="size-4 animate-spin" /> : "Registrar pago"}
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          {/* E4.4 — Liquidación */}
          {settlingPeriod && settlingPayment && settlementCalc && (
            <Card>
              <CardHeader>
                <CardTitle className="capitalize">
                  Liquidar {formatPeriod(settlingPeriod)} al propietario
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  {expenses.map((e, i) => (
                    <div key={i} className="grid grid-cols-[1fr_140px_36px] gap-2">
                      <Input
                        placeholder="Gasto (ej. plomero, expensas extraordinarias)"
                        value={e.description}
                        onChange={(ev) =>
                          setExpenses(expenses.map((x, j) => (j === i ? { ...x, description: ev.target.value } : x)))
                        }
                      />
                      <Input
                        type="number"
                        step="0.01"
                        value={e.amount || ""}
                        onChange={(ev) =>
                          setExpenses(expenses.map((x, j) => (j === i ? { ...x, amount: Number(ev.target.value) } : x)))
                        }
                      />
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-9 w-9 text-muted-foreground"
                        onClick={() => setExpenses(expenses.filter((_, j) => j !== i))}
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    </div>
                  ))}
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setExpenses([...expenses, { description: "", amount: 0 }])}
                  >
                    <Plus className="size-3.5 mr-1" /> Agregar gasto a descontar
                  </Button>
                </div>
                <dl className="grid grid-cols-2 gap-y-1 text-sm max-w-sm ml-auto">
                  <dt className="text-muted-foreground">Cobrado</dt>
                  <dd className="text-right tabular-nums">
                    {money(settlingPayment.paid_amount ?? settlingPayment.amount, c.currency)}
                  </dd>
                  <dt className="text-muted-foreground">Comisión ({c.commission_pct} %)</dt>
                  <dd className="text-right tabular-nums">− {money(settlementCalc.commission, c.currency)}</dd>
                  <dt className="text-muted-foreground">Gastos</dt>
                  <dd className="text-right tabular-nums">− {money(settlementCalc.expensesAmount, c.currency)}</dd>
                  <dt className="font-semibold border-t border-border pt-1">Neto al propietario</dt>
                  <dd className="text-right tabular-nums font-semibold border-t border-border pt-1">
                    {money(settlementCalc.net, c.currency)}
                  </dd>
                </dl>
                <div className="flex justify-end gap-2">
                  <Button variant="ghost" onClick={() => setSettlingPeriod(null)}>
                    Cancelar
                  </Button>
                  <Button
                    disabled={busy === "settle" || expenses.some((e) => !e.description)}
                    onClick={async () => {
                      const ok = await run("settle", () =>
                        createSettlementAction({ contract_id: c.id, period: settlingPeriod, expenses })
                      );
                      if (ok) setSettlingPeriod(null);
                    }}
                  >
                    {busy === "settle" ? <Loader2 className="size-4 animate-spin" /> : "Generar liquidación"}
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader>
              <CardTitle>Liquidaciones emitidas</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {c.settlements.length === 0 ? (
                <p className="p-4 text-sm text-muted-foreground">
                  Ninguna todavía. Cobrá una cuota y usá &ldquo;Liquidar&rdquo;.
                </p>
              ) : (
                <ul className="divide-y divide-border text-sm">
                  {c.settlements.map((s) => (
                    <li key={s.id} className="flex items-center justify-between px-4 py-2.5">
                      <span className="capitalize">
                        {formatPeriod(s.period)}{" "}
                        <span className="text-muted-foreground">· emitida {formatDate(s.issued_at)}</span>
                      </span>
                      <span className="flex items-center gap-3">
                        <span className="tabular-nums font-medium">{money(s.net_amount, s.currency)}</span>
                        <Button asChild variant="outline" size="sm" className="h-7 text-xs">
                          <Link href={`/dashboard/alquileres/${c.id}/liquidacion/${s.id}`} target="_blank">
                            <FileText className="size-3.5 mr-1" /> PDF
                          </Link>
                        </Button>
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          {/* E4.2 — Ajuste */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="size-4 text-muted-foreground" /> Canon y ajuste
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <p className="text-2xl font-semibold tabular-nums">
                {money(c.rent_amount, c.currency)}
              </p>
              {c.adjustment_index === "NINGUNO" ? (
                <p className="text-muted-foreground">Sin ajuste durante el contrato.</p>
              ) : !c.next_adjustment_date ? (
                <p className="text-muted-foreground">No quedan ajustes pendientes.</p>
              ) : (
                <>
                  <p className="text-muted-foreground">
                    Próximo ajuste: <span className="text-foreground font-medium">{formatDate(c.next_adjustment_date)}</span>
                    <br />
                    Base: {money(c.rent_amount, c.currency)} ({formatPeriod(c.base_period)})
                  </p>
                  {c.adjustmentPreview && "error" in c.adjustmentPreview ? (
                    <p className="text-xs text-warning">
                      {c.adjustmentPreview.error}{" "}
                      <Link href="/dashboard/ajustes" className="underline">
                        Cargar índices
                      </Link>
                    </p>
                  ) : c.adjustmentPreview ? (
                    <p>
                      Nuevo canon: <span className="font-semibold tabular-nums">{money(c.adjustmentPreview.amount, c.currency)}</span>{" "}
                      <span className="text-muted-foreground">(×{c.adjustmentPreview.factor.toFixed(4)})</span>
                    </p>
                  ) : null}
                  <Button
                    size="sm"
                    className="w-full"
                    disabled={
                      busy === "adjust" ||
                      c.status !== "ACTIVO" ||
                      !c.adjustmentPreview ||
                      "error" in c.adjustmentPreview ||
                      c.next_adjustment_date > c.today
                    }
                    onClick={() => run("adjust", () => applyAdjustmentAction(c.id))}
                  >
                    {busy === "adjust" ? <Loader2 className="size-4 animate-spin" /> : "Aplicar ajuste"}
                  </Button>
                  {c.next_adjustment_date > c.today && (
                    <p className="text-xs text-muted-foreground">
                      Se habilita a partir de la fecha de ajuste.
                    </p>
                  )}
                </>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base font-semibold">Partes</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-sm">
              {[
                { label: "Propietario", p: c.owner },
                { label: "Inquilino", p: c.tenant },
              ].map(({ label, p }) => (
                <div key={label}>
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
                  <p className="font-medium">{p?.full_name ?? "—"}</p>
                  {p?.phone && <p className="text-muted-foreground">{p.phone}</p>}
                  {p?.email && <p className="text-muted-foreground">{p.email}</p>}
                </div>
              ))}
              <div>
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Comisión</p>
                <p className="font-medium">{c.commission_pct} % del canon</p>
              </div>
              {c.notes && (
                <div>
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">Notas</p>
                  <p className="whitespace-pre-line">{c.notes}</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </Page>
  );
}
