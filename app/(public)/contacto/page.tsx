import Image from "next/image";
import { ContactForm } from "@/features/public/ContactForm";
import { Mail, MapPin } from "lucide-react";

export default async function ContactoPage() {
  return (
    <main className="flex min-h-[calc(100vh-4rem)] w-full pb-16 md:pb-0">
      <div className="container mx-auto max-w-[90dvw]">
        {/* Layout de 2 columnas */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-12 min-h-[calc(100vh-4rem)]">
          
          {/* Columna Derecha: Imagen (primero en DOM, pero se mueve a la derecha en desktop) */}
          <div className="order-2 md:order-2 relative h-full w-full flex items-center justify-end">
            <div className="relative h-[80vh] w-full md:w-[600px]">
              <Image
                src="/contact.webp"
                alt="Contacto Inmobiliaria"
                fill
                className="object-cover"
              />
            </div>
          </div>

          {/* Columna Izquierda: Información y Formulario */}
          <div className="order-1 md:order-1 flex flex-col justify-center py-12 px-4 md:px-0">
            <span className="text-sm font-semibold uppercase text-main mb-2">
              Contacto
            </span>
            <h1 className="text-4xl md:text-5xl font-bold text-zinc-900">
              Ponete en contacto
            </h1>
            <p className="text-lg text-zinc-600 mb-10">
              Contactá a nuestro equipo para cualquier consulta o duda que tengas.
            </p>

            {/* Información de Contacto */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-8 mb-10">
              <div>
                <h3 className="text-lg font-semibold mb-2 flex items-center">
                  <MapPin size={18} className="mr-2" /> Dirección
                </h3>
                <p className="text-zinc-600">
                  Gobernador Crespo 1658
                  <br />
                  Tostado, Santa Fe
                </p>
              </div>
              <div>
                <h3 className="text-lg font-semibold mb-2 flex items-center">
                  <Mail size={18} className="mr-2" /> Email y Teléfono
                </h3>
                <p className="text-zinc-600">
                  info@inmobiliaria.com
                  <br />
                  +54 (3491) 00-0000
                </p>
              </div>
            </div>

            {/* Formulario */}
            <ContactForm />
          </div>
        </div>
      </div>
    </main>
  );
}