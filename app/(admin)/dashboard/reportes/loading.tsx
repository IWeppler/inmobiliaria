import { ReportsSkeleton } from "@/features/dashboard/reports/ReportsSkeleton";
import { Page } from "@/shared/components/PageShell";

export default function Loading() {
  return (
    <Page>
      <ReportsSkeleton />
    </Page>
  );
}
