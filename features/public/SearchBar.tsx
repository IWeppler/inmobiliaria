"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { MapPin } from "lucide-react";
import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/components/ui/select";

// Tipos que recibimos del componente servidor
type PropertyType = {
  id: number;
  name: string;
};

type HeroSearchCardProps = {
  propertyTypes: PropertyType[];
};

export function SearchBar({ propertyTypes }: HeroSearchCardProps) {
  const router = useRouter();

  // Estados para el formulario
  const [operation, setOperation] = useState("alquileres");
  const [propertyTypeId, setPropertyTypeId] = useState<string>("all");
  const [location, setLocation] = useState("");

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();

    const params = new URLSearchParams();
    params.set("tipo", operation);

    if (propertyTypeId && propertyTypeId !== "all") {
      params.set("typeId", propertyTypeId);
    }
    if (location) {
      params.set("loc", location);
    }

    router.push(`/propiedades?${params.toString()}`);
  };

  const tabs = [
    { label: "Venta", value: "venta" },
    { label: "Alquileres", value: "alquileres" },
    // { label: "Alquiler Temporal", value: "alquiler_temporal" },
    // { label: "Emprendimientos", value: "emprendimiento" },
  ];

  return (
    <div className="w-full bg-white p-4 rounded-2xl shadow-2xl">
      {/* 1. Tabs de Texto */}
      <div className="flex space-x-6 md:space-x-8 border-b border-zinc-200 mb-6">
        {tabs.map((tab) => (
          <button
            key={tab.value}
            onClick={() => setOperation(tab.value)}
            className={`pb-3 text-base md:text-lg font-medium transition-colors rounded-none
              ${
                operation === tab.value
                  ? "text-black border-b-2 border-black "
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
        {/* 2.1. Select de Tipo de Propiedad (ocupa 2 de 6 columnas) */}
        <Select value={propertyTypeId} onValueChange={setPropertyTypeId}>
          <SelectTrigger
            className="relative w-full sm:w-46 md:col-span-1 h-14 text-base text-zinc-700 flex items-center"
            style={{
              height: "56px",
              minHeight: "56px",
              display: "flex",
              alignItems: "center",
            }}
          >
            <SelectValue placeholder="Tipo de Propiedad" />
          </SelectTrigger>
          <SelectContent
            side="bottom"
            sideOffset={4}
            position="popper"
            align="start"
            className="z-9999"
          >
            <SelectItem value="all">Todos los Tipos</SelectItem>
            {propertyTypes.map((type) => (
              <SelectItem key={type.id} value={String(type.id)}>
                {type.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* 2.2. Input de Ubicación */}
        <div className="relative flex-1">
          <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-zinc-400" />
          <Input
            type="text"
            placeholder="Ingresá una ubicación"
            className="h-14 pl-12 w-full text-[1.02rem] placeholder:text-[1.02rem] placeholder:text-zinc-500"
            value={location}
            onChange={(e) => setLocation(e.target.value)}
          />
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
