"use client";

import { useState } from "react";
import { createClientBrowser } from "@/lib/supabase-browser";
import { LeadWithDetails } from "@/app/types";
import type { Database } from "@/app/types/supabase";
import { toast } from "sonner";
import { format } from "date-fns";
import { es } from "date-fns/locale";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/shared/components/ui/table";
import { Button } from "@/shared/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuPortal,
} from "@/shared/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/shared/components/ui/alert-dialog";
import { MoreHorizontal, Trash2, Edit } from "lucide-react";
import Link from "next/link";
import { statusLabels, statusMeta } from "@/features/dashboard/leads/leadStatus";
import { StatusBadge } from "@/shared/components/StatusBadge";
import { TemperatureBadge } from "@/features/dashboard/leads/TemperatureBadge";

// Props que recibe el componente
type LeadTableProps = {
  initialLeads: LeadWithDetails[];
  userRole: string;
};

export function LeadTable({ initialLeads, userRole }: LeadTableProps) {
  const supabase = createClientBrowser();
  const [leads, setLeads] = useState(initialLeads);
  const [isDeleting, setIsDeleting] = useState(false);
  const [leadToDelete, setLeadToDelete] = useState<LeadWithDetails | null>(
    null
  );

  const isAdmin = userRole === "admin";

  const handleStatusUpdate = async (
    leadId: string,
    newStatus: Database["public"]["Enums"]["lead_status"]
  ) => {
    setLeads((prev) =>
      prev.map((lead) =>
        lead.id === leadId ? { ...lead, status: newStatus } : lead
      )
    );

    const { error } = await supabase
      .from("leads")
      .update({ status: newStatus })
      .eq("id", leadId);

    // 3. Revertir si hay error
    if (error) {
      toast.error(`Error al actualizar estado: ${error.message}`);
      setLeads(initialLeads);
    } else {
      toast.success(
        `Lead actualizado a "${statusLabels[newStatus] || newStatus}"`
      );
    }
  };

  // --- Lógica de Borrado ---
  const handleDeleteLead = async () => {
    if (!leadToDelete) return;

    setIsDeleting(true);
    const toastId = toast.loading("Eliminando lead...");

    const { error } = await supabase
      .from("leads")
      .delete()
      .eq("id", leadToDelete.id);

    setIsDeleting(false);

    if (error) {
      toast.error(`Error al eliminar: ${error.message}`, { id: toastId });
    } else {
      toast.success("Lead eliminado con éxito.", { id: toastId });
      setLeads((prev) => prev.filter((p) => p.id !== leadToDelete.id));
    }
    setLeadToDelete(null);
  };

  return (
    <>
      <div className="overflow-hidden rounded-lg border border-border bg-card">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead>Lead</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead className="hidden md:table-cell">Propiedad de interés</TableHead>
              <TableHead className="hidden lg:table-cell">Contacto</TableHead>
              <TableHead className="hidden xl:table-cell">Fuente</TableHead>
              {isAdmin && <TableHead className="hidden lg:table-cell">Responsable</TableHead>}
              <TableHead className="hidden md:table-cell">Fecha</TableHead>
              <TableHead className="w-10" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {leads.map((lead) => {
              const meta = statusMeta(lead.status);

              return (
              <TableRow key={lead.id} className="group">
                <TableCell className="max-w-[220px] font-medium">
                  <Link
                    href={`/dashboard/leads/${lead.id}`}
                    className="block truncate text-foreground underline-offset-4 hover:underline"
                  >
                    {lead.name}
                  </Link>
                </TableCell>

                {/* Estado + temperatura (E1.8) */}
                <TableCell>
                  <span className="inline-flex items-center gap-1.5">
                    <StatusBadge tone={meta.tone} icon={meta.icon}>
                      {meta.label}
                    </StatusBadge>
                    <TemperatureBadge
                      status={lead.status}
                      lastActivityAt={lead.last_activity_at}
                      iconOnly
                    />
                  </span>
                </TableCell>

                <TableCell className="hidden max-w-[260px] truncate text-fg-secondary md:table-cell">
                  {lead.properties ? (
                    <Link
                      href={`/dashboard/propiedades/${lead.properties.id}`}
                      className="underline-offset-4 hover:underline"
                    >
                      {lead.properties.title}
                    </Link>
                  ) : (
                    <span className="text-muted-foreground">Sin propiedad</span>
                  )}
                </TableCell>

                {/* Un solo dato de contacto por fila; el resto vive en el detalle */}
                <TableCell className="hidden max-w-[220px] truncate text-fg-secondary lg:table-cell">
                  {lead.phone || lead.email || <span className="text-muted-foreground">—</span>}
                </TableCell>

                <TableCell className="hidden capitalize text-fg-secondary xl:table-cell">
                  {lead.source?.toLowerCase().replaceAll("_", " ") ?? ""}
                </TableCell>

                {isAdmin && (
                  <TableCell className="hidden max-w-[160px] truncate text-fg-secondary lg:table-cell">
                    {lead.agents?.full_name ?? <span className="text-muted-foreground">Sin asignar</span>}
                  </TableCell>
                )}

                <TableCell className="hidden text-muted-foreground md:table-cell">
                  {format(new Date(lead.created_at), "d MMM yyyy", {
                    locale: es,
                  })}
                </TableCell>

                <TableCell className="py-0 pr-2">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        aria-label="Más acciones"
                        className="text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100 data-[state=open]:opacity-100"
                      >
                        <MoreHorizontal />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuSub>
                        <DropdownMenuSubTrigger>
                          <Edit />
                          <span>Cambiar estado</span>
                        </DropdownMenuSubTrigger>
                        <DropdownMenuPortal>
                          <DropdownMenuSubContent>
                            {Object.entries(statusLabels).map(
                              ([statusKey, statusLabel]) => (
                                <DropdownMenuItem
                                  key={statusKey}
                                  onClick={() =>
                                    handleStatusUpdate(
                                      lead.id,
                                      statusKey as Database["public"]["Enums"]["lead_status"]
                                    )
                                  }
                                  disabled={lead.status === statusKey}
                                >
                                  {statusLabel}
                                </DropdownMenuItem>
                              )
                            )}
                          </DropdownMenuSubContent>
                        </DropdownMenuPortal>
                      </DropdownMenuSub>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        variant="destructive"
                        onClick={() => setLeadToDelete(lead)}
                      >
                        <Trash2 />
                        Eliminar
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      {/* Diálogo de Confirmación de Borrado */}
      <AlertDialog
        open={!!leadToDelete}
        onOpenChange={() => setLeadToDelete(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Eliminar lead</AlertDialogTitle>
            <AlertDialogDescription>
              Se elimina{" "}
              <span className="font-medium text-foreground">{leadToDelete?.name}</span>{" "}
              con sus notas e historial. Esta acción no se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteLead}
              disabled={isDeleting}
              className="bg-destructive text-white hover:bg-destructive/90"
            >
              {isDeleting ? "Eliminando…" : "Eliminar"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
