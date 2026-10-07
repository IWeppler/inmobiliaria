import "server-only";
import { createHash } from "node:crypto";
import { supabaseAdmin } from "@/lib/supabase-admin";

// Portal (links privados, sin usuario): valida el token y responde qué
// contacto es y en qué contratos participa. Todo lo que hace el portal pasa
// por acá antes de leer o escribir con service role.

export type PortalAccess = {
  linkId: string;
  contactId: string;
  viewCount: number;
  tenantContractIds: string[];
  activeTenantContractId: string | null;
};

export async function resolvePortalLink(token: string): Promise<PortalAccess | null> {
  if (!/^[A-Za-z0-9_-]{20,64}$/.test(token)) return null;
  const tokenHash = createHash("sha256").update(token).digest("hex");
  const { data: link } = await supabaseAdmin.from("rental_portal_links")
    .select("id, contact_id, expires_at, revoked_at, view_count").eq("token_hash", tokenHash).maybeSingle();
  if (!link || link.revoked_at || new Date(link.expires_at) <= new Date()) return null;

  const [{ data: direct }, { data: parties }] = await Promise.all([
    supabaseAdmin.from("rental_contracts").select("id, status, start_date").eq("tenant_id", link.contact_id),
    supabaseAdmin.from("rental_contract_parties").select("contract:rental_contracts(id, status, start_date)")
      .eq("contact_id", link.contact_id).eq("role", "CO_INQUILINO"),
  ]);
  type C = { id: string; status: string; start_date: string };
  const contracts: C[] = [...(direct ?? []), ...(parties ?? []).map((p) => p.contract as unknown as C).filter(Boolean)];
  const active = contracts.filter((c) => c.status === "ACTIVO").sort((a, b) => b.start_date.localeCompare(a.start_date))[0];

  return {
    linkId: link.id,
    contactId: link.contact_id,
    viewCount: link.view_count,
    tenantContractIds: contracts.map((c) => c.id),
    activeTenantContractId: active?.id ?? null,
  };
}

// Respuesta PDF para las descargas del portal.
export function pdfResponse(buffer: Buffer, fileName: string) {
  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${fileName.replace(/[^\w.\- ]/g, "")}"`,
      "Cache-Control": "private, no-store",
      "X-Robots-Tag": "noindex",
      "Referrer-Policy": "no-referrer",
    },
  });
}

export const notFoundResponse = () => new Response("No disponible", { status: 404, headers: { "Cache-Control": "no-store" } });
