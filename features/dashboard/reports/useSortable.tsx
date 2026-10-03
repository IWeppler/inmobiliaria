"use client";

import { useMemo, useState } from "react";
import { ArrowDown, ArrowUp, ChevronsUpDown } from "lucide-react";
import { TableHead } from "@/shared/components/ui/table";

type Sortable = number | string | null;
export type SortState<K extends string> = { key: K; dir: "asc" | "desc" };

// `accessors` debe ser una constante de módulo para no invalidar el memo.
export function useSortable<T, K extends string>(
  rows: T[],
  accessors: Record<K, (row: T) => Sortable>,
  initial: SortState<K>,
) {
  const [sort, setSort] = useState(initial);
  const sorted = useMemo(() => {
    const read = accessors[sort.key];
    const factor = sort.dir === "asc" ? 1 : -1;
    return [...rows].sort((a, b) => {
      const left = read(a);
      const right = read(b);
      if (left === right) return 0;
      if (left === null) return 1; // vacíos siempre al final
      if (right === null) return -1;
      if (typeof left === "number" && typeof right === "number")
        return (left - right) * factor;
      return String(left).localeCompare(String(right), "es") * factor;
    });
  }, [rows, accessors, sort]);
  const toggle = (key: K) =>
    setSort((current) =>
      current.key === key
        ? { key, dir: current.dir === "asc" ? "desc" : "asc" }
        : { key, dir: "desc" },
    );
  return { sorted, sort, toggle };
}

export function SortHead<K extends string>({
  label,
  sortKey,
  sort,
  onToggle,
  align = "left",
  className,
}: {
  label: string;
  sortKey: K;
  sort: SortState<K>;
  onToggle: (key: K) => void;
  align?: "left" | "right";
  className?: string;
}) {
  const active = sort.key === sortKey;
  const Icon = !active
    ? ChevronsUpDown
    : sort.dir === "asc"
      ? ArrowUp
      : ArrowDown;
  return (
    <TableHead
      aria-sort={
        active ? (sort.dir === "asc" ? "ascending" : "descending") : "none"
      }
      className={`${align === "right" ? "text-right" : ""} ${className ?? ""}`}
    >
      <button
        type="button"
        onClick={() => onToggle(sortKey)}
        className={`inline-flex items-center gap-1 rounded-sm outline-none transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring ${align === "right" ? "flex-row-reverse" : ""} ${active ? "text-foreground" : ""}`}
      >
        {label}
        <Icon className={`size-3 ${active ? "" : "opacity-40"}`} aria-hidden />
      </button>
    </TableHead>
  );
}
