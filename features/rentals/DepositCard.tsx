"use client";

import { useState } from "react";
import { Loader2, Plus, Trash2 } from "lucide-react";
import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import { Label } from "@/shared/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/components/ui/card";
import { StatusBadge } from "@/shared/components/StatusBadge";
import { updateDepositAction } from "@/features/rentals/lifecycleActions";
import { formatDate, money, round2, type SettlementExpense } from "@/features/rentals/logic";
import { useRunAction } from "@/features/rentals/useRunAction";

export type DepositData = {
  amount: number;
  received_at: string | null;
  returned_at: string | null;
  returned_amount: number | null;
  deductions: SettlementExpense[];
};

// Depósito en garantía: recibido al firmar, devuelto al entregar las llaves
// menos los descuentos (daños, deudas de servicios, etc.).
export function DepositCard({ contractId, currency, deposit, today }: {
  contractId: string; currency: string; deposit: DepositData; today: string;
}) {
  const { busy, run } = useRunAction();
  const [editing, setEditing] = useState(false);
  const [receivedAt, setReceivedAt] = useState(deposit.received_at ?? "");
  const [returnedAt, setReturnedAt] = useState(deposit.returned_at ?? "");
  const [deductions, setDeductions] = useState(deposit.deductions);

  const deducted = round2(deductions.reduce((sum, item) => sum + (item.amount || 0), 0));
  const refund = round2(deposit.amount - deducted);
  const status = deposit.returned_at ? { tone: "neutral" as const, label: "Devuelto" }
    : deposit.received_at ? { tone: "success" as const, label: "En custodia" }
    : { tone: "warning" as const, label: "Sin recibir" };

  if (deposit.amount <= 0) return null;

  const save = async () => {
    const ok = await run("deposit", () => updateDepositAction({
      contract_id: contractId,
      deposit_received_at: receivedAt || null,
      deposit_returned_at: returnedAt || null,
      deposit_deductions: deductions,
    }));
    if (ok) setEditing(false);
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-2">
        <CardTitle>Depósito</CardTitle>
        <StatusBadge tone={status.tone}>{status.label}</StatusBadge>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        <p className="text-2xl font-semibold tabular-nums">{money(deposit.amount, currency)}</p>
        {!editing ? <>
          <dl className="grid grid-cols-2 gap-1">
            <dt className="text-muted-foreground">Recibido</dt><dd className="text-right">{formatDate(deposit.received_at)}</dd>
            {deposit.deductions.map((item, index) => <div key={index} className="contents"><dt className="text-muted-foreground truncate">− {item.description}</dt><dd className="text-right tabular-nums">{money(item.amount, currency)}</dd></div>)}
            {deposit.returned_at && <><dt className="text-muted-foreground">Devuelto el {formatDate(deposit.returned_at)}</dt><dd className="text-right font-medium tabular-nums">{money(deposit.returned_amount, currency)}</dd></>}
          </dl>
          <Button size="sm" variant="outline" onClick={() => {
            setReceivedAt(deposit.received_at ?? ""); setReturnedAt(deposit.returned_at ?? ""); setDeductions(deposit.deductions); setEditing(true);
          }}>{deposit.received_at ? "Registrar devolución" : "Registrar recepción"}</Button>
        </> : <div className="space-y-3">
          <div className="grid gap-2 sm:grid-cols-2">
            <div className="grid gap-1.5"><Label>Recibido el</Label><Input type="date" value={receivedAt} max={today} onChange={(e) => setReceivedAt(e.target.value)} /></div>
            <div className="grid gap-1.5"><Label>Devuelto el</Label><Input type="date" value={returnedAt} max={today} disabled={!receivedAt} onChange={(e) => setReturnedAt(e.target.value)} /></div>
          </div>
          <div className="space-y-2">
            <p className="text-xs font-medium text-muted-foreground">Descuentos</p>
            {deductions.map((item, index) => <div key={index} className="flex gap-2">
              <Input placeholder="Concepto" value={item.description} onChange={(e) => setDeductions(deductions.map((d, i) => i === index ? { ...d, description: e.target.value } : d))} />
              <Input className="w-28" type="number" min={0} step="0.01" value={item.amount || ""} onChange={(e) => setDeductions(deductions.map((d, i) => i === index ? { ...d, amount: Number(e.target.value) } : d))} />
              <Button size="icon" variant="ghost" aria-label="Quitar descuento" onClick={() => setDeductions(deductions.filter((_, i) => i !== index))}><Trash2 /></Button>
            </div>)}
            <Button size="sm" variant="ghost" onClick={() => setDeductions([...deductions, { description: "", amount: 0 }])}><Plus /> Agregar descuento</Button>
          </div>
          <p className={refund < 0 ? "text-danger" : "font-medium"}>A devolver: {money(refund, currency)}</p>
          <div className="flex gap-2">
            <Button size="sm" disabled={!!busy || refund < 0 || deductions.some((d) => !d.description.trim()) || (!!returnedAt && returnedAt < receivedAt)} onClick={save}>
              {busy === "deposit" ? <Loader2 className="size-4 animate-spin" /> : "Guardar"}
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setEditing(false)}>Cancelar</Button>
          </div>
        </div>}
      </CardContent>
    </Card>
  );
}
