import { redirect } from "next/navigation";
import { createClientServer } from "@/lib/supabase";
import { ContractForm } from "@/features/rentals/ContractForm";
import { ContractFromPdf } from "@/features/rentals/ContractFromPdf";
import { getPropertyOwners } from "@/features/rentals/propertyOwners";

// La lectura del PDF con IA corre en una server action de esta página.
export const maxDuration = 120;
import type { ContractInput } from "@/features/rentals/actions";
import { parseYmd, ymd } from "@/features/rentals/logic";
import { Page, PageHeader } from "@/shared/components/PageShell";

export default async function NuevoContratoPage({ searchParams }: { searchParams: Promise<{ renovar?: string; propiedad?: string }> }) {
  const supabase = await createClientServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [{ data: properties }, { data: contacts }] = await Promise.all([
    // Cualquier propiedad de alquiler (aunque ya figure ALQUILADO, por si
    // se carga un contrato vigente que no estaba en el sistema).
    supabase
      .from("properties")
      .select("id, title, status")
      .ilike("operation_type", "alquiler")
      .order("title"),
    supabase.from("rental_contacts").select("id, full_name, kind").order("full_name"),
  ]);

  const opts = (contacts ?? []) as { id: string; full_name: string; kind: string }[];
  const { renovar, propiedad } = await searchParams;
  const { data: previous } = renovar && /^[0-9a-f-]{36}$/i.test(renovar)
    ? await supabase.from("rental_contracts").select("id, property_id, owner_id, tenant_id, end_date, rent_amount, currency, adjustment_index, adjustment_months, adjustment_pct, index_lag_months, late_fee_mode, late_fee_grace_days, commission_pct, late_fee_pct_daily, late_fee_fixed, payment_due_day, guarantee_type, guarantee_detail, deposit_amount, notes").eq("id", renovar).single()
    : { data: null };
  const renewal: Partial<ContractInput> | undefined = previous ? {
    property_id: previous.property_id, owner_id: previous.owner_id, tenant_id: previous.tenant_id,
    start_date: ymd(new Date(parseYmd(previous.end_date).getTime() + 86400000)),
    rent_amount: previous.rent_amount, currency: previous.currency as "ARS" | "USD",
    adjustment_index: previous.adjustment_index as ContractInput["adjustment_index"],
    adjustment_months: previous.adjustment_months, adjustment_pct: previous.adjustment_pct ?? 0,
    index_lag_months: previous.index_lag_months,
    late_fee_mode: previous.late_fee_mode as ContractInput["late_fee_mode"],
    late_fee_grace_days: previous.late_fee_grace_days,
    commission_pct: previous.commission_pct, late_fee_pct_daily: previous.late_fee_pct_daily,
    late_fee_fixed: previous.late_fee_fixed, payment_due_day: previous.payment_due_day,
    guarantee_type: previous.guarantee_type as ContractInput["guarantee_type"],
    guarantee_detail: previous.guarantee_detail ?? "", deposit_amount: previous.deposit_amount,
    notes: previous.notes ?? "", renewed_from_id: previous.id,
  } : undefined;

  const propertyOptions = ((properties ?? []) as { id: string; title: string; status: string }[]).map((p) => ({
    id: p.id,
    label: `${p.title}${p.status === "ALQUILADO" ? " (alquilada)" : ""}`,
  }));
  const owners = opts.filter((c) => c.kind === "owner").map((c) => ({ id: c.id, label: c.full_name }));
  const tenants = opts.filter((c) => c.kind === "tenant").map((c) => ({ id: c.id, label: c.full_name }));
  const propertyOwners = await getPropertyOwners(supabase, propertyOptions.map((p) => p.id));

  return (
    <Page width="narrow">
      <PageHeader
        backHref="/dashboard/alquileres"
        title={previous ? "Renovar contrato" : "Nuevo contrato"}
        description={previous ? "Revisá las condiciones del nuevo período antes de guardar." : "Se generan las cuotas mensuales automáticamente y la propiedad pasa a Alquilada."}
      />
      {previous ? (
        <ContractForm properties={propertyOptions} owners={owners} tenants={tenants} initial={renewal} propertyOwners={propertyOwners} />
      ) : (
        <ContractFromPdf properties={propertyOptions} owners={owners} tenants={tenants} userId={user.id} propertyOwners={propertyOwners}
          initialPropertyId={propertyOptions.some((p) => p.id === propiedad) ? propiedad : undefined} />
      )}
    </Page>
  );
}
