"use server";

import { createHash, randomBytes } from "node:crypto";
import { z } from "zod";
import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { createClientServer } from "@/lib/supabase";
import { BRAND } from "@/lib/brand";
import type { ActionResult } from "@/features/rentals/actions";

// Links privados de estado de cuenta (portal, etapa 1). El token es
// aleatorio (24 bytes) y en la base solo queda su hash: el link completo
// se devuelve una única vez, al crearlo.

const uuid = z.string().uuid();

export async function createPortalLinkAction(contactId: string): Promise<ActionResult<{ url: string; expiresAt: string }>> {
  if (!uuid.safeParse(contactId).success) return { success: false, message: "Contacto inválido." };
  const supabase = await createClientServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false, message: "No autenticado" };

  const token = randomBytes(24).toString("base64url");
  const tokenHash = createHash("sha256").update(token).digest("hex");
  const { data, error } = await supabase.from("rental_portal_links")
    .insert({ contact_id: contactId, token_hash: tokenHash })
    .select("expires_at").single();
  if (error || !data) return { success: false, message: error?.message ?? "No se pudo generar el link." };

  // Mismo dominio desde el que se usa el panel (local, preview o producción).
  const origin = (await headers()).get("origin") ?? BRAND.siteUrl;
  revalidatePath(`/dashboard/alquileres/contactos/${contactId}`);
  return {
    success: true,
    message: "Link generado. Copialo ahora: no se vuelve a mostrar.",
    data: { url: `${origin}/estado/${token}`, expiresAt: data.expires_at },
  };
}

export async function revokePortalLinkAction(linkId: string, contactId: string): Promise<ActionResult> {
  if (!uuid.safeParse(linkId).success) return { success: false, message: "Link inválido." };
  const supabase = await createClientServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false, message: "No autenticado" };
  const { error } = await supabase.from("rental_portal_links")
    .update({ revoked_at: new Date().toISOString() }).eq("id", linkId).is("revoked_at", null);
  if (error) return { success: false, message: error.message };
  revalidatePath(`/dashboard/alquileres/contactos/${contactId}`);
  return { success: true, message: "Link revocado: ya no se puede abrir." };
}
