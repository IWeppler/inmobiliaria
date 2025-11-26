"use client";

import { useActionState, useEffect } from "react";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { toast } from "sonner";

// Importamos la nueva Server Action
import { createContactLeadAction } from "@/features/actions/createContactLeadAction";

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

// Schema de validación
const contactSchema = z.object({
  name: z.string().min(3, { message: "Ingresa tu nombre y apellido." }),
  phone: z.string().min(8, { message: "Ingresa un teléfono válido." }),
  email: z.string().email({ message: "Ingresa un email válido." }),
  message: z.string().min(10, { message: "Tu mensaje es muy corto." }),
});
type ContactForm = z.infer<typeof contactSchema>;

const initialState = { success: false, message: "" };

export function ContactForm() {
  const [formState, action] = useActionState(
    createContactLeadAction,
    initialState
  );

  const form = useForm<ContactForm>({
    resolver: zodResolver(contactSchema),
    defaultValues: { name: "", phone: "", email: "", message: "" },
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

  return (
    <Form {...form}>
      <form action={action} className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="name"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Nombre y Apellido *</FormLabel>
                <FormControl>
                  <Input placeholder="Tu nombre" {...field} className="h-11" />
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
                <FormLabel>Email *</FormLabel>
                <FormControl>
                  <Input
                    placeholder="tu@email.com"
                    {...field}
                    className="h-11"
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>
        <FormField
          control={form.control}
          name="phone"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Teléfono *</FormLabel>
              <FormControl>
                <Input placeholder="Tu teléfono" {...field} className="h-11" />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="message"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Mensaje *</FormLabel>
              <FormControl>
                <Textarea
                  placeholder="Escribí tu consulta..."
                  {...field}
                  className="min-h-[150px] resize-none bg-white"
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <Button
          type="submit"
          className="w-full md:w-auto h-12 text-base px-8 font-clash bg-foreground hover:bg-foreground/90 transition-colors duration-500 cursor-pointer"
        >
          Enviar Mensaje
        </Button>
      </form>
    </Form>
  );
}