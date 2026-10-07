"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Search, X } from "lucide-react";
import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/shared/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/shared/components/ui/table";
import { StatusBadge } from "@/shared/components/StatusBadge";
import { CONTRACT_STATUS_LABELS, CONTRACT_STATUS_TONE, daysBetween, formatDate, money, type RentalAlertSettings } from "@/features/rentals/logic";
import { contractCode } from "@/features/rentals/codes";

export type ContractListRow = {
  id: string; number: number; status: string; propertyTitle: string; tenantName: string | null; ownerName: string | null;
  rentAmount: number; currency: string; endDate: string; nextAdjustmentDate: string | null;
  overdueBalance: number; overdueCount: number; renewed: boolean;
};

type StatusFilter = "ACTIVO" | "CERRADOS" | "TODOS";
type Focus = "TODOS" | "MORA" | "AJUSTE" | "VENCE";

export function ContractsTable({ rows, today, alerts }: { rows: ContractListRow[]; today: string; alerts: RentalAlertSettings }) {
  const [q, setQ] = useState("");
  const [status, setStatus] = useState<StatusFilter>("ACTIVO");
  const [focus, setFocus] = useState<Focus>("TODOS");

  const filtered = useMemo(() => {
    const text = q.trim().toLowerCase();
    return rows.filter((row) => {
      if (status === "ACTIVO" && row.status !== "ACTIVO") return false;
      if (status === "CERRADOS" && row.status === "ACTIVO") return false;
      if (focus === "MORA" && row.overdueCount === 0) return false;
      if (focus === "AJUSTE" && !(row.nextAdjustmentDate && daysBetween(today, row.nextAdjustmentDate) <= alerts.adjustmentAlertDays)) return false;
      if (focus === "VENCE" && !(row.status === "ACTIVO" && !row.renewed && daysBetween(today, row.endDate) <= alerts.expiryAlertDays)) return false;
      if (text && ![row.propertyTitle, row.tenantName, row.ownerName, contractCode(row.number)].some((value) => value?.toLowerCase().includes(text))) return false;
      return true;
    });
  }, [rows, q, status, focus, today, alerts.adjustmentAlertDays, alerts.expiryAlertDays]);

  const hasFilters = q.trim() !== "" || status !== "ACTIVO" || focus !== "TODOS";

  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative w-full sm:w-72">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar propiedad, inquilino o propietario" className="pl-8" aria-label="Buscar contrato" />
        </div>
        <Select value={status} onValueChange={(value) => setStatus(value as StatusFilter)}>
          <SelectTrigger className="w-[150px]" aria-label="Estado"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="ACTIVO">Activos</SelectItem>
            <SelectItem value="CERRADOS">Cerrados</SelectItem>
            <SelectItem value="TODOS">Todos</SelectItem>
          </SelectContent>
        </Select>
        <Select value={focus} onValueChange={(value) => setFocus(value as Focus)}>
          <SelectTrigger className="w-[190px]" aria-label="Situación"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="TODOS">Cualquier situación</SelectItem>
            <SelectItem value="MORA">Con deuda vencida</SelectItem>
            <SelectItem value="AJUSTE">Ajuste en {alerts.adjustmentAlertDays} días</SelectItem>
            <SelectItem value="VENCE">Vencen en {alerts.expiryAlertDays} días</SelectItem>
          </SelectContent>
        </Select>
        {hasFilters && <Button variant="ghost" size="sm" onClick={() => { setQ(""); setStatus("ACTIVO"); setFocus("TODOS"); }}><X /> Limpiar</Button>}
        <span className="ml-auto text-sm text-muted-foreground">{filtered.length} {filtered.length === 1 ? "contrato" : "contratos"}</span>
      </div>

      <div className="overflow-hidden rounded-lg border border-border bg-card">
        {rows.length === 0 ? (
          <div className="px-4 py-10 text-center text-sm text-muted-foreground">
            Todavía no hay contratos. Creá el primero o importalos desde un CSV.
          </div>
        ) : filtered.length === 0 ? (
          <div className="px-4 py-10 text-center text-sm text-muted-foreground">Ningún contrato coincide con los filtros.</div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Propiedad</TableHead>
                <TableHead className="hidden lg:table-cell">Propietario</TableHead>
                <TableHead className="text-right">Canon</TableHead>
                <TableHead className="text-right">Saldo vencido</TableHead>
                <TableHead className="hidden md:table-cell">Próximo ajuste</TableHead>
                <TableHead className="hidden md:table-cell">Vence</TableHead>
                <TableHead>Estado</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((row) => {
                const daysLeft = daysBetween(today, row.endDate);
                const adjustSoon = row.nextAdjustmentDate && daysBetween(today, row.nextAdjustmentDate) <= alerts.adjustmentAlertDays;
                return (
                  <TableRow key={row.id}>
                    <TableCell className="max-w-[280px]">
                      <Link href={`/dashboard/alquileres/${row.id}`} className="block truncate font-medium hover:text-primary hover:underline">{row.propertyTitle}</Link>
                      <span className="block truncate text-xs text-muted-foreground"><span className="tabular-nums">{contractCode(row.number)}</span> · {row.tenantName ?? "Sin inquilino"}</span>
                    </TableCell>
                    <TableCell className="hidden text-muted-foreground lg:table-cell">{row.ownerName}</TableCell>
                    <TableCell className="text-right tabular-nums">{money(row.rentAmount, row.currency)}</TableCell>
                    <TableCell className="text-right tabular-nums">
                      {row.overdueCount > 0
                        ? <Link href={`/dashboard/alquileres/${row.id}?tab=cuenta`} className="font-medium text-danger hover:underline">{money(row.overdueBalance, row.currency)}</Link>
                        : <span className="text-muted-foreground">—</span>}
                    </TableCell>
                    <TableCell className={`hidden md:table-cell ${adjustSoon ? "font-medium text-info" : "text-muted-foreground"}`}>{formatDate(row.nextAdjustmentDate)}</TableCell>
                    <TableCell className={`hidden md:table-cell ${row.status === "ACTIVO" && !row.renewed && daysLeft <= alerts.expiryAlertDays ? "font-medium text-warning" : "text-muted-foreground"}`}>
                      {formatDate(row.endDate)}
                    </TableCell>
                    <TableCell>
                      <StatusBadge tone={row.renewed && row.status === "ACTIVO" ? "info" : CONTRACT_STATUS_TONE[row.status] ?? "neutral"}>
                        {row.renewed && row.status === "ACTIVO" ? "Renovado" : CONTRACT_STATUS_LABELS[row.status] ?? row.status}
                      </StatusBadge>
                    </TableCell>
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
