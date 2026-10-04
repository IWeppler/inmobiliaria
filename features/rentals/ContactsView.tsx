"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Loader2, Plus, Search } from "lucide-react";
import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import { Label } from "@/shared/components/ui/label";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/shared/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/shared/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/shared/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/shared/components/ui/table";
import { createContactAction } from "@/features/rentals/actions";
import { EditContactDialog, type ContactData } from "@/features/rentals/EditContractDialog";
import { useRunAction } from "@/features/rentals/useRunAction";

type Kind = "owner" | "tenant" | "guarantor";
export type ContactRow = ContactData & {
  kind: Kind;
  contracts: { id: string; title: string; active: boolean }[];
};

const KIND_LABELS: Record<Kind, string> = { owner: "Propietario", tenant: "Inquilino", guarantor: "Garante" };
const FILTERS: { value: "all" | Kind; label: string }[] = [
  { value: "all", label: "Todos" },
  { value: "owner", label: "Propietarios" },
  { value: "tenant", label: "Inquilinos" },
  { value: "guarantor", label: "Garantes" },
];

function NewContactDialog() {
  const { busy, run } = useRunAction();
  const [open, setOpen] = useState(false);
  const blank = { kind: "owner" as Kind, full_name: "", document: "", phone: "", email: "", address: "" };
  const [v, setV] = useState(blank);

  return (
    <Dialog open={open} onOpenChange={(next) => { setOpen(next); if (next) setV(blank); }}>
      <DialogTrigger asChild><Button><Plus /> Nuevo contacto</Button></DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Nuevo contacto</DialogTitle><DialogDescription>Propietarios, inquilinos y garantes de los contratos.</DialogDescription></DialogHeader>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="grid gap-1.5 sm:col-span-2"><Label>Tipo</Label>
            <Select value={v.kind} onValueChange={(value) => setV({ ...v, kind: value as Kind })}><SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{(Object.keys(KIND_LABELS) as Kind[]).map((k) => <SelectItem key={k} value={k}>{KIND_LABELS[k]}</SelectItem>)}</SelectContent></Select></div>
          <div className="grid gap-1.5 sm:col-span-2"><Label htmlFor="nc-name">Nombre y apellido o razón social</Label><Input id="nc-name" value={v.full_name} onChange={(e) => setV({ ...v, full_name: e.target.value })} /></div>
          <div className="grid gap-1.5"><Label htmlFor="nc-doc">DNI / CUIT</Label><Input id="nc-doc" value={v.document} onChange={(e) => setV({ ...v, document: e.target.value })} /></div>
          <div className="grid gap-1.5"><Label htmlFor="nc-phone">Teléfono</Label><Input id="nc-phone" value={v.phone} onChange={(e) => setV({ ...v, phone: e.target.value })} /></div>
          <div className="grid gap-1.5 sm:col-span-2"><Label htmlFor="nc-email">Email</Label><Input id="nc-email" type="email" value={v.email} onChange={(e) => setV({ ...v, email: e.target.value })} /></div>
          <div className="grid gap-1.5 sm:col-span-2"><Label htmlFor="nc-address">Domicilio</Label><Input id="nc-address" value={v.address} onChange={(e) => setV({ ...v, address: e.target.value })} /></div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)}>Cancelar</Button>
          <Button disabled={!!busy || v.full_name.trim().length < 3} onClick={async () => {
            const ok = await run("contact", () => createContactAction(v));
            if (ok) setOpen(false);
          }}>{busy ? <Loader2 className="size-4 animate-spin" /> : "Guardar"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function ContactsView({ contacts }: { contacts: ContactRow[] }) {
  const [q, setQ] = useState("");
  const [kind, setKind] = useState<"all" | Kind>("all");

  const filtered = useMemo(() => {
    const text = q.trim().toLowerCase();
    return contacts.filter((contact) => {
      if (kind !== "all" && contact.kind !== kind) return false;
      if (!text) return true;
      return [contact.full_name, contact.document, contact.phone, contact.email].some((value) => value?.toLowerCase().includes(text));
    });
  }, [contacts, q, kind]);

  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <Tabs value={kind} onValueChange={(value) => setKind(value as "all" | Kind)}>
          <TabsList>
            {FILTERS.map((f) => (
              <TabsTrigger key={f.value} value={f.value}>
                {f.label}
                <span className="tabular-nums text-muted-foreground">{f.value === "all" ? contacts.length : contacts.filter((c) => c.kind === f.value).length}</span>
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
        <div className="relative w-full sm:w-72">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar nombre, documento o teléfono" className="pl-8" aria-label="Buscar contacto" />
        </div>
        <div className="ml-auto"><NewContactDialog /></div>
      </div>

      <div className="overflow-hidden rounded-lg border border-border bg-card">
        {filtered.length === 0 ? (
          <div className="px-4 py-10 text-center text-sm text-muted-foreground">
            {contacts.length === 0 ? "Todavía no hay contactos. Se crean al cargar un contrato o desde Nuevo contacto." : "Ningún contacto coincide con la búsqueda."}
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nombre</TableHead>
                <TableHead className="hidden md:table-cell">Documento</TableHead>
                <TableHead className="hidden sm:table-cell">Contacto</TableHead>
                <TableHead>Contratos</TableHead>
                <TableHead className="w-10"><span className="sr-only">Acciones</span></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((contact) => {
                const activeContracts = contact.contracts.filter((c) => c.active);
                return (
                  <TableRow key={contact.id}>
                    <TableCell>
                      <Link href={`/dashboard/alquileres/contactos/${contact.id}`} className="block font-medium hover:text-primary hover:underline">{contact.full_name}</Link>
                      <span className="block text-xs text-muted-foreground">{KIND_LABELS[contact.kind]}</span>
                    </TableCell>
                    <TableCell className="hidden text-muted-foreground md:table-cell">{contact.document ?? "-"}</TableCell>
                    <TableCell className="hidden sm:table-cell">
                      <span className="block">{contact.phone ?? <span className="text-muted-foreground">Sin teléfono</span>}</span>
                      {contact.email && <span className="block text-xs text-muted-foreground">{contact.email}</span>}
                    </TableCell>
                    <TableCell className="max-w-[260px]">
                      {contact.contracts.length === 0 ? (
                        <span className="text-muted-foreground">Sin contratos</span>
                      ) : (
                        <>
                          {(activeContracts.length ? activeContracts : contact.contracts).slice(0, 2).map((c) => (
                            <Link key={c.id} href={`/dashboard/alquileres/${c.id}`} className="block truncate hover:underline">{c.title}</Link>
                          ))}
                          <span className="block text-xs text-muted-foreground">
                            {activeContracts.length} {activeContracts.length === 1 ? "activo" : "activos"}
                            {contact.contracts.length > activeContracts.length && ` de ${contact.contracts.length}`}
                          </span>
                        </>
                      )}
                    </TableCell>
                    <TableCell><EditContactDialog contact={contact} /></TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </div>
    </section>
  );
}
