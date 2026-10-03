"use client";

import { useMemo, useState } from "react";
import { Plus, KanbanSquare, List, Search, X, ArrowLeft, Archive, Target } from "lucide-react";
import type { LeadWithDetails } from "@/app/types";
import { Button } from "@/shared/components/ui/button";
import { PageHeader } from "@/shared/components/PageShell";
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
import { DemandTab } from "@/features/dashboard/leads/DemandTab";
import type { DemandGap } from "@/features/dashboard/buyers/queries";
import { LEAD_STATUSES, normalizeStatus, type LeadStatus } from "@/features/dashboard/leads/leadStatus";
import { Input } from "@/shared/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/components/ui/select";

const ALL = "__all__";
const NONE = "__none__";

function sourceLabel(s: string) {
  return s.charAt(0) + s.slice(1).toLowerCase().replaceAll("_", " ");
}

type LeadsViewProps = {
  leads: LeadWithDetails[];
  userRole: string;
  /** Filtro de estado inicial (desde ?estado= en la URL). */
  initialStatus?: string;
  /** Pestaña inicial (?vista=demanda en la URL). */
  initialView?: "board" | "list" | "demand";
  /** Demanda sin oferta de toda la base (Buyer Intelligence). */
  demandGaps: DemandGap[];
  propertyTypes: { id: number; name: string | null }[];
};

// E1.1: /dashboard/leads con dos vistas sobre los mismos datos: Tablero
// (Kanban, default) y Lista (tabla). El alta de lead vive acá, común a
// ambas.
export function LeadsView({ leads, userRole, initialStatus, initialView = "board", demandGaps, propertyTypes }: LeadsViewProps) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [activeView, setActiveView] = useState<string>(initialView);
  const [leadUpdates, setLeadUpdates] = useState<Record<string, { status: LeadStatus; changedAt: string }>>({});
  const isAdmin = userRole === "admin";
  const currentLeads = useMemo(() => leads.map((lead) => {
    const update = leadUpdates[lead.id];
    return update ? { ...lead, status: update.status, status_since: update.changedAt, last_activity_at: update.changedAt } : lead;
  }), [leads, leadUpdates]);
  const discardedCount = currentLeads.filter((lead) => normalizeStatus(lead.status) === "DESCARTADO").length;

  // Filtros compartidos por ambas vistas. Las opciones de responsable y
  // fuente salen de los datos (no hay catálogo aparte).
  const [q, setQ] = useState("");
  const [status, setStatus] = useState(
    initialStatus && LEAD_STATUSES.some((s) => s.value === initialStatus) ? initialStatus : ALL,
  );
  const [operation, setOperation] = useState(ALL);
  const [agent, setAgent] = useState(ALL);
  const [source, setSource] = useState(ALL);

  const agents = useMemo(() => {
    const m = new Map<string, string>();
    for (const l of currentLeads) if (l.agent_id && l.agents?.full_name) m.set(l.agent_id, l.agents.full_name);
    return [...m.entries()].sort((a, b) => a[1].localeCompare(b[1]));
  }, [currentLeads]);
  const sources = useMemo(
    () => [...new Set(currentLeads.map((l) => l.source).filter((s): s is string => !!s))].sort(),
    [currentLeads],
  );

  const filtered = useMemo(() => {
    const text = q.trim().toLowerCase();
    return currentLeads.filter((l) => {
      if (
        text &&
        !(
          l.name?.toLowerCase().includes(text) ||
          l.email?.toLowerCase().includes(text) ||
          l.phone?.toLowerCase().includes(text) ||
          l.properties?.title?.toLowerCase().includes(text)
        )
      )
        return false;
      if (status !== ALL && normalizeStatus(l.status) !== status) return false;
      if (operation === NONE && l.properties) return false;
      if (operation !== ALL && operation !== NONE && l.properties?.operation_type?.toLowerCase() !== operation) return false;
      if (agent === NONE && l.agent_id) return false;
      if (agent !== ALL && agent !== NONE && l.agent_id !== agent) return false;
      if (source !== ALL && l.source !== source) return false;
      return true;
    });
  }, [currentLeads, q, status, operation, agent, source]);

  const hasFilters = q.trim() !== "" || status !== ALL || operation !== ALL || agent !== ALL || source !== ALL;
  const demandCount = filtered.filter(
    (lead) => lead.search_operation && !["CERRADO", "DESCARTADO"].includes(normalizeStatus(lead.status)),
  ).length;
  const visibleCount = activeView === "demand"
    ? demandCount
    : activeView === "board" && status !== "DESCARTADO"
    ? filtered.filter((lead) => normalizeStatus(lead.status) !== "DESCARTADO").length
    : filtered.length;
  const isArchive = status === "DESCARTADO";

  const clear = () => {
    setQ("");
    setStatus(ALL);
    setOperation(ALL);
    setAgent(ALL);
    setSource(ALL);
  };
  // Tablero y Lista guardan estado propio (cambios optimistas): se remontan
  // cuando cambia el filtro.
  const filterKey = [q, status, operation, agent, source].join("|");

  return (
    <Tabs value={activeView} onValueChange={setActiveView} className="gap-4 w-full min-w-0">
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <PageHeader
          title="Leads"
          description={
            activeView === "demand"
              ? `${visibleCount} ${visibleCount === 1 ? "comprador" : "compradores"}${hasFilters ? ` de ${currentLeads.length} leads` : ""}`
              : `${visibleCount} ${visibleCount === 1 ? "lead" : "leads"}${hasFilters ? ` de ${currentLeads.length}` : ""}`
          }
          actions={
            <>
              <TabsList>
                <TabsTrigger value="board" className="gap-1.5">
                  <KanbanSquare className="size-4" />
                  <span className="hidden sm:inline">Tablero</span>
                </TabsTrigger>
                <TabsTrigger value="list" className="gap-1.5">
                  <List className="size-4" />
                  <span className="hidden sm:inline">Lista</span>
                </TabsTrigger>
                <TabsTrigger value="demand" className="gap-1.5">
                  <Target className="size-4" />
                  <span className="hidden sm:inline">Demanda</span>
                </TabsTrigger>
              </TabsList>
              <DialogTrigger asChild>
                <Button>
                  <Plus />
                  Nuevo lead
                </Button>
              </DialogTrigger>
            </>
          }
        />

        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle className="font-semibold">
              Crear Nuevo Lead
            </DialogTitle>
            <DialogDescription>
              Añade un nuevo cliente potencial al sistema.
            </DialogDescription>
          </DialogHeader>
          <LeadForm onSuccess={() => setIsModalOpen(false)} />
        </DialogContent>
      </Dialog>

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative w-full sm:w-64">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar lead o propiedad…"
            className="pl-8"
            aria-label="Buscar por nombre, contacto o propiedad"
          />
        </div>

        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="w-[160px]" aria-label="Estado">
            <SelectValue placeholder="Estado" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>Todos los estados</SelectItem>
            {LEAD_STATUSES.map((s) => (
              <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={operation} onValueChange={setOperation}>
          <SelectTrigger className="w-[150px]" aria-label="Operación">
            <SelectValue placeholder="Operación" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>Venta y alquiler</SelectItem>
            <SelectItem value="venta">Venta</SelectItem>
            <SelectItem value="alquiler">Alquiler</SelectItem>
            <SelectItem value={NONE}>Sin propiedad</SelectItem>
          </SelectContent>
        </Select>

        {isAdmin && (
          <Select value={agent} onValueChange={setAgent}>
            <SelectTrigger className="w-[180px]" aria-label="Responsable">
              <SelectValue placeholder="Responsable" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>Todos los responsables</SelectItem>
              {agents.map(([id, name]) => (
                <SelectItem key={id} value={id}>{name}</SelectItem>
              ))}
              <SelectItem value={NONE}>Sin asignar</SelectItem>
            </SelectContent>
          </Select>
        )}

        <Select value={source} onValueChange={setSource}>
          <SelectTrigger className="w-[140px]" aria-label="Fuente">
            <SelectValue placeholder="Fuente" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>Todas las fuentes</SelectItem>
            {sources.map((s) => (
              <SelectItem key={s} value={s}>{sourceLabel(s)}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        {hasFilters && (
          <Button variant="ghost" size="sm" onClick={clear}>
            <X /> Limpiar
          </Button>
        )}

        <Button variant="outline" size="sm" className="ml-auto" onClick={() => { setStatus(isArchive ? ALL : "DESCARTADO"); setActiveView("board"); }}>
          {isArchive ? <ArrowLeft className="size-4" /> : <Archive className="size-4" />}
          {isArchive ? "Volver al tablero" : `Descartados (${discardedCount})`}
        </Button>
      </div>

      <TabsContent value="board" className="min-w-0">
        <LeadBoard
          key={filterKey}
          initialLeads={filtered}
          isAdmin={isAdmin}
          statusFilter={status}
          onLeadMoved={(leadId, nextStatus, changedAt) => setLeadUpdates((updates) => ({ ...updates, [leadId]: { status: nextStatus, changedAt } }))}
        />
      </TabsContent>
      <TabsContent value="list" className="min-w-0 overflow-x-auto">
        <LeadTable key={filterKey} initialLeads={filtered} userRole={userRole} />
      </TabsContent>
      <TabsContent value="demand" className="min-w-0">
        <DemandTab leads={filtered} gaps={demandGaps} propertyTypes={propertyTypes} />
      </TabsContent>
    </Tabs>
  );
}
