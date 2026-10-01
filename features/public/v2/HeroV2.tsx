import Image from "next/image";
import { SearchPanel } from "@/features/public/v2/SearchPanel";
import { getUniqueLocations } from "@/shared/utils/getLocations";

// Hero con foto a sangre dentro de un marco redondeado. El degradado
// inferior asegura contraste para el texto claro sobre la foto. Copy sin
// ubicación: el sitio es white-label (las zonas del buscador salen de la base).
export async function HeroV2() {
  const locations = await getUniqueLocations();

  return (
    <section className="w-full bg-background px-2 pb-2 md:px-4 md:pb-4">
      <div className="relative isolate flex min-h-[calc(100dvh-4.5rem)] w-full overflow-hidden rounded-3xl bg-foreground md:min-h-[calc(100dvh-5rem)]">
        <Image
          src="/bghero3.jpg"
          alt="Casa de piedra y madera con jardín al frente"
          fill
          priority
          sizes="100vw"
          className="site-settle -z-20 object-cover object-[center_40%]"
        />
        <div
          aria-hidden="true"
          className="absolute inset-0 -z-10 bg-linear-to-t from-[rgb(22_24_26/0.82)] via-[rgb(22_24_26/0.28)] to-[rgb(22_24_26/0.05)] md:bg-[linear-gradient(to_top,rgb(22_24_26/0.8),rgb(22_24_26/0.15)_60%,transparent),linear-gradient(to_right,rgb(22_24_26/0.45),transparent_60%)]"
        />

        <div className="mx-auto mt-auto flex w-full max-w-7xl flex-col px-4 pb-6 md:px-10 md:pb-12">
          <h1 className="site-rise max-w-[14ch] text-balance font-clash text-5xl leading-[1.02] font-semibold tracking-tight text-card md:text-6xl lg:text-7xl">
            El lugar que buscás, sin vueltas.
          </h1>

          <p className="site-rise mt-4 max-w-[46ch] text-lg leading-relaxed text-card/85 [--rise-delay:100ms]">
            Casas, departamentos y terrenos en venta y alquiler, con asesoramiento de principio a fin.
          </p>

          <div className="site-rise mt-8 w-full max-w-2xl [--rise-delay:200ms]">
            <SearchPanel locations={locations} />
          </div>
        </div>
      </div>
    </section>
  );
}
