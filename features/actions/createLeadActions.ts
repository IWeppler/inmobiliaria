"use server";

import { z } from "zod";
import { supabaseAdmin, nextAgentForLead } from "@/lib/supabase-admin";

// Server Action pública (visitante anónimo, sin sesión) -- usa
// service_role porque "leads" ya no acepta escrituras con la anon key
// (ver 20260915161219_fix_leads_pii_exposure.sql). La validación Zod de
// abajo es la única puerta de entrada, así que tiene que ser estricta.

// Schema de validación (debe coincidir con el del cliente)
const contactSchema = z.object({
  name: z.string().min(3),
  phone: z.string().min(8),
  email: z.string().email().optional().or(z.literal("")),
  consulta: z.string().optional(),
  propertyId: z.string().uuid(),
});

type FormState = {
  success: boolean;
  message: string;
};

export async function createLeadFromPublic(
  prevState: FormState,
  formData: FormData
): Promise<FormState> {
  // 1. Obtener datos del formulario
  const rawData = {
    name: formData.get("name"),
    phone: formData.get("phone"),
    email: formData.get("email"),
    consulta: formData.get("consulta"),
    propertyId: formData.get("propertyId"),
  };

  // 2. Validar los datos
  const validation = contactSchema.safeParse(rawData);

  if (!validation.success) {
    return {
      success: false,
      message: "Error en los datos enviados. Revisa el formulario.",
    };
  }

  const { name, phone, email, consulta, propertyId } = validation.data;

  // 3. Buscar el agente dueño de esta propiedad. "properties" no tiene
  // columna user_id -- el agente asignado está en agent_id.
  const { data: property, error: ownerError } = await supabaseAdmin
    .from("properties")
    .select("agent_id, city, property_types(name)")
    .eq("id", propertyId)
    .single();

  if (ownerError || !property) {
    return { success: false, message: "No se pudo encontrar la propiedad." };
  }

  // La propiedad puede no tener agente asignado (agent_id nullable) --
  // en ese caso se asigna por reglas (ciudad / tipo, E1.2) o round-robin
  // (E0.4), mismo criterio que los otros dos formularios públicos.
  const assignedAgentId =
    property.agent_id ??
    (await nextAgentForLead({
      city: property.city,
      propertyType: property.property_types?.name,
    }));
  if (!assignedAgentId) {
    return {
      success: false,
      message: "Error interno: No se pudo asignar el agente.",
    };
  }

  // 4. Insertar el nuevo Lead
  const { error: insertError } = await supabaseAdmin.from("leads").insert({
    name: name,
    phone: phone,
    email: email || null,
    notes: consulta || null,
    property_id: propertyId,
    agent_id: assignedAgentId,
    status: "NUEVO",
    source: "WEB",
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
    message: "¡Consulta enviada! Te contactaremos a la brevedad.",
  };
}
