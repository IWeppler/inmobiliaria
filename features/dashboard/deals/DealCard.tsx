"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Copy, Handshake, Loader2, Share2 } from "lucide-react";
import { FaWhatsapp } from "react-icons/fa";
import { phoneDigits } from "@/features/rentals/tasks";
import { createDealLinkAction, revokeDealLinkAction } from "@/features/dashboard/deals/dealPortalActions";
import { Button } from "@/shared/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/components/ui/card";
import { Input } from "@/shared/components/ui/input";
import { Label } from "@/shared/components/ui/label";
import { Checkbox } from "@/shared/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/shared/components/ui/select";
import { StatusBadge } from "@/shared/components/StatusBadge";
import { cn } from "@/lib/utils";
import { addDays, ymdInAppTz } from "@/lib/dates";
import { daysBetween, formatDate, money } from "@/features/rentals/logic";
import { parseAmount } from "@/features/rentals/reconciliation";
import type { LeadWithDetails } from "@/app/types";
import { CloseSaleDialog } from "@/features/finances/CloseSaleDialog";
import {
  DEAL_CHECKLIST, DEAL_STAGE_LABELS, DEAL_STAGE_TONE, LOAN_STATUS_LABELS, checklistProgress, dealDueDate, dealSteps, nextDealStage,
  type DealChecklist, type DealStage,
} from "@/features/dashboard/deals/deal";
import {
  advanceDealAction, dropDealAction, startDealAction, toggleDealChecklistAction, updateDealAction,
} from "@/features/dashboard/deals/dealActions";

type Lead = LeadWithDetails;

// Postventa en el detalle del lead: de la reserva a la escritura, con la
// fecha que importa en cada etapa, su checklist y el paso siguiente.
export type DealLinkInfo = { created_at: string; expires_at: string; last_viewed_at: string | null; view_count: number };

export function DealCard({ lead, link }: { lead: Lead; link: DealLinkInfo | null }) {
  const router = useRouter();
  const stage = lead.deal_stage as DealStage | null;
  const property = lead.properties;
  const isRental = property?.operation_type?.toLowerCase() === "alquiler";

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-2 pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Handshake className="size-4 text-muted-foreground" aria-hidden /> Operación
        </CardTitle>
        {stage && <StatusBadge tone={DEAL_STAGE_TONE[stage]}>{DEAL_STAGE_LABELS[stage]}</StatusBadge>}
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        {!property ? (
          <p className="text-muted-foreground">Asigná la propiedad de interés para registrar una reserva.</p>
        ) : isRental ? (
          <p className="text-muted-foreground">
            En alquileres la operación sigue en el contrato.{" "}
            <Link href={`/dashboard/alquileres/nuevo?propiedad=${property.id}`} className="font-medium text-foreground underline-offset-4 hover:underline">Cargar contrato</Link>
          </p>
        ) : !stage || stage === "CAIDA" ? (
          <>
            {stage === "CAIDA" && lead.deal_lost_reason && (
              <p className="rounded-md bg-muted/60 px-3 py-2 text-xs text-muted-foreground">Operación anterior caída: {lead.deal_lost_reason}</p>
            )}
            <StartDeal lead={lead} onDone={() => router.refresh()} />
          </>
        ) : (
          <>
            <ActiveDeal lead={lead} stage={stage} onDone={() => router.refresh()} />
            <BuyerPortal lead={lead} link={link} />
          </>
        )}
      </CardContent>
    </Card>
  );
}

// Link privado para que el comprador siga su compra (/operacion/[token]).
// El link completo se muestra una sola vez, al generarlo.
function BuyerPortal({ lead, link }: { lead: Lead; link: DealLinkInfo | null }) {
  const router = useRouter();
  const [url, setUrl] = useState<string | null>(null);
  const [busy, setBusy] = useState<"create" | "revoke" | null>(null);
  const phone = phoneDigits(lead.phone);

  const create = async () => {
    setBusy("create");
    const res = await createDealLinkAction(lead.id);
    setBusy(null);
    if (!res.success || !res.data) { toast.error(res.message); return; }
    setUrl(res.data.url);
    await navigator.clipboard?.writeText(res.data.url).catch(() => {});
    toast.success("Link generado y copiado.");
    router.refresh();
  };
  const revoke = async () => {
    setBusy("revoke");
    const res = await revokeDealLinkAction(lead.id);
    setBusy(null);
    if (!res.success) { toast.error(res.message); return; }
    setUrl(null);
    toast.success(res.message);
    router.refresh();
  };
  const message = url ? `Hola ${lead.name.split(" ")[0]}, acá podés seguir cómo va tu compra, con las fechas y lo que falta: ${url}` : "";

  return (
    <div className="space-y-2 border-t border-border-subtle pt-3">
      <p className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground"><Share2 className="size-3.5" aria-hidden /> Portal del comprador</p>
      {url ? (
        <div className="space-y-2">
          <Input readOnly value={url} onFocus={(e) => e.currentTarget.select()} aria-label="Link del portal del comprador" className="text-xs" />
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="outline" onClick={() => navigator.clipboard?.writeText(url).then(() => toast.success("Copiado."))}>
              <Copy className="size-4" /> Copiar
            </Button>
            {phone && (
              <Button asChild size="sm" variant="outline">
                <a href={`https://wa.me/${phone}?text=${encodeURIComponent(message)}`} target="_blank" rel="noopener noreferrer"><FaWhatsapp className="size-4" aria-hidden /> Enviar</a>
              </Button>
            )}
          </div>
          <p className="text-xs text-muted-foreground">Copialo ahora: por seguridad no se vuelve a mostrar.</p>
        </div>
      ) : link ? (
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground">
            Link activo desde el {formatDate(link.created_at.slice(0, 10))} ·{" "}
            {link.view_count ? `visto ${link.view_count} ${link.view_count === 1 ? "vez" : "veces"}, la última el ${formatDate((link.last_viewed_at ?? link.created_at).slice(0, 10))}` : "todavía no lo abrió"}
          </p>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="outline" disabled={!!busy} onClick={create}>{busy === "create" && <Loader2 className="size-4 animate-spin" />} Generar uno nuevo</Button>
            <Button size="sm" variant="ghost" disabled={!!busy} onClick={revoke}>Revocar</Button>
          </div>
        </div>
      ) : (
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground">Un link para que el comprador vea la etapa, las fechas y qué falta, sin tener que preguntar.</p>
          <Button size="sm" variant="outline" disabled={!!busy} onClick={create}>{busy === "create" && <Loader2 className="size-4 animate-spin" />} Generar link</Button>
        </div>
      )}
    </div>
  );
}

function StartDeal({ lead, onDone }: { lead: Lead; onDone: () => void }) {
  const today = ymdInAppTz();
  const property = lead.properties!;
  const [open, setOpen] = useState(false);
  const [price, setPrice] = useState(property.price ? property.price.toLocaleString("es-AR") : "");
  const [currency, setCurrency] = useState<"ARS" | "USD">(property.currency === "ARS" ? "ARS" : "USD");
  const [amount, setAmount] = useState("");
  const [signed, setSigned] = useState(today);
  const [expires, setExpires] = useState(addDays(today, 15));
  const [financing, setFinancing] = useState(false);
  const [busy, setBusy] = useState(false);

  if (!open) {
    return (
      <div className="space-y-2">
        <p className="text-muted-foreground">Cuando el comprador reserve, registralo acá para seguir boleto y escritura.</p>
        <Button size="sm" variant="outline" onClick={() => setOpen(true)}>Registrar reserva</Button>
      </div>
    );
  }

  const save = async () => {
    const dealPrice = parseAmount(price);
    if (!dealPrice || dealPrice <= 0) { toast.error("Indicá el precio acordado."); return; }
    setBusy(true);
    const res = await startDealAction({
      lead_id: lead.id, property_id: property.id, deal_price: dealPrice, deal_currency: currency,
      reserva_at: signed, reserva_amount: parseAmount(amount) ?? 0, reserva_expires_at: expires, deal_financing: financing,
    });
    setBusy(false);
    if (!res.success) { toast.error(res.message); return; }
    toast.success(res.message);
    onDone();
  };

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-[minmax(0,1fr)_5.5rem] gap-2">
        <div className="space-y-1.5"><Label htmlFor="deal-price">Precio acordado</Label><Input id="deal-price" inputMode="decimal" value={price} onChange={(e) => setPrice(e.target.value)} /></div>
        <div className="space-y-1.5">
          <Label>Moneda</Label>
          <Select value={currency} onValueChange={(v) => setCurrency(v as "ARS" | "USD")}>
            <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
            <SelectContent><SelectItem value="USD">USD</SelectItem><SelectItem value="ARS">ARS</SelectItem></SelectContent>
          </Select>
        </div>
      </div>
      <div className="space-y-1.5"><Label htmlFor="deal-reserva">Monto de la reserva</Label><Input id="deal-reserva" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} /></div>
      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-1.5"><Label htmlFor="deal-signed">Firmada el</Label><Input id="deal-signed" type="date" max={today} value={signed} onChange={(e) => setSigned(e.target.value)} /></div>
        <div className="space-y-1.5"><Label htmlFor="deal-expires">Vence el</Label><Input id="deal-expires" type="date" min={signed} value={expires} onChange={(e) => setExpires(e.target.value)} /></div>
      </div>
      <label className="flex items-center gap-2 text-sm">
        <Checkbox checked={financing} onCheckedChange={(c) => setFinancing(c === true)} /> Compra con crédito hipotecario
      </label>
      <div className="flex justify-end gap-2">
        <Button size="sm" variant="ghost" onClick={() => setOpen(false)}>Cancelar</Button>
        <Button size="sm" disabled={busy} onClick={save}>{busy && <Loader2 className="size-4 animate-spin" />} Guardar reserva</Button>
      </div>
    </div>
  );
}

function ActiveDeal({ lead, stage, onDone }: { lead: Lead; stage: DealStage; onDone: () => void }) {
  const today = ymdInAppTz();
  const [busy, setBusy] = useState<string | null>(null);
  const [dropping, setDropping] = useState(false);
  const [reason, setReason] = useState("");
  const [saleOpen, setSaleOpen] = useState(false);
  const checklist = (lead.deal_checklist as DealChecklist) ?? {};
  const steps = dealSteps(lead.deal_financing);
  const next = nextDealStage(stage, lead.deal_financing);
  const due = dealDueDate(lead);
  const days = due.date ? daysBetween(today, due.date) : null;
  const progress = checklistProgress(stage, checklist);
  const currency = lead.deal_currency ?? "USD";
  const property = lead.properties!;
  const saleRegistered = property.status === "VENDIDO";

  // Datos que pide la etapa siguiente.
  const [boleto, setBoleto] = useState(lead.boleto_at ?? addDays(today, 15));
  const [escritura, setEscritura] = useState(lead.escritura_at ?? addDays(today, 30));
  const [escribano, setEscribano] = useState(lead.escribano ?? "");
  const [bank, setBank] = useState(lead.deal_bank ?? "");

  const run = async (key: string, fn: () => Promise<{ success: boolean; message: string }>, after?: () => void) => {
    setBusy(key);
    const res = await fn();
    setBusy(null);
    if (!res.success) { toast.error(res.message); return; }
    if (res.message) toast.success(res.message);
    after?.();
    onDone();
  };

  return (
    <div className="space-y-3">
      {/* Etapas */}
      <ol className="flex flex-wrap items-center gap-1 text-xs">
        {steps.map((s, i) => {
          const reached = steps.indexOf(stage) >= i;
          return (
            <li key={s} className={cn("rounded px-1.5 py-0.5", s === stage ? "bg-primary/10 font-medium text-foreground" : reached ? "text-foreground" : "text-muted-foreground")}>
              {DEAL_STAGE_LABELS[s]}{i < steps.length - 1 && <span className="ml-1 text-muted-foreground">›</span>}
            </li>
          );
        })}
      </ol>

      <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm">
        <dt className="text-muted-foreground">Precio</dt><dd className="text-right font-medium tabular-nums">{money(lead.deal_price, currency)}</dd>
        {!!lead.reserva_amount && <><dt className="text-muted-foreground">Reserva</dt><dd className="text-right tabular-nums">{money(lead.reserva_amount, currency)}</dd></>}
        {lead.deal_financing && <><dt className="text-muted-foreground">Crédito</dt><dd className="text-right">{[lead.deal_bank, lead.deal_loan_status ? LOAN_STATUS_LABELS[lead.deal_loan_status] : null].filter(Boolean).join(" · ") || "Sin datos"}</dd></>}
        {lead.escribano && <><dt className="text-muted-foreground">Escribano</dt><dd className="text-right">{lead.escribano}</dd></>}
        {due.date && (
          <>
            <dt className="text-muted-foreground">{due.label}</dt>
            <dd className={cn("text-right", days !== null && days < 0 ? "font-medium text-danger" : days !== null && days <= 3 ? "font-medium text-warning" : "")}>
              {formatDate(due.date)}{days !== null && ` (${days < 0 ? `hace ${-days} días` : days === 0 ? "hoy" : `en ${days} días`})`}
            </dd>
          </>
        )}
      </dl>

      {stage === "ESCRITURADA" ? (
        <div className="space-y-2 border-t border-border-subtle pt-3">
          <p className="text-success">Escriturada el {formatDate(lead.escritura_at)}.</p>
          {saleRegistered ? (
            <p className="text-xs text-muted-foreground">La venta ya está registrada en Finanzas.</p>
          ) : (
            <>
              <Button size="sm" onClick={() => setSaleOpen(true)}>Registrar la venta</Button>
              <p className="text-xs text-muted-foreground">Carga la comisión en Finanzas y marca la propiedad como vendida.</p>
              <CloseSaleDialog open={saleOpen} onOpenChange={setSaleOpen} onClosed={onDone}
                property={{ id: property.id, title: property.title, price: lead.deal_price, currency, agent_id: property.agent_id ?? lead.agent_id }} />
            </>
          )}
        </div>
      ) : (
        <>
          {progress.total > 0 && (
            <div className="space-y-1.5 border-t border-border-subtle pt-3">
              <p className="text-xs font-medium text-muted-foreground">Para esta etapa · {progress.done}/{progress.total}</p>
              {DEAL_CHECKLIST[stage as keyof typeof DEAL_CHECKLIST].map((item) => (
                <label key={item.key} className="flex items-center gap-2">
                  <Checkbox checked={!!checklist[item.key]} disabled={busy === item.key}
                    onCheckedChange={(c) => run(item.key, () => toggleDealChecklistAction({ lead_id: lead.id, key: item.key, done: c === true }))} />
                  <span className={cn(checklist[item.key] && "text-muted-foreground line-through")}>{item.label}</span>
                </label>
              ))}
            </div>
          )}

          {next && (
            <div className="space-y-2 border-t border-border-subtle pt-3">
              {next === "BOLETO" && (
                <div className="space-y-1.5"><Label htmlFor="deal-boleto">Firma del boleto (prevista)</Label><Input id="deal-boleto" type="date" value={boleto} onChange={(e) => setBoleto(e.target.value)} /></div>
              )}
              {next === "FINANCIACION" && (
                <div className="space-y-1.5"><Label htmlFor="deal-bank">Banco</Label><Input id="deal-bank" value={bank} onChange={(e) => setBank(e.target.value)} placeholder="Ej.: Banco Nación" /></div>
              )}
              {next === "ESCRITURA" && (
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1.5"><Label htmlFor="deal-escritura">Escritura (prevista)</Label><Input id="deal-escritura" type="date" value={escritura} onChange={(e) => setEscritura(e.target.value)} /></div>
                  <div className="space-y-1.5"><Label htmlFor="deal-escribano">Escribano</Label><Input id="deal-escribano" value={escribano} onChange={(e) => setEscribano(e.target.value)} /></div>
                </div>
              )}
              <Button size="sm" disabled={!!busy}
                onClick={() => run("advance", () => advanceDealAction({
                  lead_id: lead.id, boleto_at: boleto, escritura_at: escritura, escribano: escribano || undefined, deal_bank: bank || undefined,
                }))}>
                {busy === "advance" && <Loader2 className="size-4 animate-spin" />}
                {next === "ESCRITURADA" ? "Escritura firmada" : `Pasar a ${DEAL_STAGE_LABELS[next]}`}
              </Button>
              {progress.pending.length > 0 && <p className="text-xs text-muted-foreground">Quedan {progress.pending.length} pasos del checklist sin marcar.</p>}
            </div>
          )}

          {stage === "FINANCIACION" && (
            <div className="flex items-center gap-2 text-xs">
              <span className="text-muted-foreground">Estado del crédito</span>
              <Select value={lead.deal_loan_status ?? "EN_TRAMITE"}
                onValueChange={(v) => run("loan", () => updateDealAction({ lead_id: lead.id, deal_loan_status: v as "EN_TRAMITE" | "APROBADO" | "RECHAZADO" }))}>
                <SelectTrigger className="h-7 w-32 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>{Object.entries(LOAN_STATUS_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          )}

          <div className="border-t border-border-subtle pt-3">
            {!dropping ? (
              <button type="button" className="text-xs text-muted-foreground underline-offset-4 hover:text-danger hover:underline" onClick={() => setDropping(true)}>
                La operación se cayó
              </button>
            ) : (
              <div className="space-y-2">
                <Input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Qué pasó (ej.: no aprobaron el crédito)" maxLength={500} aria-label="Motivo de la caída" />
                <div className="flex justify-end gap-2">
                  <Button size="sm" variant="ghost" onClick={() => setDropping(false)}>Cancelar</Button>
                  <Button size="sm" variant="destructive" disabled={!!busy || reason.trim().length < 3}
                    onClick={() => run("drop", () => dropDealAction({ lead_id: lead.id, reason }), () => setDropping(false))}>
                    Marcar caída
                  </Button>
                </div>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
