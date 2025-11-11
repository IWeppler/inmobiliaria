import Link from "next/link";
import { createClientServer } from "@/lib/supabase";
import { ArrowRight } from "lucide-react";

/**
 * Define el tipo de datos que esperamos de Supabase:
 * el tipo de propiedad + un array que contiene un objeto con el conteo.
 */
type PropertyTypeWithCount = {
  id: number;
  name: string;
  properties: [{ count: number }];
};

/**
 * Función de Servidor para obtener los tipos de propiedad y su conteo.
 */
async function getPropertyTypeCounts() {
  const supabase = await createClientServer();

  // 1. Definimos los tipos que queremos mostrar, como pediste
  const desiredTypes = [
    "Casa",
    "Departamento",
    "Campo",
    "PH",
    "Comercio",
    "Terreno", // Añadí terreno ya que es común
  ];

  // 2. Hacemos la consulta
  // Seleccionamos 'id' y 'name' de 'property_types'
  // y pedimos el 'count' de la tabla relacionada 'properties'
  const { data, error } = await supabase
    .from("property_types")
    .select(
      `
      id,
      name,
      properties ( count )
    `
    )
    .in("name", desiredTypes); // Filtramos solo por los tipos que queremos

  if (error) {
    console.error("Error fetching property type counts:", error);
    return [];
  }

  // 3. Filtramos los que tienen 0 propiedades para no mostrarlos (opcional, pero más limpio)
  return (data as PropertyTypeWithCount[]).filter(
    (type) => type.properties[0]?.count > 0
  );
}

/**
 * Componente de link individual para la grilla
 */
function PropertyTypeLink({ type }: { type: PropertyTypeWithCount }) {
  const count = type.properties[0]?.count || 0;
  
  // Creamos un link a la página de búsqueda, pre-filtrado por este tipo
  const href = `/propiedades?typeId=${type.id}`;

  return (
    <Link
      href={href}
      className="block p-4 group transition-all duration-200 hover:text-main"
    >
      <h3 className="text-lg font-semibold flex items-center">
        {type.name}
        <span className="opacity-0 group-hover:opacity-100 group-hover:translate-x-1 transition-all ml-1">
          &gt;
        </span>
      </h3>
      <p className="text-sm text-zinc-500">
        +{count} propiedades
      </p>
    </Link>
  );
}

export async function PropertyTypeGrid() {
  const typesWithCount = await getPropertyTypeCounts();

  if (typesWithCount.length === 0) {
    return null; 
  }

  return (
    <section className="w-full py-16 md:py-24 bg-white">
      <div className="container mx-auto max-w-6xl px-4">
        {/* Encabezado */}
        <div className="flex items-start max-w-3xl">
          <ArrowRight className="w-8 h-8 mr-4 mt-2 shrink-0 text-zinc-900" />
          <div>
            <h2 className="text-3xl md:text-4xl font-bold text-zinc-900">
              ¿Qué estas buscando?
            </h2>
            <p className="mt-4 text-lg text-zinc-600">
              Ya sea que busques comprar, alquilar o invertir, estamos para
              ayudarte.
            </p>
          </div>
        </div>

        {/* Grilla de Tipos */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-x-6 gap-y-8 mt-12">
          {typesWithCount.map((type) => (
            <PropertyTypeLink key={type.id} type={type} />
          ))}
        </div>
      </div>
    </section>
  );
}