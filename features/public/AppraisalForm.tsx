"use client";

import { useActionState, useEffect } from "react";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { toast } from "sonner";

// Importamos la nueva Server Action
import { createAppraisalLeadAction } from "@/features/actions/createAppraisalLeadAction";

import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import { Textarea } from "@/shared/components/ui/textarea";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/shared/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/components/ui/select";

// Schema de validación
const appraisalSchema = z.object({
  name: z.string().min(3, { message: "Ingresa tu nombre y apellido." }),
  phone: z.string().min(8, { message: "Ingresa un teléfono válido." }),
  email: z
    .string()
    .email({ message: "Ingresa un email válido." })
    .optional()
    .or(z.literal("")),
  address: z
    .string()
    .min(5, { message: "Ingresa la dirección de la propiedad." }),
  // Nuevos campos
  propertyType: z.string().min(1, { message: "Selecciona un tipo." }),
  operationType: z.enum(["VENTA", "ALQUILER"] as const, {
    message: "Selecciona una operación",
  }),
  consulta: z.string().optional(),
});

type AppraisalForm = z.infer<typeof appraisalSchema>;

const initialState = { success: false, message: "" };

export function AppraisalForm() {
  const [formState, action] = useActionState(
    createAppraisalLeadAction,
    initialState
  );

  const form = useForm<AppraisalForm>({
    resolver: zodResolver(appraisalSchema),
    defaultValues: {
      name: "",
      phone: "",
      email: "",
      address: "",
      propertyType: "",
      operationType: "VENTA", // Valor por defecto
      consulta: "",
    },
  });

  useEffect(() => {
    if (formState.message) {
      if (formState.success) {
        toast.success(formState.message);
        form.reset();
      } else {
        toast.error(formState.message);
      }
    }
  }, [formState, form]);

  // Clases para hacer los inputs más grandes (h-12 en lugar de h-10)
  const inputClass = "h-12 text-base";

  return (
    <Form {...form}>
      <form action={action} className="space-y-5">
        {" "}
        {/* space-y-5 para más aire */}
        {/* Nombre */}
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="text-base">Nombre y apellido *</FormLabel>
              <FormControl>
                <Input
                  placeholder="Tu nombre"
                  {...field}
                  className={inputClass}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        {/* Teléfono y Email (Grilla) */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="phone"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-base">Teléfono *</FormLabel>
                <FormControl>
                  <Input
                    placeholder="Tu teléfono"
                    {...field}
                    className={inputClass}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="email"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-base">Email (Opcional)</FormLabel>
                <FormControl>
                  <Input
                    placeholder="tu@email.com"
                    {...field}
                    className={inputClass}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>
        {/* Dirección */}
        <FormField
          control={form.control}
          name="address"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="text-base">
                Dirección de la propiedad *
              </FormLabel>
              <FormControl>
                <Input
                  placeholder="Ej: Av. Siempre Viva 742"
                  {...field}
                  className={inputClass}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        {/* Tipo de Propiedad y Operación (Grilla - NUEVOS CAMPOS) */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="propertyType"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-base">Tipo de Propiedad *</FormLabel>
                <Select
                  onValueChange={field.onChange}
                  defaultValue={field.value}
                  name="propertyType" // Importante para Server Action
                >
                  <FormControl>
                    <SelectTrigger className={inputClass}>
                      <SelectValue placeholder="Seleccionar..." />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="Casa">Casa</SelectItem>
                    <SelectItem value="Departamento">Departamento</SelectItem>
                    <SelectItem value="PH">PH</SelectItem>
                    <SelectItem value="Terreno">Terreno</SelectItem>
                    <SelectItem value="Local">Local / Oficina</SelectItem>
                    <SelectItem value="Campo">Campo</SelectItem>
                    <SelectItem value="Otro">Otro</SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="operationType"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-base">Tipo de Operación *</FormLabel>
                <Select
                  onValueChange={field.onChange}
                  defaultValue={field.value}
                  name="operationType" // Importante para Server Action
                >
                  <FormControl>
                    <SelectTrigger className={inputClass}>
                      <SelectValue placeholder="Seleccionar..." />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="VENTA">Venta</SelectItem>
                    <SelectItem value="ALQUILER">Alquiler</SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>
        {/* Consulta */}
        <FormField
          control={form.control}
          name="consulta"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="text-base">
                Comentarios Adicionales
              </FormLabel>
              <FormControl>
                <Textarea
                  placeholder="Contanos más detalles (estado, antigüedad, etc)..."
                  {...field}
                  className="min-h-[120px] text-base resize-none"
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <Button
          type="submit"
          className="w-full h-12 font-semibold bg-foreground hover:bg-foreground/90 transition-colors duration-500 cursor-pointer"
        >
          Solicitar Tasación
        </Button>
      </form>
    </Form>
  );
}
