import type { Metadata } from "next";
import { DashboardCalendar } from "@/features/dashboard/Calendar";
import { Page, PageHeader } from "@/shared/components/PageShell";

export const metadata: Metadata = { title: "Agenda" };

// Calendario completo: visitas y eventos por día. El dashboard solo muestra
// los próximos 7 días.
export default function AgendaPage() {
  return (
    <Page width="narrow">
      <PageHeader
        title="Agenda"
        description="Visitas y eventos. Elegí un día para ver o agregar."
      />
      <div className="max-w-md">
        <DashboardCalendar />
      </div>
    </Page>
  );
}
