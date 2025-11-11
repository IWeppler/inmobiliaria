import Image from "next/image";
import { SearchBar } from "./SearchBar";
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

  return (
    <section className="relative h-[80dvh] md:h-[80dvh] min-h-[400px] w-full mx-auto flex flex-col justify-around md:justify-center items-center">
      {/* Imagen de Fondo */}
      <Image
        src="/bghero3.jpg"
        alt="Casa moderna"
        fill
        priority
        style={{ objectFit: "cover" }}
        className="rounded-4xl"
      />

      {/* Overlay */}
      <div className="absolute inset-0 bg-linear-to-b from-black/40 via-black/50 to-black/70 rounded-4xl z-10" />

      {/* Contenido principal */}
      <div className="relative z-20 flex flex-col justify-around items-center w-full max-w-5xl h-full px-4 text-center">
        {/* Títulos */}
        <div className="flex flex-col items-center">
          <h1 className="text-6xl font-bold mb-4 text-white drop-shadow-lg">
            Encontrá tu próximo hogar
          </h1>
          <p className="text-xl text-white/90 mb-10 max-w-2xl drop-shadow-md">
            El portal inmobiliario con la tecnología más rápida para que
            explores propiedades al instante.
          </p>
        </div>

        {/* SearchBar */}
        <div className="w-full max-w-3xl px-4 md:px-0">
          <SearchBar propertyTypes={propertyTypes as PropertyType[]} />
        </div>
      </div>
    </section>
  );
}
