import { notFound, redirect } from "next/navigation";
import { createClientServer } from "@/lib/supabase";
import { ymdInAppTz } from "@/lib/dates";
import { ContractDetail, type ContractDetailData } from "@/features/rentals/ContractDetail";
import { computeAdjustment, periodOf } from "@/features/rentals/logic";

export default async function ContratoPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClientServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: raw } = await supabase
    .from("rental_contracts")
    .select(
      `id, status, start_date, end_date, rent_amount, currency, adjustment_index, adjustment_months,
       adjustment_pct, base_rent_amount, base_period, next_adjustment_date, commission_pct,
       last_adjustment_date, late_fee_pct_daily, late_fee_fixed, payment_due_day,
       guarantee_type, guarantee_detail, deposit_amount, renewed_from_id, notes,
       property:properties(id, title),
       owner:rental_contacts!rental_contracts_owner_id_fkey(id, full_name, phone, email),
       tenant:rental_contacts!rental_contracts_tenant_id_fkey(id, full_name, phone, email)`
    )
    .eq("id", id)
    .single();
  if (!raw) notFound();

  const c = raw as unknown as Omit<
    ContractDetailData,
    "charges" | "settlements" | "adjustments" | "adjustmentPreview" | "today"
  > & { base_rent_amount: number };

  const [{ data: charges }, { data: settlements }, { data: adjustments }, { data: indexValues }] = await Promise.all([
    supabase
      .from("rental_charges")
      .select("id, period, due_date, kind, description, amount, currency, entries:rental_payment_entries(id, amount, paid_at, method, account, receipt_number)")
      .eq("contract_id", id)
      .order("due_date", { ascending: false }),
    supabase
      .from("rental_settlements")
      .select("id, period, net_amount, currency, issued_at")
      .eq("contract_id", id)
      .order("period", { ascending: false }),
    supabase.from("rental_adjustments")
      .select("id, effective_date, previous_amount, new_amount, index_code")
      .eq("contract_id", id).order("effective_date", { ascending: false }),
    c.next_adjustment_date && (c.adjustment_index === "ICL" || c.adjustment_index === "IPC")
      ? supabase
          .from("index_values")
          .select("index_code, period, value")
          .eq("index_code", c.adjustment_index)
          .in("period", [c.base_period, periodOf(c.next_adjustment_date)])
      : Promise.resolve({ data: [] }),
  ]);

  const adjustmentPreview = c.next_adjustment_date
    ? computeAdjustment(c, periodOf(c.next_adjustment_date), indexValues ?? [])
    : null;

  return (
    <ContractDetail
      c={{
        ...c,
        charges: (charges ?? []) as ContractDetailData["charges"],
        settlements: (settlements ?? []) as ContractDetailData["settlements"],
        adjustments: (adjustments ?? []) as ContractDetailData["adjustments"],
        adjustmentPreview,
        today: ymdInAppTz(),
      }}
    />
  );
}
