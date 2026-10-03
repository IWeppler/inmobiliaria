import { cn } from "@/lib/utils";

// Tarjeta común de los reportes: encabezado con título, subtítulo corto y, si
// hace falta, reglas de cálculo plegadas en `notes`. Ocupa toda la altura de
// su celda para que las tarjetas de una misma fila terminen alineadas.
export function ReportSection({
  title,
  subtitle,
  notes,
  action,
  bodyClassName,
  children,
}: {
  title: string;
  subtitle?: string;
  notes?: React.ReactNode;
  action?: React.ReactNode;
  bodyClassName?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="flex h-full min-w-0 flex-col rounded-lg border border-border bg-card">
      <div className="flex items-start justify-between gap-3 px-5 pb-4 pt-5">
        <div className="min-w-0">
          <h3 className="text-[15px] font-semibold tracking-tight">{title}</h3>
          {subtitle && (
            <p className="mt-0.5 text-[13px] leading-relaxed text-muted-foreground">
              {subtitle}
            </p>
          )}
          {notes && (
            <details className="mt-1 text-[13px] text-muted-foreground">
              <summary className="w-fit cursor-pointer rounded-sm underline decoration-border underline-offset-4 outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring">
                Cómo se calcula
              </summary>
              <div className="mt-1 max-w-prose leading-relaxed">{notes}</div>
            </details>
          )}
        </div>
        {action && <div className="shrink-0">{action}</div>}
      </div>
      <div
        className={cn("flex min-h-0 flex-1 flex-col px-5 pb-5", bodyClassName)}
      >
        {children}
      </div>
    </section>
  );
}
