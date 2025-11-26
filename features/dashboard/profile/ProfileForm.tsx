"use client";

import { useState } from "react";
import Image from "next/image";
import { toast } from "sonner";
import { updateAgentAction } from "@/features/actions/manage-agents";
import { Camera, Save, Loader2 } from "lucide-react";

import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import { Label } from "@/shared/components/ui/label";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/shared/components/ui/card";

type Agent = {
  id: string;
  full_name: string;
  email: string;
  phone: string;
  role: string;
  avatar_url: string | null;
};

export function ProfileForm({ agent }: { agent: Agent }) {
  const [isLoading, setIsLoading] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(agent.avatar_url);

  const [formData, setFormData] = useState({
    full_name: agent.full_name || "",
    phone: agent.phone || "",
  });

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      setPreviewUrl(URL.createObjectURL(file));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    const data = new FormData();
    data.append("id", agent.id);
    data.append("full_name", formData.full_name);
    data.append("phone", formData.phone);
    data.append("role", agent.role);

    if (selectedFile) {
      data.append("avatar", selectedFile);
    }

    const result = await updateAgentAction(data);

    if (result.error) {
      toast.error(result.error);
    } else {
      toast.success("Perfil actualizado correctamente");
    }
    setIsLoading(false);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Tarjeta de Avatar */}
      <Card>
        <CardHeader>
          <CardTitle>Imagen de Perfil</CardTitle>
          <CardDescription>
            Esta foto será visible para los clientes en la web.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex items-center gap-6">
          <div className="relative w-24 h-24 rounded-full overflow-hidden border-2 border-zinc-100 bg-zinc-50 shadow-sm">
            {previewUrl ? (
              <Image
                src={previewUrl}
                alt="Avatar"
                fill
                className="object-cover"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-zinc-400 font-bold text-2xl">
                {agent.full_name?.[0]}
              </div>
            )}
          </div>
          <div className="flex flex-col gap-2">
            <Label
              htmlFor="avatar-upload"
              className="cursor-pointer inline-flex"
            >
              <div className="flex items-center gap-2 bg-white border border-zinc-200 hover:bg-zinc-50 px-4 py-2 rounded-md text-sm font-medium transition-colors">
                <Camera className="w-4 h-4" />
                Cambiar Foto
              </div>
            </Label>
            <Input
              id="avatar-upload"
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleFileChange}
            />
            <p className="text-xs text-muted-foreground">
              Soporta JPG, PNG. Máx 5MB.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Tarjeta de Datos Personales */}
      <Card>
        <CardHeader>
          <CardTitle>Información Personal</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Nombre Completo</Label>
              <Input
                value={formData.full_name}
                onChange={(e) =>
                  setFormData({ ...formData, full_name: e.target.value })
                }
              />
            </div>
            <div className="space-y-2">
              <Label>Rol</Label>
              <Input
                value={
                  agent.role === "admin"
                    ? "Administrador"
                    : "Agente Inmobiliario"
                }
                disabled
                className="bg-zinc-50 text-zinc-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Email</Label>
              <Input
                value={agent.email}
                disabled
                className="bg-zinc-50 text-zinc-500"
              />
              <p className="text-[10px] text-muted-foreground">
                Para cambiar tu email, contacta al soporte.
              </p>
            </div>
            <div className="space-y-2">
              <Label>Teléfono (WhatsApp Público)</Label>
              <Input
                value={formData.phone}
                onChange={(e) =>
                  setFormData({ ...formData, phone: e.target.value })
                }
                placeholder="Ej: 549..."
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button
          type="submit"
          disabled={isLoading}
          className="w-full md:w-auto bg-foreground hover:bg-foreground/90 cursor-pointer"
        >
          {isLoading ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Save className="mr-2 h-4 w-4" />
          )}
          Guardar Cambios
        </Button>
      </div>
    </form>
  );
}
