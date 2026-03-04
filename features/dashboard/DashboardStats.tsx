import { Building2, Users, Eye, Activity } from "lucide-react";
import { Card, CardContent } from "@/shared/components/ui/card";

type StatsProps = {
  stats: {
    totalProperties: number;
    totalViews: number;
    activeProperties: number;
    recentLeadsCount: number;
  };
  biMetrics: {
    totalRevenue: number;
    closedDealsCount: number;
    closedDealsThisMonth: number;
    newLeadsCount: number;
    contactedLeadsCount: number;
    leadsThisMonth: number;
  };
};

export function DashboardStats({ stats, biMetrics }: StatsProps) {
  const operationalItems = [
    {
      label: "Propiedades Totales",
      value: stats.totalProperties,
      icon: Building2,
      color: "text-blue-600",
      bg: "bg-blue-50",
    },
    {
      label: "Propiedades Activas",
      value: stats.activeProperties,
      icon: Activity,
      color: "text-green-600",
      bg: "bg-green-50",
    },
    {
      label: "Vistas Totales",
      value: stats.totalViews,
      icon: Eye,
      color: "text-purple-600",
      bg: "bg-purple-50",
    },
    {
      label: "Leads Recientes",
      value: stats.recentLeadsCount,
      icon: Users,
      color: "text-orange-600",
      bg: "bg-orange-50",
    },
  ];

  return (
    <div className="flex flex-col gap-4">
      {/* PANEL DE NEGOCIO (BI) - AHORA CON DATOS REALES */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Ingresos */}
        <div className="bg-white p-5 rounded-2xl border border-zinc-200 shadow-sm flex flex-col justify-between relative overflow-hidden">
          <div className="flex justify-between items-center mb-4">
            <span className="text-sm font-medium text-zinc-500">
              Ingresos Generados
            </span>
            <span className="text-xs font-semibold text-emerald-700 bg-emerald-100/80 px-2 py-1 rounded-full">
              Histórico
            </span>
          </div>
          <span className="text-3xl font-clash font-semibold text-zinc-900">
            USD ${biMetrics.totalRevenue.toLocaleString("es-AR")}
          </span>
        </div>

        {/* Operaciones Cerradas */}
        <div className="bg-white p-5 rounded-2xl border border-zinc-200 shadow-sm flex flex-col justify-between">
          <div className="flex justify-between items-center mb-4">
            <span className="text-sm font-medium text-zinc-500">
              Operaciones Cerradas
            </span>
            <span className="text-xs font-semibold text-emerald-700 bg-emerald-100/80 px-2 py-1 rounded-full">
              +{biMetrics.closedDealsThisMonth} este mes
            </span>
          </div>
          <span className="text-3xl font-clash font-semibold text-zinc-900">
            {biMetrics.closedDealsCount}
          </span>
        </div>

        {/* Nuevos Leads */}
        <div className="bg-white p-5 rounded-2xl border border-zinc-200 shadow-sm flex flex-col justify-between">
          <div className="flex justify-between items-center mb-4">
            <span className="text-sm font-medium text-zinc-500">
              Leads Totales
            </span>
            <span className="text-xs font-semibold text-amber-700 bg-amber-100/80 px-2 py-1 rounded-full">
              +{biMetrics.leadsThisMonth} este mes
            </span>
          </div>
          <span className="text-3xl font-clash font-semibold text-zinc-900">
            {biMetrics.newLeadsCount}
          </span>
        </div>

        {/* Leads en Proceso */}
        <div className="bg-white p-5 rounded-2xl border border-zinc-200 shadow-sm flex flex-col justify-between">
          <div className="flex justify-between items-center mb-4">
            <span className="text-sm font-medium text-zinc-500">
              Leads en Proceso
            </span>
            <span className="text-xs font-semibold text-blue-700 bg-blue-100/80 px-2 py-1 rounded-full">
              Activos
            </span>
          </div>
          <span className="text-3xl font-clash font-semibold text-zinc-900">
            {biMetrics.contactedLeadsCount}
          </span>
        </div>
      </div>

      {/* MÉTRICAS OPERATIVAS */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
        {operationalItems.map((item) => (
          <Card key={item.label} className="border-zinc-200 shadow-sm py-4">
            <CardContent className="flex items-center gap-2">
              <div className={`p-3 rounded-full ${item.bg} ${item.color}`}>
                <item.icon className="w-5 h-5" />
              </div>
              <div>
                <p className="text-xs md:text-sm text-muted-foreground font-medium">
                  {item.label}
                </p>
                <h4 className="text-xl md:text-2xl font-bold font-clash">
                  {item.value}
                </h4>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
