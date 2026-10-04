import Image from "next/image";
import Link from "next/link";
import { CalendarCheck, ChevronRight, Mail, Phone, ShieldCheck } from "lucide-react";
import { FaWhatsapp } from "react-icons/fa";
import { BRAND } from "@/lib/brand";

type Agent = {
  id: string;
  full_name: string | null;
  phone: string | null;
  email: string | null;
  avatar_url: string | null;
} | null;

type AgentCardProps = {
  agent: Agent;
  propertyTitle: string;
  propertyId: string;
  available: boolean;
  priceDisplay: string;
  priceLabel: string;
  statusDisplay: string;
  expensasDisplay?: string | null;
};

function contactData(agent: Agent, propertyTitle: string) {
  const name = agent?.full_name || BRAND.name;
  const phone = agent?.phone?.replace(/[^0-9]/g, "") || "";
  const message = encodeURIComponent(
    `Hola ${name}, estoy interesado en la propiedad: ${propertyTitle}. ¿Podrías darme más información?`,
  );
  return {
    name,
    phone,
    whatsappUrl: phone ? `https://wa.me/${phone}?text=${message}` : null,
    mailUrl: agent?.email
      ? `mailto:${agent.email}?subject=${encodeURIComponent(`Consulta por ${propertyTitle}`)}`
      : null,
  };
}

export function AgentCard({
  agent,
  propertyTitle,
  propertyId,
  available,
  priceDisplay,
  priceLabel,
  statusDisplay,
  expensasDisplay,
}: AgentCardProps) {
  const { name, phone, whatsappUrl, mailUrl } = contactData(agent, propertyTitle);

  return (
    <div className="overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-[0_1px_2px_rgb(0_0_0/0.04),0_12px_32px_-12px_rgb(0_0_0/0.12)]">
      {/* Precio */}
      <div className="border-b border-zinc-100 p-6">
        <div className="flex items-center justify-between gap-3">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-zinc-500">{priceLabel}</p>
          <span
            className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${
              available ? "bg-emerald-50 text-emerald-700" : "bg-zinc-100 text-zinc-600"
            }`}
          >
            <span className={`h-1.5 w-1.5 rounded-full ${available ? "bg-emerald-500" : "bg-zinc-400"}`} />
            {statusDisplay}
          </span>
        </div>
        <p className="mt-2 font-clash text-3xl font-semibold tracking-tight text-zinc-900">{priceDisplay}</p>
        {expensasDisplay && <p className="mt-1 text-sm text-zinc-500">+ {expensasDisplay} de expensas</p>}
      </div>

      <div className="p-6">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-zinc-500">Tu próximo paso</p>
        <h2 className="mt-1.5 font-clash text-xl font-semibold text-zinc-900">
          {available ? "Conocé esta propiedad en persona" : "Consultá por esta propiedad"}
        </h2>
        <p className="mt-1.5 text-sm leading-6 text-zinc-600">
          {available
            ? "Elegí día y horario para visitarla o escribinos con tus dudas."
            : "Ya no está disponible para visitas, pero podemos mostrarte alternativas similares."}
        </p>

        {available && (
          <Link
            href={`/agendar/${propertyId}`}
            className="group mt-5 flex items-center gap-3 rounded-xl bg-zinc-900 p-3 pr-4 text-white transition hover:bg-zinc-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-900 focus-visible:ring-offset-2"
          >
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-white/10">
              <CalendarCheck className="h-5 w-5" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-semibold">Agendar una visita</span>
              <span className="block text-xs text-white/60">Elegí el horario que te quede cómodo</span>
            </span>
            <ChevronRight className="h-5 w-5 text-white/60 transition-transform group-hover:translate-x-0.5" />
          </Link>
        )}

        {(whatsappUrl || mailUrl) && (
          <div className="mt-3 grid grid-cols-2 gap-2.5">
            {whatsappUrl && (
              <a
                href={whatsappUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 text-sm font-semibold text-emerald-800 transition hover:bg-emerald-100"
              >
                <FaWhatsapp className="h-4 w-4" aria-hidden />
                WhatsApp
              </a>
            )}
            {phone && (
              <a
                href={`tel:+${phone}`}
                className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-zinc-200 text-sm font-semibold text-zinc-800 transition hover:bg-zinc-50"
              >
                <Phone className="h-4 w-4" />
                Llamar
              </a>
            )}
            {mailUrl && (
              <a
                href={mailUrl}
                className="col-span-2 inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-zinc-200 text-sm font-semibold text-zinc-800 transition hover:bg-zinc-50"
              >
                <Mail className="h-4 w-4" />
                Escribir por email
              </a>
            )}
          </div>
        )}

        {!whatsappUrl && !mailUrl && (
          <Link
            href="/contacto"
            className="mt-3 inline-flex h-11 w-full items-center justify-center rounded-xl border border-zinc-200 text-sm font-semibold text-zinc-800 transition hover:bg-zinc-50"
          >
            Contactar a la inmobiliaria
          </Link>
        )}

        {/* Asesor */}
        <div className="mt-6 flex items-center gap-3 rounded-xl bg-zinc-50 p-3">
          <div className="relative h-11 w-11 shrink-0 overflow-hidden rounded-full border-2 border-white bg-zinc-200 shadow-sm">
            {agent?.avatar_url ? (
              <Image src={agent.avatar_url} alt={name} fill sizes="44px" className="object-cover" />
            ) : (
              <span className="flex h-full items-center justify-center font-semibold text-zinc-600" aria-hidden="true">
                {name[0]}
              </span>
            )}
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-zinc-900">{name}</p>
            <p className="text-xs text-zinc-500">Te acompaña en todo el proceso</p>
          </div>
        </div>

        <p className="mt-4 flex items-center gap-2 text-xs text-zinc-500">
          <ShieldCheck className="h-4 w-4 shrink-0 text-zinc-400" />
          Consultar y visitar no tiene costo ni compromiso.
        </p>
      </div>
    </div>
  );
}

// Barra fija inferior en móvil: la card del aside queda al final de la
// página en pantallas chicas, así el contacto siempre está a mano.
export function MobileContactBar({
  agent,
  propertyTitle,
  propertyId,
  available,
  priceDisplay,
  priceLabel,
}: Pick<AgentCardProps, "agent" | "propertyTitle" | "propertyId" | "available" | "priceDisplay" | "priceLabel">) {
  const { whatsappUrl } = contactData(agent, propertyTitle);

  return (
    <div className="fixed inset-x-0 bottom-0 z-40 border-t border-zinc-200 bg-white/95 px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur lg:hidden">
      <div className="flex items-center gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-medium uppercase tracking-wide text-zinc-500">{priceLabel}</p>
          <p className="truncate font-clash text-lg font-semibold text-zinc-900">{priceDisplay}</p>
        </div>
        {whatsappUrl && (
          <a
            href={whatsappUrl}
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Consultar por WhatsApp"
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-emerald-200 bg-emerald-50 text-emerald-800"
          >
            <FaWhatsapp className="h-5 w-5" aria-hidden />
          </a>
        )}
        {available ? (
          <Link
            href={`/agendar/${propertyId}`}
            className="inline-flex h-11 shrink-0 items-center gap-2 rounded-xl bg-zinc-900 px-4 text-sm font-semibold text-white"
          >
            <CalendarCheck className="h-4 w-4" />
            Agendar visita
          </Link>
        ) : (
          <Link
            href="/contacto"
            className="inline-flex h-11 shrink-0 items-center rounded-xl bg-zinc-900 px-4 text-sm font-semibold text-white"
          >
            Consultar
          </Link>
        )}
      </div>
    </div>
  );
}
