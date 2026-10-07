"use client";

import { useMemo, useState } from "react";
import { AlertTriangle, CheckCircle2, FileText, Loader2, RefreshCw } from "lucide-react";
import { FaWhatsapp } from "react-icons/fa";
import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import { Label } from "@/shared/components/ui/label";
import { Textarea } from "@/shared/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/shared/components/ui/select";
import { StatusBadge } from "@/shared/components/StatusBadge";
import { cn } from "@/lib/utils";
import { money } from "@/features/rentals/logic";
import { phoneDigits } from "@/features/rentals/tasks";
import { allocate, parseAmount, type ContractCandidate } from "@/features/rentals/reconciliation";
import { KIND_LABELS, KIND_TONE, type InboxAiData, type InboxKind } from "@/features/rentals/inbox";
import {
  confirmInboxPaymentAction, createInboxClaimAction, rejectInboxPaymentAction, resolveInboxAction, retryInboxAiAction,
} from "@/features/rentals/inboxActions";
import { useRunAction } from "@/features/rentals/useRunAction";

export type InboxItemView = {
  id: string;
  receivedAt: string;
  text: string | null;
  mediaUrl: string | null;
  mediaMime: string | null;
  kind: InboxKind;
  summary: string | null;
  data: InboxAiData | null;
  aiError: string | null;
  status: "PENDIENTE" | "CONFIRMADO" | "DESCARTADO" | "RECHAZADO";
  resultNote: string | null;
  resolvedBy: string | null;
  resolvedAt: string | null;
  contractId: string | null;
  currency: string;
  propertyTitle: string | null;
  contactName: string;
  contactRole: string;
  contactPhone: string | null;
  source: "WHATSAPP" | "PORTAL";
};

const EDITABLE_KINDS: InboxKind[] = ["COMPROBANTE", "RECLAMO", "CONSULTA", "OTRO"];
const RESOLVED_LABEL = { PENDIENTE: "Pendiente", CONFIRMADO: "Resuelto", DESCARTADO: "Descartado", RECHAZADO: "Rechazado" } as const;
const RESOLVED_TONE = { PENDIENTE: "warning", CONFIRMADO: "success", DESCARTADO: "neutral", RECHAZADO: "danger" } as const;
const REJECT_REASONS = [
  "No vemos la transferencia en la cuenta",
  "El monto no coincide",
  "No se lee el comprobante",
  "Comprobante repetido",
];

const timeLabel = (iso: string) => new Intl.DateTimeFormat("es-AR", {
  timeZone: "America/Argentina/Buenos_Aires", day: "numeric", month: "numeric", hour: "2-digit", minute: "2-digit", hourCycle: "h23",
}).format(new Date(iso));

export function InboxView({ items, candidates, today, whatsappConfigured }: {
  items: InboxItemView[]; candidates: ContractCandidate[]; today: string; whatsappConfigured: boolean;
}) {
  const [tab, setTab] = useState<"pendientes" | "resueltos">("pendientes");
  const pending = items.filter((i) => i.status === "PENDIENTE");
  const resolved = items.filter((i) => i.status !== "PENDIENTE");
  const byContract = useMemo(() => new Map(candidates.map((c) => [c.id, c])), [candidates]);

  return (
    <div className="space-y-4">
      {!whatsappConfigured && (
        <p className="rounded-lg border border-border bg-muted/40 px-4 py-3 text-sm text-muted-foreground">
          WhatsApp todavía no está conectado: por ahora llegan acá los comprobantes y reclamos enviados desde el portal; cuando se configure WhatsApp, también sus mensajes.
        </p>
      )}
      <div className="flex gap-2">
        {(["pendientes", "resueltos"] as const).map((t) => (
          <button key={t} type="button" onClick={() => setTab(t)} aria-pressed={tab === t}
            className={cn("rounded-md px-3 py-1.5 text-sm font-medium", tab === t ? "bg-muted text-foreground" : "text-muted-foreground hover:text-foreground")}>
            {t === "pendientes" ? "Pendientes" : "Resueltos"}{" "}
            <span className="tabular-nums text-muted-foreground">{t === "pendientes" ? pending.length : resolved.length}</span>
          </button>
        ))}
      </div>

      {tab === "pendientes" && (pending.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border px-4 py-14 text-center">
          <CheckCircle2 className="mx-auto size-8 text-success" aria-hidden />
          <p className="mt-3 font-medium">No hay mensajes pendientes</p>
        </div>
      ) : (
        <ul className="space-y-3">
          {pending.map((item) => (
            <InboxCard key={item.id} item={item} contract={item.contractId ? byContract.get(item.contractId) : undefined} today={today} />
          ))}
        </ul>
      ))}

      {tab === "resueltos" && (
        <ul className="divide-y divide-border-subtle overflow-hidden rounded-lg border border-border bg-card">
          {resolved.length === 0 && <li className="px-4 py-6 text-sm text-muted-foreground">Todavía no hay mensajes resueltos.</li>}
          {resolved.map((item) => (
            <li key={item.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-3 text-sm">
              <StatusBadge tone={RESOLVED_TONE[item.status]}>{RESOLVED_LABEL[item.status]}</StatusBadge>
              <span className="font-medium">{item.contactName}</span>
              <span className="text-muted-foreground">{KIND_LABELS[item.kind]} · {timeLabel(item.receivedAt)}</span>
              <span className="w-full text-xs text-muted-foreground">
                {item.resultNote ?? item.summary ?? item.text}
                {item.resolvedAt && ` · ${item.resolvedBy ?? "Sistema"}, ${timeLabel(item.resolvedAt)}`}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function InboxCard({ item, contract, today }: { item: InboxItemView; contract?: ContractCandidate; today: string }) {
  const { busy, run } = useRunAction();
  const [kind, setKind] = useState<InboxKind>(item.kind === "PENDIENTE_IA" ? (item.mediaUrl ? "COMPROBANTE" : "CONSULTA") : item.kind);
  const payment = item.data?.payment;
  const claim = item.data?.claim;
  const [amount, setAmount] = useState(payment?.amount ? payment.amount.toLocaleString("es-AR", { maximumFractionDigits: 2 }) : "");
  const [date, setDate] = useState(payment?.date && payment.date <= today ? payment.date : item.receivedAt.slice(0, 10));
  const [title, setTitle] = useState(claim?.title ?? "");
  const [description, setDescription] = useState(claim?.description ?? item.text ?? "");
  const [priority, setPriority] = useState<"BAJA" | "MEDIA" | "ALTA" | "URGENTE">(claim?.priority ?? "MEDIA");
  const [reply, setReply] = useState(item.data?.suggested_reply ?? "");
  const [rejecting, setRejecting] = useState(false);
  const [rejectReason, setRejectReason] = useState("");

  const amountValue = parseAmount(amount) ?? 0;
  const preview = contract && amountValue > 0 ? allocate(contract.open, amountValue, date) : null;
  const phone = phoneDigits(item.contactPhone);
  const currencyMismatch = payment?.currency && payment.currency !== item.currency;

  return (
    <li className="rounded-lg border border-border bg-card">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-border-subtle px-4 py-3">
        <span className="text-sm font-medium">{item.contactName}</span>
        <span className="text-xs text-muted-foreground">
          {item.contactRole}{item.propertyTitle ? ` · ${item.propertyTitle}` : ""} · {item.source === "PORTAL" ? "por el portal" : "por WhatsApp"} · {timeLabel(item.receivedAt)}
        </span>
        <span className="ml-auto"><StatusBadge tone={KIND_TONE[item.kind]}>{KIND_LABELS[item.kind]}</StatusBadge></span>
      </div>

      <div className="grid gap-4 p-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
        <div className="min-w-0 space-y-3">
          {item.summary && <p className="text-sm font-medium">{item.summary}</p>}
          {item.text && <p className="whitespace-pre-wrap rounded-md bg-muted/50 px-3 py-2 text-sm">{item.text}</p>}
          {item.mediaUrl && (item.mediaMime?.startsWith("image/") ? (
            <a href={item.mediaUrl} target="_blank" rel="noopener noreferrer" className="block w-fit">
              {/* eslint-disable-next-line @next/next/no-img-element -- URL firmada temporal de storage */}
              <img src={item.mediaUrl} alt="Adjunto del mensaje" className="max-h-64 rounded-md border border-border object-contain" />
            </a>
          ) : (
            <Button asChild size="sm" variant="outline">
              <a href={item.mediaUrl} target="_blank" rel="noopener noreferrer"><FileText className="size-4" /> Ver adjunto</a>
            </Button>
          ))}
          {item.aiError && (
            <p className="flex items-center gap-2 text-xs text-warning">
              <AlertTriangle className="size-3.5" aria-hidden /> {item.aiError}
              <button type="button" className="inline-flex items-center gap-1 underline underline-offset-4" disabled={!!busy}
                onClick={() => run("retry", () => retryInboxAiAction(item.id))}>
                <RefreshCw className="size-3" /> Reintentar
              </button>
            </p>
          )}
        </div>

        <div className="min-w-0 space-y-3">
          <div className="flex items-center gap-2">
            <Label className="shrink-0 text-xs text-muted-foreground">Tratar como</Label>
            <Select value={kind} onValueChange={(v) => setKind(v as InboxKind)}>
              <SelectTrigger className="h-8 w-48"><SelectValue /></SelectTrigger>
              <SelectContent>{EDITABLE_KINDS.map((k) => <SelectItem key={k} value={k}>{KIND_LABELS[k]}</SelectItem>)}</SelectContent>
            </Select>
          </div>

          {!item.contractId && (kind === "COMPROBANTE" || kind === "RECLAMO") && (
            <p className="text-sm text-warning">Este contacto no tiene un contrato vinculado: registralo a mano desde el contrato.</p>
          )}

          {kind === "COMPROBANTE" && item.contractId && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor={`amount-${item.id}`}>Importe ({item.currency})</Label>
                  <Input id={`amount-${item.id}`} inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor={`date-${item.id}`}>Fecha del pago</Label>
                  <Input id={`date-${item.id}`} type="date" max={today} value={date} onChange={(e) => setDate(e.target.value)} />
                </div>
              </div>
              {currencyMismatch && <p className="text-xs text-warning">El comprobante parece estar en {payment?.currency}; el contrato es en {item.currency}.</p>}
              {payment?.payer_name && <p className="text-xs text-muted-foreground">Pagó: {payment.payer_name}{payment.reference ? ` · operación ${payment.reference}` : ""}</p>}
              {preview && (
                <p className={cn("text-xs", preview.leftover > 0 ? "text-warning" : "text-muted-foreground")}>
                  Se imputa a: {preview.allocations.map((a) => `${a.charge.description} (${money(a.amount, item.currency)})`).join(", ") || "sin deuda pendiente"}
                  {preview.leftover > 0 && `. Sobran ${money(preview.leftover, item.currency)}.`}
                </p>
              )}
              {!contract && <p className="text-xs text-muted-foreground">El contrato no tiene deuda pendiente.</p>}
              <div className="flex flex-wrap gap-2">
                <Button size="sm" disabled={!!busy || !(amountValue > 0) || !preview?.allocations.length}
                  onClick={() => run("pay", () => confirmInboxPaymentAction({ inbox_id: item.id, contract_id: item.contractId!, amount: amountValue, date }))}>
                  {busy === "pay" && <Loader2 className="size-4 animate-spin" />} Confirmar e imputar
                </Button>
                {!rejecting && <Button size="sm" variant="outline" disabled={!!busy} onClick={() => setRejecting(true)}>Rechazar</Button>}
              </div>
              {rejecting && (
                <div className="space-y-2 rounded-md border border-border p-3">
                  <Label htmlFor={`reject-${item.id}`}>Motivo del rechazo (lo ve el inquilino)</Label>
                  <div className="flex flex-wrap gap-1.5">
                    {REJECT_REASONS.map((r) => (
                      <button key={r} type="button" onClick={() => setRejectReason(r)} aria-pressed={rejectReason === r}
                        className={cn("rounded-md border border-border px-2 py-0.5 text-xs", rejectReason === r ? "bg-muted text-foreground" : "text-muted-foreground hover:bg-muted")}>
                        {r}
                      </button>
                    ))}
                  </div>
                  <Input id={`reject-${item.id}`} value={rejectReason} onChange={(e) => setRejectReason(e.target.value)} maxLength={300} />
                  <div className="flex flex-wrap justify-end gap-2">
                    <Button size="sm" variant="ghost" onClick={() => setRejecting(false)}>Cancelar</Button>
                    {phone && rejectReason.trim().length >= 3 && (
                      <Button asChild size="sm" variant="outline">
                        <a href={`https://wa.me/${phone}?text=${encodeURIComponent(`Hola ${item.contactName.split(" ")[0]}, no pudimos registrar el pago que informaste: ${rejectReason.trim()}. ¿Nos lo revisás?`)}`}
                          target="_blank" rel="noopener noreferrer"><FaWhatsapp className="size-4" aria-hidden /> Avisar</a>
                      </Button>
                    )}
                    <Button size="sm" variant="destructive" disabled={!!busy || rejectReason.trim().length < 3}
                      onClick={() => run("reject", () => rejectInboxPaymentAction({ inbox_id: item.id, reason: rejectReason }))}>
                      {busy === "reject" && <Loader2 className="size-4 animate-spin" />} Rechazar pago
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}

          {kind === "RECLAMO" && item.contractId && (
            <div className="space-y-3">
              <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_9rem]">
                <div className="space-y-1.5">
                  <Label htmlFor={`title-${item.id}`}>Reclamo</Label>
                  <Input id={`title-${item.id}`} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Ej.: Pérdida de agua en el baño" />
                </div>
                <div className="space-y-1.5">
                  <Label>Prioridad</Label>
                  <Select value={priority} onValueChange={(v) => setPriority(v as typeof priority)}>
                    <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {(["BAJA", "MEDIA", "ALTA", "URGENTE"] as const).map((p) => <SelectItem key={p} value={p}>{p[0] + p.slice(1).toLowerCase()}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <Textarea rows={3} value={description} onChange={(e) => setDescription(e.target.value)} aria-label="Descripción del reclamo" />
              <Button size="sm" disabled={!!busy || title.trim().length < 3}
                onClick={() => run("claim", () => createInboxClaimAction({ inbox_id: item.id, contract_id: item.contractId!, title, description, priority }))}>
                {busy === "claim" && <Loader2 className="size-4 animate-spin" />} Crear reclamo
              </Button>
            </div>
          )}

          {(kind === "CONSULTA" || kind === "OTRO") && (
            <div className="space-y-3">
              <Textarea rows={3} value={reply} onChange={(e) => setReply(e.target.value)} placeholder="Respuesta" aria-label="Respuesta" />
              <div className="flex flex-wrap gap-2">
                {phone && reply.trim() && (
                  <Button asChild size="sm" variant="outline">
                    <a href={`https://wa.me/${phone}?text=${encodeURIComponent(reply)}`} target="_blank" rel="noopener noreferrer">
                      <FaWhatsapp className="size-4" aria-hidden /> Responder
                    </a>
                  </Button>
                )}
                <Button size="sm" disabled={!!busy}
                  onClick={() => run("done", () => resolveInboxAction({ inbox_id: item.id, status: "CONFIRMADO", note: reply ? `Respondido: ${reply}` : "Resuelto" }))}>
                  Marcar resuelto
                </Button>
              </div>
            </div>
          )}

          <div className="flex justify-end border-t border-border-subtle pt-3">
            <Button size="sm" variant="ghost" disabled={!!busy}
              onClick={() => run("discard", () => resolveInboxAction({ inbox_id: item.id, status: "DESCARTADO" }))}>
              Descartar
            </Button>
          </div>
        </div>
      </div>
    </li>
  );
}
