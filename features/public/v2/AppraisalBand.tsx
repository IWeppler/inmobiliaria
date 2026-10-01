import Image from "next/image";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { APPRAISAL_STEPS } from "@/features/public/v2/content";
import { Reveal } from "@/features/public/v2/Reveal";

// Bloque de captación para propietarios. Único bloque con el acento de
// fondo en toda la página: es la conversión secundaria del sitio.
export function AppraisalBand() {
  return (
    <section aria-labelledby="v2-appraisal-title" className="mx-auto w-full max-w-7xl bg-background px-4 pb-16 md:px-6 md:pb-24">
      <Reveal className="grid w-full grid-cols-1 overflow-hidden rounded-3xl bg-main text-primary-foreground lg:grid-cols-12">
        <div className="flex flex-col px-6 py-12 md:px-12 md:py-16 lg:col-span-7 lg:py-20">
          <h2
            id="v2-appraisal-title"
            className="max-w-[18ch] font-clash text-4xl leading-[1.05] font-semibold tracking-tight md:text-5xl"
          >
            ¿Querés vender o alquilar tu propiedad?
          </h2>
          <p className="mt-5 max-w-[48ch] text-lg leading-relaxed text-primary-foreground/80">
            Te decimos cuánto vale hoy, sin costo, y la publicamos donde se mueve la demanda.
          </p>

          <ol className="mt-10 grid grid-cols-1 gap-6 md:grid-cols-3 md:gap-8">
            {APPRAISAL_STEPS.map((step, i) => (
              <li key={step.title} className="flex flex-col gap-2 border-t border-primary-foreground/20 pt-4">
                <span className="font-clash text-sm font-semibold text-primary-foreground/60" aria-hidden="true">
                  {i + 1}
                </span>
                <p className="text-base font-semibold">{step.title}</p>
                <p className="text-sm leading-relaxed text-primary-foreground/75">{step.body}</p>
              </li>
            ))}
          </ol>

          <Link
            href="/tasar"
            className="group mt-10 inline-flex h-12 w-fit items-center gap-2 rounded-md bg-card px-6 text-base font-semibold whitespace-nowrap text-main transition-transform hover:bg-card/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-card focus-visible:ring-offset-2 focus-visible:ring-offset-main active:scale-[0.98]"
          >
            Tasar mi propiedad
            <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
          </Link>
        </div>

        <div className="relative min-h-72 lg:col-span-5 lg:min-h-full">
          <Image
            src="/contact.webp"
            alt="Casa blanca de dos plantas con jardín"
            fill
            sizes="(min-width: 1024px) 40vw, 100vw"
            className="object-cover"
          />
        </div>
      </Reveal>
    </section>
  );
}
