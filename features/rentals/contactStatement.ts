import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { CHARGE_LABELS, formatPeriod, round2 } from "@/features/rentals/logic";
import { buildStatement, statementYears, type CurrencyStatement, type StatementMovement } from "@/features/rentals/statement";

// Estado de cuenta consolidado de un contacto. Lo usan la ficha interna
// (cliente con la sesión del agente: RLS limita a sus contratos) y el link
// público de estado de cuenta (cliente service_role, ya validado el token:
// todos los contratos de esa persona). `internal` decide si los movimientos
// enlazan a pantallas del panel; afuera no hay links internos.

export type StatementContract = {
  id: string; status: string; start_date: string; end_date: string; currency: string; owner_id: string; tenant_id: string;
  deposit_amount: number; deposit_received_at: string | null; deposit_returned_at: string | null;
  property: { title: string } | null;
};
type Charge = {
  id: string; contract_id: string; period: string; due_date: string; kind: string; description: string; amount: number; currency: string;
  entries: { id: string; amount: number; paid_at: string; receipt_number: number }[];
};
type Share = {
  id: string; share_pct: number; amount: number; paid_to_owner_at: string | null; payout_method: string | null; payout_reference: string | null;
  settlement: {
    id: string; period: string; issued_at: string; currency: string;
    rent_amount: number; other_collected_amount: number; commission_amount: number; expenses_amount: number;
    contract: { id: string; property: { title: string } | null } | null;
  } | null;
};
export type AnnualRow = { year: string; currency: string; collected: number; commission: number; expenses: number; net: number; paid: number };
export type PendingCharge = Charge & { balance: number };

export type ContactStatementData = {
  contact: { id: string; kind: string; full_name: string; document: string | null; phone: string | null; email: string | null; address: string | null; notes: string | null };
  tenantContracts: StatementContract[];
  ownerContracts: StatementContract[];
  overdue: PendingCharge[];
  upcoming: PendingCharge[];
  tenantStatement: CurrencyStatement[];
  ownerStatement: CurrencyStatement[];
  annualRows: AnnualRow[];
  owedToOwner: [string, number][];
  depositsHeld: StatementContract[];
  yearOptions: number[];
  isTenant: boolean;
  isOwner: boolean;
};

const METHOD_LABELS: Record<string, string> = { TRANSFERENCIA: "Transferencia", EFECTIVO: "Efectivo", OTRO: "Otro" };
const CONTRACT_FIELDS = "id, status, start_date, end_date, currency, owner_id, tenant_id, deposit_amount, deposit_received_at, deposit_returned_at, property:properties(title)";

export function totalsByCurrency(items: { amount: number; currency: string }[]): [string, number][] {
  const map = new Map<string, number>();
  for (const item of items) map.set(item.currency, round2((map.get(item.currency) ?? 0) + item.amount));
  return [...map.entries()].filter(([, amount]) => Math.abs(amount) > 0.005);
}

export async function loadContactStatement(
  supabase: SupabaseClient,
  contactId: string,
  { today, year, internal }: { today: string; year: number | null; internal: boolean },
): Promise<ContactStatementData | null> {
  const { data: contact } = await supabase.from("rental_contacts")
    .select("id, kind, full_name, document, phone, email, address, notes").eq("id", contactId).maybeSingle();
  if (!contact) return null;

  // Contratos en los que participa: como titular o como co-titular.
  const [{ data: asTenant }, { data: asOwner }, { data: parties }] = await Promise.all([
    supabase.from("rental_contracts").select(CONTRACT_FIELDS).eq("tenant_id", contactId),
    supabase.from("rental_contracts").select(CONTRACT_FIELDS).eq("owner_id", contactId),
    supabase.from("rental_contract_parties").select(`role, contract:rental_contracts(${CONTRACT_FIELDS})`).eq("contact_id", contactId),
  ]);
  const partyRows = (parties ?? []) as unknown as { role: string; contract: StatementContract | null }[];
  const tenantContracts = [
    ...((asTenant ?? []) as unknown as StatementContract[]),
    ...partyRows.filter((p) => p.role === "CO_INQUILINO" && p.contract).map((p) => p.contract!),
  ];
  const ownerContracts = [
    ...((asOwner ?? []) as unknown as StatementContract[]),
    ...partyRows.filter((p) => p.role === "CO_PROPIETARIO" && p.contract).map((p) => p.contract!),
  ];
  const contractById = new Map([...tenantContracts, ...ownerContracts].map((c) => [c.id, c]));

  const [{ data: chargesRaw }, { data: sharesRaw }] = await Promise.all([
    tenantContracts.length
      ? supabase.from("rental_charges")
        .select("id, contract_id, period, due_date, kind, description, amount, currency, entries:rental_payment_entries(id, amount, paid_at, receipt_number)")
        .in("contract_id", tenantContracts.map((c) => c.id))
      : Promise.resolve({ data: [] }),
    supabase.from("rental_settlement_shares")
      .select("id, share_pct, amount, paid_to_owner_at, payout_method, payout_reference, settlement:rental_settlements(id, period, issued_at, currency, rent_amount, other_collected_amount, commission_amount, expenses_amount, contract:rental_contracts(id, property:properties(title)))")
      .eq("contact_id", contactId),
  ]);
  const charges = (chargesRaw ?? []) as unknown as Charge[];
  const shares = ((sharesRaw ?? []) as unknown as Share[]).filter((s) => s.settlement);

  // Inquilino: cargos vencidos hasta hoy (aumentan la deuda) y cobros (la bajan).
  const tenantMovements: StatementMovement[] = [];
  for (const charge of charges) {
    const title = contractById.get(charge.contract_id)?.property?.title ?? "Contrato";
    if (charge.due_date <= today) {
      tenantMovements.push({
        id: `c-${charge.id}`, date: charge.due_date, currency: charge.currency,
        description: charge.description, detail: `${title} · ${CHARGE_LABELS[charge.kind] ?? charge.kind}`,
        increase: charge.amount, decrease: 0, href: internal ? `/dashboard/alquileres/${charge.contract_id}?tab=cuenta` : undefined,
      });
    }
    for (const entry of charge.entries) {
      tenantMovements.push({
        id: `e-${entry.id}`, date: entry.paid_at, currency: charge.currency,
        description: `Pago · recibo N.º ${entry.receipt_number}`, detail: `${title} · ${charge.description}`,
        increase: 0, decrease: entry.amount, href: internal ? `/dashboard/alquileres/${charge.contract_id}/recibo/${entry.id}` : undefined,
      });
    }
  }
  const pending = charges.map((c) => ({ ...c, balance: round2(c.amount - c.entries.reduce((s, e) => s + e.amount, 0)) }))
    .filter((c) => c.balance > 0.005);

  // Propietario: su parte de cada liquidación (a su favor) y transferencias.
  const ownerMovements: StatementMovement[] = [];
  const annual = new Map<string, AnnualRow>();
  for (const share of shares) {
    const s = share.settlement!;
    const title = s.contract?.property?.title ?? "Contrato";
    ownerMovements.push({
      id: `s-${share.id}`, date: s.issued_at, currency: s.currency,
      description: `Liquidación ${formatPeriod(s.period)}`, detail: share.share_pct < 100 ? `${title} · ${share.share_pct} %` : title,
      increase: share.amount, decrease: 0,
      href: internal && s.contract ? `/dashboard/alquileres/${s.contract.id}/liquidacion/${s.id}` : undefined,
    });
    if (share.paid_to_owner_at) {
      ownerMovements.push({
        id: `p-${share.id}`, date: share.paid_to_owner_at, currency: s.currency,
        description: `${METHOD_LABELS[share.payout_method ?? ""] ?? "Pago"} al propietario`,
        detail: [`${title} · ${formatPeriod(s.period)}`, share.payout_reference].filter(Boolean).join(" · "),
        increase: 0, decrease: share.amount,
      });
    }
    // Resumen anual por período liquidado: su parte de cada concepto.
    const key = `${s.period.slice(0, 4)}|${s.currency}`;
    const row = annual.get(key) ?? { year: s.period.slice(0, 4), currency: s.currency, collected: 0, commission: 0, expenses: 0, net: 0, paid: 0 };
    const part = share.share_pct / 100;
    row.collected = round2(row.collected + (s.rent_amount + s.other_collected_amount) * part);
    row.commission = round2(row.commission + s.commission_amount * part);
    row.expenses = round2(row.expenses + s.expenses_amount * part);
    row.net = round2(row.net + share.amount);
    if (share.paid_to_owner_at) row.paid = round2(row.paid + share.amount);
    annual.set(key, row);
  }

  const years = statementYears([...tenantMovements, ...ownerMovements]);
  return {
    // Afuera del panel viaja solo lo que se muestra: nada de documento,
    // teléfono, email ni notas internas (aunque hoy no se rendericen).
    contact: internal ? contact : {
      id: contact.id, kind: contact.kind, full_name: contact.full_name,
      document: null, phone: null, email: null, address: null, notes: null,
    },
    tenantContracts,
    ownerContracts,
    overdue: pending.filter((c) => c.due_date < today),
    upcoming: pending.filter((c) => c.due_date >= today).sort((a, b) => a.due_date.localeCompare(b.due_date)),
    tenantStatement: buildStatement(tenantMovements, year),
    ownerStatement: buildStatement(ownerMovements, year),
    annualRows: [...annual.values()].sort((a, b) => b.year.localeCompare(a.year) || a.currency.localeCompare(b.currency)),
    owedToOwner: totalsByCurrency(shares.filter((s) => !s.paid_to_owner_at).map((s) => ({ amount: s.amount, currency: s.settlement!.currency }))),
    depositsHeld: ownerContracts.filter((c) => c.deposit_amount > 0 && c.deposit_received_at && !c.deposit_returned_at),
    yearOptions: [...new Set([Number(today.slice(0, 4)), ...years])].sort((a, b) => b - a),
    isTenant: tenantContracts.length > 0,
    isOwner: ownerContracts.length > 0 || shares.length > 0,
  };
}

// Año pedido en la URL (?anio=2026 | ?anio=todo); por defecto el actual.
export function parseStatementYear(anio: string | undefined, today: string): number | null {
  if (anio === "todo") return null;
  return /^\d{4}$/.test(anio ?? "") ? Number(anio) : Number(today.slice(0, 4));
}
