"use server";

import { createClientServer } from "@/lib/supabase"; 
import { z } from "zod";

// Schema de validación (debe coincidir con el del cliente)
const appraisalSchema = z.object({
  name: z.string().min(3),
  phone: z.string().min(8),
  email: z.string().email().optional().or(z.literal("")),
  address: z.string().min(5),
  propertyType: z.string().min(1, "Selecciona un tipo"),
  operationType: z.enum(["VENTA", "ALQUILER"] as const, {
    message: "Selecciona una operación",
  }),
  consulta: z.string().optional(),
});

type FormState = {
  success: boolean;
  message: string;
};

export async function createAppraisalLeadAction(
  prevState: FormState,
  formData: FormData
): Promise<FormState> {
  const supabase = await createClientServer();

  // 1. Obtener datos del formulario
  const rawData = {
    name: formData.get("name"),
    phone: formData.get("phone"),
    email: formData.get("email"),
    address: formData.get("address"),
    propertyType: formData.get("propertyType"),
    operationType: formData.get("operationType"),
    consulta: formData.get("consulta"),
  };

  const validation = appraisalSchema.safeParse(rawData);

  if (!validation.success) {
    return {
      success: false,
      message: "Error en los datos. Revisa el formulario.",
    };
  }

  const { name, phone, email, address, propertyType, operationType, consulta } =
    validation.data;

  // 3. Buscar el agente (user_id)
  const { data: agent, error: agentError } = await supabase
    .from("agents") // O 'profiles'
    .select("user_id")
    .limit(1)
    .single();

  if (agentError || !agent) {
    return {
      success: false,
      message: "Error interno: No se pudo asignar el agente.",
    };
  }

  // 4. Insertar el nuevo Lead de Tasación
  const { error: insertError } = await supabase.from("leads").insert({
    name: name,
    phone: phone,
    email: email || null,
    // 👇 Construimos una nota más completa
    notes: `SOLICITUD DE TASACIÓN\n
    - Dirección: ${address}
    - Tipo: ${propertyType}
    - Operación: ${operationType}
    --------------------------------
    Mensaje: ${consulta || "Sin mensaje adicional."}`,
    property_id: null,
    user_id: agent.user_id,
    status: "NUEVO",
    source: "TASACION",
  });

  if (insertError) {
    return {
      success: false,
      message: `Error al guardar la consulta: ${insertError.message}`,
    };
  }

  // 5. Éxito
  return {
    success: true,
    message: "¡Solicitud enviada! Te contactaremos a la brevedad.",
  };
}