import { createClientServer } from "@/lib/supabase";
import { redirect } from "next/navigation";
import { getReportData } from "@/features/dashboard/reports/getReportData";
import { ReportsView } from "@/features/dashboard/reports/ReportsView";
import { Page, PageHeader } from "@/shared/components/PageShell";

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
    <Page>
      <PageHeader
        title="Reportes"
        description="Conversión, ingresos y señales de alerta sobre tu cartera."
      />
      <ReportsView data={data} />
    </Page>
  );
}
