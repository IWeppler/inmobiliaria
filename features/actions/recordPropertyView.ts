"use server";

import { cookies } from "next/headers";
import { z } from "zod";
import { supabaseAdmin } from "@/lib/supabase-admin";

// Vista de la ficha pública. Antes el navegador llamaba increment_views con
// la anon key, así que cualquiera podía inflar el contador desde la consola.
// Ahora solo el servidor ejecuta el RPC y cuenta una vista por visitante,
// propiedad y día (cookie), lo que además evita el doble conteo de React
// en desarrollo.
const COOKIE_TTL_SECONDS = 60 * 60 * 24;

export async function recordPropertyView(propertyId: string): Promise<void> {
  if (!z.string().uuid().safeParse(propertyId).success) return;

  const jar = await cookies();
  const key = `pv_${propertyId.replace(/-/g, "").slice(0, 12)}`;
  if (jar.get(key)) return;
  jar.set(key, "1", {
    maxAge: COOKIE_TTL_SECONDS,
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
  });

  // El error se ignora a propósito: una vista perdida no debe romper la ficha.
  await supabaseAdmin.rpc("increment_views", { property_id: propertyId });
}
