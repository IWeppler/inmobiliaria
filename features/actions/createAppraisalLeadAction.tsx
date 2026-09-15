"use server";

import { z } from "zod";
import { supabaseAdmin, nextAgentForLead } from "@/lib/supabase-admin";

// Server Action pública (visitante anónimo, sin sesión) -- usa
// service_role porque "leads" ya no acepta escrituras con la anon key
// (ver 20260915161219_fix_leads_pii_exposure.sql). La validación Zod de
// abajo es la única puerta de entrada, así que tiene que ser estricta.

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

  // 3. Asignar agente: reglas por tipo de propiedad (E1.2) o round-robin
  // (E0.4), ver lib/supabase-admin.ts. Tasación no tiene ciudad.
  const agentId = await nextAgentForLead({ propertyType });

  if (!agentId) {
    return {
      success: false,
      message: "Error interno: No se pudo asignar el agente.",
    };
  }

  const { error: insertError } = await supabaseAdmin.from("leads").insert({
    name: name,
    phone: phone,
    email: email || null,
    notes: `SOLICITUD DE TASACIÓN\n
    - Dirección: ${address}
    - Tipo: ${propertyType}
    - Operación: ${operationType}
    --------------------------------
    Mensaje: ${consulta || "Sin mensaje adicional."}`,
    property_id: null,
    agent_id: agentId,
    status: "NUEVO",
    source: "TASACION",
  });

  if (insertError) {
    return {
      success: false,
      message: `Error al guardar la consulta: ${insertError.message}`,
    };
  }

  return {
    success: true,
    message: "¡Solicitud enviada! Te contactaremos a la brevedad.",
  };
}
