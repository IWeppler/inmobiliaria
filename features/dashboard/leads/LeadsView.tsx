"use client";

import { useState } from "react";
import { PlusCircle, KanbanSquare, List } from "lucide-react";
import type { LeadWithDetails } from "@/app/types";
import { Button } from "@/shared/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogTrigger,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/shared/components/ui/dialog";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/shared/components/ui/tabs";
import { LeadForm } from "@/features/dashboard/leads/LeadForm";
import { LeadBoard } from "@/features/dashboard/leads/LeadBoard";
import { LeadTable } from "@/features/dashboard/leads/LeadTable";

type LeadsViewProps = {
  leads: LeadWithDetails[];
  userRole: string;
};

// E1.1: /dashboard/leads con dos vistas sobre los mismos datos: Tablero
// (Kanban, default) y Lista (tabla). El alta de lead vive acá, común a
// ambas.
export function LeadsView({ leads, userRole }: LeadsViewProps) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const isAdmin = userRole === "admin";

  return (
    <Tabs defaultValue="board" className="gap-4 w-full min-w-0">
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="font-serif font-semibold text-2xl text-foreground">
              Gestión de Leads
            </h1>
            <p className="text-muted-foreground pr-2">
              Aquí puedes ver y gestionar tus clientes potenciales.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <TabsList>
              <TabsTrigger value="board" className="gap-1.5">
                <KanbanSquare className="size-4" />
                <span className="hidden sm:inline">Tablero</span>
              </TabsTrigger>
              <TabsTrigger value="list" className="gap-1.5">
                <List className="size-4" />
                <span className="hidden sm:inline">Lista</span>
              </TabsTrigger>
            </TabsList>
            <DialogTrigger asChild>
              <Button className="cursor-pointer">
                <PlusCircle className="mr-2 h-4 w-4" />
                Agregar Lead
              </Button>
            </DialogTrigger>
          </div>
        </div>

        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle className="font-serif font-semibold">
              Crear Nuevo Lead
            </DialogTitle>
            <DialogDescription>
              Añade un nuevo cliente potencial al sistema.
            </DialogDescription>
          </DialogHeader>
          <LeadForm onSuccess={() => setIsModalOpen(false)} />
        </DialogContent>
      </Dialog>

      <TabsContent value="board" className="min-w-0">
        <LeadBoard initialLeads={leads} isAdmin={isAdmin} />
      </TabsContent>
      <TabsContent value="list" className="min-w-0 overflow-x-auto">
        <LeadTable initialLeads={leads} userRole={userRole} />
      </TabsContent>
    </Tabs>
  );
}
