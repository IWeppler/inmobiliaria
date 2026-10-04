import { notFound, redirect } from "next/navigation";
import { createClientServer } from "@/lib/supabase";
import { ymdInAppTz } from "@/lib/dates";
import { BRAND } from "@/lib/brand";
import { Page, PageHeader } from "@/shared/components/PageShell";
import type { TemplateData, TemplatePerson } from "@/features/rentals/contractTemplate";
import { ContractGenerator } from "@/features/rentals/ContractGenerator";

type Contact = { full_name: string; document: string | null; address: string | null };

// /dashboard/alquileres/[id]/contrato: contrato listo para firmar a partir
// de una plantilla y los datos cargados (E4.16).
export default async function ContratoPlantillaPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClientServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [{ data: contract }, { data: parties }, { data: templates }] = await Promise.all([
    supabase.from("rental_contracts").select(`start_date, end_date, rent_amount, currency, adjustment_index, adjustment_months,
      adjustment_pct, index_lag_months, payment_due_day, deposit_amount, guarantee_type, guarantee_detail, late_fee_pct_daily, late_fee_fixed,
      property:properties(title, street_address, neighborhood, city, province),
      owner:rental_contacts!rental_contracts_owner_id_fkey(full_name, document, address),
      tenant:rental_contacts!rental_contracts_tenant_id_fkey(full_name, document, address)`).eq("id", id).maybeSingle(),
    supabase.from("rental_contract_parties").select("role, share_pct, contact:rental_contacts(full_name, document, address)").eq("contract_id", id),
    supabase.from("rental_contract_templates").select("id, name, body, is_default").order("name"),
  ]);
  if (!contract) notFound();

  const byRole = (role: string): TemplatePerson[] => (parties ?? [])
    .filter((p) => p.role === role)
    .map((p) => ({ ...(p.contact as unknown as Contact), share_pct: p.share_pct }))
    .filter((p) => !!p.full_name);
  const owner = contract.owner as unknown as Contact | null;
  const tenant = contract.tenant as unknown as Contact | null;

  const data: TemplateData = {
    contract: {
      start_date: contract.start_date, end_date: contract.end_date, rent_amount: Number(contract.rent_amount), currency: contract.currency,
      adjustment_index: contract.adjustment_index, adjustment_months: contract.adjustment_months,
      adjustment_pct: contract.adjustment_pct, index_lag_months: contract.index_lag_months ?? 0,
      payment_due_day: contract.payment_due_day, deposit_amount: Number(contract.deposit_amount ?? 0),
      guarantee_type: contract.guarantee_type, guarantee_detail: contract.guarantee_detail,
      late_fee_pct_daily: Number(contract.late_fee_pct_daily ?? 0), late_fee_fixed: Number(contract.late_fee_fixed ?? 0),
    },
    property: contract.property as unknown as TemplateData["property"],
    owners: [...(owner ? [owner] : []), ...byRole("CO_PROPIETARIO")],
    tenants: [...(tenant ? [tenant] : []), ...byRole("CO_INQUILINO")],
    guarantors: byRole("GARANTE"),
    agencyName: BRAND.name,
    today: ymdInAppTz(),
  };

  return (
    <Page width="narrow">
      <PageHeader
        backHref={`/dashboard/alquileres/${id}`}
        title="Contrato para firmar"
        description="Se completa con los datos cargados. Podés retocar el texto antes de descargarlo."
      />
      <ContractGenerator contractId={id} data={data} templates={templates ?? []} />
    </Page>
  );
}
