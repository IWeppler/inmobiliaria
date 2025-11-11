"use server";

import { createClientServer } from "@/lib/supabase";
import { revalidatePath } from "next/cache";

type FormState = {
  success: boolean;
  message: string;
};

export async function updateRateAction(
  prevState: FormState,
  formData: FormData
): Promise<FormState> {
  const supabase = await createClientServer();
  const newRateString = formData.get("exchange_rate") as string;
  const newRate = parseFloat(newRateString);

  if (isNaN(newRate) || newRate <= 0) {
    return { success: false, message: "Por favor, ingresa un número válido." };
  }

  // 1. Actualizamos la tasa de cambio en la tabla 'exchange_rates'
  const { error: rateError } = await supabase
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
  const { error: rpcError } = await supabase.rpc(
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