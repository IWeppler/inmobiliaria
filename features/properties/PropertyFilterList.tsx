"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { useCallback } from "react";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/shared/components/ui/accordion";
import { Checkbox } from "@/shared/components/ui/checkbox";
import { Label } from "@/shared/components/ui/label";

type PropertyType = { id: number; name: string };
type Amenity = { id: number; name: string };
type PageSearchParams = {
  tipo?: string;
  typeId?: string;
  loc?: string;
  amenities?: string;
  bedrooms?: string;
  bathrooms?: string;
};

type PropertyFilterListProps = {
  types: PropertyType[];
  amenities: Amenity[];
  cities: string[];
  currentParams: PageSearchParams;
};

export function PropertyFilterList({
  amenities,
  cities,
  currentParams,
}: PropertyFilterListProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // --- Lógica para crear la nueva URL ---
  const createQueryString = useCallback(
    (name: string, value: string) => {
      const params = new URLSearchParams(searchParams.toString());

      if (name === "amenities") {
        const currentAmenities = params.get("amenities")?.split(",") || [];
        const isChecked = currentAmenities.includes(value);

        if (isChecked) {
          const newAmenities = currentAmenities.filter((id) => id !== value);
          if (newAmenities.length > 0) {
            params.set(name, newAmenities.join(","));
          } else {
            params.delete(name);
          }
        } else {
          currentAmenities.push(value);
          params.set(name, currentAmenities.join(","));
        }
      } else {
        if (params.get(name) === value) {
          params.delete(name);
        } else {
          params.set(name, value);
        }
      }

      return params.toString();
    },
    [searchParams]
  );

  // --- Helpers para saber qué está seleccionado ---
  const selectedTipo = currentParams.tipo || "";
  const selectedLocation = currentParams.loc || "";
  const selectedAmenities = currentParams.amenities?.split(",") || [];
  const selectedBedrooms = currentParams.bedrooms || "";
  const selectedBathrooms = currentParams.bathrooms || "";

  return (
    <div className="w-full bg-white  border border-zinc-200 rounded-lg p-6">
      <h3 className="text-xl font-semibold mb-4">Filtros</h3>

      <Accordion
        type="multiple"
        defaultValue={["operation", "location", "amenities"]}
      >
        {/* --- Filtro de Operación --- */}
        <AccordionItem value="operation">
          <AccordionTrigger>Tipo de Operación</AccordionTrigger>
          <AccordionContent className="space-y-3">
            <div className="flex items-center space-x-2">
              <Checkbox
                id="op-venta"
                checked={selectedTipo === "venta"}
                onCheckedChange={() =>
                  router.push(
                    pathname + "?" + createQueryString("tipo", "venta")
                  )
                }
              />
              <Label htmlFor="op-venta">Venta</Label>
            </div>
            <div className="flex items-center space-x-2">
              <Checkbox
                id="op-alquiler"
                checked={selectedTipo === "alquiler"}
                onCheckedChange={() =>
                  router.push(
                    pathname + "?" + createQueryString("tipo", "alquiler")
                  )
                }
              />
              <Label htmlFor="op-alquiler">Alquiler</Label>
            </div>
          </AccordionContent>
        </AccordionItem>

        {/* --- Filtro de Ubicación --- */}
        <AccordionItem value="location">
          <AccordionTrigger>Ubicación</AccordionTrigger>
          <AccordionContent className="space-y-3 max-h-60 overflow-y-auto">
            {cities.map((city) => (
              <div key={city} className="flex items-center space-x-2">
                <Checkbox
                  id={`loc-${city}`}
                  checked={selectedLocation === city}
                  onCheckedChange={() =>
                    router.push(pathname + "?" + createQueryString("loc", city))
                  }
                />
                <Label htmlFor={`loc-${city}`}>{city}</Label>
              </div>
            ))}
          </AccordionContent>
        </AccordionItem>

        {/* --- Habitaciones --- */}
        <AccordionItem value="bedrooms">
          <AccordionTrigger>Dormitorios</AccordionTrigger>
          <AccordionContent className="space-y-3">
            {[1, 2, 3, 4].map((num) => (
              <div key={num} className="flex items-center space-x-2">
                <Checkbox
                  id={`bed-${num}`}
                  checked={selectedBedrooms === String(num)}
                  onCheckedChange={() =>
                    router.push(
                      pathname +
                        "?" +
                        createQueryString("bedrooms", String(num))
                    )
                  }
                />
                <Label htmlFor={`bed-${num}`}>{num}+ Dormitorios</Label>
              </div>
            ))}
          </AccordionContent>
        </AccordionItem>

        {/* --- Baños --- */}
        <AccordionItem value="bathrooms">
          <AccordionTrigger>Baños</AccordionTrigger>
          <AccordionContent className="space-y-3">
            {[1, 2, 3].map((num) => (
              <div key={num} className="flex items-center space-x-2">
                <Checkbox
                  id={`bath-${num}`}
                  checked={selectedBathrooms === String(num)}
                  onCheckedChange={() =>
                    router.push(
                      pathname +
                        "?" +
                        createQueryString("bathrooms", String(num))
                    )
                  }
                />
                <Label htmlFor={`bath-${num}`}>{num}+ Baños</Label>
              </div>
            ))}
          </AccordionContent>
        </AccordionItem>

        {/* --- Amenities --- */}
        <AccordionItem value="amenities">
          <AccordionTrigger>Amenities</AccordionTrigger>
          <AccordionContent className="space-y-3 max-h-60 overflow-y-auto">
            {amenities.map((amenity) => (
              <div key={amenity.id} className="flex items-center space-x-2">
                <Checkbox
                  id={`amenity-${amenity.id}`}
                  checked={selectedAmenities.includes(String(amenity.id))}
                  onCheckedChange={() =>
                    router.push(
                      pathname +
                        "?" +
                        createQueryString("amenities", String(amenity.id))
                    )
                  }
                />
                <Label htmlFor={`amenity-${amenity.id}`}>{amenity.name}</Label>
              </div>
            ))}
          </AccordionContent>
        </AccordionItem>
        
      </Accordion>
    </div>
  );
}
