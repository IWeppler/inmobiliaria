import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/shared/components/ui/button";

// Shell único del panel: todas las pantallas se arman con <Page> +
// <PageHeader>. Un solo contenedor, un solo título (20px), una sola
// forma de ubicar las acciones. Nada de headers reconstruidos a mano.

type PageProps = React.ComponentProps<"div"> & {
  /** `full` listados y dashboard (1600px); `narrow` formularios y detalle (1024px). */
  width?: "full" | "narrow";
};

export function Page({ width = "full", className, ...props }: PageProps) {
  return (
    <div
      data-slot="page"
      className={cn(
        "mx-auto flex w-full min-w-0 flex-col gap-6 px-4 py-5 md:px-6",
        width === "full" ? "max-w-[1600px]" : "max-w-5xl",
        className,
      )}
      {...props}
    />
  );
}

type PageHeaderProps = {
  title: React.ReactNode;
  /** Una línea, 13px secundario. Solo si agrega información (conteos, contexto). */
  description?: React.ReactNode;
  /** Acciones a la derecha: un solo botón primario por pantalla. */
  actions?: React.ReactNode;
  /** Ruta de vuelta para pantallas de detalle / alta. */
  backHref?: string;
  /** Contenido pegado al título (badge de estado en detalles). */
  aside?: React.ReactNode;
  className?: string;
};

export function PageHeader({
  title,
  description,
  actions,
  backHref,
  aside,
  className,
}: PageHeaderProps) {
  return (
    <header
      data-slot="page-header"
      className={cn(
        "flex flex-wrap items-start justify-between gap-x-6 gap-y-3",
        className,
      )}
    >
      <div className="flex min-w-0 items-start gap-2">
        {backHref && (
          <Button
            asChild
            variant="ghost"
            size="icon"
            className="-ml-2 mt-px shrink-0 text-muted-foreground"
          >
            <Link href={backHref} aria-label="Volver">
              <ArrowLeft />
            </Link>
          </Button>
        )}
        <div className="min-w-0">
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            <h1 className="truncate text-xl font-semibold tracking-tight text-foreground">
              {title}
            </h1>
            {aside}
          </div>
          {description && (
            <p className="mt-0.5 text-sm text-fg-secondary">{description}</p>
          )}
        </div>
      </div>
      {actions && (
        <div className="flex shrink-0 items-center gap-2">{actions}</div>
      )}
    </header>
  );
}
