"use client";

import Link, { useLinkStatus } from "next/link";

const PERIOD_OPTIONS = [
  { value: "30", label: "30 días" },
  { value: "90", label: "90 días" },
  { value: "365", label: "12 meses" },
  { value: "todo", label: "Histórico" },
] as const;

// Punto de tamaño fijo, siempre renderizado: evita saltos de layout.
function PendingDot() {
  const { pending } = useLinkStatus();
  return (
    <span
      aria-hidden
      className={`ml-1.5 inline-block size-1.5 rounded-full bg-current transition-opacity duration-150 ${pending ? "animate-pulse opacity-100" : "opacity-0"}`}
    />
  );
}

export function PeriodNav({ selected }: { selected: string }) {
  return (
    <nav
      aria-label="Período del reporte"
      className="inline-flex flex-wrap gap-1 rounded-lg border border-border bg-card p-1"
    >
      {PERIOD_OPTIONS.map((option) => (
        <Link
          key={option.value}
          href={`/dashboard/reportes?periodo=${option.value}`}
          scroll={false}
          aria-current={selected === option.value ? "page" : undefined}
          className={`inline-flex items-center rounded-md px-3 py-1.5 text-xs font-medium transition-colors active:scale-[0.97] ${selected === option.value ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground"}`}
        >
          {option.label}
          <PendingDot />
        </Link>
      ))}
    </nav>
  );
}
