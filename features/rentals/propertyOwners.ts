import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/app/types/supabase";

// Dueños de cada propiedad (tabla property_owners). El contrato los copia al
// crearse; acá solo se leen.

export type PropertyOwner = { contact_id: string; full_name: string; share_pct: number; is_primary: boolean };

export async function getPropertyOwners(
  supabase: SupabaseClient<Database>,
  propertyIds?: string[],
): Promise<Record<string, PropertyOwner[]>> {
  let query = supabase.from("property_owners")
    .select("property_id, contact_id, share_pct, is_primary, contact:rental_contacts(full_name)");
  if (propertyIds) query = query.in("property_id", propertyIds);
  const { data } = await query;

  const byProperty: Record<string, PropertyOwner[]> = {};
  for (const row of data ?? []) {
    const contact = row.contact as unknown as { full_name: string } | null;
    (byProperty[row.property_id] ??= []).push({
      contact_id: row.contact_id,
      full_name: contact?.full_name ?? "Sin nombre",
      share_pct: Number(row.share_pct),
      is_primary: row.is_primary,
    });
  }
  // Principal primero, después por porcentaje.
  for (const owners of Object.values(byProperty)) {
    owners.sort((a, b) => Number(b.is_primary) - Number(a.is_primary) || b.share_pct - a.share_pct);
  }
  return byProperty;
}

export function ownersLabel(owners: PropertyOwner[]) {
  if (owners.length === 1) return owners[0].full_name;
  return owners.map((o) => `${o.full_name} (${o.share_pct.toLocaleString("es-AR")} %)`).join(", ");
}
