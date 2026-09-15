import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { ArrowLeft, MapPin } from "lucide-react";
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

  const { data: raw } = await supabase
    .from("properties")
    .select(
      "id, title, price, currency, status, city, province, neighborhood, agent_id, property_images(image_url, order), property_types(name), agents(full_name, avatar_url)"
    )
    .eq("id", id)
    .single();

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

  return (
    <main className="min-h-[calc(100vh-4rem)] w-full pb-16">
      <div className="container mx-auto max-w-5xl px-4 py-8 md:py-12">
        <Link
          href={`/propiedades/${property.id}`}
          className="inline-flex gap-1 items-center mb-6 text-sm hover:underline"
        >
          <ArrowLeft className="h-4 w-4" />
          Volver a la propiedad
        </Link>

        <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_320px] gap-8 items-start">
          <div>
            <span className="text-sm font-semibold uppercase text-main mb-2 block">
              Visita
            </span>
            <h1 className="text-3xl md:text-4xl font-clash font-semibold text-zinc-900 mb-2">
              Agendá tu visita
            </h1>
            <p className="text-zinc-600 mb-8">
              Elegí el día y horario que te quede cómodo. Te confirmamos por
              WhatsApp o teléfono.
            </p>

            {!active ? (
              <div className="bg-white p-6 rounded-xl border border-zinc-100 shadow-lg">
                <p className="text-zinc-700">
                  Esta propiedad ya no está disponible para visitas.
                </p>
              </div>
            ) : !agentId ? (
              <div className="bg-white p-6 rounded-xl border border-zinc-100 shadow-lg">
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

          <aside className="bg-white rounded-xl border border-zinc-100 shadow-lg overflow-hidden lg:sticky lg:top-24">
            <div className="relative aspect-4/3 bg-zinc-100">
              {image && (
                <Image src={image} alt={property.title} fill className="object-cover" />
              )}
            </div>
            <div className="p-5">
              <p className="font-clash text-lg font-semibold text-zinc-900 leading-snug">
                {property.title}
              </p>
              <p className="text-zinc-900 font-bold mt-1">
                {formatPrice(property.price, property.currency)}
              </p>
              {formatLocation(property) && (
                <p className="flex items-center gap-1.5 text-sm text-zinc-500 mt-2">
                  <MapPin className="size-4 shrink-0" />
                  {formatLocation(property)}
                </p>
              )}
              <p className="text-xs text-zinc-500 mt-4 border-t border-zinc-100 pt-3">
                Te atiende {property.agents?.full_name ?? BRAND.name}.
              </p>
            </div>
          </aside>
        </div>
      </div>
    </main>
  );
}
