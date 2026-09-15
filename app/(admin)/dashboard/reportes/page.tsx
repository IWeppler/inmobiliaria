import { createClientServer } from "@/lib/supabase";
import { redirect } from "next/navigation";
import { getReportData } from "@/features/dashboard/reports/getReportData";
import { ReportsView } from "@/features/dashboard/reports/ReportsView";

// E1.3: vista analítica separada del dashboard operativo. Tendencias y
// comparaciones -- lo que no hace falta mirar todos los días.
export default async function ReportesPage() {
  const supabase = await createClientServer();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: agent } = await supabase
    .from("agents")
    .select("role")
    .eq("id", user.id)
    .single();

  const data = await getReportData(supabase, {
    isAdmin: agent?.role === "admin",
    userId: user.id,
  });

  return (
    <div className="theme-tn flex flex-col w-full max-w-[1600px] mx-auto px-4 py-6 gap-6">
      <div>
        <h1 className="text-[26px] font-serif font-semibold tracking-tight text-foreground">
          Reportes
        </h1>
        <p className="text-muted-foreground text-sm mt-1">
          Conversión, ingresos y señales de alerta sobre tu cartera.
        </p>
      </div>
      <ReportsView data={data} />
    </div>
  );
}
