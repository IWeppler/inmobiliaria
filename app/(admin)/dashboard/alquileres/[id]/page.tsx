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
       late_fee_pct_daily, payment_due_day, notes,
       property:properties(id, title),
       owner:rental_contacts!rental_contracts_owner_id_fkey(id, full_name, phone, email),
       tenant:rental_contacts!rental_contracts_tenant_id_fkey(id, full_name, phone, email)`
    )
    .eq("id", id)
    .single();
  if (!raw) notFound();

  const c = raw as unknown as Omit<
    ContractDetailData,
    "payments" | "settlements" | "adjustmentPreview" | "today"
  > & { base_rent_amount: number };

  const [{ data: payments }, { data: settlements }, { data: indexValues }] = await Promise.all([
    supabase
      .from("rental_payments")
      .select("id, period, due_date, amount, currency, paid_at, paid_amount, method")
      .eq("contract_id", id)
      .order("period"),
    supabase
      .from("rental_settlements")
      .select("id, period, net_amount, currency, issued_at")
      .eq("contract_id", id)
      .order("period", { ascending: false }),
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
        payments: (payments ?? []) as ContractDetailData["payments"],
        settlements: (settlements ?? []) as ContractDetailData["settlements"],
        adjustmentPreview,
        today: ymdInAppTz(),
      }}
    />
  );
}
