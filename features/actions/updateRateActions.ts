"use server";

import { createServerClient } from "@supabase/ssr";
import { createClientServer } from "@/lib/supabase";
import { revalidatePath } from "next/cache";

type FormState = {
  success: boolean;
  message: string;
};

const supabaseAdmin = createServerClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { cookies: { getAll: () => [], setAll: () => {} } }
);

// --- AUTORIZACIÓN ---
// Verifica el rol contra la sesión del servidor (nunca contra un valor
// enviado por el cliente/formulario) antes de permitir el uso de
// supabaseAdmin, que bypassea RLS. Mismo patrón que manage-agents.ts.
async function requireAdmin(): Promise<string | null> {
  const supabase = await createClientServer();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return "No autenticado";
  }

  const { data: agent, error } = await supabase
    .from("agents")
    .select("role")
    .eq("id", user.id)
    .single();

  if (error || agent?.role !== "admin") {
    return "No autorizado: se requiere rol de administrador";
  }

  return null;
}

export async function updateRateAction(
  prevState: FormState,
  formData: FormData
): Promise<FormState> {
  const adminError = await requireAdmin();
  if (adminError) {
    return { success: false, message: adminError };
  }

  const newRateString = formData.get("exchange_rate") as string;
  const newRate = parseFloat(newRateString);

  if (isNaN(newRate) || newRate <= 0) {
    return { success: false, message: "Por favor, ingresa un número válido." };
  }

  // 1. Actualizamos la tasa de cambio en la tabla 'exchange_rates'
  const { error: rateError } = await supabaseAdmin
    .from("exchange_rates")
    .update({ usd_to_ars: newRate })
    .eq("id", 1);

  if (rateError) {
    return {
      success: false,
      message: `Error al guardar la tasa: ${rateError.message}`,
    };
  }

  // 2. Llamamos a la función de la DB para recalcular TODAS las propiedades
  const { error: rpcError } = await supabaseAdmin.rpc(
    "update_all_normalized_prices",
    {
      new_rate: newRate,
    }
  );

  if (rpcError) {
    return {
      success: false,
      message: `Error al recalcular propiedades: ${rpcError.message}`,
    };
  }

  // 3. Éxito
  revalidatePath("/dashboard");
  revalidatePath("/propiedades"); 
  return {
    success: true,
    message: `Valor del dolar actualizado a $${newRate}.`,
  };
}