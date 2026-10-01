import Link from "next/link";
import {
  ArrowRight,
  ArrowUpRight,
  ClipboardCheck,
  KeyRound,
  Search,
  Tag,
  type LucideIcon,
} from "lucide-react";
import { Reveal } from "@/features/public/v2/Reveal";

const serviceData: {
  icon: LucideIcon;
  title: string;
  href: string;
  description: string;
}[] = [
  {
    icon: Tag,
    title: "Venta",
    href: "/tasar",
    description:
      "Vendé tu propiedad al mejor precio del mercado. Te acompañamos en cada paso, con una gestión profesional y segura.",
  },
  {
    icon: Search,
    title: "Compra",
    href: "/propiedades?tipo=venta",
    description:
      "Encontramos el hogar o inversión ideal. Nuestra experiencia asegura que tomes decisiones informadas.",
  },
  {
    icon: KeyRound,
    title: "Alquileres",
    href: "/propiedades?tipo=alquiler",
    description:
      "Gestionamos alquileres de forma transparente y eficiente, cuidando tanto propietarios como inquilinos.",
  },
  {
    icon: ClipboardCheck,
    title: "Tasaciones",
    href: "/tasar",
    description:
      "Tasaciones profesionales basadas en datos reales y análisis del mercado inmobiliario.",
  },
];

export const Solutions = () => {
  return (
    <section className="w-full py-16 md:py-32">
      <div className="mx-auto max-w-7xl px-4 md:px-6">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-14 lg:gap-20 items-start">
          {/* BLOQUE IZQUIERDO */}
          <Reveal>
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-[2px] bg-main"></div>
              <span className="text-sm font-medium uppercase tracking-wide text-main">
                Nuestros servicios
              </span>
            </div>

            <h2 className="text-4xl md:text-5xl font-clash font-semibold text-foreground mb-6 text-balance">
              Comprá, vendé, alquilá o tasá con un mismo equipo
            </h2>

            <p className="text-lg text-muted-foreground mb-10 max-w-lg leading-relaxed">
              Acompañamos a propietarios, compradores e inversores con
              servicios profesionales y un enfoque moderno.
            </p>

            <Link
              href="/contacto"
              className="bg-foreground hover:bg-foreground/90 active:scale-[0.98] text-background w-fit px-6 py-3 rounded-lg flex items-center gap-2 text-sm font-medium transition-all"
            >
              Contacto <ArrowRight size={18} />
            </Link>
          </Reveal>

          {/* BLOQUE DERECHO */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-12 gap-y-14">
            {serviceData.map((s, i) => (
              <Reveal key={s.title} delay={i * 0.06}>
                <Link
                  href={s.href}
                  className="group flex flex-col items-start gap-3 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-4 focus-visible:ring-offset-background"
                >
                  <div className="p-3 rounded-xl bg-main/10 text-main flex items-center justify-center transition-colors group-hover:bg-main/20">
                    <s.icon className="size-8" strokeWidth={1.5} />
                  </div>

                  <h3 className="inline-flex items-center gap-1 text-xl font-semibold text-foreground">
                    {s.title}
                    <ArrowUpRight className="size-4 opacity-0 -translate-x-1 transition-all group-hover:opacity-100 group-hover:translate-x-0" />
                  </h3>

                  <p className="text-muted-foreground leading-relaxed text-[15px]">
                    {s.description}
                  </p>
                </Link>
              </Reveal>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
};
