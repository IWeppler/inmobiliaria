"use client";

import { createClientBrowser } from "@/lib/supabase-browser";
import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect, useState, useCallback } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";

// Importaciones de Shadcn
import { Button } from "@/shared/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/shared/components/ui/form";
import { Input } from "@/shared/components/ui/input";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/shared/components/ui/card";
import { toast } from "sonner";

// Tipo simple para el amenity
type Amenity = {
  id: number;
  name: string;
};

// Esquema de Zod
const amenitySchema = z.object({
  name: z
    .string()
    .min(3, { message: "El nombre debe tener al menos 3 caracteres." }),
});

type AmenityForm = z.infer<typeof amenitySchema>;

export function AddAmenityForm() {
  const supabase = createClientBrowser();
  const [amenities, setAmenities] = useState<Amenity[]>([]);

  const fetchAmenities = useCallback(async () => {
    const { data: amenitiesData } = await supabase
      .from("amenities") 
      .select("id, name")
      .order("name", { ascending: true });

    if (amenitiesData) {
      setAmenities(amenitiesData);
    }
  }, [supabase]);

  useEffect(() => {
    const loadAmenities = async () => {
      await fetchAmenities();
    };
    loadAmenities();
  }, [fetchAmenities]);

  // Formulario (Crear Amenity)
  const amenityForm = useForm<AmenityForm>({
    resolver: zodResolver(amenitySchema),
    defaultValues: {
      name: "",
    },
  });

  // Submit del Formulario (Crear Amenity)
  const onSubmitAmenity = async (data: AmenityForm) => {
    const { error } = await supabase
      .from("amenities") 
      .insert({ name: data.name })
      .select();

    if (error) {
      toast.error(`Error al crear el amenity: ${error.message}`);
    } else {
      toast.success(`¡Amenity "${data.name}" creado con éxito!`);
      amenityForm.reset();
      await fetchAmenities();
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-xl">Gestionar Amenities</CardTitle>
        <CardDescription>
          Añade nuevos amenities para el formulario principal.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Formulario de Creación */}
        <Form {...amenityForm}>
          <form
            onSubmit={amenityForm.handleSubmit(onSubmitAmenity)}
            className="space-y-4"
          >
            <FormField
              control={amenityForm.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nuevo Amenity</FormLabel> 
                  <FormControl>
                    <Input
                      placeholder="Ej: Piscina, Gimnasio, Balcón"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <Button
              type="submit"
              disabled={amenityForm.formState.isSubmitting}
              className="w-full cursor-pointer"
            >
              {amenityForm.formState.isSubmitting
                ? "Creando..."
                : "Crear Amenity"}{" "}
            </Button>
          </form>
        </Form>

        <div>
          <h3 className="text-md font-medium mb-2">Amenities Existentes</h3>
          <ul className="space-y-2 max-h-48 overflow-y-auto p-3 bg-zinc-50  rounded-md border">
            {amenities.length > 0 ? (
              amenities.map((amenity) => (
                <li key={amenity.id} className="text-sm">
                  {amenity.name}
                </li>
              ))
            ) : (
              <li className="text-sm text-zinc-500">
                No hay amenities creados.
              </li>
            )}
          </ul>
        </div>
      </CardContent>
    </Card>
  );
}