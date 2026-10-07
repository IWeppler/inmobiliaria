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
import { Send, Mail, Phone } from "lucide-react";
import type { User } from "@supabase/supabase-js";

import { LeadWithDetails } from "@/app/types";
import { LeadTimeline, type TimelineItem } from "@/features/dashboard/leads/LeadTimeline";
import { statusMeta } from "@/features/dashboard/leads/leadStatus";
import { lostReasonLabel } from "@/features/dashboard/leads/lostReasons";
import { ScheduleVisitCard } from "@/features/dashboard/leads/ScheduleVisitCard";
import { NextActionCard } from "@/features/dashboard/leads/NextActionCard";
import { DealCard, type DealLinkInfo } from "@/features/dashboard/deals/DealCard";
import { BuyerDemandCard } from "@/features/dashboard/buyers/BuyerDemandCard";
import { LeadPropertyMatches } from "@/features/dashboard/buyers/LeadPropertyMatches";
import type { PropertyMatch } from "@/features/dashboard/buyers/queries";

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
  propertyTypes: { id: number; name: string | null }[];
  propertyMatches: PropertyMatch[];
  timeline: TimelineItem[];
  dealLink: DealLinkInfo | null;
  /** Tarjeta de tareas, armada en el servidor. */
  tasksCard?: React.ReactNode;
}

export function LeadDetailClient({
  initialLead,
  currentUser,
  userRole,
  allAgents,
  allProperties,
  propertyTypes,
  propertyMatches,
  timeline,
  dealLink,
  tasksCard,
}: LeadDetailClientProps) {
  const supabase = createClientBrowser();
  const router = useRouter();

  const [lead] = useState<LeadWithDetails>(initialLead);

  // --- ESTADOS PARA AGENTE (Expandible) ---
  const [isReassignOpen, setIsReassignOpen] = useState(false);
  const [selectedAgentId, setSelectedAgentId] = useState(lead.agent_id || "");
  const [isReassigning, setIsReassigning] = useState(false);

  // --- ESTADOS PARA PROPIEDAD (Expandible) ---
  const [isAssignPropertyOpen, setIsAssignPropertyOpen] = useState(false);
  const [selectedPropertyId, setSelectedPropertyId] = useState(
    lead.property_id || "",
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

    const { error } = await supabase
      .from("lead_notes")
      .insert({
        content: data.content,
        lead_id: lead.id,
        user_id: currentUser.id,
      });

    if (error) {
      toast.error("Error al guardar la nota");
    } else {
      toast.success("Nota agregada.");
      form.reset();
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

      {lead.status === "DESCARTADO" && (
        <p className="rounded-md border border-border bg-muted/60 px-4 py-3 text-sm text-fg-secondary">
          <span className="font-medium text-foreground">
            Motivo de descarte:{" "}
          </span>
          {lostReasonLabel(lead.lost_reason) ?? "sin registrar"}
          {lead.lost_reason_note && (
            <span className="text-muted-foreground">
              {" "}
              · {lead.lost_reason_note}
            </span>
          )}
        </p>
      )}

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
                    {form.formState.isSubmitting
                      ? "Guardando…"
                      : "Guardar nota"}
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
              {/* Notas, WhatsApp, estados, visitas y alta en una sola línea de tiempo. */}
              <LeadTimeline items={timeline} originalMessage={initialLead.notes} />
            </CardContent>
          </Card>
        </div>

        {/* COLUMNA LATERAL */}
        <div className="space-y-4">
          {/* Próximo paso: se toma de initialLead, que se actualiza al refrescar. */}
          <NextActionCard
            leadId={initialLead.id}
            action={initialLead.next_action}
            at={initialLead.next_action_at}
            closed={initialLead.status === "CERRADO" || initialLead.status === "DESCARTADO"}
          />

          {/* Postventa: reserva → boleto → escritura. */}
          <DealCard lead={initialLead} link={dealLink} />

          {tasksCard}

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

          {/* Buyer Intelligence: qué busca este comprador */}
          <BuyerDemandCard lead={lead} propertyTypes={propertyTypes} />
          {lead.search_operation && (
            <LeadPropertyMatches matches={propertyMatches} />
          )}

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
              <CardTitle>Datos de Contacto</CardTitle>
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
