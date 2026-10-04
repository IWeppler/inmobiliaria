import { notFound, redirect } from "next/navigation";
import { createClientServer } from "@/lib/supabase";
import { ymdInAppTz } from "@/lib/dates";
import { ContractDetail, type ContractDetailData } from "@/features/rentals/ContractDetail";
import {
  CONTRACT_TABS, computeAdjustment, indexPeriods, periodOf, usesIndexValues, type ContractTab, type SettlementExpense,
} from "@/features/rentals/logic";

const CONTACT_FIELDS = "id, full_name, document, phone, email, address, notes";

export default async function ContratoPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  const { id } = await params;
  const { tab } = await searchParams;
  const initialTab: ContractTab = CONTRACT_TABS.includes(tab as ContractTab) ? (tab as ContractTab) : "resumen";
  const supabase = await createClientServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: raw } = await supabase
    .from("rental_contracts")
    .select(
      `id, status, start_date, end_date, rent_amount, currency, adjustment_index, adjustment_months,
       adjustment_pct, base_rent_amount, base_period, next_adjustment_date, commission_pct, index_lag_months,
       last_adjustment_date, late_fee_pct_daily, late_fee_fixed, late_fee_mode, late_fee_grace_days, payment_due_day,
       guarantee_type, guarantee_detail, deposit_amount, renewed_from_id, notes,
       deposit_received_at, deposit_returned_at, deposit_returned_amount, deposit_deductions,
       property:properties(id, title),
       owner:rental_contacts!rental_contracts_owner_id_fkey(${CONTACT_FIELDS}),
       tenant:rental_contacts!rental_contracts_tenant_id_fkey(${CONTACT_FIELDS})`
    )
    .eq("id", id)
    .single();
  if (!raw) notFound();

  const {
    deposit_amount, deposit_received_at, deposit_returned_at, deposit_returned_amount, deposit_deductions,
    ...c
  } = raw as unknown as Omit<
    ContractDetailData,
    "charges" | "settlements" | "adjustments" | "adjustmentPreview" | "parties" | "deposit" | "maintenance" | "documents" | "contacts" | "today"
  > & {
    base_rent_amount: number; deposit_amount: number; deposit_received_at: string | null;
    deposit_returned_at: string | null; deposit_returned_amount: number | null; deposit_deductions: SettlementExpense[];
  };

  const [
    { data: charges }, { data: settlements }, { data: adjustments }, { data: indexValues },
    { data: parties }, { data: maintenance }, { data: documents }, { data: contacts },
  ] = await Promise.all([
    supabase
      .from("rental_charges")
      .select("id, period, due_date, kind, description, amount, currency, entries:rental_payment_entries(id, amount, paid_at, method, account, receipt_number)")
      .eq("contract_id", id)
      .order("due_date", { ascending: false }),
    supabase
      .from("rental_settlements")
      .select("id, period, net_amount, currency, issued_at, paid_to_owner_at, shares:rental_settlement_shares(id, share_pct, amount, is_primary, paid_to_owner_at, payout_method, payout_reference, contact:rental_contacts(full_name))")
      .eq("contract_id", id)
      .order("period", { ascending: false }),
    supabase.from("rental_adjustments")
      .select("id, effective_date, previous_amount, new_amount, index_code")
      .eq("contract_id", id).order("effective_date", { ascending: false }),
    c.next_adjustment_date && usesIndexValues(c.adjustment_index)
      ? supabase
          .from("index_values")
          .select("index_code, period, value")
          .eq("index_code", c.adjustment_index)
          .in("period", Object.values(indexPeriods(c.base_period, periodOf(c.next_adjustment_date), c.index_lag_months)))
      : Promise.resolve({ data: [] }),
    supabase.from("rental_contract_parties")
      .select(`id, role, share_pct, contact:rental_contacts(${CONTACT_FIELDS})`)
      .eq("contract_id", id).order("created_at"),
    supabase.from("rental_maintenance")
      .select("id, title, description, priority, status, payer, provider, cost, reported_at, resolved_at, charge_id, settlement_id")
      .eq("contract_id", id).order("reported_at", { ascending: false }),
    supabase.from("rental_documents")
      .select("id, kind, file_name, created_at")
      .eq("contract_id", id).order("created_at", { ascending: false }),
    supabase.from("rental_contacts").select("id, full_name, kind").order("full_name"),
  ]);
  const { data: notices } = await supabase.from("rental_notifications")
    .select("id, kind, status, detail, created_at, contact:rental_contacts(full_name)")
    .eq("contract_id", id).order("created_at", { ascending: false }).limit(10);

  const adjustmentPreview = c.next_adjustment_date
    ? computeAdjustment(c, periodOf(c.next_adjustment_date), indexValues ?? [])
    : null;

  return (
    <ContractDetail
      c={{
        ...c,
        charges: (charges ?? []) as ContractDetailData["charges"],
        settlements: (settlements ?? []) as unknown as ContractDetailData["settlements"],
        adjustments: (adjustments ?? []) as ContractDetailData["adjustments"],
        adjustmentPreview,
        parties: (parties ?? []) as unknown as ContractDetailData["parties"],
        deposit: {
          amount: deposit_amount,
          received_at: deposit_received_at,
          returned_at: deposit_returned_at,
          returned_amount: deposit_returned_amount,
          deductions: deposit_deductions ?? [],
        },
        maintenance: (maintenance ?? []) as ContractDetailData["maintenance"],
        documents: (documents ?? []) as ContractDetailData["documents"],
        contacts: (contacts ?? []).map((contact) => ({ id: contact.id, label: contact.full_name, kind: contact.kind })),
        notices: (notices ?? []) as unknown as ContractDetailData["notices"],
        today: ymdInAppTz(),
      }}
      initialTab={initialTab}
    />
  );
}
