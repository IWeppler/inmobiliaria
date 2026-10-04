"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { createClientServer } from "@/lib/supabase";
import type { ActionResult } from "@/features/rentals/actions";

// Vacancia: intención de renovar y publicación de la propiedad.

async function currentUser() {
  const supabase = await createClientServer();
  const { data: { user } } = await supabase.auth.getUser();
  return { supabase, user };
}

function revalidateVacancy(contractId?: string) {
  revalidatePath("/dashboard/alquileres", "layout");
  if (contractId) revalidatePath(`/dashboard/alquileres/${contractId}`);
}

const intentSchema = z.object({
  contract_id: z.string().uuid(),
  intent: z.enum(["RENUEVA", "NO_RENUEVA"]).nullable(),
  note: z.string().trim().max(500).optional(),
});

export async function setRenewalIntentAction(input: z.input<typeof intentSchema>): Promise<ActionResult> {
  const parsed = intentSchema.safeParse(input);
  if (!parsed.success) return { success: false, message: "Datos inválidos." };
  const { supabase, user } = await currentUser();
  if (!user) return { success: false, message: "No autenticado" };
  const { contract_id, intent, note } = parsed.data;
  const { error } = await supabase.from("rental_contracts").update({
    renewal_intent: intent,
    renewal_intent_at: intent ? new Date().toISOString() : null,
    renewal_intent_note: note || null,
  }).eq("id", contract_id).eq("status", "ACTIVO");
  if (error) return { success: false, message: error.message };
  revalidateVacancy(contract_id);
  const messages = { RENUEVA: "Anotado: renueva.", NO_RENUEVA: "Anotado: no renueva. Ya podés publicar la propiedad.", none: "Renovación sin definir." };
  return { success: true, message: messages[intent ?? "none"] };
}

const publishSchema = z.object({
  property_id: z.string().uuid(),
  status: z.enum(["EN_ALQUILER", "RESERVADO"]),
  available_from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
});

// Publica (EN_ALQUILER, visible en el sitio y los portales) o marca como
// reservada. Con un contrato todavía vigente, se publica con "disponible
// desde" para salir a buscar inquilino antes de que se desocupe.
export async function setRentalListingAction(input: z.input<typeof publishSchema>): Promise<ActionResult> {
  const parsed = publishSchema.safeParse(input);
  if (!parsed.success) return { success: false, message: "Datos inválidos." };
  const { supabase, user } = await currentUser();
  if (!user) return { success: false, message: "No autenticado" };
  const { property_id, status, available_from } = parsed.data;
  const { data, error } = await supabase.from("properties")
    .update({ status, ...(available_from !== undefined ? { available_from } : {}) })
    .eq("id", property_id).select("id");
  if (error) return { success: false, message: error.message };
  if (!data?.length) return { success: false, message: "Solo el responsable de la propiedad o un administrador puede publicarla." };
  revalidateVacancy();
  revalidatePath(`/dashboard/propiedades/${property_id}`);
  return { success: true, message: status === "RESERVADO" ? "Propiedad marcada como reservada." : "Propiedad publicada en alquiler." };
}
