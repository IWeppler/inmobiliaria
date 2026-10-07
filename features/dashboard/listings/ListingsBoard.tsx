"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { AlertCircle, CalendarClock, Loader2, Plus } from "lucide-react";
import { FaWhatsapp } from "react-icons/fa";
import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import { Label } from "@/shared/components/ui/label";
import { Textarea } from "@/shared/components/ui/textarea";
import { Checkbox } from "@/shared/components/ui/checkbox";
import { Combobox } from "@/shared/components/ui/combobox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/shared/components/ui/dialog";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/shared/components/ui/sheet";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/shared/components/ui/select";
import { StatusBadge } from "@/shared/components/StatusBadge";
import { cn } from "@/lib/utils";
import { addDays } from "@/lib/dates";
import { formatDate, money } from "@/features/rentals/logic";
import { phoneDigits } from "@/features/rentals/tasks";
import { parseAmount } from "@/features/rentals/reconciliation";
import { useRunAction } from "@/features/rentals/useRunAction";
import {
  LISTING_LOST_REASONS, LISTING_PIPELINE, LISTING_SOURCES, LISTING_STAGE_HINT, LISTING_STAGE_LABELS, LISTING_STAGE_TONE,
  defaultAuthorizationExpiry, isPipelineStage, listingAlerts, priceGap, type ListingStage,
} from "@/features/dashboard/listings/listing";
import {
  createProspectAction, deleteProspectAction, moveProspectAction, publishProspectAction, updateProspectAction,
} from "@/features/dashboard/listings/listingActions";

export type Prospect = {
  id: string; owner_name: string; owner_phone: string | null; owner_email: string | null;
  address: string | null; city: string | null; operation: string; property_type_id: number | null;
  stage: string; source: string | null; appraisal_value: number | null; owner_price: number | null; currency: string;
  commission_pct: number | null; exclusive: boolean; authorization_signed_at: string | null; authorization_expires_at: string | null;
  property_id: string | null; next_action: string | null; next_action_at: string | null; lost_reason: string | null;
  notes: string | null; stage_changed_at: string; created_at: string;
  agent: { full_name: string } | null;
  property: { id: string; title: string } | null;
};
type Option = { id: string | number; name: string };

const NO_TYPE = "none";
const urgencyStyle = { alta: "text-danger", media: "text-warning", baja: "text-muted-foreground" } as const;

// Tablero de captaciones: una columna por etapa; el detalle se abre al
// costado para editar, avanzar de etapa o publicar.
export function ListingsBoard({ prospects, propertyTypes, properties, today, showAgent, initialCreateOpen, initialSelectedId }: {
  prospects: Prospect[]; propertyTypes: Option[]; properties: Option[]; today: string; showAgent: boolean; initialCreateOpen: boolean; initialSelectedId: string | null;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [creating, setCreating] = useState(initialCreateOpen);
  const [selectedId, setSelectedId] = useState<string | null>(initialSelectedId);
  const selected = prospects.find((p) => p.id === selectedId) ?? null;
  const active = prospects.filter((p) => isPipelineStage(p.stage));
  const finished = prospects.filter((p) => !isPipelineStage(p.stage));
  const typeName = (id: number | null) => propertyTypes.find((t) => t.id === id)?.name;

  const closeCreate = (open: boolean) => {
    setCreating(open);
    // Llegó con ?nueva=1 (Ctrl+K): se limpia para que un refresh no la reabra.
    if (!open && initialCreateOpen) router.replace(pathname);
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-end">
        <Button onClick={() => setCreating(true)}><Plus className="size-4" /> Nueva captación</Button>
      </div>

      <div className="-mx-4 overflow-x-auto px-4 md:mx-0 md:px-0">
        <div className="grid min-w-[880px] grid-cols-4 gap-3">
          {LISTING_PIPELINE.map((stage) => {
            const items = active.filter((p) => p.stage === stage);
            return (
              <section key={stage} className="flex min-w-0 flex-col rounded-lg bg-muted/40 p-2" aria-label={LISTING_STAGE_LABELS[stage]}>
                <h2 className="px-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  <span className="flex items-center justify-between">{LISTING_STAGE_LABELS[stage]} <span className="tabular-nums">{items.length}</span></span>
                </h2>
                <p className="px-1.5 pb-2 text-xs text-muted-foreground">{LISTING_STAGE_HINT[stage]}</p>
                <ul className="space-y-2">
                  {items.map((p) => {
                    const alert = listingAlerts(p, today)[0];
                    const price = p.appraisal_value ?? p.owner_price;
                    return (
                      <li key={p.id}>
                        <button type="button" onClick={() => setSelectedId(p.id)}
                          className="block w-full space-y-1 rounded-md border border-border bg-card p-3 text-left text-sm shadow-xs transition-colors hover:border-primary/40">
                          <span className="flex items-start justify-between gap-2">
                            <span className="min-w-0 truncate font-medium">{p.owner_name}</span>
                            {price && <span className="shrink-0 text-xs tabular-nums text-muted-foreground">{money(price, p.currency)}</span>}
                          </span>
                          <span className="block truncate text-xs text-muted-foreground">
                            {[p.address, p.city].filter(Boolean).join(", ") || "Sin dirección"} · {[typeName(p.property_type_id), p.operation].filter(Boolean).join(" en ")}
                          </span>
                          {alert ? (
                            <span className={cn("flex items-center gap-1 text-xs", urgencyStyle[alert.urgency])}>
                              <AlertCircle className="size-3.5 shrink-0" aria-hidden /><span className="truncate">{alert.text}</span>
                            </span>
                          ) : p.next_action ? (
                            <span className="flex items-center gap-1 text-xs text-muted-foreground">
                              <CalendarClock className="size-3.5 shrink-0" aria-hidden />
                              <span className="truncate">{p.next_action}{p.next_action_at && ` · ${formatDate(p.next_action_at)}`}</span>
                            </span>
                          ) : null}
                          {showAgent && p.agent && <span className="block truncate text-xs text-muted-foreground">{p.agent.full_name}</span>}
                        </button>
                      </li>
                    );
                  })}
                  {items.length === 0 && <li className="px-1.5 py-3 text-xs text-muted-foreground">Nada en esta etapa.</li>}
                </ul>
              </section>
            );
          })}
        </div>
      </div>

      {finished.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-sm font-semibold">Publicadas y perdidas (últimos 90 días)</h2>
          <ul className="divide-y divide-border-subtle rounded-lg border border-border bg-card">
            {finished.map((p) => (
              <li key={p.id}>
                <button type="button" onClick={() => setSelectedId(p.id)} className="flex w-full flex-wrap items-center gap-x-3 gap-y-1 px-4 py-2.5 text-left text-sm hover:bg-muted/40">
                  <StatusBadge tone={LISTING_STAGE_TONE[p.stage as ListingStage]}>{LISTING_STAGE_LABELS[p.stage as ListingStage]}</StatusBadge>
                  <span className="font-medium">{p.owner_name}</span>
                  <span className="min-w-0 flex-1 truncate text-muted-foreground">
                    {p.stage === "PERDIDA" ? p.lost_reason : p.property?.title ?? p.address}
                  </span>
                  {p.stage === "PUBLICADA" && listingAlerts(p, today).find((a) => a.kind === "autorizacion") && (
                    <span className="text-xs font-medium text-warning">Renovar autorización</span>
                  )}
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      <NewProspectDialog open={creating} onOpenChange={closeCreate} propertyTypes={propertyTypes} today={today}
        onCreated={(id) => { closeCreate(false); setSelectedId(id); }} />

      <Sheet open={!!selected} onOpenChange={(open) => {
        if (open) return;
        setSelectedId(null);
        if (initialSelectedId) router.replace(pathname); // llegó desde Hoy con ?c=
      }}>
        <SheetContent className="w-full overflow-y-auto sm:max-w-lg">
          {selected && (
            <ProspectDetail key={selected.id + selected.stage} prospect={selected} propertyTypes={propertyTypes} properties={properties}
              today={today} onDeleted={() => setSelectedId(null)} />
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}

function NewProspectDialog({ open, onOpenChange, propertyTypes, today, onCreated }: {
  open: boolean; onOpenChange: (open: boolean) => void; propertyTypes: Option[]; today: string; onCreated: (id: string) => void;
}) {
  const { busy, run } = useRunAction();
  const [form, setForm] = useState({
    owner_name: "", owner_phone: "", owner_email: "", address: "", city: "", operation: "venta" as "venta" | "alquiler",
    property_type_id: NO_TYPE, source: "", owner_price: "", currency: "USD" as "ARS" | "USD",
    next_action: "Visitar para tasar", next_action_at: addDays(today, 2), notes: "",
  });
  const set = (patch: Partial<typeof form>) => setForm((f) => ({ ...f, ...patch }));

  const save = async () => {
    let createdId: string | undefined;
    const ok = await run("create", async () => {
      const res = await createProspectAction({
        ...form,
        property_type_id: form.property_type_id === NO_TYPE ? null : Number(form.property_type_id),
        owner_price: parseAmount(form.owner_price) || null,
      });
      if (res.success) createdId = res.id;
      return res;
    });
    if (ok && createdId) {
      set({ owner_name: "", owner_phone: "", owner_email: "", address: "", owner_price: "", notes: "" });
      onCreated(createdId);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Nueva captación</DialogTitle>
          <DialogDescription>Un propietario que quiere vender o alquilar. Lo seguís hasta publicar la propiedad.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Propietario" id="np-name" className="sm:col-span-2">
            <Input id="np-name" value={form.owner_name} onChange={(e) => set({ owner_name: e.target.value })} autoFocus />
          </Field>
          <Field label="Teléfono" id="np-phone"><Input id="np-phone" type="tel" value={form.owner_phone} onChange={(e) => set({ owner_phone: e.target.value })} /></Field>
          <Field label="Email" id="np-email"><Input id="np-email" type="email" value={form.owner_email} onChange={(e) => set({ owner_email: e.target.value })} /></Field>
          <Field label="Dirección" id="np-address"><Input id="np-address" value={form.address} onChange={(e) => set({ address: e.target.value })} /></Field>
          <Field label="Ciudad" id="np-city"><Input id="np-city" value={form.city} onChange={(e) => set({ city: e.target.value })} /></Field>
          <Field label="Operación">
            <Select value={form.operation} onValueChange={(v) => set({ operation: v as "venta" | "alquiler" })}>
              <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="venta">Venta</SelectItem><SelectItem value="alquiler">Alquiler</SelectItem></SelectContent>
            </Select>
          </Field>
          <Field label="Tipo">
            <Select value={form.property_type_id} onValueChange={(v) => set({ property_type_id: v })}>
              <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value={NO_TYPE}>Sin definir</SelectItem>
                {propertyTypes.map((t) => <SelectItem key={t.id} value={String(t.id)}>{t.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Precio que pretende" id="np-price">
            <div className="flex gap-2">
              <Input id="np-price" inputMode="decimal" value={form.owner_price} onChange={(e) => set({ owner_price: e.target.value })} />
              <Select value={form.currency} onValueChange={(v) => set({ currency: v as "ARS" | "USD" })}>
                <SelectTrigger className="w-24" aria-label="Moneda"><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="USD">USD</SelectItem><SelectItem value="ARS">ARS</SelectItem></SelectContent>
              </Select>
            </div>
          </Field>
          <Field label="Origen">
            <Select value={form.source || NO_TYPE} onValueChange={(v) => set({ source: v === NO_TYPE ? "" : v })}>
              <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value={NO_TYPE}>Sin definir</SelectItem>
                {LISTING_SOURCES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Próximo paso" id="np-next"><Input id="np-next" value={form.next_action} onChange={(e) => set({ next_action: e.target.value })} /></Field>
          <Field label="Para el" id="np-next-at"><Input id="np-next-at" type="date" min={today} value={form.next_action_at} onChange={(e) => set({ next_action_at: e.target.value })} /></Field>
          <Field label="Notas" id="np-notes" className="sm:col-span-2">
            <Textarea id="np-notes" rows={2} value={form.notes} onChange={(e) => set({ notes: e.target.value })} />
          </Field>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button disabled={!!busy || form.owner_name.trim().length < 2} onClick={save}>
            {busy === "create" && <Loader2 className="size-4 animate-spin" />} Guardar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ProspectDetail({ prospect: p, propertyTypes, properties, today, onDeleted }: {
  prospect: Prospect; propertyTypes: Option[]; properties: Option[]; today: string; onDeleted: () => void;
}) {
  const { busy, run } = useRunAction();
  const stage = p.stage as ListingStage;
  const open = isPipelineStage(stage);
  const idx = isPipelineStage(stage) ? LISTING_PIPELINE.indexOf(stage) : -1;
  const next = idx >= 0 && idx < LISTING_PIPELINE.length - 1 ? LISTING_PIPELINE[idx + 1] : null;
  const alerts = listingAlerts(p, today);
  const gap = priceGap(p);
  const phone = phoneDigits(p.owner_phone);

  const [draft, setDraft] = useState({
    owner_name: p.owner_name, owner_phone: p.owner_phone ?? "", owner_email: p.owner_email ?? "",
    address: p.address ?? "", city: p.city ?? "", property_type_id: p.property_type_id ? String(p.property_type_id) : NO_TYPE,
    owner_price: p.owner_price?.toLocaleString("es-AR") ?? "", appraisal_value: p.appraisal_value?.toLocaleString("es-AR") ?? "",
    commission_pct: p.commission_pct?.toString() ?? "", notes: p.notes ?? "",
    next_action: p.next_action ?? "", next_action_at: p.next_action_at ?? addDays(today, 2),
    authorization_expires_at: p.authorization_expires_at ?? "",
  });
  const set = (patch: Partial<typeof draft>) => setDraft((d) => ({ ...d, ...patch }));
  // Datos que pide el cambio de etapa.
  const [signedAt, setSignedAt] = useState(today);
  const [exclusive, setExclusive] = useState(p.exclusive);
  const [losing, setLosing] = useState(false);
  const [lostReason, setLostReason] = useState("");
  const [propertyId, setPropertyId] = useState<string | null>(null);

  const save = () => run("save", () => updateProspectAction({
    id: p.id, owner_name: draft.owner_name, owner_phone: draft.owner_phone, owner_email: draft.owner_email,
    address: draft.address, city: draft.city, notes: draft.notes,
    property_type_id: draft.property_type_id === NO_TYPE ? null : Number(draft.property_type_id),
    owner_price: parseAmount(draft.owner_price) || null, appraisal_value: parseAmount(draft.appraisal_value) || null,
    commission_pct: draft.commission_pct ? Number(draft.commission_pct.replace(",", ".")) : null,
    next_action: draft.next_action, next_action_at: draft.next_action ? draft.next_action_at : null,
    ...(p.authorization_signed_at ? { authorization_expires_at: draft.authorization_expires_at || null } : {}),
  }));

  const advance = () => next && run("move", () => moveProspectAction({
    id: p.id, stage: next,
    appraisal_value: parseAmount(draft.appraisal_value) || undefined,
    ...(next === "AUTORIZACION" ? {
      authorization_signed_at: signedAt, authorization_expires_at: defaultAuthorizationExpiry(signedAt), exclusive,
      commission_pct: draft.commission_pct ? Number(draft.commission_pct.replace(",", ".")) : undefined,
    } : {}),
  }));

  return (
    <div className="space-y-5 px-4 pb-6">
      <SheetHeader className="px-0">
        <div className="flex items-center gap-2">
          <SheetTitle>{p.owner_name}</SheetTitle>
          <StatusBadge tone={LISTING_STAGE_TONE[stage]}>{LISTING_STAGE_LABELS[stage]}</StatusBadge>
        </div>
        <SheetDescription>
          {[p.address, p.city].filter(Boolean).join(", ") || "Sin dirección"} · cargada el {formatDate(p.created_at.slice(0, 10))}{p.source && ` · ${p.source}`}
        </SheetDescription>
      </SheetHeader>

      {alerts.length > 0 && (
        <ul className="space-y-1 rounded-md bg-muted/60 px-3 py-2 text-sm">
          {alerts.map((a) => <li key={a.kind} className={urgencyStyle[a.urgency]}>{a.text}</li>)}
        </ul>
      )}

      {phone && (
        <Button asChild size="sm" variant="outline">
          <a href={`https://wa.me/${phone}`} target="_blank" rel="noreferrer"><FaWhatsapp className="size-4" /> Escribir por WhatsApp</a>
        </Button>
      )}

      {/* Etapa */}
      {open && (
        <section className="space-y-3 rounded-lg border border-border p-3">
          <h3 className="text-sm font-semibold">Avanzar</h3>
          {next === "AUTORIZACION" && (
            <div className="grid grid-cols-2 gap-2">
              <Field label="Firmada el" id="pd-signed"><Input id="pd-signed" type="date" max={today} value={signedAt} onChange={(e) => setSignedAt(e.target.value)} /></Field>
              <Field label="Vence (90 días)" id="pd-exp"><Input id="pd-exp" disabled value={formatDate(defaultAuthorizationExpiry(signedAt))} /></Field>
              <label className="col-span-2 flex items-center gap-2 text-sm"><Checkbox checked={exclusive} onCheckedChange={(c) => setExclusive(c === true)} /> Exclusiva</label>
            </div>
          )}
          {next === "PROPUESTA" && !parseAmount(draft.appraisal_value) && (
            <p className="text-xs text-muted-foreground">Cargá el valor de tasación abajo para enviar la propuesta.</p>
          )}
          <div className="flex flex-wrap gap-2">
            {next && (
              <Button size="sm" disabled={!!busy || (next === "PROPUESTA" && !parseAmount(draft.appraisal_value))} onClick={advance}>
                {busy === "move" && <Loader2 className="size-4 animate-spin" />} Pasar a {LISTING_STAGE_LABELS[next]}
              </Button>
            )}
            {stage === "AUTORIZACION" && <PublishControl propertyId={propertyId} setPropertyId={setPropertyId} properties={properties} busy={busy}
              onPublish={() => propertyId && run("publish", () => publishProspectAction({ id: p.id, property_id: propertyId }))} />}
            {idx > 0 && (
              <Button size="sm" variant="ghost" disabled={!!busy} onClick={() => run("back", () => moveProspectAction({ id: p.id, stage: LISTING_PIPELINE[idx - 1] }))}>
                Volver a {LISTING_STAGE_LABELS[LISTING_PIPELINE[idx - 1]]}
              </Button>
            )}
          </div>
          {!losing ? (
            <button type="button" className="text-xs text-muted-foreground underline-offset-4 hover:text-danger hover:underline" onClick={() => setLosing(true)}>
              Se perdió la captación
            </button>
          ) : (
            <div className="space-y-2">
              <div className="flex flex-wrap gap-1.5">
                {LISTING_LOST_REASONS.map((r) => (
                  <button key={r} type="button" onClick={() => setLostReason(r)} aria-pressed={lostReason === r}
                    className={cn("rounded-md border border-border px-2 py-0.5 text-xs", lostReason === r ? "bg-muted text-foreground" : "text-muted-foreground hover:bg-muted")}>
                    {r}
                  </button>
                ))}
              </div>
              <Input value={lostReason} onChange={(e) => setLostReason(e.target.value)} placeholder="Motivo" aria-label="Motivo" maxLength={500} />
              <div className="flex justify-end gap-2">
                <Button size="sm" variant="ghost" onClick={() => setLosing(false)}>Cancelar</Button>
                <Button size="sm" variant="destructive" disabled={!!busy || lostReason.trim().length < 3}
                  onClick={() => run("lost", () => moveProspectAction({ id: p.id, stage: "PERDIDA", lost_reason: lostReason }))}>Marcar perdida</Button>
              </div>
            </div>
          )}
        </section>
      )}
      {stage === "PERDIDA" && (
        <section className="space-y-2 rounded-lg border border-border p-3 text-sm">
          <p><span className="text-muted-foreground">Motivo:</span> {p.lost_reason}</p>
          <Button size="sm" variant="outline" disabled={!!busy} onClick={() => run("reopen", () => moveProspectAction({ id: p.id, stage: "CONTACTO" }))}>Reabrir</Button>
        </section>
      )}
      {stage === "PUBLICADA" && p.property && (
        <p className="text-sm">Publicada como <Link href={`/dashboard/propiedades/${p.property.id}`} className="font-medium underline-offset-4 hover:underline">{p.property.title}</Link>.</p>
      )}

      {/* Datos */}
      <section className="space-y-3">
        <h3 className="text-sm font-semibold">Datos</h3>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Propietario" id="pd-name" className="sm:col-span-2"><Input id="pd-name" value={draft.owner_name} onChange={(e) => set({ owner_name: e.target.value })} /></Field>
          <Field label="Teléfono" id="pd-phone"><Input id="pd-phone" type="tel" value={draft.owner_phone} onChange={(e) => set({ owner_phone: e.target.value })} /></Field>
          <Field label="Email" id="pd-email"><Input id="pd-email" type="email" value={draft.owner_email} onChange={(e) => set({ owner_email: e.target.value })} /></Field>
          <Field label="Dirección" id="pd-address"><Input id="pd-address" value={draft.address} onChange={(e) => set({ address: e.target.value })} /></Field>
          <Field label="Ciudad" id="pd-city"><Input id="pd-city" value={draft.city} onChange={(e) => set({ city: e.target.value })} /></Field>
          <Field label="Tipo">
            <Select value={draft.property_type_id} onValueChange={(v) => set({ property_type_id: v })}>
              <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value={NO_TYPE}>Sin definir</SelectItem>
                {propertyTypes.map((t) => <SelectItem key={t.id} value={String(t.id)}>{t.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Comisión (%)" id="pd-commission"><Input id="pd-commission" inputMode="decimal" value={draft.commission_pct} onChange={(e) => set({ commission_pct: e.target.value })} /></Field>
          <Field label={`Pretende (${p.currency})`} id="pd-price"><Input id="pd-price" inputMode="decimal" value={draft.owner_price} onChange={(e) => set({ owner_price: e.target.value })} /></Field>
          <Field label={`Tasación (${p.currency})`} id="pd-appraisal"><Input id="pd-appraisal" inputMode="decimal" value={draft.appraisal_value} onChange={(e) => set({ appraisal_value: e.target.value })} /></Field>
          {gap !== null && (
            <p className={cn("text-xs sm:col-span-2", Math.abs(gap) >= 15 ? "text-warning" : "text-muted-foreground")}>
              {gap === 0 ? "Pretende lo mismo que la tasación." : `Pretende ${Math.abs(gap)} % ${gap > 0 ? "más" : "menos"} que la tasación.`}
            </p>
          )}
          {p.authorization_signed_at && (
            <>
              <Field label="Autorización firmada"><Input disabled value={`${formatDate(p.authorization_signed_at)}${p.exclusive ? " · exclusiva" : ""}`} /></Field>
              <Field label="Vence" id="pd-auth-exp"><Input id="pd-auth-exp" type="date" value={draft.authorization_expires_at} onChange={(e) => set({ authorization_expires_at: e.target.value })} /></Field>
            </>
          )}
          <Field label="Próximo paso" id="pd-next"><Input id="pd-next" value={draft.next_action} onChange={(e) => set({ next_action: e.target.value })} placeholder="Ej.: Llamar para la respuesta" /></Field>
          <Field label="Para el" id="pd-next-at"><Input id="pd-next-at" type="date" value={draft.next_action_at} onChange={(e) => set({ next_action_at: e.target.value })} /></Field>
          <Field label="Notas" id="pd-notes" className="sm:col-span-2"><Textarea id="pd-notes" rows={3} value={draft.notes} onChange={(e) => set({ notes: e.target.value })} /></Field>
        </div>
        <div className="flex items-center justify-between gap-2">
          <Button size="sm" variant="ghost" className="text-muted-foreground hover:text-danger" disabled={!!busy}
            onClick={async () => { if (await run("delete", () => deleteProspectAction({ id: p.id }))) onDeleted(); }}>
            Eliminar
          </Button>
          <Button size="sm" disabled={!!busy || draft.owner_name.trim().length < 2} onClick={save}>
            {busy === "save" && <Loader2 className="size-4 animate-spin" />} Guardar cambios
          </Button>
        </div>
      </section>
    </div>
  );
}

function PublishControl({ propertyId, setPropertyId, properties, busy, onPublish }: {
  propertyId: string | null; setPropertyId: (id: string | null) => void; properties: Option[]; busy: string | null; onPublish: () => void;
}) {
  return (
    <div className="w-full space-y-2 border-t border-border-subtle pt-3">
      <Label htmlFor="pd-property">Propiedad publicada</Label>
      <Combobox id="pd-property" value={propertyId} onChange={setPropertyId} placeholder="Elegí la propiedad"
        searchPlaceholder="Buscar por título…" options={properties.map((o) => ({ value: String(o.id), label: o.name }))} />
      <div className="flex flex-wrap items-center gap-2">
        <Button size="sm" disabled={!!busy || !propertyId} onClick={onPublish}>
          {busy === "publish" && <Loader2 className="size-4 animate-spin" />} Marcar publicada
        </Button>
        <Link href="/dashboard/propiedades/nueva" target="_blank" className="text-xs font-medium underline-offset-4 hover:underline">Cargar la propiedad</Link>
      </div>
      <p className="text-xs text-muted-foreground">El propietario queda como contacto y, si la propiedad no tiene dueños, como su propietario.</p>
    </div>
  );
}

function Field({ label, id, className, children }: { label: string; id?: string; className?: string; children: React.ReactNode }) {
  return (
    <div className={cn("space-y-1.5", className)}>
      <Label htmlFor={id}>{label}</Label>
      {children}
    </div>
  );
}
