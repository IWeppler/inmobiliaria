import { Mail } from "lucide-react";
import { FaWhatsapp } from "react-icons/fa";
import { BRAND, whatsappLink } from "@/lib/brand";
import { CONTACT_CTA_LABEL } from "@/features/public/v2/content";
import { Reveal } from "@/features/public/v2/Reveal";

// Cierre de la página, tipográfico (el hero ya usa foto a sangre). Un solo
// CTA de contacto (WhatsApp); el email va como dato, no como segundo
// botón con la misma intención.
export function ContactClose() {
  return (
    <section aria-labelledby="v2-contact-title" id="contacto" className="w-full bg-background">
      <div className="mx-auto w-full max-w-7xl px-4 pb-20 md:px-6 md:pb-28">
        <Reveal className="grid grid-cols-1 gap-10 border-t border-border-strong pt-12 md:pt-16 lg:grid-cols-12 lg:items-end">
          <div className="lg:col-span-8">
            <h2
              id="v2-contact-title"
              className="max-w-[18ch] text-balance font-clash text-5xl leading-[1.02] font-semibold tracking-tight text-foreground md:text-6xl lg:text-7xl"
            >
              ¿No encontrás lo que buscás?
            </h2>
            <p className="mt-5 max-w-[48ch] text-lg leading-relaxed text-muted-foreground">
              Muchas propiedades se venden antes de publicarse. Contanos qué necesitás y te avisamos.
            </p>
          </div>

          <div className="flex flex-col items-start gap-4 lg:col-span-4 lg:items-end">
            <a
              href={whatsappLink("Hola, estoy buscando una propiedad y quería hacer una consulta.")}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex h-12 items-center gap-2 rounded-md bg-foreground px-6 text-base font-semibold whitespace-nowrap text-background transition-[background-color,transform] hover:bg-main focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 active:scale-[0.98]"
            >
              <FaWhatsapp className="h-5 w-5" aria-hidden="true" />
              {CONTACT_CTA_LABEL}
            </a>
            <a
              href={`mailto:${BRAND.email}`}
              className="inline-flex items-center gap-2 text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
            >
              <Mail className="h-4 w-4" aria-hidden="true" />
              {BRAND.email}
            </a>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
