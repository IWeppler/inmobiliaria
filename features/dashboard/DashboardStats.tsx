import { Building2, Users, Eye, Activity } from "lucide-react";
import { Card, CardContent } from "@/shared/components/ui/card";

// E1.3: el dashboard queda solo con métricas operativas. Ingresos,
// funnel y comparaciones viven en /dashboard/reportes.
type StatsProps = {
  stats: {
    totalProperties: number;
    totalViews: number;
    activeProperties: number;
    newLeadsCount: number;
  };
};

export function DashboardStats({ stats }: StatsProps) {
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
      label: "Leads Nuevos",
      value: stats.newLeadsCount,
      icon: Users,
      color: "text-orange-600",
      bg: "bg-orange-50",
    },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
      {operationalItems.map((item) => (
        <Card
          key={item.label}
          className="border-border shadow-none rounded-md py-4"
        >
          <CardContent className="flex items-center gap-2">
            <div className={`p-3 rounded-full ${item.bg} ${item.color}`}>
              <item.icon className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs md:text-sm text-muted-foreground font-medium">
                {item.label}
              </p>
              <h4 className="text-xl md:text-2xl font-semibold font-serif">
                {item.value}
              </h4>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
