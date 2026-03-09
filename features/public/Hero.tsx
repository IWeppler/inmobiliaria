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
    <section className="w-full pt-14 flex flex-col items-center relative">
      
      {/* 1. TEXTO SUPERIOR */}
      <div className="relative z-20 flex flex-col items-center w-full max-w-5xl px-4 text-center mb-8 md:mb-12">
        <h1 className="font-clash text-5xl md:text-7xl lg:text-[5.5rem] font-semibold mb-3 text-foreground tracking-tight leading-[1.05]">
          Encontrá tu hogar ideal <br />
          <span>con TerraNova</span>
        </h1>

        <p className="text-lg md:text-xl text-muted-foreground max-w-2xl leading-relaxed">
          Explorá la oferta más completa de propiedades. Desde tu primera casa
          hasta grandes hectáreas de inversión en un solo lugar.
        </p>
      </div>

      {/* 2. SEARCHBAR  */}
      <div className="relative z-30 w-full max-w-4xl px-4 -mb-8 md:-mb-10">
        <SearchBar
          locations={locations}
          propertyTypes={propertyTypes as PropertyType[]}
        />
      </div>

      {/* 3. IMAGEN INFERIOR */}
      <div className="w-full max-w-7xl mx-auto px-4 relative z-10 flex flex-col">
        <div className="relative w-full h-[400px] md:h-[600px] rounded-t-3xl md:rounded-4xl overflow-hidden shadow-[0_30px_60px_-15px_rgba(0,0,0,0.5)]">
          <Image
            src="/bghero3.jpg"
            alt="Hero de la inmobiliaria en Tostado Santa Fe"
            fill
            priority
            className="object-cover"
          />
        </div>
      </div>

      <div className="absolute bottom-0 left-0 right-0 h-[100px] md:h-[200px] bg-foreground z-0"></div>
    </section>
  );
}