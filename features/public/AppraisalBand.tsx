import Image from "next/image";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Reveal } from "@/features/public/v2/Reveal";

const steps = [
  {
    title: "Nos contás",
    body: "Completás un formulario corto con los datos de tu propiedad.",
  },
  {
    title: "La visitamos",
    body: "Coordinamos una visita para ver estado, superficie y entorno.",
  },
  {
    title: "Recibís el informe",
    body: "Te enviamos un valor de mercado con comparables de la zona.",
  },
];

// Banda de tasación: lleva a dueños que todavía no publicaron hacia
// /tasar, el primer paso para vender o alquilar con la inmobiliaria.
export function AppraisalBand() {
  return (
    <section className="w-full pb-16 md:pb-32">
      <div className="mx-auto max-w-7xl px-4 md:px-6">
        <div className="grid grid-cols-1 items-center gap-10 overflow-hidden rounded-3xl bg-card border border-border p-4 md:p-6 lg:grid-cols-2 lg:gap-16">
          <Reveal className="relative aspect-4/3 w-full overflow-hidden rounded-2xl">
            <Image
              src="/bghero5.jpg"
              alt="Casa de dos plantas con galería de madera, pileta y parque"
              fill
              sizes="(min-width: 1024px) 600px, 100vw"
              className="object-cover"
            />
          </Reveal>

          <Reveal delay={0.08} className="px-2 pb-4 lg:px-0 lg:pb-0 lg:pr-6">
            <h2 className="font-clash text-4xl font-semibold text-foreground md:text-5xl text-balance">
              ¿Cuánto vale tu propiedad?
            </h2>
            <p className="mt-4 max-w-md text-lg leading-relaxed text-muted-foreground">
              Pedí una tasación profesional y sabé a qué precio publicar antes
              de decidir.
            </p>

            <ol className="mt-8 space-y-5">
              {steps.map((step, i) => (
                <li key={step.title} className="flex gap-4">
                  <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-main/10 text-sm font-semibold text-main">
                    {i + 1}
                  </span>
                  <div>
                    <p className="font-semibold text-foreground">{step.title}</p>
                    <p className="text-[15px] leading-relaxed text-muted-foreground">
                      {step.body}
                    </p>
                  </div>
                </li>
              ))}
            </ol>

            <Link
              href="/tasar"
              className="mt-10 flex w-fit items-center gap-2 rounded-lg bg-foreground px-6 py-3 text-sm font-medium text-background transition-all hover:bg-foreground/90 active:scale-[0.98]"
            >
              Tasar mi propiedad <ArrowRight size={18} />
            </Link>
          </Reveal>
        </div>
      </div>
    </section>
  );
}
