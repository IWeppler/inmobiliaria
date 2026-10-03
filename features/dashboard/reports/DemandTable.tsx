"use client";

import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import type { DemandItem } from "@/features/dashboard/reports/getReportInsights";
import {
  SortHead,
  useSortable,
} from "@/features/dashboard/reports/useSortable";
import {
  Table,
  TableBody,
  TableCell,
  TableHeader,
  TableRow,
} from "@/shared/components/ui/table";

type Key = "title" | "inquiries" | "visits" | "negotiations" | "ageDays";

const ACCESSORS = {
  title: (row: DemandItem) => row.title,
  inquiries: (row: DemandItem) => row.inquiries,
  visits: (row: DemandItem) => row.visits,
  negotiations: (row: DemandItem) => row.negotiations,
  ageDays: (row: DemandItem) => row.ageDays,
} satisfies Record<Key, (row: DemandItem) => number | string>;

export function DemandTable({
  rows,
  silent = false,
}: {
  rows: DemandItem[];
  silent?: boolean;
}) {
  const { sorted, sort, toggle } = useSortable<DemandItem, Key>(
    rows,
    ACCESSORS,
    silent
      ? { key: "ageDays", dir: "desc" }
      : { key: "inquiries", dir: "desc" },
  );
  if (!rows.length)
    return (
      <p className="rounded-md border border-dashed border-border p-4 text-sm text-muted-foreground">
        {silent
          ? "Todas las propiedades disponibles recibieron consultas en los últimos 30 días."
          : "Todavía no hay propiedades con consultas en este período."}
      </p>
    );
  const table = (
    <Table
      className={`table-fixed ${silent ? "min-w-[300px]" : "min-w-[560px]"}`}
    >
      <TableHeader>
        <TableRow>
          <SortHead
            label="Propiedad"
            sortKey="title"
            sort={sort}
            onToggle={toggle}
            className={silent ? "w-[75%]" : "w-[46%]"}
          />
          {!silent && (
            <>
              <SortHead
                label="Consultas"
                sortKey="inquiries"
                sort={sort}
                onToggle={toggle}
                align="right"
              />
              <SortHead
                label="Visitas"
                sortKey="visits"
                sort={sort}
                onToggle={toggle}
                align="right"
              />
              <SortHead
                label="Negociación"
                sortKey="negotiations"
                sort={sort}
                onToggle={toggle}
                align="right"
              />
            </>
          )}
          <SortHead
            label="Días"
            sortKey="ageDays"
            sort={sort}
            onToggle={toggle}
            align="right"
          />
        </TableRow>
      </TableHeader>
      <TableBody>
        {sorted.map((row) => (
          <TableRow key={row.id}>
            <TableCell className="py-2">
              <Link
                href={`/dashboard/propiedades/${row.id}`}
                title={row.title}
                className="flex max-w-full items-center gap-1 font-medium underline decoration-border underline-offset-4 hover:text-primary hover:decoration-current"
              >
                <span className="min-w-0 truncate">{row.title}</span>
                <ArrowUpRight className="size-3.5 shrink-0" />
              </Link>
              {row.city && (
                <span
                  className="block truncate text-xs text-muted-foreground"
                  title={row.city}
                >
                  {row.city}
                </span>
              )}
            </TableCell>
            {!silent && (
              <>
                <TableCell className="py-2 text-right tabular-nums">
                  {row.inquiries}
                </TableCell>
                <TableCell className="py-2 text-right tabular-nums">
                  {row.visits}
                </TableCell>
                <TableCell className="py-2 text-right tabular-nums">
                  {row.negotiations}
                </TableCell>
              </>
            )}
            <TableCell className="py-2 text-right tabular-nums">
              {row.ageDays}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );

  // El ranking está acotado a 10 filas y define la altura de la fila. La lista
  // sin consultas no tiene tope: se posiciona en absoluto para no estirar la
  // fila y scrollea dentro del alto que le deja su vecina.
  if (!silent) return table;
  return (
    <div className="relative min-h-[280px] flex-1">
      <div className="absolute inset-0 overflow-y-auto">{table}</div>
    </div>
  );
}
