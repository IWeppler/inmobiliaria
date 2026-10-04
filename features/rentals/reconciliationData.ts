import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/app/types/supabase";
import { addDays } from "@/lib/dates";
import type { ContractCandidate, OpenCharge } from "@/features/rentals/reconciliation";

// Contratos que pueden recibir un pago, con sus deudas abiertas. Corre con
// la sesión del agente (RLS: sus contratos; admin todos). Se excluyen los
// cargos de períodos ya liquidados (no se les puede imputar un cobro) y los
// que vencen más allá de 60 días.
export async function loadReconciliationCandidates(
  supabase: SupabaseClient<Database>,
  today: string,
  contractIds?: string[],
): Promise<ContractCandidate[]> {
  let contractsQuery = supabase.from("rental_contracts")
    .select("id, status, currency, property:properties(title), tenant:rental_contacts!rental_contracts_tenant_id_fkey(full_name, document)");
  if (contractIds) contractsQuery = contractsQuery.in("id", contractIds);
  let chargesQuery = supabase.from("rental_charges")
    .select("id, contract_id, period, due_date, description, amount, entries:rental_payment_entries(amount)")
    .lte("due_date", addDays(today, 60));
  if (contractIds) chargesQuery = chargesQuery.in("contract_id", contractIds);
  let partiesQuery = supabase.from("rental_contract_parties")
    .select("contract_id, contact:rental_contacts(full_name, document)").eq("role", "CO_INQUILINO");
  if (contractIds) partiesQuery = partiesQuery.in("contract_id", contractIds);

  const [{ data: contracts }, { data: charges }, { data: settlements }, { data: parties }] = await Promise.all([
    contractsQuery,
    chargesQuery,
    supabase.from("rental_settlements").select("contract_id, period"),
    partiesQuery,
  ]);

  const settled = new Set((settlements ?? []).map((s) => `${s.contract_id}|${s.period}`));
  const openByContract = new Map<string, OpenCharge[]>();
  for (const charge of charges ?? []) {
    if (settled.has(`${charge.contract_id}|${charge.period}`)) continue;
    const paid = (charge.entries ?? []).reduce((sum, e) => sum + Number(e.amount), 0);
    const outstanding = Math.round((Number(charge.amount) - paid) * 100) / 100;
    if (outstanding <= 0) continue;
    const list = openByContract.get(charge.contract_id) ?? [];
    list.push({ id: charge.id, due_date: charge.due_date, description: charge.description, outstanding });
    openByContract.set(charge.contract_id, list);
  }

  const coTenants = new Map<string, { full_name: string; document: string | null }[]>();
  for (const party of parties ?? []) {
    const contact = party.contact as unknown as { full_name: string; document: string | null } | null;
    if (contact) coTenants.set(party.contract_id, [...(coTenants.get(party.contract_id) ?? []), contact]);
  }

  return (contracts ?? [])
    .filter((c) => openByContract.has(c.id))
    .map((c) => {
      const tenant = c.tenant as unknown as { full_name: string; document: string | null } | null;
      const property = c.property as unknown as { title: string } | null;
      const people = [tenant, ...(coTenants.get(c.id) ?? [])].filter((p): p is { full_name: string; document: string | null } => !!p);
      return {
        id: c.id,
        label: `${tenant?.full_name ?? "Sin inquilino"} · ${property?.title ?? "Propiedad"}`,
        currency: c.currency,
        names: people.map((p) => p.full_name),
        documents: people.map((p) => p.document).filter((d): d is string => !!d),
        open: (openByContract.get(c.id) ?? []).sort((a, b) => a.due_date.localeCompare(b.due_date)),
      };
    })
    .sort((a, b) => a.label.localeCompare(b.label, "es"));
}
