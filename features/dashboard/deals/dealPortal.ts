import "server-only";
import { createHash } from "node:crypto";
import { supabaseAdmin } from "@/lib/supabase-admin";

// Portal del comprador: link privado, sin usuario. Igual que el de
// alquileres: en la base solo está el hash del token; se valida acá antes
// de leer con service role, y solo se lee la operación de ese lead.

export const DEAL_TOKEN_RE = /^[A-Za-z0-9_-]{20,64}$/;
export const hashDealToken = (token: string) => createHash("sha256").update(token).digest("hex");

export async function resolveDealLink(token: string) {
  if (!DEAL_TOKEN_RE.test(token)) return null;
  const { data: link } = await supabaseAdmin.from("deal_portal_links")
    .select("id, lead_id, expires_at, revoked_at, view_count").eq("token_hash", hashDealToken(token)).maybeSingle();
  if (!link || link.revoked_at || new Date(link.expires_at) <= new Date()) return null;
  return { linkId: link.id, leadId: link.lead_id, viewCount: link.view_count };
}
