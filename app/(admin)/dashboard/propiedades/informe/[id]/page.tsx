import { notFound, redirect } from "next/navigation";
import type { Metadata } from "next";
import { createClientServer } from "@/lib/supabase";
import { OwnerReportViewer } from "@/features/dashboard/property/OwnerReportViewer";
import { getPropertyPerformance } from "@/features/dashboard/property/performanceData";
import type { Period } from "@/features/dashboard/property/performance";
import { formatPrice, operationLabel } from "@/features/dashboard/property/propertyStatus";

export const metadata: Metadata = { title: "Informe para el propietario" };

const PERIOD_LABEL: Record<Period, string> = {
  "30": "Ultimos 30 dias",
  "90": "Ultimos 90 dias",
  todo: "Desde la publicacion",
};

// Informe de rendimiento para entregarle al propietario. La sesión y el
// acceso a la propiedad se validan con el cliente del usuario (RLS); los
// números agregados salen de performanceData.
export default async function OwnerReportPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ periodo?: string }>;
}) {
  const { id } = await params;
  const { periodo } = await searchParams;
  const period: Period = periodo === "30" || periodo === "90" ? periodo : "todo";

  const supabase = await createClientServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: property } = await supabase.from("properties").select("*").eq("id", id).single();
  if (!property) notFound();

  const perf = await getPropertyPerformance(property, period);

  return (
    <OwnerReportViewer
      data={{
        title: property.title,
        location: [property.street_address, property.neighborhood, property.city].filter(Boolean).join(", "),
        priceLabel: formatPrice(property.price, property.currency),
        operation: property.operation_type ? operationLabel(property.operation_type) : null,
        periodLabel: PERIOD_LABEL[period],
        generatedOn: new Date().toLocaleDateString("es-AR", { day: "numeric", month: "long", year: "numeric" }),
        perf,
      }}
    />
  );
}
