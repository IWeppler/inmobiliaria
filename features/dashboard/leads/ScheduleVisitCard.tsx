"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { format, startOfDay } from "date-fns";
import { es } from "date-fns/locale";
import { CalendarClock } from "lucide-react";
import { toast } from "sonner";
import { createClientBrowser } from "@/lib/supabase-browser";
import type { LeadWithDetails } from "@/app/types";
import { normalizeStatus } from "@/features/dashboard/leads/leadStatus";
import { Button } from "@/shared/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/shared/components/ui/card";
import { Input } from "@/shared/components/ui/input";
import { Label } from "@/shared/components/ui/label";
import { Separator } from "@/shared/components/ui/separator";

type Props = {
  lead: LeadWithDetails;
  currentUserId: string;
};

// Visitas agendadas para este lead (events.type = 'visita', E0.2).
type VisitEvent = { id: string; date: string; time: string };

// Crea un evento de calendario vinculado al lead (lead_id / property_id /
// type = 'visita') y, si el lead estaba en NUEVO o CONTACTADO, lo pasa a
// VISITA PROGRAMADA. El vínculo es lo que permite "visitas de hoy" en el
// dashboard (E1.4) y la etapa "Visita" del funnel (E1.5).
export function ScheduleVisitCard({ lead, currentUserId }: Props) {
  const supabase = createClientBrowser();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [date, setDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [time, setTime] = useState("10:00");
  const [visits, setVisits] = useState<VisitEvent[]>([]);

  const loadVisits = async () => {
    const { data } = await supabase
      .from("events")
      .select("id, date, time")
      .eq("lead_id", lead.id)
      .eq("type", "visita")
      .gte("date", startOfDay(new Date()).toISOString())
      .order("date", { ascending: true })
      .order("time", { ascending: true });
    setVisits(data ?? []);
  };

  useEffect(() => {
    void loadVisits();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lead.id]);

  const handleSave = async () => {
    if (!date || !time) return;
    setSaving(true);

    const eventDate = startOfDay(new Date(`${date}T00:00:00`)).toISOString();
    const { data, error } = await supabase
      .from("events")
      .insert({
        date: eventDate,
        time,
        title: `Visita: ${lead.name}${
          lead.properties?.title ? ` · ${lead.properties.title}` : ""
        }`,
        type: "visita",
        lead_id: lead.id,
        property_id: lead.property_id,
        agent_id: currentUserId,
      })
      .select("id, date, time")
      .single();

    if (error || !data) {
      toast.error(`Error al agendar: ${error?.message ?? "desconocido"}`);
      setSaving(false);
      return;
    }

    const current = normalizeStatus(lead.status);
    if (current === "NUEVO" || current === "CONTACTADO") {
      const { error: statusError } = await supabase
        .from("leads")
        .update({ status: "VISITA PROGRAMADA" })
        .eq("id", lead.id);
      if (statusError) {
        toast.error(`Visita creada, pero no se pudo actualizar el estado.`);
      }
    }

    toast.success("Visita agendada.");
    setVisits((prev) => [...prev, data]);
    setOpen(false);
    setSaving(false);
    router.refresh();
  };

  return (
    <Card className="shadow-none border-border rounded-md">
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-serif font-semibold text-foreground flex items-center gap-2">
          <CalendarClock className="h-4 w-4 text-muted-foreground" />
          Visitas
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        <div className="flex items-center justify-between gap-2">
          <div className="text-sm">
            {visits.length === 0 ? (
              <span className="text-muted-foreground italic">
                Sin visitas próximas
              </span>
            ) : (
              <ul className="space-y-1">
                {visits.map((v) => (
                  <li key={v.id} className="font-medium">
                    {format(new Date(v.date), "EEE d MMM", { locale: es })} ·{" "}
                    {v.time}
                  </li>
                ))}
              </ul>
            )}
          </div>
          <Button
            variant="outline"
            size="sm"
            className="h-8 text-xs shrink-0"
            onClick={() => setOpen((p) => !p)}
          >
            <CalendarClock className="mr-2 h-3 w-3" />
            {open ? "Cerrar" : "Agendar"}
          </Button>
        </div>

        {open && (
          <div className="pt-4 space-y-4 animate-in slide-in-from-top-2 duration-200">
            <Separator />
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label className="text-sm">Fecha</Label>
                <Input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label className="text-sm">Hora</Label>
                <Input
                  type="time"
                  step={900}
                  value={time}
                  onChange={(e) => setTime(e.target.value)}
                />
              </div>
            </div>
            <div className="flex justify-end">
              <Button
                onClick={handleSave}
                disabled={saving}
                className="h-10 cursor-pointer"
              >
                {saving ? "Guardando..." : "Agendar visita"}
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
