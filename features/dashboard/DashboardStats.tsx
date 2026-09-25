import Link from "next/link";

// KPIs operativos en una fila baja: label 12px arriba, valor 20px abajo.
// Sin íconos ni hints; el detalle vive en cada sección.
type StatsProps = {
  stats: {
    activeProperties: number;
    openLeads: number;
    visitsThisWeek: number;
    closedThisMonth: number;
  };
};

const nf = new Intl.NumberFormat("es-AR");

export function DashboardStats({ stats }: StatsProps) {
  const items = [
    { label: "Leads activos", value: stats.openLeads, href: "/dashboard/leads" },
    { label: "Propiedades activas", value: stats.activeProperties, href: "/dashboard/propiedades" },
    { label: "Visitas esta semana", value: stats.visitsThisWeek, href: "/dashboard/reportes" },
    { label: "Cierres este mes", value: stats.closedThisMonth, href: "/dashboard/reportes" },
  ];

  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
      {items.map((item) => (
        <Link
          key={item.label}
          href={item.href}
          className="flex h-16 flex-col justify-center gap-0.5 rounded-lg border border-border bg-card px-4 transition-colors hover:border-border-strong"
        >
          <span className="truncate text-xs font-medium text-muted-foreground">{item.label}</span>
          <span className="text-xl font-semibold leading-none tracking-tight text-foreground">
            {nf.format(item.value)}
          </span>
        </Link>
      ))}
    </div>
  );
}
