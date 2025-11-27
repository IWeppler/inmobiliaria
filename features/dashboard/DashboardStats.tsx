import { Building2, Users, Eye, Activity } from "lucide-react";
import { Card, CardContent } from "@/shared/components/ui/card";

type StatsProps = {
  stats: {
    totalProperties: number;
    totalViews: number;
    activeProperties: number;
    recentLeadsCount: number;
  };
};

export function DashboardStats({ stats }: StatsProps) {
  const items = [
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
    <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
      {items.map((item) => (
        <Card key={item.label} className="border-zinc-200 shadow-sm">
          <CardContent className="flex items-center gap-2">
            <div className={`p-3 rounded-full ${item.bg} ${item.color}`}>
              <item.icon className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs md:text-sm text-muted-foreground font-medium">{item.label}</p>
              <h4 className="text-xl md:text-2xl font-bold font-clash">{item.value}</h4>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}