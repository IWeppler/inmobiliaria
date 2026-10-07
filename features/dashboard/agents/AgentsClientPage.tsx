"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { toast } from "sonner";
import {
  Trash2,
  Shield,
  User,
  Edit,
  Camera,
  Plus,
  Calculator,
} from "lucide-react";
import {
  createAgentAction,
  deleteAgentAction,
  updateAgentAction,
} from "@/features/actions/manage-agents";

// UI Components
import { Button } from "@/shared/components/ui/button";
import { PageHeader } from "@/shared/components/PageShell";
import { Input } from "@/shared/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
  DialogDescription,
} from "@/shared/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/components/ui/select";
import { Label } from "@/shared/components/ui/label";
import { StatusBadge } from "@/shared/components/StatusBadge";
import type { AgentMetric } from "./getAgentMetrics";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/shared/components/ui/table";

type Agent = {
  id: string;
  full_name: string;
  email: string;
  phone: string;
  role: string;
  avatar_url: string | null;
};

// Recibimos currentUserId
export function AgentsClientPage({
  initialAgents,
  currentUserId,
  metrics,
  asOf,
}: {
  initialAgents: Agent[];
  currentUserId: string;
  metrics: AgentMetric[];
  asOf: string;
}) {
  const [agents, setAgents] = useState(initialAgents);
  const [inactiveDays, setInactiveDays] = useState(7);
  const [selectedAgentId, setSelectedAgentId] = useState<string | null>(initialAgents[0]?.id ?? null);
  const selectedMetric = metrics.find((metric) => metric.id === selectedAgentId);
  const selectedAgent = agents.find((agent) => agent.id === selectedAgentId);
  const inactiveLeads = selectedMetric?.openLeads.filter((lead) => new Date(asOf).getTime() - new Date(lead.lastActivityAt).getTime() > inactiveDays * 86400000) ?? [];
  const percent = (numerator: number, denominator: number) => denominator ? `${Math.round(numerator / denominator * 100)}%` : "—";
  const conversion = (numerator: number, denominator: number) => selectedMetric && selectedMetric.assigned >= 10 ? percent(numerator, denominator) : "Muestra insuficiente";
  const duration = (minutes: number | null) => minutes === null ? "Sin datos" : minutes >= 60 ? `${(minutes / 60).toFixed(1)} h` : `${Math.round(minutes)} min`;
  const money = (value: number, currency: "ARS" | "USD") => new Intl.NumberFormat("es-AR", { style: "currency", currency, maximumFractionDigits: 0 }).format(value);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [editingAgent, setEditingAgent] = useState<Agent | null>(null);
  const [formData, setFormData] = useState({
    full_name: "",
    email: "",
    phone: "",
    password: "",
    role: "agente",
  });

  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const openCreateModal = () => {
    setEditingAgent(null);
    setFormData({
      full_name: "",
      email: "",
      phone: "",
      password: "",
      role: "agente",
    });
    setSelectedFile(null);
    setIsModalOpen(true);
  };

  const openEditModal = (agent: Agent) => {
    setEditingAgent(agent);
    setFormData({
      full_name: agent.full_name || "",
      email: agent.email || "",
      phone: agent.phone || "",
      password: "",
      role: agent.role || "agente",
    });
    setSelectedFile(null);
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    const data = new FormData();
    data.append("full_name", formData.full_name);
    data.append("phone", formData.phone);
    data.append("role", formData.role);

    if (selectedFile) {
      data.append("avatar", selectedFile);
    }

    let result;

    if (editingAgent) {
      data.append("id", editingAgent.id);
      result = await updateAgentAction(data);
    } else {
      data.append("email", formData.email);
      data.append("password", formData.password);
      result = await createAgentAction(data);
    }

    if (result.error) {
      toast.error(result.error);
    } else {
      toast.success(editingAgent ? "Agente actualizado" : "Agente creado");
      setIsModalOpen(false);
      window.location.reload();
    }
    setIsLoading(false);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("¿Estás seguro? Esto eliminará el acceso del usuario."))
      return;

    const toastId = toast.loading("Eliminando...");
    const result = await deleteAgentAction(id);

    if (result.error) {
      toast.error(result.error, { id: toastId });
    } else {
      toast.success("Eliminado", { id: toastId });
      setAgents((prev) => prev.filter((a) => a.id !== id));
    }
  };

  return (
    <>
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <PageHeader
          title="Equipo"
          description="Agentes y administradores de la inmobiliaria."
          actions={
            <DialogTrigger asChild>
              <Button onClick={openCreateModal}>
                <Plus /> Agregar agente
              </Button>
            </DialogTrigger>
          }
        />
          <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle>
                {editingAgent ? "Editar Agente" : "Nuevo Miembro"}
              </DialogTitle>
              <DialogDescription>
                {editingAgent
                  ? "Modifica los datos del usuario."
                  : "Crear un usuario para acceso al sistema."}
              </DialogDescription>
            </DialogHeader>

            <form onSubmit={handleSubmit} className="space-y-4 py-4">
              {/* IMAGEN DE PERFIL */}
              <div className="flex flex-col items-center gap-4 mb-4">
                <div className="relative size-20 overflow-hidden rounded-full border border-dashed border-border-strong bg-muted flex items-center justify-center group">
                  {selectedFile ? (
                    <Image
                      src={URL.createObjectURL(selectedFile)}
                      alt="Preview"
                      fill
                      className="object-cover"
                    />
                  ) : editingAgent?.avatar_url ? (
                    <Image
                      src={editingAgent.avatar_url}
                      alt="Current"
                      fill
                      className="object-cover"
                    />
                  ) : (
                    <Camera className="size-6 text-muted-foreground" />
                  )}
                </div>
                <Label
                  htmlFor="avatar-upload"
                  className="cursor-pointer text-sm text-primary underline-offset-4 hover:underline"
                >
                  {editingAgent || selectedFile ? "Cambiar foto" : "Subir foto"}
                </Label>
                <Input
                  id="avatar-upload"
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
                />
              </div>

              <div className="space-y-2">
                <Label>Nombre Completo</Label>
                <Input
                  required
                  value={formData.full_name}
                  onChange={(e) =>
                    setFormData({ ...formData, full_name: e.target.value })
                  }
                />
              </div>

              <div className="space-y-2">
                <Label>Email</Label>
                <Input
                  type="email"
                  required
                  disabled={!!editingAgent}
                  value={formData.email}
                  onChange={(e) =>
                    setFormData({ ...formData, email: e.target.value })
                  }
                />
              </div>

              {!editingAgent && (
                <div className="space-y-2">
                  <Label>Contraseña</Label>
                  <Input
                    type="password"
                    required
                    placeholder="Mínimo 6 caracteres"
                    value={formData.password}
                    onChange={(e) =>
                      setFormData({ ...formData, password: e.target.value })
                    }
                  />
                </div>
              )}

              <div className="space-y-2">
                <Label>Teléfono (WhatsApp)</Label>
                <Input
                  placeholder="549..."
                  value={formData.phone}
                  onChange={(e) =>
                    setFormData({ ...formData, phone: e.target.value })
                  }
                />
              </div>

              <div className="space-y-2">
                <Label>Rol</Label>
                <Select
                  value={formData.role}
                  onValueChange={(val) =>
                    setFormData({ ...formData, role: val })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="agente">Agente (Vendedor)</SelectItem>
                    <SelectItem value="administracion">Administración (alquileres y finanzas)</SelectItem>
                    <SelectItem value="admin">Administrador</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <DialogFooter>
                <Button
                  type="submit"
                  disabled={isLoading}
                  className="cursor-pointer"
                >
                  {isLoading
                    ? "Guardando..."
                    : editingAgent
                    ? "Guardar Cambios"
                    : "Crear Usuario"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
      </Dialog>

      <section className="mb-6 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div><h2 className="text-lg font-semibold">Rendimiento por agente</h2><p className="text-sm text-muted-foreground">Seleccioná un integrante para ver actividad y conversiones.</p></div>
          <Select value={selectedAgentId ?? undefined} onValueChange={setSelectedAgentId}>
            <SelectTrigger className="w-56"><SelectValue placeholder="Elegí un agente" /></SelectTrigger>
            <SelectContent>{agents.map((agent) => <SelectItem key={agent.id} value={agent.id}>{agent.full_name || agent.email || "Sin nombre"}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        {selectedMetric && <>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {[
              ["Leads asignados", String(selectedMetric.assigned)],
              ["Primera respuesta media", duration(selectedMetric.meanResponseMinutes)],
              ["Visitas pasadas", String(selectedMetric.pastVisits)],
              ["En negociación", String(selectedMetric.negotiating)],
              ["Cierres", String(selectedMetric.closed)],
              ["Propiedades captadas", String(selectedMetric.captured)],
              ["Comisiones alquiler · ARS", money(selectedMetric.commissions.ARS, "ARS")],
              ["Comisiones alquiler · USD", money(selectedMetric.commissions.USD, "USD")],
            ].map(([label, value]) => <div key={label} className="rounded-lg border bg-card p-4"><p className="text-sm text-muted-foreground">{label}</p><p className="mt-2 text-2xl font-semibold">{value}</p></div>)}
          </div>
          <div className="grid gap-4 xl:grid-cols-2">
            <div className="rounded-lg border bg-card p-5">
              <h3 className="font-semibold">Conversión · {selectedAgent?.full_name || "Agente"}</h3>
              <p className="mt-1 text-xs text-muted-foreground">Porcentaje visible desde 10 leads asignados. Cada etapa usa como base la etapa anterior.</p>
              <div className="mt-4 space-y-3 text-sm">
                {[
                  ["Cierres / leads asignados", selectedMetric.closed, selectedMetric.assigned],
                  ["Lead → visita programada", selectedMetric.visitedStage, selectedMetric.assigned],
                  ["Visita programada → negociación", selectedMetric.negotiating, selectedMetric.visitedStage],
                  ["Negociación → cierre", selectedMetric.closed, selectedMetric.negotiating],
                ].map(([label, numerator, denominator]) => <div key={String(label)} className="flex items-center justify-between gap-3 border-b pb-2 last:border-0"><span>{label}</span><span className="text-right font-medium">{conversion(Number(numerator), Number(denominator))}<span className="ml-2 text-xs font-normal text-muted-foreground">({numerator}/{denominator})</span></span></div>)}
              </div>
            </div>
            <div className="rounded-lg border bg-card p-5">
              <div className="flex flex-wrap items-center justify-between gap-3"><h3 className="font-semibold">Leads sin actividad <span className="text-destructive">{inactiveLeads.length > 0 ? `· ${inactiveLeads.length}` : ""}</span></h3><Select value={String(inactiveDays)} onValueChange={(value) => setInactiveDays(Number(value))}><SelectTrigger className="w-36"><SelectValue /></SelectTrigger><SelectContent>{[3, 7, 14, 30].map((days) => <SelectItem key={days} value={String(days)}>{days} días</SelectItem>)}</SelectContent></Select></div>
              <div className="mt-4 max-h-56 space-y-2 overflow-auto text-sm">{inactiveLeads.length ? inactiveLeads.map((lead) => <Link key={lead.id} href={`/dashboard/leads/${lead.id}`} className="flex justify-between rounded-md border px-3 py-2 hover:bg-muted"><span>{lead.name}</span><span className="text-muted-foreground">{Math.floor((new Date(asOf).getTime() - new Date(lead.lastActivityAt).getTime()) / 86400000)} días</span></Link>) : <p className="text-muted-foreground">No hay leads abiertos sin actividad en este plazo.</p>}</div>
            </div>
          </div>
          <p className="text-xs text-muted-foreground">Primera respuesta: tiempo hasta CONTACTADO ({selectedMetric.responseSample} leads medidos). Visitas pasadas: eventos agendados con fecha anterior a hoy, sin confirmación de asistencia. Negociación indica etapa del Kanban, no oferta registrada. Comisiones: liquidaciones de alquiler del agente; las ventas todavía no registran comisión. Propiedades captadas cuenta solo las que tienen captador registrado.</p>
        </>}
      </section>

      <div className="overflow-hidden rounded-lg border border-border bg-card">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="w-[80px]">Foto</TableHead>
              <TableHead>Nombre</TableHead>
              <TableHead>Contacto</TableHead>
              <TableHead>Rol</TableHead>
              <TableHead className="text-right">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {agents.map((agent) => (
              <TableRow key={agent.id}>
                <TableCell>
                  <div className="relative size-8 overflow-hidden rounded-full bg-muted">
                    {agent.avatar_url ? (
                      <Image
                        src={agent.avatar_url}
                        alt="Avatar"
                        fill
                        className="object-cover"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-xs font-medium uppercase text-muted-foreground">
                        {agent.full_name?.[0] || "?"}
                      </div>
                    )}
                  </div>
                </TableCell>

                <TableCell className="font-medium">
                  {agent.full_name || "Sin nombre"}
                  {agent.id === currentUserId && (
                    <span className="ml-2 text-xs font-normal text-muted-foreground">(vos)</span>
                  )}
                </TableCell>

                <TableCell>
                  <div className="text-sm text-fg-secondary">
                    {agent.email}
                    {agent.phone && (
                      <span className="text-muted-foreground"> · {agent.phone}</span>
                    )}
                  </div>
                </TableCell>
                <TableCell>
                  {agent.role === "admin" ? (
                    <StatusBadge tone="accent" icon={Shield}>
                      Admin
                    </StatusBadge>
                  ) : agent.role === "administracion" ? (
                    <StatusBadge tone="info" icon={Calculator}>
                      Administración
                    </StatusBadge>
                  ) : (
                    <StatusBadge tone="neutral" icon={User}>
                      Agente
                    </StatusBadge>
                  )}
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-2">
                    {/* BOTÓN EDITAR */}
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => openEditModal(agent)}
                    >
                      <Edit className="size-4 text-muted-foreground" />
                    </Button>

                    {/* BOTÓN BORRAR (Protegido) */}
                    {agent.id !== currentUserId && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-muted-foreground hover:text-danger"
                        onClick={() => handleDelete(agent.id)}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </>
  );
}
