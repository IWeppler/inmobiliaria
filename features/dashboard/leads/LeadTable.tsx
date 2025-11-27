"use client";

import { useState } from "react";
import { createClientBrowser } from "@/lib/supabase-browser";
import { LeadWithDetails } from "@/app/types";
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
import { Badge } from "@/shared/components/ui/badge";
import { Button } from "@/shared/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
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
import {
  Dialog,
  DialogContent,
  DialogTrigger,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/shared/components/ui/dialog";
import { MoreHorizontal, Trash2, PlusCircle, Edit, User } from "lucide-react";
import { LeadForm } from "@/features/dashboard/leads/LeadForm";
import Link from "next/link";

const statusColors: { [key: string]: string } = {
  NUEVO: "bg-blue-600 hover:bg-blue-700",
  CONTACTADO: "bg-yellow-500 hover:bg-yellow-600 text-foreground",
  VISITA_PROGRAMADA: "bg-orange-500 hover:bg-orange-600",
  NEGOCIACION: "bg-green-600 hover:bg-green-700",
  CERRADO: "bg-zinc-600 hover:bg-zinc-700",
  DESCARTADO: "bg-red-600 hover:bg-red-700",
};

const statusLabels: { [key: string]: string } = {
  NUEVO: "Nuevo",
  CONTACTADO: "Contactado",
  VISITA_PROGRAMADA: "Visita Programada",
  NEGOCIACION: "Negociación",
  CERRADO: "Cerrado",
  DESCARTADO: "Descartado",
};

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
  const [isModalOpen, setIsModalOpen] = useState(false);

  const isAdmin = userRole === "admin";

  const handleStatusUpdate = async (leadId: string, newStatus: string) => {
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
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="font-clash font-semibold text-2xl">
              Gestión de Leads
            </h1>
            <p className="text-muted-foreground pr-2">
              Aquí puedes ver y gestionar tus clentes potenciales.
            </p>
          </div>
          <DialogTrigger asChild>
            <Button className="bg-foreground hover:bg-foreground/90 cursor-pointer">
              <PlusCircle className="mr-2 h-4 w-4" />
              Agregar Lead
            </Button>
          </DialogTrigger>
        </div>

        <DialogContent className="sm:max-w-[600px]">
          {/* 1. Añade el DialogHeader con el título y descripción */}
          <DialogHeader>
            <DialogTitle className="font-clash font-semibold">
              Crear Nuevo Lead
            </DialogTitle>
            <DialogDescription>
              Añade un nuevo cliente potencial al sistema.
            </DialogDescription>
          </DialogHeader>
          <LeadForm onSuccess={() => setIsModalOpen(false)} />
        </DialogContent>
      </Dialog>

      <div className="bg-white rounded-lg border shadow-sm">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nombre</TableHead>
              {isAdmin && <TableHead>Agente Asignado</TableHead>}
              <TableHead className="hidden md:table-cell">
                Propiedad de Interés
              </TableHead>
              <TableHead>Estado</TableHead>
              <TableHead className="hidden lg:table-cell">Contacto</TableHead>
              <TableHead className="hidden lg:table-cell">Fuente</TableHead>
              <TableHead className="hidden md:table-cell">Fecha</TableHead>
              <TableHead className="w-[50px]">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {leads.map((lead) => (
              <TableRow key={lead.id}>
                {/* Nombre */}
                <TableCell className="font-medium">
                  <Link
                    href={`/dashboard/leads/${lead.id}`}
                    className="hover:underline hover:text-primary"
                  >
                    {lead.name}
                  </Link>
                </TableCell>

                {isAdmin && (
                  <TableCell>
                    {lead.agents ? (
                      <div className="flex items-center gap-2 text-sm font-medium">
                        <div className="bg-zinc-100 p-1 rounded-full">
                          <User className="h-3 w-3 text-zinc-500" />
                        </div>
                        {lead.agents.full_name}
                      </div>
                    ) : (
                      <span className="text-zinc-400 text-xs italic">
                        Sin asignar
                      </span>
                    )}
                  </TableCell>
                )}

                {/* Propiedad de Interés */}
                <TableCell className="hidden md:table-cell text-muted-foreground">
                  {lead.properties?.title || "Sin propiedad asignada"}
                </TableCell>

                {/* Estado */}
                <TableCell>
                  <Badge
                    className={`text-white ${
                      statusColors[lead.status] || "bg-zinc-500"
                    }`}
                  >
                    {statusLabels[lead.status] || lead.status}
                  </Badge>
                </TableCell>

                {/* Contacto */}
                <TableCell className="hidden lg:table-cell text-muted-foreground">
                  <div className="flex flex-col">
                    <span>{lead.email}</span>
                    <span className="text-xs">{lead.phone}</span>
                  </div>
                </TableCell>

                {/* Fuente */}
                <TableCell className="hidden lg:table-cell text-muted-foreground capitalize">
                  {lead.source.toLowerCase()}
                </TableCell>

                {/* Fecha */}
                <TableCell className="hidden md:table-cell text-muted-foreground">
                  {format(new Date(lead.created_at), "dd MMM yyyy", {
                    locale: es,
                  })}
                </TableCell>

                {/* Acciones */}
                <TableCell>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon">
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuSub>
                        <DropdownMenuSubTrigger>
                          <Edit className="mr-2 h-4 w-4" />
                          <span>Cambiar Estado</span>
                        </DropdownMenuSubTrigger>
                        <DropdownMenuPortal>
                          <DropdownMenuSubContent>
                            {Object.entries(statusLabels).map(
                              ([statusKey, statusLabel]) => (
                                <DropdownMenuItem
                                  key={statusKey}
                                  onClick={() =>
                                    handleStatusUpdate(lead.id, statusKey)
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
                      {/* <DropdownMenuItem>Ver/Editar</DropdownMenuItem> */}
                      <DropdownMenuItem
                        className="text-red-500"
                        onClick={() => setLeadToDelete(lead)}
                      >
                        <Trash2 className="mr-2 h-4 w-4" />
                        Eliminar
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            ))}
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
            <AlertDialogTitle>¿Estás seguro?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción no se puede deshacer. Esto eliminará permanentemente
              el lead de <strong>{leadToDelete?.name}</strong>.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteLead}
              disabled={isDeleting}
              className="bg-red-600 hover:bg-red-700"
            >
              {isDeleting ? "Eliminando..." : "Sí, eliminar"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
