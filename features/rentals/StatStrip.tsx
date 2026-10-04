import { cn } from "@/lib/utils";

// Franja de indicadores del módulo de alquileres: una sola superficie con
// divisiones de 1px (gap-px sobre bg-border), no cuatro tarjetas sueltas.
// Sin "use client": la usan páginas de servidor y componentes de cliente.
export function StatStrip({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <dl className={cn("grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-border bg-border lg:grid-cols-4", className)}>
      {children}
    </dl>
  );
}

export function Stat({ label, value, detail, tone }: {
  label: string; value: React.ReactNode; detail?: React.ReactNode; tone?: "danger" | "warning" | "info";
}) {
  return (
    <div className="min-w-0 bg-card px-4 py-3">
      <dt className="text-xs font-medium text-muted-foreground">{label}</dt>
      <dd className={cn(
        "mt-0.5 truncate text-lg font-semibold tabular-nums tracking-tight",
        tone === "danger" && "text-danger", tone === "warning" && "text-warning", tone === "info" && "text-info",
      )}>{value}</dd>
      {detail && <dd className="truncate text-xs text-muted-foreground">{detail}</dd>}
    </div>
  );
}
