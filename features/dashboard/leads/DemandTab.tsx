"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import type { LeadWithDetails } from "@/app/types";
import { StatusBadge } from "@/shared/components/StatusBadge";
import { Button } from "@/shared/components/ui/button";
import { Card } from "@/shared/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/shared/components/ui/table";
import { ConfirmSearchButton } from "@/features/dashboard/buyers/ConfirmSearchButton";
import { DemandGapsCard } from "@/features/dashboard/buyers/DemandGapsCard";
import { STALE_DAYS, daysAgo } from "@/features/dashboard/buyers/format";
import type { DemandGap } from "@/features/dashboard/buyers/queries";
import { normalizeStatus } from "@/features/dashboard/leads/leadStatus";

const URGENCY: Record<string, string> = { alta: "Alta", media: "Media", baja: "Baja" };

const money = (n: number | null, cur: string | null) =>
  n === null ? null : `${cur ?? "USD"} ${new Intl.NumberFormat("es-AR", { maximumFractionDigits: 0 }).format(n)}`;

// Los compradores son leads con una búsqueda cargada: esta pestaña es la
// misma lista de leads (respeta los filtros de arriba) vista como demanda.
// La tarjeta de demanda sin oferta, en cambio, cubre toda la base: no
// depende de los filtros.
export function DemandTab({
  leads,
  gaps,
  propertyTypes,
}: {
  leads: LeadWithDetails[];
  gaps: DemandGap[];
  propertyTypes: { id: number; name: string | null }[];
}) {
  const [onlyStale, setOnlyStale] = useState(false);

  const rows = useMemo(
    () =>
      leads
        .filter((l) => l.search_operation && !["CERRADO", "DESCARTADO"].includes(normalizeStatus(l.status)))
        .map((l) => {
          const days = daysAgo(l.search_confirmed_at);
          return { lead: l, days, stale: days === null || days > STALE_DAYS };
        })
        // Las búsquedas más viejas (o nunca confirmadas) primero.
        .sort((a, b) => (b.days ?? Infinity) - (a.days ?? Infinity)),
    [leads],
  );
  const staleCount = rows.filter((r) => r.stale).length;
  const shown = onlyStale ? rows.filter((r) => r.stale) : rows;
  const typeName = (id: number | undefined) => propertyTypes.find((t) => t.id === id)?.name;

  return (
    <div className="space-y-4">
      <DemandGapsCard gaps={gaps} />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          {rows.length} {rows.length === 1 ? "comprador con búsqueda activa" : "compradores con búsqueda activa"} ·{" "}
          {staleCount} para reconfirmar
        </p>
        <Button variant="outline" size="sm" onClick={() => setOnlyStale((v) => !v)}>
          {onlyStale ? "Ver todos" : "Solo por reconfirmar"}
        </Button>
      </div>

      <Card className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Comprador</TableHead>
              <TableHead>Busca</TableHead>
              <TableHead>Zona</TableHead>
              <TableHead>Presupuesto</TableHead>
              <TableHead>Urgencia</TableHead>
              <TableHead>Confirmada</TableHead>
              <TableHead className="w-px" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {shown.length === 0 && (
              <TableRow>
                <TableCell colSpan={7} className="h-24 text-center text-muted-foreground">
                  {onlyStale
                    ? "No hay búsquedas por reconfirmar."
                    : "No hay compradores con búsqueda cargada con estos filtros. Cargá qué busca cada lead desde su ficha."}
                </TableCell>
              </TableRow>
            )}
            {shown.map(({ lead: l, days, stale }) => (
              <TableRow key={l.id}>
                <TableCell>
                  <Link href={`/dashboard/leads/${l.id}`} className="font-medium underline-offset-4 hover:underline">
                    {l.name}
                  </Link>
                </TableCell>
                <TableCell>
                  {[l.search_operation === "venta" ? "Comprar" : "Alquilar", typeName(l.search_type_ids?.[0])]
                    .filter(Boolean)
                    .join(" · ")}
                </TableCell>
                <TableCell className="max-w-[220px] truncate">{l.search_locations?.join(", ") || "—"}</TableCell>
                <TableCell className="tabular-nums">
                  {[money(l.search_budget_min, l.search_currency), money(l.search_budget_max, l.search_currency)]
                    .filter(Boolean)
                    .join(" – ") || "—"}
                </TableCell>
                <TableCell>{l.search_urgency ? URGENCY[l.search_urgency] : "—"}</TableCell>
                <TableCell>
                  <span className="flex items-center gap-2">
                    {days === null ? "Nunca" : days === 0 ? "Hoy" : `Hace ${days} d`}
                    {stale && <StatusBadge tone="warning">Reconfirmar</StatusBadge>}
                  </span>
                </TableCell>
                <TableCell>
                  <ConfirmSearchButton leadId={l.id} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
