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
    <section className="relative h-[75dvh] md:h-[80dvh] min-h-[480px] w-full mx-auto flex flex-col justify-center items-center">
      {/* Imagen de Fondo */}
      <Image
        src="/bghero3.jpg"
        alt="Casa moderna"
        fill
        priority
        style={{ objectFit: "cover" }}
        className="rounded-4xl"
      />

      {/* Overlay mejorado (más elegante) */}
      <div className="absolute inset-0 rounded-4xl bg-black/40 md:bg-black/35 backdrop-blur-[1px] z-10" />

      {/* Contenido */}
      <div className="relative z-20 flex flex-col items-center w-full max-w-5xl px-6 text-center">
        {/* Título */}
        <h1 className="font-clash text-5xl px-8 md:px-0 md:text-7xl font-semibold mb-4 text-white drop-shadow-xl leading-[1.1]">
          Encontrá tu próximo hogar
        </h1>

        {/* Subtítulo */}
        <p className="text-lg md:text-xl text-white/90 mb-10 max-w-2xl leading-relaxed drop-shadow">
          El portal inmobiliario con la tecnología más rápida para que explores
          propiedades al instante.
        </p>

        {/* SearchBar con fondo más premium */}
        <div className="w-full max-w-3xl px-4 md:px-0 ">
          <SearchBar
            locations={locations}
            propertyTypes={propertyTypes as PropertyType[]}
          />
        </div>
      </div>
    </section>
  );
}
