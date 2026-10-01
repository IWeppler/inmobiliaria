import Image from "next/image";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { createClientServer } from "@/lib/supabase";
import { Reveal } from "@/features/public/v2/Reveal";

// Fotos en el orden que definió la inmobiliaria. (No se reusa
// `cardImages` porque vive en un módulo "use client" y esto corre en el
// servidor.)
function orderedImages(images: Row["property_images"]) {
  return [...(images ?? [])]
    .sort((a, b) => (a.order ?? Number.MAX_SAFE_INTEGER) - (b.order ?? Number.MAX_SAFE_INTEGER))
    .map((img) => img.image_url)
    .filter((url): url is string => Boolean(url));
}

type TypeTile = {
  id: number;
  name: string;
  count: number;
  image: string | null;
};

type TypeGroup = Omit<TypeTile, "image"> & { candidates: string[] };

type Row = {
  property_type_id: number | null;
  property_types: { name: string } | null;
  property_images: { image_url: string | null; order: number | null }[] | null;
};

// Tipos con propiedades disponibles, ordenados por cantidad. Cada tipo
// usa la portada más reciente que no esté usando otro tipo, así dos
// celdas no repiten foto.
async function getTypeTiles(): Promise<TypeTile[]> {
  const supabase = await createClientServer();
  const { data, error } = await supabase
    .from("properties")
    .select("property_type_id, property_types ( name ), property_images ( image_url, order )")
    .in("status", ["EN_VENTA", "EN_ALQUILER"])
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Error al cargar tipos:", error.message);
    return [];
  }

  const byType = new Map<number, TypeGroup>();
  for (const row of (data ?? []) as unknown as Row[]) {
    if (!row.property_type_id || !row.property_types) continue;
    const group = byType.get(row.property_type_id) ?? {
      id: row.property_type_id,
      name: row.property_types.name,
      count: 0,
      candidates: [],
    };
    group.count += 1;
    // Portada primero, el resto de las fotos como reserva.
    group.candidates.push(...orderedImages(row.property_images));
    byType.set(row.property_type_id, group);
  }

  const used = new Set<string>();
  return [...byType.values()]
    .sort((a, b) => b.count - a.count)
    .slice(0, 5)
    .map(({ candidates, ...tile }) => {
      const image = candidates.find((url) => !used.has(url)) ?? candidates[0] ?? null;
      if (image) used.add(image);
      return { ...tile, image };
    });
}

// Celdas por cantidad de tipos: la grilla siempre queda completa (4
// columnas x 2 filas en desktop), sin huecos.
const SPANS: Record<number, string[]> = {
  1: ["lg:col-span-4 lg:row-span-2"],
  2: ["lg:col-span-2 lg:row-span-2", "lg:col-span-2 lg:row-span-2"],
  3: ["lg:col-span-2 lg:row-span-2", "lg:col-span-2", "lg:col-span-2"],
  4: ["lg:col-span-2 lg:row-span-2", "lg:col-span-2", "lg:col-span-1", "lg:col-span-1"],
  5: ["lg:col-span-2 lg:row-span-2", "lg:col-span-1", "lg:col-span-1", "lg:col-span-1", "lg:col-span-1"],
};

function TypeCell({ tile, className, large }: { tile: TypeTile; className: string; large: boolean }) {
  return (
    <Link
      href={`/propiedades?typeId=${tile.id}`}
      className={`group relative isolate flex min-h-56 flex-col justify-end overflow-hidden rounded-lg bg-foreground p-5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 md:p-6 ${className}`}
    >
      {tile.image && (
        <Image
          src={tile.image}
          alt=""
          fill
          sizes={large ? "(min-width: 1024px) 50vw, 100vw" : "(min-width: 1024px) 25vw, 50vw"}
          className="-z-20 object-cover transition-transform duration-700 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:scale-[1.04] motion-reduce:transition-none motion-reduce:group-hover:scale-100"
        />
      )}
      <div
        aria-hidden="true"
        className="absolute inset-0 -z-10 bg-linear-to-t from-[rgb(22_24_26/0.78)] via-[rgb(22_24_26/0.2)] to-transparent"
      />
      <div className="flex items-end justify-between gap-4 text-card">
        <div>
          <p className={`font-clash font-semibold tracking-tight ${large ? "text-3xl md:text-4xl" : "text-2xl"}`}>
            {tile.name}
          </p>
          <p className="mt-1 text-sm text-card/80">
            {tile.count} {tile.count === 1 ? "disponible" : "disponibles"}
          </p>
        </div>
        <ArrowUpRight
          className="h-6 w-6 shrink-0 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5"
          aria-hidden="true"
        />
      </div>
    </Link>
  );
}

export async function TypeBento() {
  const tiles = await getTypeTiles();
  if (tiles.length === 0) return null;

  const spans = SPANS[tiles.length];

  return (
    <section aria-labelledby="v2-types-title" className="w-full bg-background">
      <div className="mx-auto w-full max-w-7xl px-4 pb-16 md:px-6 md:pb-24">
        <Reveal>
          <h2
            id="v2-types-title"
            className="font-clash text-4xl leading-[1.05] font-semibold tracking-tight text-foreground md:text-5xl"
          >
            Explorá por tipo
          </h2>
        </Reveal>

        <div className="mt-10 grid auto-rows-[minmax(14rem,auto)] grid-cols-1 gap-4 sm:grid-cols-2 lg:auto-rows-[15rem] lg:grid-cols-4 lg:gap-5">
          {tiles.map((tile, i) => (
            // El span de grilla va en el wrapper animado, que es el ítem real de la grilla.
            <Reveal
              key={tile.id}
              delay={i * 0.06}
              className={[
                "flex",
                spans[i],
                i === 0 ? "sm:col-span-2 sm:min-h-80" : "",
                // En 2 columnas, si sobra una celda al final ocupa el ancho completo.
                i > 0 && i === tiles.length - 1 && (tiles.length - 1) % 2 === 1 ? "sm:col-span-2" : "",
              ].join(" ")}
            >
              <TypeCell tile={tile} large={i === 0} className="w-full" />
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
