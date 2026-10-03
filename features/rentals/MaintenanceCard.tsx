"use client";

import { useState } from "react";
import { Loader2, Plus, Receipt, Wrench } from "lucide-react";
import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import { Label } from "@/shared/components/ui/label";
import { Textarea } from "@/shared/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/shared/components/ui/select";
import { StatusBadge, type StatusTone } from "@/shared/components/StatusBadge";
import { billMaintenanceToTenantAction, saveMaintenanceAction } from "@/features/rentals/lifecycleActions";
import { formatDate, money } from "@/features/rentals/logic";
import { useRunAction } from "@/features/rentals/useRunAction";

type Priority = "BAJA" | "MEDIA" | "ALTA" | "URGENTE";
type Status = "ABIERTO" | "EN_CURSO" | "RESUELTO" | "CANCELADO";
type Payer = "INQUILINO" | "PROPIETARIO" | "INMOBILIARIA";

export type MaintenanceItem = {
  id: string; title: string; description: string | null; priority: Priority; status: Status;
  payer: Payer | null; provider: string | null; cost: number | null; reported_at: string;
  resolved_at: string | null; charge_id: string | null;
};

export const MAINTENANCE_STATUS: Record<Status, { label: string; tone: StatusTone }> = {
  ABIERTO: { label: "Abierto", tone: "warning" },
  EN_CURSO: { label: "En curso", tone: "info" },
  RESUELTO: { label: "Resuelto", tone: "success" },
  CANCELADO: { label: "Cancelado", tone: "neutral" },
};
const PRIORITY_LABELS: Record<Priority, string> = { BAJA: "Baja", MEDIA: "Media", ALTA: "Alta", URGENTE: "Urgente" };
const PAYER_LABELS: Record<Payer, string> = { INQUILINO: "Inquilino", PROPIETARIO: "Propietario", INMOBILIARIA: "Inmobiliaria" };
const NONE = "__none__";

type Draft = {
  id?: string; title: string; description: string; priority: Priority; status: Status;
  payer: Payer | null; provider: string; cost: number | null; reported_at: string;
};

export function MaintenanceCard({ contractId, currency, items, today }: {
  contractId: string; currency: string; items: MaintenanceItem[]; today: string;
}) {
  const { busy, run } = useRunAction();
  const [draft, setDraft] = useState<Draft | null>(null);
  const [showClosed, setShowClosed] = useState(false);

  const open = items.filter((item) => item.status === "ABIERTO" || item.status === "EN_CURSO");
  const visible = showClosed ? items : open;
  const set = <K extends keyof Draft>(key: K, value: Draft[K]) => setDraft((prev) => prev && { ...prev, [key]: value });

  const edit = (item?: MaintenanceItem) => setDraft(item ? {
    id: item.id, title: item.title, description: item.description ?? "", priority: item.priority, status: item.status,
    payer: item.payer, provider: item.provider ?? "", cost: item.cost, reported_at: item.reported_at,
  } : {
    title: "", description: "", priority: "MEDIA", status: "ABIERTO", payer: null, provider: "", cost: null, reported_at: today,
  });

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-2">
        <CardTitle className="flex items-center gap-2"><Wrench className="size-4" /> Mantenimiento</CardTitle>
        {!draft && <Button size="sm" variant="outline" onClick={() => edit()}><Plus /> Nuevo reclamo</Button>}
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        {draft && <div className="space-y-3 rounded-md border border-border p-3">
          <div className="grid gap-2 sm:grid-cols-2">
            <div className="grid gap-1.5 sm:col-span-2"><Label>Título</Label><Input value={draft.title} placeholder="Pérdida en el baño" onChange={(e) => set("title", e.target.value)} /></div>
            <div className="grid gap-1.5 sm:col-span-2"><Label>Detalle</Label><Textarea rows={2} value={draft.description} onChange={(e) => set("description", e.target.value)} /></div>
            <div className="grid gap-1.5"><Label>Prioridad</Label><Select value={draft.priority} onValueChange={(v) => set("priority", v as Priority)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{(Object.keys(PRIORITY_LABELS) as Priority[]).map((k) => <SelectItem key={k} value={k}>{PRIORITY_LABELS[k]}</SelectItem>)}</SelectContent></Select></div>
            <div className="grid gap-1.5"><Label>Estado</Label><Select value={draft.status} onValueChange={(v) => set("status", v as Status)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{(Object.keys(MAINTENANCE_STATUS) as Status[]).map((k) => <SelectItem key={k} value={k}>{MAINTENANCE_STATUS[k].label}</SelectItem>)}</SelectContent></Select></div>
            <div className="grid gap-1.5"><Label>Reportado</Label><Input type="date" max={today} value={draft.reported_at} onChange={(e) => set("reported_at", e.target.value)} /></div>
            <div className="grid gap-1.5"><Label>Proveedor</Label><Input value={draft.provider} placeholder="Plomero, gasista…" onChange={(e) => set("provider", e.target.value)} /></div>
            <div className="grid gap-1.5"><Label>Costo ({currency})</Label><Input type="number" min={0} step="0.01" value={draft.cost ?? ""} onChange={(e) => set("cost", e.target.value === "" ? null : Number(e.target.value))} /></div>
            <div className="grid gap-1.5"><Label>A cargo de</Label><Select value={draft.payer ?? NONE} onValueChange={(v) => set("payer", v === NONE ? null : v as Payer)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value={NONE}>A definir</SelectItem>{(Object.keys(PAYER_LABELS) as Payer[]).map((k) => <SelectItem key={k} value={k}>{PAYER_LABELS[k]}</SelectItem>)}</SelectContent></Select></div>
          </div>
          {draft.payer === "PROPIETARIO" && <p className="text-xs text-muted-foreground">Agregalo como gasto al generar la liquidación del propietario.</p>}
          <div className="flex gap-2">
            <Button size="sm" disabled={!!busy || draft.title.trim().length < 3} onClick={async () => {
              const ok = await run("maintenance", () => saveMaintenanceAction({ contract_id: contractId, ...draft }));
              if (ok) setDraft(null);
            }}>{busy === "maintenance" ? <Loader2 className="size-4 animate-spin" /> : "Guardar"}</Button>
            <Button size="sm" variant="ghost" onClick={() => setDraft(null)}>Cancelar</Button>
          </div>
        </div>}

        {visible.length === 0 && !draft && <p className="text-muted-foreground">{open.length === 0 && items.length > 0 ? "Sin reclamos abiertos." : "Todavía no hay reclamos."}</p>}
        {visible.map((item) => {
          const status = MAINTENANCE_STATUS[item.status];
          const billable = item.payer === "INQUILINO" && (item.cost ?? 0) > 0 && !item.charge_id;
          return (
            <div key={item.id} className="rounded-md border border-border p-3">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <button type="button" className="min-w-0 text-left" onClick={() => edit(item)}>
                  <p className="font-medium hover:underline">{item.title}</p>
                  <p className="text-xs text-muted-foreground">
                    {formatDate(item.reported_at)} · prioridad {PRIORITY_LABELS[item.priority].toLowerCase()}
                    {item.provider ? ` · ${item.provider}` : ""}
                    {item.payer ? ` · a cargo de ${PAYER_LABELS[item.payer].toLowerCase()}` : ""}
                  </p>
                </button>
                <div className="flex items-center gap-2">
                  {item.cost != null && <span className="tabular-nums">{money(item.cost, currency)}</span>}
                  <StatusBadge tone={item.priority === "URGENTE" && status.tone === "warning" ? "danger" : status.tone}>{status.label}</StatusBadge>
                </div>
              </div>
              {item.description && <p className="mt-2 whitespace-pre-line text-muted-foreground">{item.description}</p>}
              {billable && <Button className="mt-2" size="sm" variant="outline" disabled={!!busy}
                onClick={() => run(`bill-${item.id}`, () => billMaintenanceToTenantAction(item.id))}><Receipt /> Cargar al inquilino</Button>}
              {item.charge_id && <p className="mt-2 text-xs text-muted-foreground">Cargado en la cuenta corriente del inquilino.</p>}
            </div>
          );
        })}
        {items.length > open.length && <button type="button" className="text-xs text-muted-foreground underline-offset-4 hover:underline" onClick={() => setShowClosed((p) => !p)}>
          {showClosed ? "Ocultar cerrados" : `Ver ${items.length - open.length} cerrados`}
        </button>}
      </CardContent>
    </Card>
  );
}
