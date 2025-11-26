"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { MapPin } from "lucide-react";
import { Button } from "@/shared/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/components/ui/select";

type LocationOption = {
  city: string;
  province: string;
  label: string;
};

type PropertyType = {
  id: number;
  name: string;
};

type HeroSearchCardProps = {
  propertyTypes: PropertyType[];
  locations: LocationOption[];
};

export function SearchBar({ propertyTypes, locations }: HeroSearchCardProps) {
  const router = useRouter();

  const [operation, setOperation] = useState("");
  const [propertyTypeId, setPropertyTypeId] = useState<string>("all");
  const [locationValue, setLocationValue] = useState<string>("all");

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();

    const params = new URLSearchParams();

    if (operation) {
      params.set("tipo", operation);
    }

    if (propertyTypeId && propertyTypeId !== "all") {
      params.set("typeId", propertyTypeId);
    }

    if (locationValue && locationValue !== "all") {
      const [city] = locationValue.split(",");
      params.set("loc", city.trim());
    }

    router.push(`/propiedades?${params.toString()}`);
  };

  const tabs = [
    { label: "Venta", value: "venta" },
    { label: "Alquiler", value: "alquiler" },
  ];

  return (
    <div className="w-full bg-white p-4 rounded-2xl shadow-2xl">
      <div className="flex w-full max-w-44 gap-4 border-b border-zinc-200 mb-6">
        {tabs.map((tab) => (
          <button
            key={tab.value}
            onClick={() => setOperation(tab.value)}
            className={`
        flex-1 pb-3 text-base md:text-lg font-medium transition-colors text-center relative
        ${
          operation === tab.value
            ? "text-black border-b-2 border-black -mb-px"
            : "text-zinc-500 hover:text-black"
        }
      `}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* 2. Formulario de Búsqueda */}
      <form
        onSubmit={handleSearch}
        className="flex flex-col gap-4 sm:flex-row md:items-center"
      >
        {/* 2.1. Select de Tipo de Propiedad */}
        <Select value={propertyTypeId} onValueChange={setPropertyTypeId}>
          <SelectTrigger
            className="relative w-full sm:w-46 md:col-span-1 h-14 text-base text-zinc-700 flex items-center"
            style={{ height: "56px", minHeight: "56px" }}
          >
            <SelectValue placeholder="Tipo de Propiedad" />
          </SelectTrigger>
          <SelectContent
            side="bottom"
            position="popper"
            align="start"
            className="z-9999"
          >
            <SelectItem value="all">Todos los Tipos</SelectItem>
            {propertyTypes?.map((type) => (
              <SelectItem key={type.id} value={String(type.id)}>
                {type.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* 2.2. Input de Ubicación */}
        <div className="flex-1 relative">
          <Select value={locationValue} onValueChange={setLocationValue}>
            <SelectTrigger
              className="w-full h-14 text-base text-zinc-700 flex items-center gap-2 pl-4"
              style={{ height: "56px", minHeight: "56px" }}
            >
              <div className="flex items-center gap-3 w-full">
                <MapPin className="h-5 w-5 text-zinc-400 shrink-0" />
                <SelectValue placeholder="Seleccionar Ubicación" />
              </div>
            </SelectTrigger>

            <SelectContent position="popper" className="max-h-[200px] z-9999">
              <SelectItem value="all">Todas las zonas</SelectItem>
              {locations?.length > 0 ? (
                locations.map((loc, index) => (
                  <SelectItem key={index} value={loc.label}>
                    <span className="font-medium">{loc.city}</span>
                    <span className="text-zinc-400 ml-2 text-sm">
                      {loc.province}
                    </span>
                  </SelectItem>
                ))
              ) : (
                <div className="p-2 text-sm text-zinc-500 text-center">
                  No hay ubicaciones cargadas
                </div>
              )}
            </SelectContent>
          </Select>
        </div>

        {/* 2.3. Botón de Búsqueda */}
        <Button
          type="submit"
          className="md:col-span-1 h-14 text-base bg-foreground hover:bg-foreground/90 cursor-pointer"
        >
          Buscar
        </Button>
      </form>
    </div>
  );
}
