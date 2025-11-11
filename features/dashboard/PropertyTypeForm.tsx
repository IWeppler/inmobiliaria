"use client";

import { createClientBrowser } from "@/lib/supabase-browser";
import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect, useState, useCallback } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
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

type PropertyType = {
  id: number;
  name: string;
};

const propertyTypeSchema = z.object({
  name: z
    .string()
    .min(2, { message: "El nombre debe tener al menos 2 caracteres." }),
});

type PropertyTypeForm = z.infer<typeof propertyTypeSchema>;

export function AddPropertyTypeForm() {
  const supabase = createClientBrowser();
  const [propertyTypes, setPropertyTypes] = useState<PropertyType[]>([]);

  const fetchPropertyTypes = useCallback(async () => {
    const { data: types } = await supabase
      .from("property_types")
      .select("id, name")
      .order("name", { ascending: true });

    if (types) {
      setPropertyTypes(types);
    }
  }, [supabase]);

  useEffect(() => {
    const loadPropertyTypes = async () => {
      await fetchPropertyTypes();
    };
    loadPropertyTypes();
  }, [fetchPropertyTypes]);
  const typeForm = useForm<PropertyTypeForm>({
    resolver: zodResolver(propertyTypeSchema),
    defaultValues: {
      name: "",
    },
  });

  // Submit del Formulario Secundario (Crear Tipo)
  const onSubmitType = async (data: PropertyTypeForm) => {
    const { error } = await supabase
      .from("property_types")
      .insert({ name: data.name })
      .select();

    if (error) {
      toast.error(`Error al crear el tipo: ${error.message}`);
    } else {
      toast.success(`¡Tipo "${data.name}" creado con éxito!`);
      typeForm.reset();
      await fetchPropertyTypes();
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-xl">Gestionar Tipos de Inmuebles</CardTitle>
        <CardDescription>
          Añade nuevos tipos de propiedad para el formulario principal.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Formulario de Creación */}
        <Form {...typeForm}>
          <form
            onSubmit={typeForm.handleSubmit(onSubmitType)}
            className="space-y-4"
          >
            <FormField
              control={typeForm.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nuevo Tipo</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="Ej: Local Comercial, Cochera"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <Button
              type="submit"
              disabled={typeForm.formState.isSubmitting}
              className="w-full cursor-pointer"
            >
              {typeForm.formState.isSubmitting ? "Creando..." : "Crear Tipo"}
            </Button>
          </form>
        </Form>

        {/* Lista de Tipos Existentes */}
        <div>
          <h3 className="text-md font-medium mb-2">Tipos de Inmuebles Existentes</h3>
          <ul className="space-y-2 max-h-48 overflow-y-auto p-3 bg-zinc-50 rounded-md border">
            {propertyTypes.length > 0 ? (
              propertyTypes.map((type) => (
                <li key={type.id} className="text-sm">
                  {type.name}
                </li>
              ))
            ) : (
              <li className="text-sm text-zinc-500">No hay tipos creados.</li>
            )}
          </ul>
        </div>
      </CardContent>
    </Card>
  );
}
