"use client";

import { useState } from "react";
import { Loader2, Plus, Trash2 } from "lucide-react";
import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import { Label } from "@/shared/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/shared/components/ui/select";
import { addContractPartyAction, removeContractPartyAction } from "@/features/rentals/lifecycleActions";
import { EditContactDialog, type ContactData } from "@/features/rentals/EditContractDialog";
import { useRunAction } from "@/features/rentals/useRunAction";

type Role = "CO_INQUILINO" | "CO_PROPIETARIO" | "GARANTE";
export type Party = { id: string; role: Role; share_pct: number | null; contact: ContactData };
type Option = { id: string; label: string; kind: string };

const ROLE_LABELS: Record<Role, string> = {
  CO_INQUILINO: "Co-inquilino",
  CO_PROPIETARIO: "Co-propietario",
  GARANTE: "Garante",
};
const ROLE_KIND: Record<Role, string> = { CO_INQUILINO: "tenant", CO_PROPIETARIO: "owner", GARANTE: "guarantor" };
const NEW = "__new__";

function ContactRow({ label, contact, contractId, extra, action }: {
  label: string; contact: ContactData | null; contractId: string; extra?: string; action?: React.ReactNode;
}) {
  if (!contact) return null;
  return (
    <div className="flex items-start justify-between gap-2">
      <div className="min-w-0">
        <p className="text-xs text-muted-foreground">{label}{extra ? ` · ${extra}` : ""}</p>
        <p className="truncate font-medium">{contact.full_name}</p>
        <p className="truncate text-muted-foreground">{[contact.document, contact.phone, contact.email].filter(Boolean).join(" · ")}</p>
      </div>
      <div className="flex shrink-0 items-center">
        <EditContactDialog contact={contact} contractId={contractId} />
        {action}
      </div>
    </div>
  );
}

export function PartiesCard({ contractId, owner, tenant, parties, contacts, editable }: {
  contractId: string; owner: ContactData | null; tenant: ContactData | null;
  parties: Party[]; contacts: Option[]; editable: boolean;
}) {
  const { busy, run } = useRunAction();
  const [adding, setAdding] = useState(false);
  const [role, setRole] = useState<Role>("GARANTE");
  const [contactId, setContactId] = useState("");
  const [draft, setDraft] = useState({ full_name: "", document: "", phone: "" });
  const [share, setShare] = useState(0);

  const taken = new Set([owner?.id, tenant?.id, ...parties.filter((p) => p.role === role).map((p) => p.contact.id)]);
  const options = contacts.filter((c) => c.kind === ROLE_KIND[role] && !taken.has(c.id));
  const creating = contactId === NEW;
  // El principal se queda con el resto hasta 100 % (mismo criterio que la base).
  const coOwnersPct = parties.filter((p) => p.role === "CO_PROPIETARIO").reduce((sum, p) => sum + (p.share_pct ?? 0), 0);
  const primaryPct = 100 - coOwnersPct;
  const shareInvalid = role === "CO_PROPIETARIO" && (share <= 0 || coOwnersPct + share >= 100);
  const canSave = (creating ? draft.full_name.trim().length >= 3 : !!contactId) && !shareInvalid;

  const reset = () => { setAdding(false); setContactId(""); setDraft({ full_name: "", document: "", phone: "" }); setShare(0); };

  return (
    <Card>
      <CardHeader><CardTitle>Partes</CardTitle></CardHeader>
      <CardContent className="space-y-3 text-sm">
        <ContactRow label="Propietario" extra={coOwnersPct > 0 ? `${primaryPct} %` : undefined} contact={owner} contractId={contractId} />
        <ContactRow label="Inquilino" contact={tenant} contractId={contractId} />
        {parties.map((party) => (
          <ContactRow
            key={party.id}
            label={ROLE_LABELS[party.role]}
            extra={party.share_pct != null ? `${party.share_pct} %` : undefined}
            contact={party.contact}
            contractId={contractId}
            action={editable && <Button size="icon" variant="ghost" className="size-7" aria-label={`Quitar ${party.contact.full_name}`} disabled={!!busy}
              onClick={() => run(`party-${party.id}`, () => removeContractPartyAction(party.id, contractId))}><Trash2 className="size-3.5" /></Button>}
          />
        ))}

        {editable && (adding ? (
          <div className="space-y-2 rounded-md border border-border p-3">
            <div className="grid gap-2 sm:grid-cols-2">
              <div className="grid gap-1.5"><Label>Rol</Label>
                <Select value={role} onValueChange={(value) => { setRole(value as Role); setContactId(""); }}><SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{(Object.keys(ROLE_LABELS) as Role[]).map((key) => <SelectItem key={key} value={key}>{ROLE_LABELS[key]}</SelectItem>)}</SelectContent></Select></div>
              <div className="grid gap-1.5"><Label>Contacto</Label>
                <Select value={contactId} onValueChange={setContactId}><SelectTrigger><SelectValue placeholder="Seleccionar..." /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NEW}>+ Nuevo contacto</SelectItem>
                    {options.map((o) => <SelectItem key={o.id} value={o.id}>{o.label}</SelectItem>)}
                  </SelectContent></Select></div>
            </div>
            {creating && <div className="grid gap-2 sm:grid-cols-3">
              <Input className="sm:col-span-3" placeholder="Nombre y apellido" value={draft.full_name} onChange={(e) => setDraft({ ...draft, full_name: e.target.value })} />
              <Input placeholder="DNI / CUIT" value={draft.document} onChange={(e) => setDraft({ ...draft, document: e.target.value })} />
              <Input placeholder="Teléfono" value={draft.phone} onChange={(e) => setDraft({ ...draft, phone: e.target.value })} />
            </div>}
            {role === "CO_PROPIETARIO" && (
              <div className="grid gap-1.5">
                <Label htmlFor="co-owner-share">Participación (% del neto)</Label>
                <Input id="co-owner-share" type="number" min={0.01} max={99.99} step="0.01" value={share || ""} onChange={(e) => setShare(Number(e.target.value))} />
                <p className={`text-xs ${share > 0 && shareInvalid ? "text-danger" : "text-muted-foreground"}`}>
                  {share > 0 && shareInvalid
                    ? `Los co-propietarios sumarían ${coOwnersPct + share} %: el principal tiene que conservar una parte.`
                    : `${owner?.full_name ?? "El propietario principal"} quedaría con ${Math.max(0, primaryPct - share)} %. Se aplica a las liquidaciones que se emitan desde ahora.`}
                </p>
              </div>
            )}
            <div className="flex gap-2">
              <Button size="sm" disabled={!!busy || !canSave} onClick={async () => {
                const ok = await run("party", () => addContractPartyAction({
                  contract_id: contractId,
                  role,
                  contact_id: creating ? undefined : contactId,
                  new_contact: creating ? draft : undefined,
                  share_pct: role === "CO_PROPIETARIO" ? share : undefined,
                }));
                if (ok) reset();
              }}>{busy === "party" ? <Loader2 className="size-4 animate-spin" /> : "Agregar"}</Button>
              <Button size="sm" variant="ghost" onClick={reset}>Cancelar</Button>
            </div>
          </div>
        ) : (
          <Button size="sm" variant="outline" onClick={() => setAdding(true)}><Plus /> Agregar garante o co-titular</Button>
        ))}
      </CardContent>
    </Card>
  );
}
