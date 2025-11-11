"use server";

import { createClientServer } from "@/lib/supabase";
import { z } from "zod";

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
  const supabase = await createClientServer();

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

  // 3. Buscar el agente (user_id) dueño de esta propiedad
  const { data: propertyOwner, error: ownerError } = await supabase
    .from("properties")
    .select("user_id")
    .eq("id", propertyId)
    .single();

  if (ownerError || !propertyOwner) {
    return { success: false, message: "No se pudo encontrar la propiedad." };
  }

  // 4. Insertar el nuevo Lead
  const { error: insertError } = await supabase.from("leads").insert({
    name: name,
    phone: phone,
    email: email || null,
    notes: consulta || null,
    property_id: propertyId,
    user_id: propertyOwner.user_id,
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
