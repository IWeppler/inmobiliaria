"use server";

import { z } from "zod";
import { supabaseAdmin, nextAgentForLead } from "@/lib/supabase-admin";
import {
  getAvailability,
  isSlotBookable,
} from "@/features/booking/availability";
import { dayStartISO } from "@/lib/dates";
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
  };
};

const OFFSET = process.env.NEXT_PUBLIC_APP_UTC_OFFSET ?? "-03:00";

// Archivo .ics para que el visitante (o el agente) lo sume a su
// calendario. Reemplaza, por ahora, la sync con Google Calendar.
function buildIcs(opts: {
  date: string;
  time: string;
  title: string;
  address: string;
  url: string;
  uid: string;
}) {
  const start = new Date(`${opts.date}T${opts.time}:00${OFFSET}`);
  const end = new Date(start.getTime() + 60 * 60 * 1000);
  const fmt = (d: Date) =>
    d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
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
    `SUMMARY:${esc(`Visita: ${opts.title}`)}`,
    `LOCATION:${esc(opts.address)}`,
    `DESCRIPTION:${esc(`Visita coordinada con ${BRAND.name}. Ficha: ${opts.url}`)}`,
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

  return {
    success: true,
    message: "¡Visita agendada! Te vamos a confirmar por WhatsApp o teléfono.",
    booking: {
      date,
      time,
      propertyTitle: property.title,
      address,
      agentName: agent?.full_name ?? BRAND.name,
      ics: buildIcs({
        date,
        time,
        title: property.title,
        address,
        url: propertyUrl(propertyId),
        uid: `${event.id}@${BRAND.siteUrl.replace(/^https?:\/\//, "")}`,
      }),
    },
  };
}
