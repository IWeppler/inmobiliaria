"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { createClientServer } from "@/lib/supabase";
import {
  GCAL_BANNER_COOKIE,
  deleteGoogleEvent,
  disconnectGoogleCalendar,
  syncEventToGoogle,
} from "@/lib/google-calendar";

// Llamar después de crear un evento desde el cliente. Verifica con la
// sesión (RLS) que el usuario puede ver el evento antes de sincronizarlo.
export async function syncEventAction(eventId: string) {
  const supabase = await createClientServer();
  const { data } = await supabase.from("events").select("id").eq("id", eventId).maybeSingle();
  if (!data) return { synced: false };
  return { synced: await syncEventToGoogle(eventId) };
}

// Borra el evento (con la sesión del usuario, así aplica RLS) y su espejo
// en Google Calendar si lo tenía.
export async function deleteEventAction(eventId: string) {
  const supabase = await createClientServer();
  const { data: event } = await supabase
    .from("events")
    .select("id, agent_id, google_event_id")
    .eq("id", eventId)
    .maybeSingle();

  const { data: deleted, error } = await supabase
    .from("events")
    .delete()
    .eq("id", eventId)
    .select("id");
  if (error) return { error: error.message };
  if (!deleted?.length) return { error: "No tenés permiso para borrar este evento." };

  if (event?.agent_id && event.google_event_id) {
    await deleteGoogleEvent(event.agent_id, event.google_event_id);
  }
  return { error: null };
}

export async function disconnectGoogleCalendarAction() {
  const supabase = await createClientServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Sesión vencida." };
  await disconnectGoogleCalendar(user.id);
  revalidatePath("/dashboard", "layout");
  return { error: null };
}

export async function dismissGoogleCalendarBannerAction() {
  const store = await cookies();
  store.set(GCAL_BANNER_COOKIE, "1", {
    path: "/dashboard",
    maxAge: 60 * 60 * 24 * 30,
    sameSite: "lax",
    httpOnly: true,
  });
}
