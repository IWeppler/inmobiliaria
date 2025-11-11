"use client";

import { useFormState } from "react-dom";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { useEffect } from "react";

import { createLeadFromPublic } from "@/features/actions/createLeadActions";

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
import Link from "next/link";

type ContactAsideProps = {
  propertyId: string;
  agent: {
    full_name: string | null;
    avatar_url: string | null;
    phone: string | null;
  } | null;
};

// Schema de validación
const contactSchema = z.object({
  name: z.string().min(3, { message: "Ingresa tu nombre y apellido." }),
  phone: z.string().min(8, { message: "Ingresa un teléfono válido." }),
  email: z
    .string()
    .email({ message: "Ingresa un email válido." })
    .optional()
    .or(z.literal("")),
  consulta: z.string().optional(),
});
type ContactForm = z.infer<typeof contactSchema>;

export function ContactAside({ propertyId, agent }: ContactAsideProps) {
  // Estado para el formulario de Server Action
  const [formState, action] = useFormState(createLeadFromPublic, {
    success: false,
    message: "",
  });

  const form = useForm<ContactForm>({
    resolver: zodResolver(contactSchema),
    defaultValues: { name: "", phone: "", email: "", consulta: "" },
  });

  // Efecto para mostrar toast y resetear el form
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

  const whatsappNumber = agent?.phone || "TU_NUMERO_DE_WHATSAPP_POR_DEFECTO";
  const whatsappLink = `https://wa.me/${whatsappNumber}?text=Hola, estoy interesado en la propiedad ${propertyId}`;

  return (
    <div className="h-fit p-2 lg:p-6 bg-white rounded-lg border">
      <h3 className="text-xl font-semibold mb-4">
        Consultá por esta propiedad
      </h3>
      <p className="mb-2 font-medium">
        {agent?.full_name || "Estudio Inmobiliario"}
      </p>

      {/* Botón de WhatsApp */}
      <Link
        href={whatsappLink}
        target="_blank"
        rel="noopener noreferrer"
        className="flex mt-2 mb-4 items-center"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width={20}
          height={20}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
          className="icon icon-tabler icons-tabler-outline icon-tabler-brand-whatsapp mr-2 text-green-600"
        >
          <path stroke="none" d="M0 0h24v24H0z" fill="none" />
          <path d="M3 21l1.65 -3.8a9 9 0 1 1 3.4 2.9l-5.05 .9" />
          <path d="M9 10a.5 .5 0 0 0 1 0v-1a.5 .5 0 0 0 -1 0v1a5 5 0 0 0 5 5h1a.5 .5 0 0 0 0 -1h-1a.5 .5 0 0 0 0 1" />
        </svg>{" "}
        {whatsappNumber}
      </Link>

      <Form {...form}>
        {/* Pasamos el propertyId a la Server Action */}
        <form action={action} className="space-y-4">
          <input type="hidden" name="propertyId" value={propertyId} />

          <FormField
            control={form.control}
            name="name"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Nombre y apellido</FormLabel>
                <FormControl>
                  <Input placeholder="Tu nombre" {...field} />
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
                <FormLabel>Teléfono de contacto</FormLabel>
                <FormControl>
                  <Input placeholder="Tu teléfono" {...field} />
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
                <FormLabel>Correo electrónico (Opcional)</FormLabel>
                <FormControl>
                  <Input placeholder="tu@email.com" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="consulta"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Consulta (Opcional)</FormLabel>
                <FormControl>
                  <Textarea placeholder="Dejanos tu consulta..." {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <Button
            type="submit"
            className="w-full cursor-pointer bg-foreground"
            disabled={form.formState.isSubmitting}
          >
            Enviar Consulta
          </Button>
        </form>
      </Form>
    </div>
  );
}
