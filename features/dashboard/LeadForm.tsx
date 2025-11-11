"use client";

import { createClientBrowser } from "@/lib/supabase-browser";
import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

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
import { Textarea } from "@/shared/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/components/ui/select";

// Tipo simple para el dropdown de propiedades
type PropertyMini = {
  id: string;
  title: string;
};

// Esquema de Zod para validar el formulario
const leadSchema = z.object({
  name: z
    .string()
    .min(3, { message: "El nombre debe tener al menos 3 caracteres." }),
  email: z
    .string()
    .email({ message: "Por favor, ingresa un email válido." })
    .optional()
    .or(z.literal("")),
  phone: z.string().optional().or(z.literal("")),
  source: z.enum(["TELEFONO", "EMAIL", "WEB", "REFERIDO"] as const, {
    message: "Selecciona una fuente",
  }),
  notes: z.string().optional().or(z.literal("")),
  property_id: z.string().uuid().optional().or(z.literal("")),
});

type LeadForm = z.infer<typeof leadSchema>;

type LeadFormProps = {
  onSuccess?: () => void;
};

export function LeadForm({ onSuccess }: LeadFormProps) {
  const supabase = createClientBrowser();
  const router = useRouter();
  const [properties, setProperties] = useState<PropertyMini[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Cargar propiedades para el Select
  useEffect(() => {
    const fetchProperties = async () => {
      const { data } = await supabase
        .from("properties")
        .select("id, title")
        .order("title", { ascending: true });

      if (data) {
        setProperties(data);
      }
    };
    fetchProperties();
  }, [supabase]);

  // Configuración de React Hook Form
  const form = useForm<LeadForm>({
    resolver: zodResolver(leadSchema),
    defaultValues: {
      name: "",
      email: "",
      phone: "",
      notes: "",
      property_id: "",
    },
  });

  // Handler para el envío
  const onSubmit = async (data: LeadForm) => {
    setIsSubmitting(true);
    const toastId = toast.loading("Creando nuevo lead...");

    const cleanData = {
      ...data,
      email: data.email || null,
      phone: data.phone || null,
      notes: data.notes || null,
      property_id:
        data.property_id === "none" || data.property_id === ""
          ? null
          : data.property_id,
      status: "NUEVO",
    };

    const { error } = await supabase.from("leads").insert(cleanData);

    setIsSubmitting(false);

    if (error) {
      toast.error(`Error al crear el lead: ${error.message}`, { id: toastId });
    } else {
      toast.success("Lead creado con éxito.", { id: toastId });
      form.reset();
      router.refresh();
      onSuccess?.();
    }
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        {/* Nombre */}
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Nombre *</FormLabel>
              <FormControl>
                <Input placeholder="Ej: Juan Pérez" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Email y Teléfono (en una grilla) */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="email"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Email</FormLabel>
                <FormControl>
                  <Input
                    type="email"
                    placeholder="ejemplo@correo.com"
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="phone"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Teléfono</FormLabel>
                <FormControl>
                  <Input type="tel" placeholder="+54 11 1234 5678" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        {/* Fuente y Propiedad (en una grilla) */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="source"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Fuente *</FormLabel>
                <Select
                  onValueChange={field.onChange}
                  defaultValue={field.value}
                >
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecciona el origen del lead" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="TELEFONO">Teléfono</SelectItem>
                    <SelectItem value="EMAIL">Email</SelectItem>
                    <SelectItem value="WEB">Sitio Web</SelectItem>
                    <SelectItem value="REFERIDO">Referido</SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="property_id"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Propiedad de Interés (Opcional)</FormLabel>
                <Select
                  onValueChange={field.onChange}
                  // Corregimos el defaultValue para que acepte string vacío
                  defaultValue={field.value ? String(field.value) : ""}
                >
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecciona una propiedad" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent className="max-h-60">
                    <SelectItem value="none">Sin propiedad asignada</SelectItem>{" "}
                    {properties.map((prop) => (
                      <SelectItem key={prop.id} value={prop.id}>
                        {prop.title}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        {/* Notas */}
        <FormField
          control={form.control}
          name="notes"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Notas / Mensaje Inicial</FormLabel>
              <FormControl>
                <Textarea
                  placeholder="Ej: El cliente llamó consultando por la casa..."
                  className="resize-none"
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <Button
          type="submit"
          disabled={isSubmitting}
          className="w-full cursor-pointer"
        >
          {isSubmitting ? "Guardando..." : "Crear Lead"}
        </Button>
      </form>
    </Form>
  );
}
