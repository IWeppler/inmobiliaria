"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import { Label } from "@/shared/components/ui/label";
import { DatePicker } from "@/shared/components/ui/date-picker";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/shared/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/components/ui/select";
import { createClientBrowser } from "@/lib/supabase-browser";
import { ymdInAppTz } from "@/lib/dates";
import { money } from "@/features/rentals/logic";
import { closeSaleAction } from "./actions";

export type SaleProperty = {
  id: string;
  title: string;
  price: number | null;
  currency: string | null;
  agent_id: string | null;
};

const NONE = "__none__";

// Cierre de venta: precio final, % de comisión de la inmobiliaria y parte
// del agente (sobre la comisión, no sobre el precio). Al guardar, la
// propiedad pasa a VENDIDO y finanzas recibe el ingreso y el egreso.
export function CloseSaleDialog({
  property,
  open,
  onOpenChange,
  onClosed,
}: {
  property: SaleProperty;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Después de guardar (ej. actualizar la fila en una tabla). */
  onClosed?: () => void;
}) {
  const router = useRouter();
  const [agents, setAgents] = useState<{ id: string; full_name: string | null }[]>([]);
  const [soldOn, setSoldOn] = useState(ymdInAppTz());
  const [price, setPrice] = useState(property.price ? String(property.price) : "");
  const [currency, setCurrency] = useState<"ARS" | "USD">(property.currency === "ARS" ? "ARS" : "USD");
  const [commissionPct, setCommissionPct] = useState("3");
  const [agentId, setAgentId] = useState(property.agent_id ?? NONE);
  const [agentPct, setAgentPct] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    createClientBrowser()
      .from("agents")
      .select("id, full_name")
      .order("full_name")
      .then(({ data }) => setAgents(data ?? []));
  }, []);

  const salePrice = Number(price) || 0;
  const commission = (salePrice * (Number(commissionPct) || 0)) / 100;
  const agentCommission = agentId === NONE ? 0 : (commission * (Number(agentPct) || 0)) / 100;
  const valid = salePrice > 0 && commissionPct !== "" && Number(commissionPct) >= 0 && Number(commissionPct) <= 100
    && (Number(agentPct) || 0) <= 100;

  const save = async () => {
    setBusy(true);
    const res = await closeSaleAction({
      property_id: property.id,
      sold_on: soldOn,
      sale_price: salePrice,
      currency,
      commission_pct: Number(commissionPct),
      agent_id: agentId === NONE ? null : agentId,
      agent_commission_pct: Number(agentPct) || 0,
    });
    setBusy(false);
    if (res.success) {
      toast.success(res.message);
      onOpenChange(false);
      onClosed?.();
      router.refresh();
    } else toast.error(res.message);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Cerrar venta</DialogTitle>
          <DialogDescription className="truncate">{property.title}</DialogDescription>
        </DialogHeader>

        <div className="grid min-w-0 gap-4">
          <div className="grid grid-cols-[minmax(0,1fr)_96px] gap-3">
            <div className="grid min-w-0 gap-2">
              <Label htmlFor="sale-price">Precio final</Label>
              <Input id="sale-price" type="number" inputMode="decimal" min="0" value={price} onChange={(e) => setPrice(e.target.value)} />
            </div>
            <div className="grid min-w-0 gap-2">
              <Label>Moneda</Label>
              <Select value={currency} onValueChange={(v) => setCurrency(v as "ARS" | "USD")}>
                <SelectTrigger className="w-full min-w-0"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="USD">USD</SelectItem>
                  <SelectItem value="ARS">ARS</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="grid min-w-0 gap-2">
              <Label htmlFor="sale-date">Fecha de venta</Label>
              <DatePicker id="sale-date" value={soldOn} onChange={setSoldOn} />
            </div>
            <div className="grid min-w-0 gap-2">
              <Label htmlFor="sale-pct">Comisión inmobiliaria %</Label>
              <Input id="sale-pct" type="number" inputMode="decimal" min="0" max="100" step="0.1" value={commissionPct} onChange={(e) => setCommissionPct(e.target.value)} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="grid min-w-0 gap-2">
              <Label>Agente</Label>
              <Select value={agentId} onValueChange={setAgentId}>
                <SelectTrigger className="w-full min-w-0"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>Sin agente</SelectItem>
                  {agents.map((a) => (
                    <SelectItem key={a.id} value={a.id}>{a.full_name ?? "Sin nombre"}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid min-w-0 gap-2">
              <Label htmlFor="sale-agent-pct">% de la comisión al agente</Label>
              <Input
                id="sale-agent-pct"
                type="number"
                inputMode="decimal"
                min="0"
                max="100"
                step="1"
                placeholder="0"
                disabled={agentId === NONE}
                value={agentPct}
                onChange={(e) => setAgentPct(e.target.value)}
              />
            </div>
          </div>

          {/* Resumen de lo que va a finanzas */}
          <dl className="grid gap-1 rounded-md border border-border bg-sunken px-3 py-2.5 text-sm">
            <div className="flex justify-between">
              <dt className="text-fg-secondary">Comisión inmobiliaria</dt>
              <dd className="font-medium tabular-nums">{money(commission, currency)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-fg-secondary">Comisión del agente</dt>
              <dd className="tabular-nums">−{money(agentCommission, currency)}</dd>
            </div>
            <div className="flex justify-between border-t border-border pt-1">
              <dt className="font-medium">Neto para la inmobiliaria</dt>
              <dd className="font-semibold tabular-nums">{money(commission - agentCommission, currency)}</dd>
            </div>
          </dl>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={save} disabled={busy || !valid || !soldOn}>
            {busy ? <Loader2 className="size-4 animate-spin" /> : "Cerrar venta"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
