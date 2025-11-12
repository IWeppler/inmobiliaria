"use server";

import { createClientServer } from "@/lib/supabase";
import { z } from "zod";

// Schema de validación
const contactSchema = z.object({
  name: z.string().min(3),
  phone: z.string().min(8),
  email: z.string().email(),
  message: z.string().min(10),
});

type FormState = {
  success: boolean;
  message: string;
};

export async function createContactLeadAction(
  prevState: FormState,
  formData: FormData
): Promise<FormState> {
  const supabase = await createClientServer();

  // 1. Obtener datos del formulario
  const rawData = {
    name: formData.get("name"),
    phone: formData.get("phone"),
    email: formData.get("email"),
    message: formData.get("message"),
  };

  // 2. Validar los datos
  const validation = contactSchema.safeParse(rawData);

  if (!validation.success) {
    return {
      success: false,
      message: "Datos inválidos. Revisa el formulario.",
    };
  }

  const { name, phone, email, message } = validation.data;

  // 3. Buscar el agente (user_id) al que se asignará el lead
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

  // 4. Insertar el nuevo Lead de Contacto
  const { error: insertError } = await supabase.from("leads").insert({
    name: name,
    phone: phone,
    email: email,
    notes: message, // El mensaje va a las notas
    property_id: null,
    user_id: agent.user_id,
    status: "NUEVO",
    source: "CONTACTO", // Fuente: Formulario de Contacto
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
    message: "¡Mensaje enviado! Te contactaremos a la brevedad.",
  };
}