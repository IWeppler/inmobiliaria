"use client";

import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { usePathname } from "next/navigation";

type Crumb = { label: string; href?: string };

const sections: Record<string, string> = {
  propiedades: "Propiedades",
  leads: "Leads",
  calendario: "Calendario",
  alquileres: "Alquileres",
  reportes: "Reportes",
  finanzas: "Finanzas",
  agentes: "Equipo",
  ajustes: "Ajustes",
  perfil: "Mi perfil",
};

function getCrumbs(pathname: string): Crumb[] {
  const [, root, section, ...rest] = pathname.split("/");
  const crumbs: Crumb[] = [{ label: "Dashboard", href: "/dashboard" }];

  if (root !== "dashboard" || !section) return crumbs;

  const sectionHref = `/dashboard/${section}`;
  crumbs.push({ label: sections[section] ?? section, href: sectionHref });

  if (section === "propiedades" && rest.length) {
    const labels: Record<string, string> = {
      nueva: "Nueva propiedad",
      editar: "Editar propiedad",
      instagram: "Pieza para Instagram",
      pdf: "PDF de propiedad",
    };
    crumbs.push({ label: labels[rest[0]] ?? "Propiedad" });
  } else if (section === "leads" && rest.length) {
    crumbs.push({ label: "Detalle del lead" });
  } else if (section === "alquileres" && rest.length) {
    const labels: Record<string, string> = {
      nuevo: "Nuevo contrato",
      importar: "Importar contratos",
      propietarios: "Liquidaciones",
      cobranzas: "Cobranzas",
      conciliacion: "Conciliación bancaria",
      vacancia: "Vacancia",
      mantenimiento: "Mantenimiento",
      contactos: "Contactos",
      hoy: "Hoy",
    };

    if (rest[0] === "contactos" && rest[1]) {
      crumbs.push({ label: labels.contactos, href: `${sectionHref}/contactos` });
      crumbs.push({ label: "Cuenta corriente" });
    } else if (labels[rest[0]]) {
      crumbs.push({ label: labels[rest[0]] });
    } else {
      crumbs.push({
        label: "Contrato",
        href: rest.length > 1 ? `${sectionHref}/${rest[0]}` : undefined,
      });
      if (rest[1] === "liquidacion") crumbs.push({ label: "Liquidación" });
      if (rest[1] === "recibo") crumbs.push({ label: "Recibo" });
      if (rest[1] === "contrato") crumbs.push({ label: "Contrato para firmar" });
    }
  }

  return crumbs;
}

export function AppBreadcrumbs() {
  const pathname = usePathname();
  const crumbs = getCrumbs(pathname);

  return (
    <nav aria-label="Ruta de navegación" className="min-w-0 flex-1 overflow-hidden">
      <ol className="flex min-w-0 items-center gap-1.5 text-sm">
        {crumbs.map((crumb, index) => {
          const isCurrent = index === crumbs.length - 1;

          return (
            <li
              key={`${crumb.href ?? crumb.label}-${index}`}
              className={`min-w-0 items-center gap-1.5 ${isCurrent ? "flex" : "hidden sm:flex"}`}
            >
              {index > 0 && (
                <ChevronRight className="hidden size-3.5 shrink-0 text-muted-foreground sm:block" aria-hidden="true" />
              )}
              {isCurrent ? (
                <span aria-current="page" className="truncate font-medium text-foreground">
                  {crumb.label}
                </span>
              ) : (
                <Link href={crumb.href ?? "/dashboard"} className="truncate text-muted-foreground hover:text-foreground">
                  {crumb.label}
                </Link>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
