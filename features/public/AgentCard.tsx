import Image from "next/image";
import { Phone } from "lucide-react";
import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import { Textarea } from "@/shared/components/ui/textarea";
import Link from "next/link";

type AgentCardProps = {
  agent: {
    id: string; 
    full_name: string | null;
    phone: string | null;
    email: string | null;
    avatar_url: string | null;
  } | null;
  propertyTitle: string;
  propertyId: string; 
};

export function AgentCard({ agent, propertyTitle }: AgentCardProps) {
  const displayAgent = agent || {
    full_name: "TerraNova Inmobiliaria",
    phone: "5491154702118",
    email: "contacto@terranova.com",
    avatar_url: null,
  };

  const cleanPhone = (displayAgent.phone || "").replace(/[^0-9]/g, "");

  // Mensaje predeterminado
  const whatsappMessage = encodeURIComponent(
    `Hola ${displayAgent.full_name}, estoy interesado en la propiedad: ${propertyTitle}`
  );

  return (
    <div className="bg-white p-6 rounded-xl shadow-lg border border-zinc-100 sticky top-24">
      <h3 className="text-xl font-clash font-semibold mb-4 text-zinc-900">
        Consultá por esta propiedad
      </h3>

      {/* 1. Perfil del Agente */}
      <div className="flex items-center gap-4 mb-6">
        <div className="relative w-16 h-16 rounded-full overflow-hidden bg-zinc-100 border border-zinc-200">
          {displayAgent.avatar_url ? (
            <Image
              src={displayAgent.avatar_url}
              alt={displayAgent.full_name || "Agente"}
              fill
              className="object-cover"
            />
          ) : (
            // Placeholder si no hay foto
            <div className="w-full h-full flex items-center justify-center text-zinc-400 font-bold text-xl">
              {displayAgent.full_name?.[0] || "A"}
            </div>
          )}
        </div>
        <div>
          <p className="font-semibold text-lg text-zinc-900">
            {displayAgent.full_name}
          </p>
          <p className="text-sm text-zinc-500">Agente Inmobiliario</p>
        </div>
      </div>

      {/* 2. Botones de Acción Directa */}
      <div className="grid grid-cols-2 gap-3 mb-6">
        <Button
          className="w-full bg-[#24d367] hover:bg-[#113828] text-white"
          asChild
        >
          <a
            href={`https://wa.me/${cleanPhone}?text=${whatsappMessage}`}
            target="_blank"
            rel="noopener noreferrer"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width={20}
              height={20}
              viewBox="0 0 24 24"
              fill="none"
              stroke="white"
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
              className="icon icon-tabler icons-tabler-outline icon-tabler-brand-whatsapp mr-2 text-green-600"
            >
              <path stroke="none" d="M0 0h24v24H0z" fill="none" />
              <path d="M3 21l1.65 -3.8a9 9 0 1 1 3.4 2.9l-5.05 .9" />
              <path d="M9 10a.5 .5 0 0 0 1 0v-1a.5 .5 0 0 0 -1 0v1a5 5 0 0 0 5 5h1a.5 .5 0 0 0 0 -1h-1a.5 .5 0 0 0 0 1" />
            </svg>{" "}
            WhatsApp
          </a>
        </Button>
        <Button variant="outline" className="w-full border-zinc-300" asChild>
          <Link
            href={`tel:${cleanPhone}`}
            target="_blank"
            rel="noopener noreferrer"
          >
            <Phone className="w-4 h-4 mr-2" />
            Llamar
          </Link>
        </Button>
      </div>

      <div className="relative flex py-2 items-center">
        <div className="grow border-t border-zinc-200"></div>
        <span className="shrink mx-4 text-zinc-400 text-xs uppercase">
          O envíanos un email
        </span>
        <div className="grow border-t border-zinc-200"></div>
      </div>

      {/* 3. Formulario (Visual - Conectar lógica luego) */}
      <form className="space-y-4 mt-4">
        <div>
          <Input
            placeholder="Tu nombre"
            className="bg-zinc-50 border-zinc-200"
          />
        </div>
        <div>
          <Input
            placeholder="Tu teléfono"
            className="bg-zinc-50 border-zinc-200"
          />
        </div>
        <div>
          <Input
            placeholder="Tu email"
            className="bg-zinc-50 border-zinc-200"
          />
        </div>
        <div>
          <Textarea
            placeholder="Hola, quisiera saber más sobre..."
            className="bg-zinc-50 border-zinc-200 min-h-[100px]"
          />
        </div>
        <Button type="submit" className="w-full cursor-pointer bg-foreground">
          Enviar Consulta
        </Button>
      </form>
    </div>
  );
}
