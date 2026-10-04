"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { createClientServer } from "@/lib/supabase";
import type { ActionResult } from "@/features/rentals/actions";

// Reemplaza los dueños de una propiedad. La validación final (un principal,
// suma 100 %, permisos) la hace la función set_property_owners.
const ownersSchema = z.object({
  property_id: z.string().uuid(),
  owners: z.array(z.object({
    contact_id: z.string().uuid(),
    share_pct: z.coerce.number().gt(0).max(100),
    is_primary: z.boolean(),
  })).min(1, "Cargá al menos un propietario.").max(10),
}).refine((v) => v.owners.filter((o) => o.is_primary).length === 1, { message: "Marcá un propietario principal." })
  .refine((v) => Math.abs(v.owners.reduce((sum, o) => sum + o.share_pct, 0) - 100) < 0.001, { message: "Los porcentajes tienen que sumar 100 %." })
  .refine((v) => new Set(v.owners.map((o) => o.contact_id)).size === v.owners.length, { message: "Hay un propietario repetido." });

export async function setPropertyOwnersAction(input: z.input<typeof ownersSchema>): Promise<ActionResult> {
  const parsed = ownersSchema.safeParse(input);
  if (!parsed.success) return { success: false, message: parsed.error.issues[0]?.message ?? "Datos inválidos." };
  const supabase = await createClientServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false, message: "No autenticado" };

  const { error } = await supabase.rpc("set_property_owners", {
    p_property_id: parsed.data.property_id,
    p_owners: parsed.data.owners,
  });
  if (error) return { success: false, message: error.message };
  revalidatePath(`/dashboard/propiedades/${parsed.data.property_id}`);
  revalidatePath("/dashboard/alquileres/nuevo");
  return { success: true, message: "Propietarios actualizados. Los contratos vigentes conservan los titulares con los que se firmaron." };
}
