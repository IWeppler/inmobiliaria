"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { createClientServer } from "@/lib/supabase";
import type { ActionResult } from "@/features/rentals/actions";

// Plantillas de contrato: solo admin escribe (RLS lo garantiza; acá se
// valida y se da un mensaje claro).

const templateSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().trim().min(3, "El nombre es muy corto.").max(120),
  body: z.string().min(20, "La plantilla está vacía.").max(60000),
  is_default: z.boolean(),
});

async function adminClient() {
  const supabase = await createClientServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { supabase, allowed: false };
  const { data: me } = await supabase.from("agents").select("role").eq("id", user.id).single();
  return { supabase, allowed: me?.role === "admin" };
}

export async function saveContractTemplateAction(input: z.input<typeof templateSchema>): Promise<ActionResult<{ id: string }>> {
  const parsed = templateSchema.safeParse(input);
  if (!parsed.success) return { success: false, message: parsed.error.issues[0]?.message ?? "Plantilla inválida." };
  const { supabase, allowed } = await adminClient();
  if (!allowed) return { success: false, message: "Solo un administrador puede editar plantillas." };
  const { id, ...v } = parsed.data;

  // Una sola por defecto: primero se desmarca la anterior.
  if (v.is_default) {
    const { error } = await supabase.from("rental_contract_templates").update({ is_default: false }).eq("is_default", true);
    if (error) return { success: false, message: error.message };
  }
  const row = { ...v, updated_at: new Date().toISOString() };
  const { data, error } = id
    ? await supabase.from("rental_contract_templates").update(row).eq("id", id).select("id").single()
    : await supabase.from("rental_contract_templates").insert(row).select("id").single();
  if (error || !data) return { success: false, message: error?.message ?? "No se pudo guardar." };
  revalidatePath("/dashboard/ajustes");
  return { success: true, message: "Plantilla guardada.", data };
}

export async function deleteContractTemplateAction(id: string): Promise<ActionResult> {
  if (!z.string().uuid().safeParse(id).success) return { success: false, message: "Plantilla inválida." };
  const { supabase, allowed } = await adminClient();
  if (!allowed) return { success: false, message: "Solo un administrador puede borrar plantillas." };
  const { count } = await supabase.from("rental_contract_templates").select("id", { count: "exact", head: true });
  if ((count ?? 0) <= 1) return { success: false, message: "Tiene que quedar al menos una plantilla." };
  const { error } = await supabase.from("rental_contract_templates").delete().eq("id", id);
  if (error) return { success: false, message: error.message };
  revalidatePath("/dashboard/ajustes");
  return { success: true, message: "Plantilla eliminada." };
}
