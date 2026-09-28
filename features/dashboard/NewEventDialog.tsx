"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Plus } from "lucide-react";
import { toast } from "sonner";
import { createClientBrowser } from "@/lib/supabase-browser";
import { dayStartISO, ymdInAppTz } from "@/lib/dates";
import { EVENT_TYPES, type EventType } from "@/features/dashboard/eventTypes";
import type { UpcomingEvent } from "@/features/dashboard/UpcomingEvents";
import { Button } from "@/shared/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/shared/components/ui/dialog";
import { Input } from "@/shared/components/ui/input";
import { Label } from "@/shared/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/components/ui/select";
import { syncEventAction } from "@/features/dashboard/google-calendar/actions";

const DEFAULT_TIME = "10:00";

// Carga rápida de un evento desde el dashboard: cuándo (día + hora), qué
// (tipo) y con quién. Reemplaza al módulo /dashboard/agenda. Las visitas
// vinculadas a un lead siguen saliendo desde el detalle del lead.
export function NewEventDialog({ initialDate, onCreated }: { initialDate?: string; onCreated?: (event: UpcomingEvent) => void } = {}) {
  const supabase = createClientBrowser();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [date, setDate] = useState(initialDate ?? ymdInAppTz());
  const [time, setTime] = useState(DEFAULT_TIME);
  const [type, setType] = useState<EventType>("llamada");
  const [who, setWho] = useState("");

  const reset = () => {
    setDate(initialDate ?? ymdInAppTz());
    setTime(DEFAULT_TIME);
    setType("llamada");
    setWho("");
  };

  const canSave = Boolean(date && time && who.trim()) && !saving;

  const handleSave = async () => {
    if (!canSave) return;
    setSaving(true);

    const { data: created, error } = await supabase.from("events").insert({
      date: dayStartISO(date),
      time,
      title: who.trim(),
      type,
    }).select("id, date, time, title, type, lead_id, property_id").single();

    if (error) {
      toast.error(`No se pudo guardar: ${error.message}`);
      setSaving(false);
      return;
    }

    toast.success("Evento agendado.");
    if (created) {
      onCreated?.(created);
      void syncEventAction(created.id);
    }
    setSaving(false);
    setOpen(false);
    reset();
    router.refresh();
  };

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => { if (nextOpen) setDate(initialDate ?? ymdInAppTz()); setOpen(nextOpen); }}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm" className="-mr-2 text-fg-secondary">
          <Plus />
          Nuevo evento
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Nuevo evento</DialogTitle>
          <DialogDescription>Cuándo, qué y con quién.</DialogDescription>
        </DialogHeader>

        <div className="grid gap-4">
          <div className="grid grid-cols-[1fr_7rem] gap-3">
            <div className="grid gap-1.5">
              <Label htmlFor="event-date">Día</Label>
              <Input
                id="event-date"
                type="date"
                value={date}
                min={ymdInAppTz()}
                onChange={(e) => setDate(e.target.value)}
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="event-time">Hora</Label>
              <Input
                id="event-time"
                type="time"
                step={900}
                value={time}
                onChange={(e) => setTime(e.target.value)}
              />
            </div>
          </div>

          <div className="grid gap-1.5">
            <Label>Tipo</Label>
            <Select value={type} onValueChange={(v) => setType(v as EventType)}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {EVENT_TYPES.map((t) => (
                  <SelectItem key={t.value} value={t.value}>
                    {t.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-1.5">
            <Label htmlFor="event-who">Con quién</Label>
            <Input
              id="event-who"
              placeholder="Ej.: Juan Pérez · Casa 3 dorm."
              value={who}
              onChange={(e) => setWho(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSave()}
              autoFocus
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={saving}>
            Cancelar
          </Button>
          <Button onClick={handleSave} disabled={!canSave}>
            {saving && <Loader2 className="animate-spin" />}
            Guardar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
