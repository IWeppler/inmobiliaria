import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/app/types/supabase";
import { addDays, dayStartISO, ymdInAppTz } from "@/lib/dates";
import { daysBetween } from "@/features/rentals/logic";
import { lostRent, vacancyStage, type ExpiringItem, type RenewalIntent, type VacantItem } from "@/features/rentals/vacancy";

type ContractRow = {
  id: string; property_id: string; status: string; start_date: string; end_date: string; rent_amount: number; currency: string;
  renewal_intent: string | null; renewal_intent_note: string | null; renewed_from_id: string | null;
  tenant: { full_name: string; phone: string | null } | null;
};

// Arma las dos listas de vacancia: contratos que vencen sin sucesor y
// propiedades de alquiler sin contrato activo. Corre con la sesión del
// agente: ve sus contratos (admin todos) y todas las propiedades.
export async function buildVacancy(
  supabase: SupabaseClient<Database>,
  today: string,
  windowDays: number,
  viewer: { id: string; isAdmin: boolean },
): Promise<{ expiring: ExpiringItem[]; vacant: VacantItem[] }> {
  const [{ data: properties }, { data: contractsRaw }] = await Promise.all([
    supabase.from("properties").select("id, title, status, available_from, price, currency, created_at, agent_id").ilike("operation_type", "alquiler"),
    supabase.from("rental_contracts").select("id, property_id, status, start_date, end_date, rent_amount, currency, renewal_intent, renewal_intent_note, renewed_from_id, tenant:rental_contacts!rental_contracts_tenant_id_fkey(full_name, phone)"),
  ]);
  const propertyIds = (properties ?? []).map((p) => p.id);
  const [{ data: leads }, { data: visits }] = propertyIds.length
    ? await Promise.all([
      supabase.from("leads").select("property_id, created_at").in("property_id", propertyIds).gte("created_at", addDays(today, -90)),
      // events.date es la medianoche local guardada como timestamp.
      supabase.from("events").select("property_id, date").in("property_id", propertyIds).eq("type", "visita").gte("date", dayStartISO(today)),
    ])
    : [{ data: [] }, { data: [] }];

  const contracts = (contractsRaw ?? []) as unknown as ContractRow[];
  const byProperty = new Map<string, ContractRow[]>();
  for (const c of contracts) byProperty.set(c.property_id, [...(byProperty.get(c.property_id) ?? []), c]);

  const since30 = addDays(today, -30);
  const leadStats = new Map<string, { leads30: number; last: string | null }>();
  for (const lead of leads ?? []) {
    if (!lead.property_id) continue;
    const day = lead.created_at.slice(0, 10);
    const stat = leadStats.get(lead.property_id) ?? { leads30: 0, last: null };
    if (day >= since30) stat.leads30 += 1;
    if (!stat.last || day > stat.last) stat.last = day;
    leadStats.set(lead.property_id, stat);
  }
  const nextVisit = new Map<string, string>();
  for (const visit of visits ?? []) {
    if (!visit.property_id) continue;
    const day = ymdInAppTz(new Date(visit.date));
    const current = nextVisit.get(visit.property_id);
    if (!current || day < current) nextVisit.set(visit.property_id, day);
  }

  const propertyById = new Map((properties ?? []).map((p) => [p.id, p]));
  const canPublish = (agentId: string | null) => viewer.isAdmin || agentId === viewer.id;

  // Un contrato tiene sucesor si se renovó o si ya hay otro contrato activo
  // que empieza después (el próximo inquilino).
  const hasSuccessor = (c: ContractRow) =>
    contracts.some((o) => o.renewed_from_id === c.id
      || (o.id !== c.id && o.property_id === c.property_id && o.status === "ACTIVO" && o.start_date > c.start_date));

  const expiring: ExpiringItem[] = [];
  for (const c of contracts) {
    if (c.status !== "ACTIVO" || hasSuccessor(c)) continue;
    const daysLeft = daysBetween(today, c.end_date);
    if (daysLeft > windowDays) continue;
    const property = propertyById.get(c.property_id);
    expiring.push({
      contractId: c.id,
      propertyId: c.property_id,
      propertyTitle: property?.title ?? "Propiedad",
      tenantName: c.tenant?.full_name ?? null,
      tenantPhone: c.tenant?.phone ?? null,
      endDate: c.end_date,
      daysLeft,
      intent: (c.renewal_intent as RenewalIntent) ?? null,
      intentNote: c.renewal_intent_note,
      published: property?.status === "EN_ALQUILER",
      availableFrom: property?.available_from ?? null,
      rent: Number(c.rent_amount),
      currency: c.currency,
      leads30: leadStats.get(c.property_id)?.leads30 ?? 0,
      canPublish: canPublish(property?.agent_id ?? null),
    });
  }
  expiring.sort((a, b) => a.daysLeft - b.daysLeft);

  const vacant: VacantItem[] = [];
  for (const p of properties ?? []) {
    const own = byProperty.get(p.id) ?? [];
    if (own.some((c) => c.status === "ACTIVO")) continue;
    const last = [...own].sort((a, b) => b.end_date.localeCompare(a.end_date))[0];
    const vacantSince = last ? addDays(last.end_date, 1) : p.created_at.slice(0, 10);
    const daysVacant = Math.max(0, daysBetween(vacantSince, today));
    const askingRent = p.price && Number(p.price) > 0 ? Number(p.price) : last ? Number(last.rent_amount) : null;
    const currency = p.price && Number(p.price) > 0 ? p.currency ?? "ARS" : last?.currency ?? p.currency ?? "ARS";
    const stats = leadStats.get(p.id);
    const visit = nextVisit.get(p.id) ?? null;
    vacant.push({
      propertyId: p.id,
      propertyTitle: p.title,
      status: p.status ?? "",
      stage: vacancyStage({ status: p.status ?? "", leads30: stats?.leads30 ?? 0, nextVisit: visit }),
      vacantSince,
      daysVacant,
      lastContractId: last?.id ?? null,
      askingRent,
      currency,
      // Alquiler perdido solo si estaba alquilada: si nunca tuvo contrato en
      // el sistema, los días desde el alta no son ingresos que se dejaron de cobrar.
      lostRent: last ? lostRent(askingRent, daysVacant) : null,
      neverRented: !last,
      leads30: stats?.leads30 ?? 0,
      lastLeadAt: stats?.last ?? null,
      nextVisit: visit,
      canPublish: canPublish(p.agent_id),
    });
  }
  vacant.sort((a, b) => b.daysVacant - a.daysVacant);

  return { expiring, vacant };
}
