import { AlquileresIcon, CompraIcon, TasacionesIcon, VentaIcon } from "@/shared/icons/icons";
import { ArrowRight } from "lucide-react";
import Link from "next/link";
import React from "react";

const serviceData = [
  {
    icon: VentaIcon,
    title: "Venta",
    description:
      "Vendé tu propiedad al mejor precio del mercado. Te acompañamos en cada paso, con una gestión profesional y segura.",
  },
  {
    icon: CompraIcon,
    title: "Compra",
    description:
      "Encontramos el hogar o inversión ideal. Nuestra experiencia asegura que tomes decisiones informadas.",
  },
  {
    icon: AlquileresIcon,
    title: "Alquileres",
    description:
      "Gestionamos alquileres de forma transparente y eficiente, cuidando tanto propietarios como inquilinos.",
  },
  {
    icon: TasacionesIcon,
    title: "Tasaciones",
    description:
      "Tasaciones profesionales basadas en datos reales y análisis del mercado inmobiliario.",
  },
];

function ServiceCard({
  icon,
  title,
  description,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
}) {
  return (
    <div
      className="
      group bg-white border border-zinc-200 rounded-2xl 
      p-8 shadow-sm hover:shadow-xl transition-all duration-500 
      hover:-translate-y-2 cursor-pointer
    "
    >
      {/* Icon */}
      <div
        className="
        w-14 h-14 rounded-xl bg-main/10 flex items-center justify-center 
        mb-6 group-hover:bg-main/20 transition-colors 
      "
      >
        {icon}
      </div>

      {/* Title */}
      <h3 className="text-2xl font-clash font-semibold mb-2 text-zinc-900">
        {title}
      </h3>

      {/* Description */}
      <p className="text-zinc-600 leading-relaxed text-base">
        {description}
      </p>
    </div>
  );
}

export const Solutions = () => {
  return (
    <section className="w-full py-28">
      <div className="container mx-auto max-w-7xl px-6">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-20 items-start">
          
          {/* BLOQUE IZQUIERDO */}
          <div>
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-[2px] bg-main"></div>
              <span className="text-sm font-medium uppercase tracking-wide text-main">
                Nuestros servicios
              </span>
            </div>

            <h2 className="text-4xl md:text-5xl font-clash font-semibold leading-tight text-zinc-900 mb-6">
              Te brindamos los mejores <br /> servicios inmobiliarios
            </h2>

            <p className="text-lg text-zinc-600 mb-10 max-w-lg leading-relaxed">
              Acompañamos a propietarios, compradores e inversores con servicios profesionales y un enfoque moderno.
            </p>

            <Link href="/contacto" className="bg-foreground hover:bg-foreground/90 text-white w-fit px-6 py-3 rounded-lg flex items-center gap-2 text-sm font-medium transition-all cursor-pointer">
              Escribinos <ArrowRight size={18} />
            </Link>
          </div>

          {/* BLOQUE DERECHO */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-12 gap-y-14">
            {serviceData.map((s) => (
              <div
                key={s.title}
                className="flex flex-col items-start gap-3"
              >
                <div className="p-3 rounded-xl bg-main/10 text-main flex items-center justify-center">
                  {s.icon}
                </div>

                <h3 className="text-xl font-semibold text-zinc-900 ">
                  {s.title}
                </h3>

                <p className="text-zinc-600 leading-relaxed text-[15px]">
                  {s.description}
                </p>
              </div>
            ))}
          </div>

        </div>
      </div>
    </section>
  );
};