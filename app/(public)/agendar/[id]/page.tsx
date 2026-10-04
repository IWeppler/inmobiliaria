import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { ArrowLeft, Clock, MapPin, ShieldCheck } from "lucide-react";
import { FaWhatsapp } from "react-icons/fa";
import { createClientServer } from "@/lib/supabase";
import { nextAgentForLead } from "@/lib/supabase-admin";
import { getAvailability } from "@/features/booking/availability";
import { BookingForm } from "@/features/booking/BookingForm";
import { BRAND, formatLocation, formatPrice } from "@/lib/brand";

// E3.2 — Booking page pública: /agendar/[id]. El visitante elige día y
// horario disponibles del asesor de la propiedad y deja sus datos.
export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const supabase = await createClientServer();
  const { data } = await supabase
    .from("properties")
    .select("title")
    .eq("id", id)
    .single();
  return {
    title: data ? `Agendar visita · ${data.title}` : "Agendar visita",
    robots: { index: false },
  };
}

export default async function AgendarPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClientServer();

  const { data: raw, error } = await supabase
    .from("properties")
    .select(
      "id, title, price, currency, status, city, province, neighborhood, agent_id, property_images(image_url, order), property_types(name), agents!properties_agent_id_fkey(full_name, avatar_url)"
    )
    .eq("id", id)
    .single();

  if (error && error.code !== "PGRST116") {
    console.error("Error fetching booking property:", error);
    throw new Error("No se pudieron cargar los datos de la propiedad.");
  }

  // createClientServer no está tipado con Database: las relaciones
  // to-one llegan como any[]. Se tipa a mano acá.
  const property = raw as unknown as {
    id: string;
    title: string;
    price: number | null;
    currency: string | null;
    status: string;
    city: string | null;
    province: string | null;
    neighborhood: string | null;
    agent_id: string | null;
    property_images: { image_url: string | null; order: number | null }[] | null;
    property_types: { name: string | null } | null;
    agents: { full_name: string | null; avatar_url: string | null } | null;
  } | null;

  if (!property) notFound();

  const active =
    property.status === "EN_VENTA" || property.status === "EN_ALQUILER";

  // Sin agente asignado, la disponibilidad se calcula sobre el agente que
  // recibiría el lead hoy (reglas / round-robin); la asignación definitiva
  // se resuelve de nuevo al confirmar.
  const agentId =
    property.agent_id ??
    (await nextAgentForLead({
      city: property.city,
      propertyType: property.property_types?.name,
    }));
  const days = active && agentId ? await getAvailability(agentId) : [];

  const image = [...(property.property_images ?? [])].sort(
    (a, b) => (a.order ?? 0) - (b.order ?? 0)
  )[0]?.image_url;

  const location = formatLocation(property);
  const agentName = property.agents?.full_name ?? BRAND.name;

  return (
    <main className="min-h-[calc(100vh-4rem)] w-full bg-zinc-50/60 pb-16">
      <div className="container mx-auto max-w-6xl px-4 py-8 md:px-8 md:py-12">
        <Link
          href={`/propiedades/${property.id}`}
          className="mb-6 inline-flex items-center gap-2 text-sm text-zinc-600 hover:text-zinc-900"
        >
          <ArrowLeft className="h-4 w-4" />
          Volver a la propiedad
        </Link>

        <div className="grid grid-cols-1 items-start gap-8 lg:grid-cols-[minmax(0,1fr)_360px] lg:gap-10">
          <div className="min-w-0">
            <header className="mb-8">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-zinc-500">
                Visita presencial
              </p>
              <h1 className="mt-2 font-clash text-3xl font-semibold text-zinc-900 md:text-5xl">
                Agendá tu visita
              </h1>
              <p className="mt-3 max-w-xl text-zinc-600">
                Elegí el día y horario que te quede cómodo. Te lleva menos de
                un minuto y te confirmamos por WhatsApp o teléfono.
              </p>
            </header>

            {!active ? (
              <div className="rounded-2xl border border-zinc-200 bg-white p-6 md:p-8">
                <p className="font-semibold text-zinc-900">
                  Esta propiedad ya no está disponible para visitas.
                </p>
                <p className="mt-1 text-sm text-zinc-600">
                  Mirá otras opciones similares o escribinos y te ayudamos a
                  encontrar una.
                </p>
                <div className="mt-5 flex flex-wrap gap-3">
                  <Link
                    href="/propiedades"
                    className="inline-flex h-10 items-center rounded-xl bg-zinc-900 px-4 text-sm font-semibold text-white hover:bg-zinc-800"
                  >
                    Ver propiedades
                  </Link>
                  <Link
                    href="/contacto"
                    className="inline-flex h-10 items-center rounded-xl border border-zinc-200 px-4 text-sm font-medium text-zinc-900 hover:bg-zinc-50"
                  >
                    Contactar
                  </Link>
                </div>
              </div>
            ) : !agentId ? (
              <div className="rounded-2xl border border-zinc-200 bg-white p-6 md:p-8">
                <p className="text-zinc-700">
                  No hay asesores disponibles en este momento. Escribinos desde{" "}
                  <Link href="/contacto" className="underline">
                    contacto
                  </Link>
                  .
                </p>
              </div>
            ) : (
              <BookingForm propertyId={property.id} days={days} />
            )}
          </div>

          <aside className="space-y-4 lg:sticky lg:top-24">
            <div className="overflow-hidden rounded-2xl border border-zinc-200 bg-white">
              <div className="relative aspect-16/10 bg-zinc-100">
                {image && (
                  <Image
                    src={image}
                    alt={property.title}
                    fill
                    sizes="(min-width: 1024px) 360px, 100vw"
                    className="object-cover"
                  />
                )}
                {property.property_types?.name && (
                  <span className="absolute top-3 left-3 rounded-full bg-white/95 px-2.5 py-1 text-xs font-medium text-zinc-900 shadow-sm">
                    {property.property_types.name}
                  </span>
                )}
              </div>
              <div className="p-5">
                <p className="font-clash text-lg font-semibold leading-snug text-zinc-900">
                  {property.title}
                </p>
                {location && (
                  <p className="mt-1.5 flex items-start gap-1.5 text-sm text-zinc-500">
                    <MapPin className="mt-0.5 size-4 shrink-0" />
                    {location}
                  </p>
                )}
                <p className="mt-3 font-clash text-xl font-semibold text-zinc-900">
                  {formatPrice(property.price, property.currency)}
                </p>
                <div className="mt-4 flex items-center gap-3 border-t border-zinc-100 pt-4">
                  <div className="relative h-10 w-10 shrink-0 overflow-hidden rounded-full border border-zinc-200 bg-zinc-100">
                    {property.agents?.avatar_url ? (
                      <Image
                        src={property.agents.avatar_url}
                        alt={agentName}
                        fill
                        sizes="40px"
                        className="object-cover"
                      />
                    ) : (
                      <span
                        className="flex h-full items-center justify-center text-sm font-semibold text-zinc-500"
                        aria-hidden="true"
                      >
                        {agentName[0]}
                      </span>
                    )}
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs text-zinc-500">Te recibe</p>
                    <p className="truncate text-sm font-semibold text-zinc-900">
                      {agentName}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-zinc-200 bg-white p-5">
              <p className="text-sm font-semibold text-zinc-900">Qué esperar</p>
              <ul className="mt-3 space-y-3 text-sm text-zinc-600">
                <li className="flex gap-3">
                  <FaWhatsapp className="mt-0.5 h-4 w-4 shrink-0 text-zinc-400" aria-hidden />
                  Te confirmamos el turno por WhatsApp o teléfono.
                </li>
                <li className="flex gap-3">
                  <Clock className="mt-0.5 h-4 w-4 shrink-0 text-zinc-400" />
                  La visita dura alrededor de 1 hora.
                </li>
                <li className="flex gap-3">
                  <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-zinc-400" />
                  Sin costo ni compromiso.
                </li>
              </ul>
            </div>
          </aside>
        </div>
      </div>
    </main>
  );
}
