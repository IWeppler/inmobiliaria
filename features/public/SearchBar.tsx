"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { MapPin, Search, Home } from "lucide-react";
import { Button } from "@/shared/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/components/ui/select";
import { motion } from "framer-motion";

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

  const [operation, setOperation] = useState("venta");
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
    { label: "Comprar", value: "venta" },
    { label: "Alquilar", value: "alquiler" },
  ];

  return (
    <div className="-mt-8 w-full max-w-5xl mx-auto bg-white p-2 rounded-xl md:rounded-full shadow-2xl transition-all duration-300 border border-zinc-100">
      <form
        onSubmit={handleSearch}
        className="flex flex-col md:flex-row items-center w-full gap-2 md:gap-0"
      >
        {/* 1. TOGGLE DE OPERACIÓN */}
        <div className="flex bg-zinc-100 p-1.5 rounded-full w-full md:w-auto shrink-0 md:mr-3">
          {tabs.map((tab) => {
            const isActive = operation === tab.value;

            return (
              <button
                key={tab.value}
                type="button"
                onClick={() => setOperation(tab.value)}
                className={`
                  relative flex-1 md:flex-none px-6 py-2.5 text-[15px] font-semibold rounded-full transition-colors duration-200
                  ${
                    isActive
                      ? "text-foreground"
                      : "text-muted-foreground hover:text-foreground cursor-pointer"
                  }
                `}
              >
                {isActive && (
                  <motion.div
                    layoutId="active-operation-pill"
                    className="absolute inset-0 bg-white shadow-sm rounded-full"
                    transition={{ type: "spring", stiffness: 400, damping: 30 }}
                  />
                )}
                <span className="relative z-10">{tab.label}</span>
              </button>
            );
          })}
        </div>

        <div className="hidden md:block w-px h-10 bg-zinc-200 mx-2 shrink-0" />

        {/* 2. SELECT DE UBICACIÓN */}
        <div className="flex-1 w-full px-2 md:px-4 flex items-center gap-2 py-2 transition-colors group min-w-0">
          <div className="bg-zinc-100 p-2.5 rounded-full text-muted-foreground hidden md:flex shrink-0">
            <MapPin className="w-[18px] h-[18px]" />
          </div>
          <div className="flex-1 min-w-0 flex flex-col justify-center">
            <Select value={locationValue} onValueChange={setLocationValue}>
              <SelectTrigger className="w-full border-0 shadow-none focus:ring-0 focus:ring-offset-0 p-2 md:p-0 h-auto bg-transparent rounded-none text-[15px] md:text-base font-medium text-foreground transition-all [&>span]:truncate [&>svg]:text-muted-foreground [&>svg]:w-4 [&>svg]:h-4 [&>svg]:ml-2">
                <SelectValue placeholder="Todas las zonas" />
              </SelectTrigger>

              <SelectContent
                position="popper"
                className="max-h-[300px] z-9999 rounded-2xl p-2"
              >
                <SelectItem
                  value="all"
                  className="rounded-xl text-base py-3 cursor-pointer"
                >
                  Ubicación
                </SelectItem>
                {locations?.length > 0 ? (
                  locations.map((loc, index) => (
                    <SelectItem
                      key={index}
                      value={loc.label}
                      className="rounded-xl py-3 cursor-pointer"
                    >
                      <span className="font-medium">{loc.city}</span>
                      <span className="text-muted-foreground ml-2 text-sm">
                        {loc.province}
                      </span>
                    </SelectItem>
                  ))
                ) : (
                  <div className="p-4 text-sm text-muted-foreground text-center">
                    No hay ubicaciones cargadas
                  </div>
                )}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="hidden md:block w-px h-10 bg-zinc-200 mx-2 shrink-0" />

        {/* 3. SELECT DE TIPO DE PROPIEDAD */}
        <div className="flex-1 w-full px-2 md:px-4 flex items-center gap-2 py-2 transition-colors group min-w-0">
          <div className="bg-zinc-100 p-2.5 rounded-full text-muted-foreground  hidden md:flex shrink-0 ">
            <Home className="w-[18px] h-[18px]" />
          </div>
          <div className="flex-1 min-w-0 flex flex-col justify-center">
            <Select value={propertyTypeId} onValueChange={setPropertyTypeId}>
              <SelectTrigger className="w-full border-0 shadow-none focus:ring-0 focus:ring-offset-0 p-2 md:p-0 h-auto bg-transparent rounded-none text-[15px] md:text-base font-medium text-foreground transition-all [&>span]:truncate [&>svg]:text-muted-foreground [&>svg]:w-4 [&>svg]:h-4 [&>svg]:ml-2">
                <SelectValue placeholder="Cualquier propiedad" />
              </SelectTrigger>
              <SelectContent
                side="bottom"
                position="popper"
                align="start"
                className="z-9999 rounded-2xl p-2"
              >
                <SelectItem
                  value="all"
                  className="rounded-xl text-base py-3 cursor-pointer"
                >
                  Tipo
                </SelectItem>
                {propertyTypes?.map((type) => (
                  <SelectItem
                    key={type.id}
                    value={String(type.id)}
                    className="rounded-xl py-3 cursor-pointer"
                  >
                    {type.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* 4. BOTÓN DE BÚSQUEDA */}
        <Button
          type="submit"
          className="w-full md:w-auto h-12 md:h-14 px-8 rounded-3xl md:rounded-full bg-foreground hover:bg-foreground/90 text-background md:text-base font-semibold transition-all mt-2 md:mt-0 shrink-0 md:ml-3 cursor-pointer"
        >
          <Search className="w-[18px] h-[18px] mr-1" />
          <span>Buscar</span>
        </Button>
      </form>
    </div>
  );
}
