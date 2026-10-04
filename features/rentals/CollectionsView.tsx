"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { FileText, Search } from "lucide-react";
import { FaWhatsapp } from "react-icons/fa";
import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/shared/components/ui/tabs";
import { CHARGE_LABELS, daysBetween, formatDate, money } from "@/features/rentals/logic";
import { PaymentDialog } from "@/features/rentals/PaymentDialog";

export type PendingCharge = {
  id: string; contractId: string; propertyTitle: string; tenantName: string | null; tenantPhone: string | null;
  kind: string; description: string; dueDate: string; amount: number; balance: number; currency: string;
};
export type CollectedEntry = {
  id: string; contractId: string; propertyTitle: string; tenantName: string | null; description: string;
  paidAt: string; amount: number; currency: string; method: string; receiptNumber: number;
};

const METHOD_LABELS: Record<string, string> = { TRANSFERENCIA: "Transferencia", EFECTIVO: "Efectivo", OTRO: "Otro" };

function reminderLink(charge: PendingCharge, overdue: boolean) {
  const digits = charge.tenantPhone?.replace(/\D/g, "") ?? "";
  if (!digits) return null;
  const text = overdue
    ? `Hola ${charge.tenantName ?? ""}, registramos un saldo pendiente de ${money(charge.balance, charge.currency)} por ${charge.description} (${charge.propertyTitle}), vencido el ${formatDate(charge.dueDate)}. Por favor, contactanos para coordinar el pago.`
    : `Hola ${charge.tenantName ?? ""}, te recordamos que el ${formatDate(charge.dueDate)} vence ${charge.description} de ${charge.propertyTitle} por ${money(charge.balance, charge.currency)}. Gracias.`;
  return `https://wa.me/${digits}?text=${encodeURIComponent(text)}`;
}

function matches(text: string, ...values: (string | null)[]) {
  return !text || values.some((value) => value?.toLowerCase().includes(text));
}

function PendingList({ charges, today, empty }: { charges: PendingCharge[]; today: string; empty: string }) {
  if (charges.length === 0) {
    return <div className="rounded-lg border border-dashed border-border px-4 py-10 text-center text-sm text-muted-foreground">{empty}</div>;
  }
  return (
    <ul className="divide-y divide-border-subtle overflow-hidden rounded-lg border border-border bg-card">
      {charges.map((charge) => {
        const late = charge.dueDate < today ? daysBetween(charge.dueDate, today) : 0;
        const wa = reminderLink(charge, late > 0);
        return (
          <li key={charge.id} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-2 px-4 py-3 text-sm md:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_120px_auto]">
            <div className="min-w-0">
              <Link href={`/dashboard/alquileres/${charge.contractId}?tab=cuenta`} className="block truncate font-medium hover:underline">{charge.propertyTitle}</Link>
              <span className="block truncate text-xs text-muted-foreground">{charge.tenantName ?? "Sin inquilino"}</span>
            </div>
            <div className="hidden min-w-0 md:block">
              <span className="block truncate">{charge.description}</span>
              <span className="block text-xs text-muted-foreground">
                {charge.kind !== "ALQUILER" && `${CHARGE_LABELS[charge.kind] ?? charge.kind} · `}{late > 0 ? "Venció" : "Vence"} el {formatDate(charge.dueDate)}
              </span>
            </div>
            <div className="text-right">
              <span className="block font-medium tabular-nums">{money(charge.balance, charge.currency)}</span>
              {charge.balance + 0.005 < charge.amount && <span className="block text-xs text-muted-foreground">de {money(charge.amount, charge.currency)}</span>}
              {late > 0 && <span className="block text-xs font-medium text-danger">{late} días de atraso</span>}
              {late === 0 && <span className="block text-xs text-muted-foreground md:hidden">vence {formatDate(charge.dueDate)}</span>}
            </div>
            <div className="col-span-2 flex justify-end gap-2 md:col-span-1">
              {wa && (
                <Button asChild size="sm" variant="ghost" aria-label={`Escribir a ${charge.tenantName ?? "inquilino"} por WhatsApp`}>
                  <a href={wa} target="_blank" rel="noopener noreferrer"><FaWhatsapp className="size-4" aria-hidden /> <span className="md:sr-only lg:not-sr-only">{late > 0 ? "Reclamar" : "Recordar"}</span></a>
                </Button>
              )}
              <PaymentDialog chargeId={charge.id} description={`${charge.propertyTitle}: ${charge.description}`} balance={charge.balance} currency={charge.currency} today={today} />
            </div>
          </li>
        );
      })}
    </ul>
  );
}

export function CollectionsView({ pending, collectedEntries, today }: {
  pending: PendingCharge[]; collectedEntries: CollectedEntry[]; today: string;
}) {
  const [q, setQ] = useState("");
  const text = q.trim().toLowerCase();

  const { overdue, upcoming, entries } = useMemo(() => {
    const visible = pending.filter((charge) => matches(text, charge.propertyTitle, charge.tenantName, charge.description));
    return {
      overdue: visible.filter((charge) => charge.dueDate < today).sort((a, b) => a.dueDate.localeCompare(b.dueDate)),
      upcoming: visible.filter((charge) => charge.dueDate >= today).sort((a, b) => a.dueDate.localeCompare(b.dueDate)),
      entries: collectedEntries.filter((entry) => matches(text, entry.propertyTitle, entry.tenantName, entry.description)),
    };
  }, [pending, collectedEntries, text, today]);

  return (
    <Tabs defaultValue={overdue.length || !upcoming.length ? "vencidas" : "mes"} className="gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <TabsList>
          <TabsTrigger value="vencidas">Vencidas <span className="tabular-nums text-muted-foreground">{overdue.length}</span></TabsTrigger>
          <TabsTrigger value="mes">Por vencer <span className="tabular-nums text-muted-foreground">{upcoming.length}</span></TabsTrigger>
          <TabsTrigger value="cobrado">Cobrado <span className="tabular-nums text-muted-foreground">{entries.length}</span></TabsTrigger>
        </TabsList>
        <div className="relative w-full sm:ml-auto sm:w-72">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar propiedad o inquilino" className="pl-8" aria-label="Buscar cobranza" />
        </div>
      </div>

      <TabsContent value="vencidas">
        <PendingList charges={overdue} today={today} empty={text ? "Ninguna cuota vencida coincide con la búsqueda." : "No hay cuotas vencidas. Todos los inquilinos están al día."} />
      </TabsContent>
      <TabsContent value="mes">
        <PendingList charges={upcoming} today={today} empty={text ? "Ninguna cuota coincide con la búsqueda." : "No quedan cuotas por vencer este mes."} />
      </TabsContent>
      <TabsContent value="cobrado">
        {entries.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border px-4 py-10 text-center text-sm text-muted-foreground">
            {text ? "Ningún cobro coincide con la búsqueda." : "Todavía no se registraron cobros este mes."}
          </div>
        ) : (
          <ul className="divide-y divide-border-subtle overflow-hidden rounded-lg border border-border bg-card">
            {entries.map((entry) => (
              <li key={entry.id} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 px-4 py-3 text-sm md:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_120px_auto]">
                <div className="min-w-0">
                  <Link href={`/dashboard/alquileres/${entry.contractId}?tab=cuenta`} className="block truncate font-medium hover:underline">{entry.propertyTitle}</Link>
                  <span className="block truncate text-xs text-muted-foreground">{entry.tenantName ?? "Sin inquilino"}</span>
                </div>
                <div className="hidden min-w-0 md:block">
                  <span className="block truncate">{entry.description}</span>
                  <span className="block text-xs text-muted-foreground">Recibo N.º {entry.receiptNumber} · {METHOD_LABELS[entry.method] ?? entry.method}</span>
                </div>
                <div className="text-right">
                  <span className="block font-medium tabular-nums">{money(entry.amount, entry.currency)}</span>
                  <span className="block text-xs text-muted-foreground">{formatDate(entry.paidAt)}</span>
                </div>
                <Button asChild size="icon" variant="ghost" className="hidden size-8 md:inline-flex" aria-label={`Ver recibo ${entry.receiptNumber}`}>
                  <Link href={`/dashboard/alquileres/${entry.contractId}/recibo/${entry.id}`} target="_blank"><FileText className="size-4" /></Link>
                </Button>
              </li>
            ))}
          </ul>
        )}
      </TabsContent>
    </Tabs>
  );
}
