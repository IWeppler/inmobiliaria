import { createClientServer } from "@/lib/supabase";

export type LocationOption = {
  city: string;
  province: string;
  label: string;
};

export async function getUniqueLocations(): Promise<LocationOption[]> {
  const supabase = await createClientServer();

  const { data } = await supabase.from("properties").select("city, province");

  if (!data) return [];

  const uniqueMap = new Map<string, LocationOption>();

  data.forEach((prop) => {
    if (prop.city && prop.province) {
      const key = `${prop.city}-${prop.province}`;
      if (!uniqueMap.has(key)) {
        uniqueMap.set(key, {
          city: prop.city,
          province: prop.province,
          label: `${prop.city}, ${prop.province}`,
        });
      }
    }
  });

  return Array.from(uniqueMap.values());
}
