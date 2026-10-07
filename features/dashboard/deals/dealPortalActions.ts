"use server";

import { createHash, randomBytes } from "node:crypto";
import { z } from "zod";
import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { createClientServer } from "@/lib/supabase";
import { BRAND } from "@/lib/brand";

// Links del portal del comprador. Con la sesión del agente: RLS deja
// crearlos y revocarlos solo para leads que puede ver. Un link activo por
// operación: generar uno nuevo revoca el anterior.

type Result<T = undefined> = { success: true; message: string; data?: T } | { success: false; message: string };
const uuid = z.string().uuid();

export async function createDealLinkAction(leadId: string): Promise<Result<{ url: string }>> {
  if (!uuid.safeParse(leadId).success) return { success: false, message: "Lead inválido." };
  const supabase = await createClientServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false, message: "No autenticado" };
  const { data: lead } = await supabase.from("leads").select("deal_stage").eq("id", leadId).maybeSingle();
  if (!lead?.deal_stage || lead.deal_stage === "CAIDA") return { success: false, message: "El lead no tiene una operación activa." };

  await supabase.from("deal_portal_links").update({ revoked_at: new Date().toISOString() }).eq("lead_id", leadId).is("revoked_at", null);
  const token = randomBytes(24).toString("base64url");
  const { error } = await supabase.from("deal_portal_links").insert({
    lead_id: leadId, token_hash: createHash("sha256").update(token).digest("hex"),
  });
  if (error) return { success: false, message: error.message };

  const origin = (await headers()).get("origin") ?? BRAND.siteUrl;
  revalidatePath(`/dashboard/leads/${leadId}`);
  return { success: true, message: "Link generado. Copialo ahora: no se vuelve a mostrar.", data: { url: `${origin}/operacion/${token}` } };
}

export async function revokeDealLinkAction(leadId: string): Promise<Result> {
  if (!uuid.safeParse(leadId).success) return { success: false, message: "Lead inválido." };
  const supabase = await createClientServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false, message: "No autenticado" };
  const { error } = await supabase.from("deal_portal_links").update({ revoked_at: new Date().toISOString() }).eq("lead_id", leadId).is("revoked_at", null);
  if (error) return { success: false, message: error.message };
  revalidatePath(`/dashboard/leads/${leadId}`);
  return { success: true, message: "Link revocado: el comprador ya no puede abrirlo." };
}
