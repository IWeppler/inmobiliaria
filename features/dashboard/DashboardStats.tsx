import Link from "next/link";

// KPIs operativos en una fila baja: label 12px arriba, valor 20px abajo.
// Sin íconos ni hints; el detalle vive en cada sección.
type StatsProps = {
  stats: {
    totalProperties: number;
    totalViews: number;
    activeProperties: number;
    newLeadsCount: number;
    visitsThisWeek: number;
  };
};

const nf = new Intl.NumberFormat("es-AR");

export function DashboardStats({ stats }: StatsProps) {
  const items = [
    { label: "Propiedades activas", value: stats.activeProperties, href: "/dashboard/propiedades" },
    { label: "Leads sin contactar", value: stats.newLeadsCount, href: "/dashboard/leads" },
    { label: "Visitas esta semana", value: stats.visitsThisWeek, href: "/dashboard/agenda" },
    { label: "Vistas del sitio", value: stats.totalViews, href: "/dashboard/reportes" },
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
