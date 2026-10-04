import "server-only";
import type { createClientServer } from "@/lib/supabase";
import { DEFAULT_ALERT_SETTINGS, type RentalAlertSettings } from "@/features/rentals/logic";

// Anticipación de las alertas del módulo (fila única de rental_settings).
// Si la lectura falla se usan los valores por defecto: una alerta con la
// anticipación de siempre es mejor que una pantalla rota.
export async function getRentalAlertSettings(
  supabase: Awaited<ReturnType<typeof createClientServer>>,
): Promise<RentalAlertSettings> {
  const { data } = await supabase.from("rental_settings").select("expiry_alert_days, adjustment_alert_days").eq("id", 1).maybeSingle();
  if (!data) return DEFAULT_ALERT_SETTINGS;
  return { expiryAlertDays: data.expiry_alert_days, adjustmentAlertDays: data.adjustment_alert_days };
}
