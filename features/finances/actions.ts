"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { createClientServer } from "@/lib/supabase";
import { ymdInAppTz } from "@/lib/dates";
import { CATEGORIES, CATEGORY_KEYS, type Category } from "@/features/finances/logic";

// Finanzas del negocio. RLS: movimientos y gastos fijos solo admin; las
// ventas las registra el agente de la propiedad o admin. Las comisiones
// (alquiler y venta) las escriben triggers, no estas acciones.

export type ActionResult =
  | { success: true; message: string }
  | { success: false; message: string };

const ymd = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const money = z.number().positive().max(1e12);
const currency = z.enum(["ARS", "USD"]);

function revalidate() {
  revalidatePath("/dashboard/finanzas");
  revalidatePath("/dashboard");
}

// === Movimientos manuales ===
const movementSchema = z.object({
  occurred_on: ymd,
  category: z.enum(CATEGORY_KEYS as [Category, ...Category[]]),
  nature: z.enum(["FIJO", "VARIABLE"]).nullable(),
  description: z.string().trim().min(2).max(200),
  amount: money,
  currency,
  property_id: z.string().uuid().nullable(),
  /** Egreso fijo que se repite todos los meses desde occurred_on. */
  recurring: z.boolean(),
});

export async function createMovementAction(
  input: z.input<typeof movementSchema>,
): Promise<ActionResult> {
  const parsed = movementSchema.safeParse(input);
  if (!parsed.success) return { success: false, message: "Datos del movimiento inválidos." };
  const { recurring, ...data } = parsed.data;
  const meta = CATEGORIES[data.category];
  if (!meta.manual)
    return { success: false, message: "Esta categoría se genera sola desde liquidaciones o cierres de venta." };
  const isExpense = meta.direction === "EGRESO";
  const supabase = await createClientServer();

  if (isExpense && recurring) {
    const { error } = await supabase.from("recurring_expenses").insert({
      description: data.description,
      category: data.category,
      amount: data.amount,
      currency: data.currency,
      day_of_month: Math.min(28, Number(data.occurred_on.slice(8, 10))),
      start_period: `${data.occurred_on.slice(0, 7)}-01`,
    });
    if (error) return { success: false, message: error.message };
    await supabase.rpc("generate_recurring_expenses");
    revalidate();
    return { success: true, message: "Gasto fijo creado. Se va a registrar todos los meses." };
  }

  const { error } = await supabase.from("cash_movements").insert({
    ...data,
    direction: meta.direction,
    nature: isExpense ? (data.nature ?? "VARIABLE") : null,
  });
  if (error) return { success: false, message: error.message };
  revalidate();
  return { success: true, message: "Movimiento registrado." };
}

export async function deleteMovementAction(id: string): Promise<ActionResult> {
  if (!z.string().uuid().safeParse(id).success) return { success: false, message: "Movimiento inválido." };
  const supabase = await createClientServer();
  const { data: movement } = await supabase
    .from("cash_movements")
    .select("settlement_id, sale_id")
    .eq("id", id)
    .single();
  if (!movement) return { success: false, message: "Movimiento no encontrado." };
  if (movement.settlement_id)
    return { success: false, message: "Viene de una liquidación de alquiler: se corrige desde el contrato." };
  if (movement.sale_id)
    return { success: false, message: "Viene de un cierre de venta: no se puede eliminar suelto." };
  const { error } = await supabase.from("cash_movements").delete().eq("id", id);
  if (error) return { success: false, message: error.message };
  revalidate();
  return { success: true, message: "Movimiento eliminado." };
}

// === Gastos fijos ===
const recurringUpdateSchema = z.object({
  id: z.string().uuid(),
  amount: money.optional(),
  active: z.boolean().optional(),
});

// Cambiar el monto afecta los meses que se generen de acá en adelante;
// los ya registrados quedan como estaban.
export async function updateRecurringExpenseAction(
  input: z.input<typeof recurringUpdateSchema>,
): Promise<ActionResult> {
  const parsed = recurringUpdateSchema.safeParse(input);
  if (!parsed.success) return { success: false, message: "Datos inválidos." };
  const { id, ...patch } = parsed.data;
  const supabase = await createClientServer();
  const { error } = await supabase.from("recurring_expenses").update(patch).eq("id", id);
  if (error) return { success: false, message: error.message };
  if (patch.active) await supabase.rpc("generate_recurring_expenses");
  revalidate();
  return {
    success: true,
    message: patch.active === false ? "Gasto fijo pausado." : patch.active ? "Gasto fijo reactivado." : "Monto actualizado.",
  };
}

// Borra la plantilla; los meses ya registrados quedan en el historial.
export async function deleteRecurringExpenseAction(id: string): Promise<ActionResult> {
  if (!z.string().uuid().safeParse(id).success) return { success: false, message: "Gasto inválido." };
  const supabase = await createClientServer();
  const { error } = await supabase.from("recurring_expenses").delete().eq("id", id);
  if (error) return { success: false, message: error.message };
  revalidate();
  return { success: true, message: "Gasto fijo eliminado. Los meses ya registrados se conservan." };
}

// === Cierre de venta ===
const saleSchema = z.object({
  property_id: z.string().uuid(),
  sold_on: ymd,
  sale_price: money,
  currency,
  commission_pct: z.number().min(0).max(100),
  agent_id: z.string().uuid().nullable(),
  agent_commission_pct: z.number().min(0).max(100),
  notes: z.string().max(500).optional(),
});

const round2 = (n: number) => Math.round(n * 100) / 100;

// Registra la venta y pasa la propiedad a VENDIDO. El trigger de
// property_sales genera el ingreso por comisión y el egreso del agente.
export async function closeSaleAction(input: z.input<typeof saleSchema>): Promise<ActionResult> {
  const parsed = saleSchema.safeParse(input);
  if (!parsed.success) return { success: false, message: "Datos de la venta inválidos." };
  const d = parsed.data;
  if (d.sold_on > ymdInAppTz()) return { success: false, message: "La fecha de venta no puede ser futura." };
  const commission = round2((d.sale_price * d.commission_pct) / 100);
  const agentCommission = d.agent_id ? round2((commission * d.agent_commission_pct) / 100) : 0;

  const supabase = await createClientServer();
  const { error } = await supabase.from("property_sales").insert({
    ...d,
    notes: d.notes || null,
    commission_amount: commission,
    agent_commission_pct: d.agent_id ? d.agent_commission_pct : 0,
    agent_commission_amount: agentCommission,
  });
  if (error) return { success: false, message: error.message };

  const { data: updated, error: statusError } = await supabase
    .from("properties")
    .update({ status: "VENDIDO" })
    .eq("id", d.property_id)
    .select("id");
  if (statusError || !updated?.length)
    return { success: false, message: "Venta registrada, pero no se pudo cambiar el estado de la propiedad." };

  revalidate();
  revalidatePath("/dashboard/propiedades");
  return { success: true, message: "Venta cerrada. La comisión quedó registrada en finanzas." };
}
