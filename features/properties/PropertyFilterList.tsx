"use client";

import { useFilterParams } from "@/features/properties/useFilterParams";
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
  types, 
  amenities,
  cities,
  currentParams,
}: PropertyFilterListProps) {
  const { toggle, clear, activeCount } = useFilterParams();

  // --- Helpers  ---
  const selectedTipo = currentParams.tipo || "";
  const selectedTypeId = currentParams.typeId || ""; 
  const selectedLocations = currentParams.loc?.split(",").filter(Boolean) || [];
  const selectedAmenities = currentParams.amenities?.split(",") || [];
  const selectedBedrooms = currentParams.bedrooms || "";
  const selectedBathrooms = currentParams.bathrooms || "";

  return (
    <div className="w-full rounded-lg border border-border bg-card p-5 text-foreground md:max-h-[calc(100dvh-6rem)] md:overflow-y-auto md:overscroll-contain">
      <div className="flex items-center justify-between">
        <h2 className="font-clash text-xl font-semibold tracking-tight">Filtros</h2>
        {activeCount > 0 && (
          <button
            type="button"
            onClick={() => clear()}
            className="cursor-pointer rounded-sm text-sm font-medium text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            Limpiar ({activeCount})
          </button>
        )}
      </div>

      <Accordion
        type="multiple"
        defaultValue={["operation", "propertyType", "location", "amenities"]}
      >
        {/* --- Filtro de Operación --- */}
        <AccordionItem value="operation">
          <AccordionTrigger>Operación</AccordionTrigger>
          <AccordionContent className="space-y-3">
            <div className="flex items-center space-x-2">
              <Checkbox
                id="op-venta"
                checked={selectedTipo === "venta"}
                onCheckedChange={() =>
                  toggle("tipo", "venta")
                }
              />
              <Label htmlFor="op-venta">Venta</Label>
            </div>
            <div className="flex items-center space-x-2">
              <Checkbox
                id="op-alquiler"
                checked={selectedTipo === "alquiler"}
                onCheckedChange={() =>
                  toggle("tipo", "alquiler")
                }
              />
              <Label htmlFor="op-alquiler">Alquiler</Label>
            </div>
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="propertyType">
          <AccordionTrigger>Tipo</AccordionTrigger>
          <AccordionContent className="space-y-3">
            {(types || []).map((type) => (
              <div key={type.id} className="flex items-center space-x-2">
                <Checkbox
                  id={`type-${type.id}`}
                  checked={selectedTypeId === String(type.id)}
                  onCheckedChange={() =>
                    toggle("typeId", String(type.id))
                  }
                />
                <Label htmlFor={`type-${type.id}`}>{type.name}</Label>
              </div>
            ))}
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
                  checked={selectedLocations.includes(city)}
                  onCheckedChange={() =>
                    toggle("loc", city)
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
                    toggle("bedrooms", String(num))
                  }
                />
                <Label htmlFor={`bed-${num}`}>{num}+ dormitorios</Label>
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
                    toggle("bathrooms", String(num))
                  }
                />
                <Label htmlFor={`bath-${num}`}>{num}+ baños</Label>
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
                    toggle("amenities", String(amenity.id))
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
