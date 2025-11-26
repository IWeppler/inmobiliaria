"use client";

import { useState } from "react";
import Image from "next/image";
import { toast } from "sonner";
import { Plus, Trash2, Shield, User, Phone, Mail, Edit, Camera } from "lucide-react";
import {
  createAgentAction,
  deleteAgentAction,
  updateAgentAction,
} from "@/features/actions/manage-agents";

// UI Components
import { Button } from "@/shared/components/ui/button";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/shared/components/ui/table";
import { Badge } from "@/shared/components/ui/badge";

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
}: {
  initialAgents: Agent[];
  currentUserId: string;
}) {
  const [agents, setAgents] = useState(initialAgents);
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
    if (!confirm("¿Estás seguro? Esto eliminará el acceso del usuario.")) return;

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
      <div className="flex justify-end mb-6 -mt-16">
        <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
          <DialogTrigger asChild>
            <Button 
                onClick={openCreateModal}
                className="bg-foreground text-white hover:bg-foreground/90 cursor-pointer"
            >
              <Plus className="w-4 h-4 mr-2" /> Agregar Agente
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle>{editingAgent ? "Editar Agente" : "Nuevo Miembro"}</DialogTitle>
              <DialogDescription>
                {editingAgent ? "Modifica los datos del usuario." : "Crear un usuario para acceso al sistema."}
              </DialogDescription>
            </DialogHeader>

            <form onSubmit={handleSubmit} className="space-y-4 py-4">
              
              {/* IMAGEN DE PERFIL */}
              <div className="flex flex-col items-center gap-4 mb-4">
                 <div className="relative w-20 h-20 rounded-full overflow-hidden bg-zinc-100 border-2 border-dashed border-zinc-300 flex items-center justify-center group">
                    {selectedFile ? (
                        <Image src={URL.createObjectURL(selectedFile)} alt="Preview" fill className="object-cover" />
                    ) : editingAgent?.avatar_url ? (
                        <Image src={editingAgent.avatar_url} alt="Current" fill className="object-cover" />
                    ) : (
                        <Camera className="text-zinc-400 w-8 h-8" />
                    )}
                 </div>
                 <Label htmlFor="avatar-upload" className="cursor-pointer text-sm text-blue-600 hover:underline">
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
                  onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                />
              </div>

              <div className="space-y-2">
                <Label>Email</Label>
                <Input
                  type="email"
                  required
                  disabled={!!editingAgent}
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
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
                      onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    />
                  </div>
              )}

              <div className="space-y-2">
                <Label>Teléfono (WhatsApp)</Label>
                <Input
                  placeholder="549..."
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                />
              </div>

              <div className="space-y-2">
                <Label>Rol</Label>
                <Select
                  value={formData.role}
                  onValueChange={(val) => setFormData({ ...formData, role: val })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="agente">Agente (Vendedor)</SelectItem>
                    <SelectItem value="admin">Administrador</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <DialogFooter>
                <Button type="submit" disabled={isLoading} className="bg-foreground text-white cursor-pointer">
                  {isLoading ? "Guardando..." : (editingAgent ? "Guardar Cambios" : "Crear Usuario")}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="border rounded-md overflow-hidden bg-white shadow-sm">
        <Table>
          <TableHeader>
            <TableRow className="bg-zinc-50 hover:bg-zinc-50">
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
                  <div className="relative w-10 h-10 rounded-full overflow-hidden bg-zinc-200 border">
                    {agent.avatar_url ? (
                      <Image
                        src={agent.avatar_url}
                        alt="Avatar"
                        fill
                        className="object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-zinc-500 font-bold uppercase">
                        {agent.full_name?.[0] || "?"}
                      </div>
                    )}
                  </div>
                </TableCell>

                <TableCell className="font-medium">
                  {agent.full_name || "Sin nombre"}
                  {agent.id === currentUserId && (
                      <span className="ml-2 text-xs text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full">Tú</span>
                  )}
                </TableCell>

                <TableCell>
                  <div className="flex flex-col text-sm text-zinc-500 gap-1">
                    <div className="flex items-center gap-2">
                      <Mail className="w-3 h-3" /> {agent.email}
                    </div>
                    {agent.phone && (
                      <div className="flex items-center gap-2">
                        <Phone className="w-3 h-3" /> {agent.phone}
                      </div>
                    )}
                  </div>
                </TableCell>
                <TableCell>
                  {agent.role === "admin" ? (
                    <Badge variant="default" className="bg-foreground gap-1">
                      <Shield className="w-3 h-3" /> Admin
                    </Badge>
                  ) : (
                    <Badge variant="secondary" className="gap-1">
                      <User className="w-3 h-3" /> Agente
                    </Badge>
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
                        <Edit className="w-4 h-4 text-zinc-500" />
                      </Button>

                      {/* BOTÓN BORRAR (Protegido) */}
                      {agent.id !== currentUserId && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="text-red-500 hover:text-red-700 hover:bg-red-50"
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