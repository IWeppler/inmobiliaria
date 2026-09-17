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
import Link from "next/link";
import {
  Send,
  Mail,
  Phone,
} from "lucide-react";
import type { User } from "@supabase/supabase-js";

import { LeadWithDetails, Note } from "@/app/types";
import { statusMeta } from "@/features/dashboard/leads/leadStatus";
import { ScheduleVisitCard } from "@/features/dashboard/leads/ScheduleVisitCard";

// UI Components
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
import { Separator } from "@/shared/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/components/ui/select";
import { Page, PageHeader } from "@/shared/components/PageShell";
import { StatusBadge } from "@/shared/components/StatusBadge";
import { Label } from "@/shared/components/ui/label";

const noteSchema = z.object({
  content: z.string().min(1, { message: "La nota no puede estar vacía." }),
});
type NoteForm = z.infer<typeof noteSchema>;

interface LeadDetailClientProps {
  initialLead: LeadWithDetails;
  currentUser: User;
  userRole: string;
  allAgents: { id: string; full_name: string }[];
  allProperties: { id: string; title: string }[];
}

export function LeadDetailClient({
  initialLead,
  currentUser,
  userRole,
  allAgents,
  allProperties,
}: LeadDetailClientProps) {
  const supabase = createClientBrowser();
  const router = useRouter();

  const [lead] = useState<LeadWithDetails>(initialLead);
  const [notes, setNotes] = useState<Note[]>(initialLead.lead_notes || []);

  // --- ESTADOS PARA AGENTE (Expandible) ---
  const [isReassignOpen, setIsReassignOpen] = useState(false);
  const [selectedAgentId, setSelectedAgentId] = useState(lead.agent_id || "");
  const [isReassigning, setIsReassigning] = useState(false);

  // --- ESTADOS PARA PROPIEDAD (Expandible) ---
  const [isAssignPropertyOpen, setIsAssignPropertyOpen] = useState(false);
  const [selectedPropertyId, setSelectedPropertyId] = useState(
    lead.property_id || ""
  );
  const [isAssigningProperty, setIsAssigningProperty] = useState(false);

  const isAdmin = userRole === "admin";

  const form = useForm<NoteForm>({
    resolver: zodResolver(noteSchema),
    defaultValues: { content: "" },
  });

  // Guardar Nota
  const onSubmitNote = async (data: NoteForm) => {
    if (!currentUser) return;

    const { error, data: newNote } = await supabase
      .from("lead_notes")
      .insert({
        content: data.content,
        lead_id: lead.id,
        user_id: currentUser.id,
      })
      .select("id, created_at, content, user_id")
      .single();

    if (error) {
      toast.error("Error al guardar la nota");
    } else {
      toast.success("Nota agregada.");
      form.reset();
      setNotes((prev) => [newNote as Note, ...prev]);
      router.refresh();
    }
  };

  // Reasignar Agente
  const handleReassign = async () => {
    if (!selectedAgentId) return;
    setIsReassigning(true);

    const { error } = await supabase
      .from("leads")
      .update({ agent_id: selectedAgentId })
      .eq("id", lead.id);

    if (error) {
      toast.error("Error al reasignar");
    } else {
      toast.success("Lead reasignado correctamente");
      setIsReassignOpen(false);
      router.refresh();
    }
    setIsReassigning(false);
  };

  // Asignar/Cambiar Propiedad
  const handleAssignProperty = async () => {
    if (!selectedPropertyId) return;
    setIsAssigningProperty(true);

    const { error } = await supabase
      .from("leads")
      .update({ property_id: selectedPropertyId })
      .eq("id", lead.id);

    if (error) {
      toast.error("Error al asignar propiedad");
    } else {
      toast.success("Propiedad actualizada correctamente");
      setIsAssignPropertyOpen(false);
      router.refresh();
    }
    setIsAssigningProperty(false);
  };

  const meta = statusMeta(lead.status);

  return (
    <Page>
      <PageHeader
        backHref="/dashboard/leads"
        title={lead.name}
        aside={
          <StatusBadge tone={meta.tone} icon={meta.icon}>
            {meta.label}
          </StatusBadge>
        }
        description={`Fuente: ${lead.source?.toLowerCase() ?? ""} · ${format(new Date(lead.created_at), "dd MMM yyyy", { locale: es })}`}
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* COLUMNA PRINCIPAL (Notas) */}
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Nueva nota</CardTitle>
            </CardHeader>
            <CardContent>
              <Form {...form}>
                <form
                  onSubmit={form.handleSubmit(onSubmitNote)}
                  className="flex flex-col gap-3"
                >
                  <FormField
                    control={form.control}
                    name="content"
                    render={({ field }) => (
                      <FormItem>
                        <FormControl>
                          <Textarea
                            placeholder="Qué pasó con este lead…"
                            className="resize-none"
                            rows={3}
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <Button
                    type="submit"
                    disabled={form.formState.isSubmitting}
                    className="self-end"
                  >
                    <Send />
                    {form.formState.isSubmitting ? "Guardando…" : "Guardar nota"}
                  </Button>
                </form>
              </Form>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Historial</CardTitle>
            </CardHeader>
            <CardContent>
              {/* Timeline plano: fecha a la izquierda, contenido a la derecha */}
              <ul className="divide-y divide-border-subtle">
                {lead.notes && (
                  <li className="flex gap-4 py-3 first:pt-0">
                    <span className="w-24 shrink-0 text-xs text-muted-foreground">
                      Mensaje original
                    </span>
                    <p className="text-sm text-fg-secondary whitespace-pre-wrap">
                      {lead.notes}
                    </p>
                  </li>
                )}

                {notes.length === 0 && !lead.notes && (
                  <li className="py-3 text-sm text-muted-foreground">
                    Todavía no hay notas.
                  </li>
                )}

                {notes.map((note) => (
                  <li key={note.id} className="flex gap-4 py-3 first:pt-0 last:pb-0">
                    <span className="w-24 shrink-0 text-xs text-muted-foreground">
                      {format(new Date(note.created_at), "d MMM HH:mm", {
                        locale: es,
                      })}
                    </span>
                    <p className="text-sm text-foreground whitespace-pre-wrap">
                      {note.content}
                    </p>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        </div>

        {/* COLUMNA LATERAL */}
        <div className="space-y-4">
          {/* 1. CARD: RESPONSABLE DEL LEAD (Layout Expandible) */}
          <Card>
            <CardHeader>
              <CardTitle>Responsable</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="text-sm font-medium">
                  {allAgents.find((a) => a.id === lead.agent_id)?.full_name ||
                    "Sin asignar"}
                </div>
                {isAdmin && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setIsReassignOpen((prev) => !prev)}
                  >
                    {isReassignOpen ? "Cerrar" : "Cambiar"}
                  </Button>
                )}
              </div>

              {isReassignOpen && (
                <div className="pt-4 space-y-4">
                  <Separator />
                  <div>
                    <h3 className="text-sm font-medium">Reasignar lead</h3>
                    <p className="text-sm text-muted-foreground mt-1">
                      Selecciona qué agente gestionará a {lead.name}.
                    </p>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-sm">Seleccionar Agente</Label>
                    <Select
                      value={selectedAgentId}
                      onValueChange={setSelectedAgentId}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Buscar agente..." />
                      </SelectTrigger>
                      <SelectContent>
                        {allAgents.map((agent) => (
                          <SelectItem key={agent.id} value={agent.id}>
                            {agent.full_name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex justify-end">
                    <Button
                      onClick={handleReassign}
                      disabled={isReassigning}
                      className="h-10 cursor-pointer"
                    >
                      {isReassigning ? "Guardando..." : "Cambiar"}
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Visitas (E0.2 / E1.4): eventos vinculados al lead */}
          <ScheduleVisitCard lead={lead} currentUserId={currentUser.id} />

          {/* 2. CARD: PROPIEDAD DE INTERÉS (Layout Expandible Idéntico) */}
          <Card>
            <CardHeader>
              <CardTitle>Interesado en</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="flex items-center justify-between gap-2">
                {lead.properties ? (
                  <Link
                    href={`/dashboard/propiedades/${lead.properties.id}`}
                    className="truncate text-sm font-medium underline-offset-4 hover:underline"
                    title={lead.properties.title}
                  >
                    {lead.properties.title}
                  </Link>
                ) : (
                  <span className="text-sm text-muted-foreground">
                    Sin asignar
                  </span>
                )}

                {/* Botón siempre visible para asignar/cambiar */}
                <Button
                  variant="outline"
                  size="sm"
                  className="shrink-0"
                  onClick={() => setIsAssignPropertyOpen((prev) => !prev)}
                >
                  {isAssignPropertyOpen
                    ? "Cerrar"
                    : lead.properties
                    ? "Cambiar"
                    : "Asignar"}
                </Button>
              </div>

              {isAssignPropertyOpen && (
                <div className="pt-4 space-y-4">
                  <Separator />
                  <div>
                    <h3 className="text-sm font-semibold">
                      Vincular Propiedad
                    </h3>
                    <p className="text-xs text-muted-foreground mt-1">
                      ¿Por qué propiedad consulta este cliente?
                    </p>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-sm">Seleccionar Propiedad</Label>
                    <Select
                      value={selectedPropertyId}
                      onValueChange={setSelectedPropertyId}
                    >
                      <SelectTrigger className="max-w-[300px]">
                        <SelectValue placeholder="Buscar propiedad..." />
                      </SelectTrigger>
                      <SelectContent className="max-h-60">
                        {allProperties.map((prop) => (
                          <SelectItem key={prop.id} value={prop.id}>
                            {prop.title}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex justify-end">
                    <Button
                      onClick={handleAssignProperty}
                      disabled={isAssigningProperty}
                      size="sm"
                      className="h-10 cursor-pointer"
                    >
                      {isAssigningProperty ? "Guardando..." : "Asignar"}
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* 3. CARD: CONTACTO (Simple) */}
          <Card>
            <CardHeader>
              <CardTitle>
                Datos de Contacto
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-3">
                <Mail className="h-4 w-4 text-muted-foreground" />
                <a
                  href={`mailto:${lead.email}`}
                  className="text-sm hover:underline"
                >
                  {lead.email || "N/A"}
                </a>
              </div>
              <div className="flex items-center gap-3">
                <Phone className="h-4 w-4 text-muted-foreground" />
                <a
                  href={`https://wa.me/${lead.phone}`}
                  target="_blank"
                  className="text-sm hover:underline"
                >
                  {lead.phone || "N/A"}
                </a>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </Page>
  );
}
