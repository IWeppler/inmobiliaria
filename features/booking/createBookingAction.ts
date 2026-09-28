"use server";

import { after } from "next/server";
import { z } from "zod";
import { supabaseAdmin, nextAgentForLead } from "@/lib/supabase-admin";
import {
  getAvailability,
  isSlotBookable,
} from "@/features/booking/availability";
import { dayStartISO } from "@/lib/dates";
import { syncEventToGoogle } from "@/lib/google-calendar";
import { BRAND, propertyUrl } from "@/lib/brand";
import { normalizeArPhone, sendTemplate, whatsappEnabled } from "@/lib/whatsapp";

// E3.2 — Booking page pública: el lead agenda su propia visita. Crea el
// lead (source BOOKING, status VISITA PROGRAMADA) y el evento vinculado
// (type 'visita') en el calendario del agente de la propiedad; si la
// propiedad no tiene agente, aplica reglas / round-robin (E1.2 / E0.4).
// Service role: el visitante no tiene sesión. Zod + re-chequeo del turno
// en servidor son la única puerta de entrada.
const bookingSchema = z.object({
  propertyId: z.string().uuid(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  time: z.string().regex(/^\d{2}:\d{2}$/),
  name: z.string().min(3).max(120),
  phone: z.string().min(8).max(40),
  email: z.string().email().optional().or(z.literal("")),
  message: z.string().max(1000).optional(),
});

export type BookingState = {
  success: boolean;
  message: string;
  booking?: {
    date: string;
    time: string;
    propertyTitle: string;
    address: string;
    agentName: string;
    ics: string;
    googleCalendarUrl: string;
    outlookCalendarUrl: string;
  };
};

const OFFSET = process.env.NEXT_PUBLIC_APP_UTC_OFFSET ?? "-03:00";

const VISIT_DURATION_MS = 60 * 60 * 1000;

function visitRange(date: string, time: string) {
  const start = new Date(`${date}T${time}:00${OFFSET}`);
  return { start, end: new Date(start.getTime() + VISIT_DURATION_MS) };
}

// 20260915T130000Z: formato UTC compacto de iCalendar y Google Calendar.
const fmtUtc = (d: Date) =>
  d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");

type CalendarEventOpts = {
  date: string;
  time: string;
  title: string;
  address: string;
  url: string;
};

const eventSummary = (title: string) => `Visita: ${title}`;
const eventDescription = (url: string) =>
  `Visita coordinada con ${BRAND.name}. Ficha: ${url}`;

// Links "agregar al calendario": abren Google Calendar / Outlook con el
// evento precargado y el visitante solo confirma. No requieren OAuth ni
// guardan nada de nuestro lado.
function buildGoogleCalendarUrl(opts: CalendarEventOpts) {
  const { start, end } = visitRange(opts.date, opts.time);
  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: eventSummary(opts.title),
    dates: `${fmtUtc(start)}/${fmtUtc(end)}`,
    details: eventDescription(opts.url),
    location: opts.address,
  });
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

function buildOutlookCalendarUrl(opts: CalendarEventOpts) {
  const { start, end } = visitRange(opts.date, opts.time);
  const params = new URLSearchParams({
    path: "/calendar/action/compose",
    rru: "addevent",
    subject: eventSummary(opts.title),
    startdt: start.toISOString(),
    enddt: end.toISOString(),
    body: eventDescription(opts.url),
    location: opts.address,
  });
  return `https://outlook.live.com/calendar/0/deeplink/compose?${params.toString()}`;
}

// Archivo .ics para Apple Calendar y el resto de los clientes.
function buildIcs(opts: CalendarEventOpts & { uid: string }) {
  const { start, end } = visitRange(opts.date, opts.time);
  const fmt = fmtUtc;
  const esc = (s: string) =>
    s
      .replace(/\\/g, "\\\\")
      .replace(/;/g, "\\;")
      .replace(/,/g, "\\,")
      .replace(/\n/g, "\\n");
  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    `PRODID:-//${esc(BRAND.name)}//Visitas//ES`,
    "BEGIN:VEVENT",
    `UID:${opts.uid}`,
    `DTSTAMP:${fmt(new Date())}`,
    `DTSTART:${fmt(start)}`,
    `DTEND:${fmt(end)}`,
    `SUMMARY:${esc(eventSummary(opts.title))}`,
    `LOCATION:${esc(opts.address)}`,
    `DESCRIPTION:${esc(eventDescription(opts.url))}`,
    `URL:${opts.url}`,
    "END:VEVENT",
    "END:VCALENDAR",
  ].join("\r\n");
}

export async function createBookingAction(
  _prev: BookingState,
  formData: FormData
): Promise<BookingState> {
  const parsed = bookingSchema.safeParse({
    propertyId: formData.get("propertyId"),
    date: formData.get("date"),
    time: formData.get("time"),
    name: formData.get("name"),
    phone: formData.get("phone"),
    email: formData.get("email"),
    message: formData.get("message"),
  });
  if (!parsed.success) {
    return { success: false, message: "Revisá los datos del formulario." };
  }
  const { propertyId, date, time, name, phone, email, message } = parsed.data;

  const { data: property } = await supabaseAdmin
    .from("properties")
    .select(
      "id, title, agent_id, city, street_address, neighborhood, province, status, property_types(name)"
    )
    .eq("id", propertyId)
    .single();
  if (!property) return { success: false, message: "La propiedad no existe." };
  if (property.status !== "EN_VENTA" && property.status !== "EN_ALQUILER") {
    return {
      success: false,
      message: "Esta propiedad ya no está disponible para visitas.",
    };
  }

  const agentId =
    property.agent_id ??
    (await nextAgentForLead({
      city: property.city,
      propertyType: property.property_types?.name,
    }));
  if (!agentId) {
    return {
      success: false,
      message: "No hay un asesor disponible en este momento.",
    };
  }

  // Re-chequeo del turno con la disponibilidad real del agente asignado.
  const availability = await getAvailability(agentId);
  if (!isSlotBookable(availability, date, time)) {
    return {
      success: false,
      message: "Ese turno ya no está disponible. Elegí otro.",
    };
  }

  const { data: lead, error: leadError } = await supabaseAdmin
    .from("leads")
    .insert({
      name,
      phone,
      email: email || null,
      notes: `VISITA AGENDADA ONLINE: ${date} ${time}${
        message ? `\n${message}` : ""
      }`,
      property_id: propertyId,
      agent_id: agentId,
      status: "VISITA PROGRAMADA",
      source: "BOOKING",
    })
    .select("id")
    .single();
  if (leadError || !lead) {
    return {
      success: false,
      message: `No se pudo registrar la solicitud: ${leadError?.message}`,
    };
  }

  const { data: event, error: eventError } = await supabaseAdmin
    .from("events")
    .insert({
      date: dayStartISO(date),
      time,
      title: `Visita: ${name} · ${property.title}`,
      type: "visita",
      lead_id: lead.id,
      property_id: propertyId,
      agent_id: agentId,
    })
    .select("id")
    .single();
  if (eventError || !event) {
    return {
      success: false,
      message: `Se registró tu consulta pero no el turno: ${eventError?.message}`,
    };
  }

  // Copia al Google Calendar del agente, si lo conectó. Después de
  // responder: no demora ni rompe la reserva.
  after(() => syncEventToGoogle(event.id));

  const { data: agent } = await supabaseAdmin
    .from("agents")
    .select("full_name")
    .eq("id", agentId)
    .single();

  // E3.3: confirmación por WhatsApp (plantilla aprobada) si está
  // configurado. Fire-and-forget: un fallo acá no invalida la reserva.
  if (whatsappEnabled) {
    const to = normalizeArPhone(phone);
    if (to) {
      void sendTemplate(to, "visita_confirmada", [name, property.title, date, time]).catch(
        () => {}
      );
    }
  }

  const address = [
    property.street_address,
    property.neighborhood,
    property.city,
    property.province,
  ]
    .filter(Boolean)
    .join(", ");

  const calendarEvent: CalendarEventOpts = {
    date,
    time,
    title: property.title,
    address,
    url: propertyUrl(propertyId),
  };

  return {
    success: true,
    message: "¡Visita agendada! Te vamos a confirmar por WhatsApp o teléfono.",
    booking: {
      date,
      time,
      propertyTitle: property.title,
      address,
      agentName: agent?.full_name ?? BRAND.name,
      googleCalendarUrl: buildGoogleCalendarUrl(calendarEvent),
      outlookCalendarUrl: buildOutlookCalendarUrl(calendarEvent),
      ics: buildIcs({
        ...calendarEvent,
        uid: `${event.id}@${BRAND.siteUrl.replace(/^https?:\/\//, "")}`,
      }),
    },
  };
}
