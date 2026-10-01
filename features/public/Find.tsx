import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { createClientServer } from "@/lib/supabase";
import { Reveal } from "@/features/public/v2/Reveal";

type PropertyTypeWithCount = {
  id: number;
  name: string;
  properties: { count: number }[];
};

const MAX_TYPES = 6;

// Tipos de propiedad con al menos una publicación, de mayor a menor
// cantidad. El conteo es el mismo universo que muestra el listado al
// filtrar por `typeId` (sin filtro de estado).
async function getPropertyTypeCounts() {
  const supabase = await createClientServer();

  const { data, error } = await supabase
    .from("property_types")
    .select("id, name, properties ( count )");

  if (error) {
    console.error("Error al cargar tipos de propiedad:", error.message);
    return [];
  }

  return (data as PropertyTypeWithCount[])
    .map((type) => ({
      id: type.id,
      name: type.name,
      count: type.properties[0]?.count ?? 0,
    }))
    .filter((type) => type.count > 0)
    .sort((a, b) => b.count - a.count)
    .slice(0, MAX_TYPES);
}

export async function PropertyTypeGrid() {
  const types = await getPropertyTypeCounts();

  if (types.length === 0) return null;

  return (
    <section className="w-full pt-16 md:pt-24">
      <div className="mx-auto max-w-7xl px-4 md:px-6">
        <Reveal>
          <h2 className="font-clash text-4xl font-semibold text-foreground md:text-5xl">
            ¿Qué estás buscando?
          </h2>
          <p className="mt-4 max-w-xl text-lg leading-relaxed text-muted-foreground">
            Casas, departamentos, campos y lotes. Elegí un tipo y mirá todo lo
            que tenemos publicado.
          </p>
        </Reveal>

        <ul className="mt-12 grid grid-cols-1 gap-x-12 md:grid-cols-2">
          {types.map((type, i) => (
            <li key={type.id} className="border-t border-border">
              <Reveal delay={i * 0.05}>
                <Link
                  href={`/propiedades?typeId=${type.id}`}
                  className="group flex items-center justify-between gap-6 py-6 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background rounded-sm"
                >
                  <span className="font-clash text-2xl font-semibold text-foreground transition-colors group-hover:text-main md:text-3xl">
                    {type.name}
                  </span>
                  <span className="flex shrink-0 items-center gap-3 text-sm text-muted-foreground">
                    {type.count} {type.count === 1 ? "propiedad" : "propiedades"}
                    <span className="flex size-10 items-center justify-center rounded-full border border-border transition-colors group-hover:border-foreground group-hover:bg-foreground group-hover:text-background">
                      <ArrowUpRight className="size-4" />
                    </span>
                  </span>
                </Link>
              </Reveal>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
