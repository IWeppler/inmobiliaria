import Image from "next/image";
import { SearchBar } from "@/features/public/SearchBar";
import { getUniqueLocations } from "@/shared/utils/getLocations";
import { createClientServer } from "@/lib/supabase";

type PropertyType = {
  id: number;
  name: string;
};

export async function Hero() {
  const supabase = await createClientServer();

  const { data: propertyTypes } = await supabase
    .from("property_types")
    .select("id, name")
    .order("name", { ascending: true });

  const locations = await getUniqueLocations();

  return (
    <section className="relative min-h-[75dvh] md:h-[80dvh] w-full mx-auto flex flex-col justify-center items-center">
      {/* Imagen de Fondo */}
      <Image
        src="/bg-hero.avif"
        alt="hero de la inmobiliaria en Tostado Santa Fe"
        fill
        priority
        style={{ objectFit: "cover" }}
        className="rounded-4xl"
      />

      {/* Overlay */}
      <div className="absolute inset-0 rounded-4xl bg-linear-to-t from-black/80 via-black/40 to-black/30 backdrop-blur-[1px] z-10" />

      {/* Contenido */}
      <div className="relative z-20 flex flex-col items-center w-full max-w-5xl py-4 px-6 text-center">
        {/* Título */}
        <h1 className="font-clash text-4xl px-2 md:px-0 md:text-7xl font-semibold mb-4 text-white drop-shadow-xl leading-[1.1]">
          Tu próximo hogar o inversión
        </h1>

        {/* Subtítulo */}
        <p className="text-md md:text-xl text-white/90 mb-10 max-w-3xl leading-relaxed drop-shadow">
          La oferta más completa de propiedades urbanas y rurales. Desde tu
          primera casa hasta grandes hectáreas de inversión, encontralo todo en
          un solo lugar.
        </p>

        {/* SearchBar */}
        <div className="shadow-2xl w-full max-w-3xl px-4 md:px-0 ">
          <SearchBar
            locations={locations}
            propertyTypes={propertyTypes as PropertyType[]}
          />
        </div>
      </div>
    </section>
  );
}
