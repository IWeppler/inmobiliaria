import "server-only";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { APP_TZ, ymdInAppTz } from "@/lib/dates";
import { BRAND } from "@/lib/brand";
import { eventTypeLabel } from "@/features/dashboard/eventTypes";

// Sincronización de la agenda con Google Calendar, una vía (panel ->
// Google). Cada agente conecta su cuenta con OAuth; los tokens viven en
// google_calendar_connections (solo service_role). Se configura por
// deployment con GOOGLE_CLIENT_ID y GOOGLE_CLIENT_SECRET; sin ellas la
// integración queda apagada y la UI no la ofrece.
const CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;

export const googleCalendarEnabled = Boolean(CLIENT_ID && CLIENT_SECRET);

// Cookie que oculta por 30 días el banner "Conectá Google Calendar".
export const GCAL_BANNER_COOKIE = "gcal_banner_dismissed";

const SCOPES = [
  "openid",
  "email",
  "https://www.googleapis.com/auth/calendar.events",
];
const CALENDAR_API = "https://www.googleapis.com/calendar/v3";
const EVENT_DURATION_MIN = 60;

export function googleRedirectUri(origin: string) {
  return `${origin}/api/google-calendar/callback`;
}

export function googleAuthUrl(origin: string, state: string) {
  const params = new URLSearchParams({
    client_id: CLIENT_ID!,
    redirect_uri: googleRedirectUri(origin),
    response_type: "code",
    scope: SCOPES.join(" "),
    access_type: "offline",
    // Siempre consent: sin esto Google no reenvía el refresh_token si el
    // usuario ya había autorizado la app antes.
    prompt: "consent",
    include_granted_scopes: "true",
    state,
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
}

type TokenResponse = {
  access_token: string;
  expires_in: number;
  refresh_token?: string;
  id_token?: string;
  error?: string;
  error_description?: string;
};

async function tokenRequest(body: Record<string, string>) {
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: CLIENT_ID!,
      client_secret: CLIENT_SECRET!,
      ...body,
    }),
    cache: "no-store",
  });
  const data = (await res.json()) as TokenResponse;
  if (!res.ok || data.error) {
    throw new Error(data.error_description || data.error || `HTTP ${res.status}`);
  }
  return data;
}

// El id_token viene directo de Google por TLS en el intercambio del code:
// alcanza con decodificarlo para leer el email, sin verificar firma.
function emailFromIdToken(idToken?: string): string | null {
  if (!idToken) return null;
  try {
    const payload = JSON.parse(Buffer.from(idToken.split(".")[1], "base64url").toString());
    return typeof payload.email === "string" ? payload.email : null;
  } catch {
    return null;
  }
}

export async function connectGoogleCalendar(agentId: string, code: string, origin: string) {
  const tokens = await tokenRequest({
    code,
    grant_type: "authorization_code",
    redirect_uri: googleRedirectUri(origin),
  });
  if (!tokens.refresh_token) {
    throw new Error("Google no devolvió un refresh token. Volvé a intentar la conexión.");
  }
  const { error } = await supabaseAdmin.from("google_calendar_connections").upsert({
    agent_id: agentId,
    google_email: emailFromIdToken(tokens.id_token),
    refresh_token: tokens.refresh_token,
    access_token: tokens.access_token,
    access_token_expires_at: new Date(Date.now() + tokens.expires_in * 1000).toISOString(),
    last_error: null,
    updated_at: new Date().toISOString(),
  });
  if (error) throw new Error(error.message);
}

export async function getGoogleConnection(agentId: string) {
  const { data } = await supabaseAdmin
    .from("google_calendar_connections")
    .select("agent_id, google_email, calendar_id, last_error, created_at")
    .eq("agent_id", agentId)
    .maybeSingle();
  return data;
}

export async function disconnectGoogleCalendar(agentId: string) {
  const { data } = await supabaseAdmin
    .from("google_calendar_connections")
    .select("refresh_token")
    .eq("agent_id", agentId)
    .maybeSingle();
  if (data?.refresh_token) {
    // Revocar es best-effort: si falla, igual se borra la conexión local.
    await fetch("https://oauth2.googleapis.com/revoke", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ token: data.refresh_token }),
    }).catch(() => {});
  }
  await supabaseAdmin.from("google_calendar_connections").delete().eq("agent_id", agentId);
}

// Access token vigente del agente, refrescándolo si vence en < 1 min.
// null si el agente no conectó Google o el refresh fue revocado.
async function accessTokenFor(agentId: string) {
  const { data: conn } = await supabaseAdmin
    .from("google_calendar_connections")
    .select("refresh_token, access_token, access_token_expires_at, calendar_id")
    .eq("agent_id", agentId)
    .maybeSingle();
  if (!conn) return null;

  const expiresAt = conn.access_token_expires_at ? Date.parse(conn.access_token_expires_at) : 0;
  if (conn.access_token && expiresAt - Date.now() > 60_000) {
    return { token: conn.access_token, calendarId: conn.calendar_id };
  }

  try {
    const tokens = await tokenRequest({
      refresh_token: conn.refresh_token,
      grant_type: "refresh_token",
    });
    await supabaseAdmin
      .from("google_calendar_connections")
      .update({
        access_token: tokens.access_token,
        access_token_expires_at: new Date(Date.now() + tokens.expires_in * 1000).toISOString(),
        last_error: null,
        updated_at: new Date().toISOString(),
      })
      .eq("agent_id", agentId);
    return { token: tokens.access_token, calendarId: conn.calendar_id };
  } catch (e) {
    await markError(agentId, `No se pudo renovar el acceso: ${(e as Error).message}`);
    return null;
  }
}

async function markError(agentId: string, message: string) {
  await supabaseAdmin
    .from("google_calendar_connections")
    .update({ last_error: message.slice(0, 500), updated_at: new Date().toISOString() })
    .eq("agent_id", agentId);
}

function addMinutes(ymd: string, time: string, minutes: number) {
  // Aritmética en "hora de pared" (sin zona): Google aplica APP_TZ.
  const [y, mo, d] = ymd.split("-").map(Number);
  const [h, mi] = time.split(":").map(Number);
  const dt = new Date(Date.UTC(y, mo - 1, d, h, mi + minutes));
  return dt.toISOString().slice(0, 19);
}

type EventForSync = {
  id: string;
  date: string;
  time: string;
  title: string;
  type: string | null;
  agent_id: string | null;
  lead_id: string | null;
  property_id: string | null;
  google_event_id: string | null;
  properties: {
    title: string | null;
    street_address: string | null;
    neighborhood: string | null;
    city: string | null;
    province: string | null;
  } | null;
  leads: { name: string | null; phone: string | null } | null;
};

function googleEventBody(event: EventForSync) {
  const ymd = ymdInAppTz(new Date(event.date));
  const time = /^\d{2}:\d{2}/.test(event.time) ? event.time.slice(0, 5) : "09:00";
  const typeLabel = eventTypeLabel(event.type);
  const p = event.properties;
  const location = p
    ? [p.street_address, p.neighborhood, p.city, p.province].filter(Boolean).join(", ")
    : "";
  const details = [
    typeLabel && `Tipo: ${typeLabel}`,
    event.leads?.name && `Contacto: ${event.leads.name}${event.leads.phone ? ` (${event.leads.phone})` : ""}`,
    p?.title && `Propiedad: ${p.title}`,
    event.lead_id && `Lead: ${BRAND.siteUrl}/dashboard/leads/${event.lead_id}`,
    event.property_id && `Ficha: ${BRAND.siteUrl}/dashboard/propiedades/${event.property_id}`,
    "",
    `Creado desde ${BRAND.name}.`,
  ].filter((l): l is string => typeof l === "string");

  return {
    summary: typeLabel && !event.title.toLowerCase().startsWith(typeLabel.toLowerCase())
      ? `${typeLabel}: ${event.title}`
      : event.title,
    location: location || undefined,
    description: details.join("\n"),
    start: { dateTime: `${ymd}T${time}:00`, timeZone: APP_TZ },
    end: { dateTime: addMinutes(ymd, time, EVENT_DURATION_MIN), timeZone: APP_TZ },
    extendedProperties: { private: { appEventId: event.id } },
    reminders: { useDefault: true },
  };
}

// Crea o actualiza el evento en el Google Calendar de su agente. No
// lanza: un fallo de Google nunca debe romper el alta del evento.
export async function syncEventToGoogle(eventId: string): Promise<boolean> {
  if (!googleCalendarEnabled) return false;
  const { data } = await supabaseAdmin
    .from("events")
    .select(
      "id, date, time, title, type, agent_id, lead_id, property_id, google_event_id, properties(title, street_address, neighborhood, city, province), leads(name, phone)",
    )
    .eq("id", eventId)
    .maybeSingle();
  const event = data as unknown as EventForSync | null;
  if (!event?.agent_id) return false;

  const auth = await accessTokenFor(event.agent_id);
  if (!auth) return false;

  const base = `${CALENDAR_API}/calendars/${encodeURIComponent(auth.calendarId)}/events`;
  const headers = { Authorization: `Bearer ${auth.token}`, "Content-Type": "application/json" };
  const body = JSON.stringify(googleEventBody(event));

  try {
    let res: Response | null = null;
    if (event.google_event_id) {
      res = await fetch(`${base}/${encodeURIComponent(event.google_event_id)}`, {
        method: "PATCH",
        headers,
        body,
      });
      // Borrado a mano en Google: se vuelve a crear.
      if (res.status === 404 || res.status === 410) res = null;
    }
    if (!res) res = await fetch(base, { method: "POST", headers, body });
    if (!res.ok) {
      await markError(event.agent_id, `Google respondió ${res.status} al sincronizar un evento.`);
      return false;
    }
    const created = (await res.json()) as { id: string };
    if (created.id !== event.google_event_id) {
      await supabaseAdmin.from("events").update({ google_event_id: created.id }).eq("id", event.id);
    }
    return true;
  } catch (e) {
    await markError(event.agent_id, (e as Error).message);
    return false;
  }
}

export async function deleteGoogleEvent(agentId: string, googleEventId: string) {
  if (!googleCalendarEnabled) return;
  const auth = await accessTokenFor(agentId);
  if (!auth) return;
  await fetch(
    `${CALENDAR_API}/calendars/${encodeURIComponent(auth.calendarId)}/events/${encodeURIComponent(googleEventId)}`,
    { method: "DELETE", headers: { Authorization: `Bearer ${auth.token}` } },
  ).catch(() => {});
}

// Al conectar: sube los eventos futuros que el agente ya tenía cargados.
export async function backfillAgentEvents(agentId: string, limit = 100) {
  const { data } = await supabaseAdmin
    .from("events")
    .select("id")
    .eq("agent_id", agentId)
    .gte("date", new Date(Date.now() - 24 * 3600 * 1000).toISOString())
    .order("date")
    .limit(limit);
  let synced = 0;
  for (const row of data ?? []) {
    if (await syncEventToGoogle(row.id)) synced++;
  }
  return synced;
}
