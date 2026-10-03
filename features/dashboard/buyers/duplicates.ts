import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/app/types/supabase";

export type DuplicateLead = { id: string; name: string; by: "teléfono" | "email" };

// Los últimos 10 dígitos identifican una línea argentina sin importar el
// formato ("0351 15-555-5555", "+54 9 351 555 5555").
export const phoneKey = (raw: string | null | undefined) => {
  const d = (raw ?? "").replace(/\D/g, "");
  return d.length >= 8 ? d.slice(-10) : null;
};

// Busca un lead existente con el mismo email o teléfono. RLS limita la
// búsqueda a los leads que el usuario puede ver. El prefiltro SQL del
// teléfono usa los últimos 4 dígitos (el formato guardado varía); la
// comparación real es por los últimos 10 dígitos.
export async function findDuplicateLead(
  supabase: SupabaseClient<Database>,
  contact: { email?: string | null; phone?: string | null },
): Promise<DuplicateLead | null> {
  const email = contact.email?.trim().toLowerCase();
  if (email) {
    const { data } = await supabase.from("leads").select("id, name").ilike("email", email).limit(1);
    if (data?.[0]) return { ...data[0], by: "email" };
  }

  const key = phoneKey(contact.phone);
  if (key) {
    const { data } = await supabase
      .from("leads")
      .select("id, name, phone")
      .ilike("phone", `%${key.slice(-4)}%`)
      .limit(50);
    const hit = (data ?? []).find((l) => phoneKey(l.phone) === key);
    if (hit) return { id: hit.id, name: hit.name, by: "teléfono" };
  }
  return null;
}
