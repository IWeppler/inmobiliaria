import { AlquileresIcon, CompraIcon, TasacionesIcon, VentaIcon } from "@/shared/icons/icons";
import React from "react";

// --- Datos para cada tarjeta de servicio ---
const serviceData = [
  {
    icon: VentaIcon,
    title: "Venta",
    description:
      "Vendé tu propiedad al mejor precio de mercado. Te acompañamos en cada paso, de forma segura y profesional.",
  },
  {
    icon: CompraIcon,
    title: "Compra",
    description:
      "Encontramos el hogar o la inversión que buscás. Detrás de cada propiedad hay un proyecto de vida, y entendemos el tuyo.",
  },
  {
    icon: AlquileresIcon,
    title: "Alquileres",
    description:
      "Gestionamos alquileres con transparencia y eficiencia, cuidando tanto al inquilino como al propietario en cada paso.",
  },
  {
    icon: TasacionesIcon,
    title: "Tasaciones",
    description:
      "Conocé el valor real de tu inmueble. Tasaciones profesionales basadas en nuestro profundo conocimiento del mercado.",
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
    <div className="bg-white border border-zinc-200 rounded-xl p-6 md:p-8 flex flex-col items-start text-left">
      {icon}
      <h3 className="text-xl font-semibold mb-2 text-zinc-900">{title}</h3>
      <p className="text-zinc-600 ">{description}</p>
    </div>
  );
}

export const Solutions = () => {
  return (
    <section className="w-full pt-16 pb-24">
      <div className="container mx-auto max-w-6xl px-4">
        {/* Encabezado de la sección */}
        <div className="text-center max-w-3xl mx-auto">
          <span className="text-sm font-medium text-main border border-main px-3 py-1 rounded-full">
            Nuestros servicios
          </span>
          <h2 className="text-3xl md:text-4xl font-bold mt-4 text-zinc-900">
            Soluciones inmobiliarias a tu{" "}
            medida
          </h2>
          <p className="mt-4 text-lg text-zinc-600 ">
            En{" "}
            <span className="font-semibold text-black ">
              tu Inmobiliaria
            </span>{" "}
            entendemos que cada cliente es único. Por eso, ofrecemos un servicio
            personalizado y adaptado a tus necesidades.
          </p>
        </div>

        {/* Grilla de Servicios */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-8 mt-12">
          {serviceData.map((service) => (
            <ServiceCard
              key={service.title}
              icon={service.icon}
              title={service.title}
              description={service.description}
            />
          ))}
        </div>
      </div>
    </section>
  );
};
