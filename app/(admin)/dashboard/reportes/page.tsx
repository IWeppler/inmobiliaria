import { createClientServer } from "@/lib/supabase";
import { redirect } from "next/navigation";
import { getReportInsights } from "@/features/dashboard/reports/getReportInsights";
import { ReportsView } from "@/features/dashboard/reports/ReportsView";
import { Page, PageHeader } from "@/shared/components/PageShell";

// E1.3: vista analítica separada del dashboard operativo. Tendencias y
// comparaciones -- lo que no hace falta mirar todos los días.
const PERIODS = [30, 90, 365] as const;

export default async function ReportesPage({
  searchParams,
}: {
  searchParams: Promise<{ periodo?: string }>;
}) {
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

  const requestedPeriod = (await searchParams).periodo;
  const periodDays = PERIODS.find((days) => String(days) === requestedPeriod) ?? (requestedPeriod === "todo" ? null : 90);
  const scope = {
    isAdmin: agent?.role === "admin",
    userId: user.id,
    periodDays,
  };
  const insights = await getReportInsights(supabase, scope);

  return (
    <Page>
      <PageHeader
        title="Reportes"
        description="Cartera, origen de leads y oportunidades de mejora."
      />
      <ReportsView insights={insights} isAdmin={scope.isAdmin} />
    </Page>
  );
}
