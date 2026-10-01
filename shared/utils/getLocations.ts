import { createClientServer } from "@/lib/supabase";

export type LocationOption = {
  city: string;
  province: string;
  label: string;
  // Cantidad de propiedades en esa ciudad (para ordenar y mostrar en las
  // sugerencias del buscador).
  count: number;
};

export async function getUniqueLocations(): Promise<LocationOption[]> {
  const supabase = await createClientServer();

  const { data } = await supabase.from("properties").select("city, province");

  if (!data) return [];

  const uniqueMap = new Map<string, LocationOption>();

  data.forEach((prop) => {
    if (prop.city && prop.province) {
      const key = `${prop.city}-${prop.province}`;
      const existing = uniqueMap.get(key);
      if (existing) {
        existing.count += 1;
      } else {
        uniqueMap.set(key, {
          city: prop.city,
          province: prop.province,
          label: `${prop.city}, ${prop.province}`,
          count: 1,
        });
      }
    }
  });

  return Array.from(uniqueMap.values()).sort((a, b) => b.count - a.count);
}
