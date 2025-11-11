"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClientBrowser } from "@/lib/supabase-browser";
import { toast } from "sonner";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { format } from "date-fns";
import { es } from "date-fns/locale";

// Tipos (puedes moverlos a tu archivo de tipos)
type Note = {
  id: string;
  created_at: string;
  content: string;
};
type LeadDetailData = {
  id: string;
  created_at: string;
  name: string;
  email: string | null;
  phone: string | null;
  status: string;
  source: string;
  notes: string | null;
  properties: {
    id: string;
    title: string;
  } | null;
  lead_notes: Note[];
};

// Componentes de Shadcn
import { Button } from "@/shared/components/ui/button";
import { Textarea } from "@/shared/components/ui/textarea";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormMessage,
} from "@/shared/components/ui/form";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/shared/components/ui/card";
import { Badge } from "@/shared/components/ui/badge";
import { Separator } from "@/shared/components/ui/separator";
import Link from "next/link";

// Schema para el formulario de notas
const noteSchema = z.object({
  content: z.string().min(1, { message: "La nota no puede estar vacía." }),
});
type NoteForm = z.infer<typeof noteSchema>;

// Diccionarios de Status
const statusColors: { [key: string]: string } = {
  NUEVO: "bg-blue-600",
  CONTACTADO: "bg-yellow-500",
  VISITA_PROGRAMADA: "bg-orange-500",
  NEGOCIACION: "bg-green-600",
  CERRADO: "bg-zinc-600",
  DESCARTADO: "bg-red-600",
};
const statusLabels: { [key: string]: string } = {
  NUEVO: "Nuevo",
  CONTACTADO: "Contactado",
  VISITA_PROGRAMADA: "Visita Programada",
  NEGOCIACION: "Negociación",
  CERRADO: "Cerrado",
  DESCARTADO: "Descartado",
};

export function LeadDetailClient({
  initialLead,
}: {
  initialLead: LeadDetailData;
}) {
  const supabase = createClientBrowser();
  const router = useRouter();
  const [lead] = useState(initialLead);
  const [notes, setNotes] = useState(initialLead.lead_notes);

  const form = useForm<NoteForm>({
    resolver: zodResolver(noteSchema),
    defaultValues: { content: "" },
  });

  const onSubmitNote = async (data: NoteForm) => {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    const { error, data: newNote } = await supabase
      .from("lead_notes")
      .insert({
        content: data.content,
        lead_id: lead.id,
        user_id: user.id,
      })
      .select("id, created_at, content")
      .single();

    if (error) {
      toast.error(`Error al guardar la nota: ${error.message}`);
    } else {
      toast.success("Nota agregada.");
      form.reset();
      // Añade la nueva nota al principio de la lista
      setNotes((prevNotes) => [newNote as Note, ...prevNotes]);
      router.refresh(); // Refresca los datos del servidor por si acaso
    }
  };

  return (
    <div className="p-4 md:p-8 max-w-6xl mx-auto">
      {/* Encabezado */}
      <div className="mb-6">
        <h1 className="text-3xl font-semibold">{lead.name}</h1>
        <div className="flex items-center gap-2 mt-2">
          <Badge
            className={`text-white ${
              statusColors[lead.status] || "bg-zinc-500"
            }`}
          >
            {statusLabels[lead.status] || lead.status}
          </Badge>
          <span className="text-muted-foreground">
            Fuente: {lead.source.toLowerCase()}
          </span>
        </div>
      </div>

      {/* Layout de Grilla */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Columna de Actividad (Principal) */}
        <div className="lg:col-span-2 space-y-6">
          {/* Formulario de Nueva Nota */}
          <Card>
            <CardHeader>
              <CardTitle>Agregar Nota de Seguimiento</CardTitle>
            </CardHeader>
            <CardContent>
              <Form {...form}>
                <form
                  onSubmit={form.handleSubmit(onSubmitNote)}
                  className="space-y-4"
                >
                  <FormField
                    control={form.control}
                    name="content"
                    render={({ field }) => (
                      <FormItem>
                        <FormControl>
                          <Textarea
                            placeholder="Ej: Llamé al cliente, agendamos visita para el viernes..."
                            className="resize-none"
                            rows={4}
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <Button type="submit" disabled={form.formState.isSubmitting}>
                    {form.formState.isSubmitting
                      ? "Guardando..."
                      : "Guardar Nota"}
                  </Button>
                </form>
              </Form>
            </CardContent>
          </Card>

          {/* Historial de Actividad */}
          <Card>
            <CardHeader>
              <CardTitle>Historial de Actividad</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-6">
                {/* La nota inicial del formulario */}
                {lead.notes && (
                  <>
                    <li className="space-y-2">
                      <p className="font-medium">Mensaje Inicial del Cliente</p>
                      <p className="text-muted-foreground italic">
                        &quot;{lead.notes}&quot;
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Recibido el{" "}
                        {format(
                          new Date(lead.created_at),
                          "dd MMM yyyy 'a las' HH:mm",
                          {
                            locale: es,
                          }
                        )}
                      </p>
                    </li>
                    <Separator />
                  </>
                )}

                {/* Historial de notas del agente */}
                {notes.length > 0
                  ? notes.map((note) => (
                      <li key={note.id} className="space-y-2">
                        <p className="text-muted-foreground">{note.content}</p>
                        <p className="text-xs text-muted-foreground">
                          {format(
                            new Date(note.created_at),
                            "dd MMM yyyy 'a las' HH:mm",
                            {
                              locale: es,
                            }
                          )}
                        </p>
                      </li>
                    ))
                  : !lead.notes && (
                      <li className="text-sm text-muted-foreground">
                        No hay actividad para este lead.
                      </li>
                    )}
              </ul>
            </CardContent>
          </Card>
        </div>

        {/* Columna de Información (Secundaria) */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Información de Contacto</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="text-sm">
                <p className="font-medium">Email</p>
                <p className="text-muted-foreground">{lead.email || "N/A"}</p>
              </div>
              <div className="text-sm">
                <p className="font-medium">Teléfono</p>
                <p className="text-muted-foreground">{lead.phone || "N/A"}</p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Propiedad de Interés</CardTitle>
            </CardHeader>
            <CardContent>
              {lead.properties ? (
                <Link
                  href={`/dashboard/propiedades/editar/${lead.properties.id}`}
                  className="font-medium hover:underline hover:text-primary"
                >
                  {lead.properties.title}
                </Link>
              ) : (
                <p className="text-muted-foreground">Sin propiedad asignada.</p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
