"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { format, startOfDay, subDays } from "date-fns";
import { es } from "date-fns/locale";
import { CalendarClock, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { createClientBrowser } from "@/lib/supabase-browser";
import { addDays, APP_TZ, ymdInAppTz } from "@/lib/dates";
import type { LeadWithDetails } from "@/app/types";
import { isTerminal, normalizeStatus } from "@/features/dashboard/leads/leadStatus";
import {
  OUTCOME_LABELS, OUTCOME_NEXT_STEP, OUTCOME_TONE, type VisitOutcome,
} from "@/features/dashboard/leads/followUp";
import { recordVisitOutcomeAction } from "@/features/dashboard/leads/followUpActions";
import { Button } from "@/shared/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/components/ui/card";
import { Input } from "@/shared/components/ui/input";
import { Label } from "@/shared/components/ui/label";
import { Separator } from "@/shared/components/ui/separator";
import { StatusBadge } from "@/shared/components/StatusBadge";
import { cn } from "@/lib/utils";
import { syncEventAction } from "@/features/dashboard/google-calendar/actions";

type Props = {
  lead: LeadWithDetails;
  currentUserId: string;
};

// Visitas del lead (events.type = 'visita', E0.2): las próximas, y las que
// ya pasaron con su resultado (o el pedido de cargarlo).
type VisitEvent = { id: string; date: string; time: string; outcome: string | null; outcome_note: string | null };

const OUTCOMES = Object.keys(OUTCOME_LABELS) as VisitOutcome[];

// Agendar crea un evento vinculado al lead (lead_id / property_id / type =
// 'visita') y, si el lead estaba en NUEVO o CONTACTADO, lo pasa a VISITA
// PROGRAMADA. El vínculo alimenta "visitas de hoy", el funnel y la bandeja.
export function ScheduleVisitCard({ lead, currentUserId }: Props) {
  const supabase = createClientBrowser();
  const router = useRouter();
  const today = ymdInAppTz();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [date, setDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [time, setTime] = useState("10:00");
  const [visits, setVisits] = useState<VisitEvent[]>([]);

  const loadVisits = async () => {
    const { data } = await supabase
      .from("events")
      .select("id, date, time, outcome, outcome_note")
      .eq("lead_id", lead.id)
      .eq("type", "visita")
      .gte("date", startOfDay(subDays(new Date(), 90)).toISOString())
      .order("date", { ascending: true })
      .order("time", { ascending: true });
    setVisits(data ?? []);
  };

  useEffect(() => {
    void loadVisits();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lead.id]);

  const dayOf = (v: VisitEvent) => ymdInAppTz(new Date(v.date));
  // Una visita de hoy cuenta como pasada recién después de su hora.
  const nowTime = new Intl.DateTimeFormat("en-GB", { timeZone: APP_TZ, hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(new Date());
  const isPast = (v: VisitEvent) => dayOf(v) < today || (dayOf(v) === today && v.time <= nowTime);
  const upcoming = visits.filter((v) => !isPast(v) && !v.outcome);
  const pendingOutcome = visits.filter((v) => isPast(v) && !v.outcome);
  const done = visits.filter((v) => v.outcome).slice(-3).reverse();

  const handleSave = async () => {
    if (!date || !time) return;
    setSaving(true);

    const eventDate = startOfDay(new Date(`${date}T00:00:00`)).toISOString();
    const { data, error } = await supabase
      .from("events")
      .insert({
        date: eventDate,
        time,
        title: `Visita: ${lead.name}${lead.properties?.title ? ` · ${lead.properties.title}` : ""}`,
        type: "visita",
        lead_id: lead.id,
        property_id: lead.property_id,
        agent_id: currentUserId,
      })
      .select("id, date, time, outcome, outcome_note")
      .single();

    if (error || !data) {
      toast.error(`Error al agendar: ${error?.message ?? "desconocido"}`);
      setSaving(false);
      return;
    }
    void syncEventAction(data.id);

    const current = normalizeStatus(lead.status);
    if (current === "NUEVO" || current === "CONTACTADO") {
      const { error: statusError } = await supabase
        .from("leads")
        .update({ status: "VISITA PROGRAMADA" })
        .eq("id", lead.id);
      if (statusError) toast.error("Visita creada, pero no se pudo actualizar el estado.");
    }

    toast.success("Visita agendada.");
    setVisits((prev) => [...prev, data]);
    setOpen(false);
    setSaving(false);
    router.refresh();
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-semibold text-foreground flex items-center gap-2">
          <CalendarClock className="h-4 w-4 text-muted-foreground" />
          Visitas
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {pendingOutcome.map((v) => (
          <OutcomeForm key={v.id} visit={v} today={today} suggestNext={!isTerminal(lead.status)}
            onSaved={() => { void loadVisits(); router.refresh(); }} />
        ))}

        <div className="flex items-center justify-between gap-2">
          <div className="text-sm">
            {upcoming.length === 0 ? (
              <span className="text-muted-foreground italic">Sin visitas próximas</span>
            ) : (
              <ul className="space-y-1">
                {upcoming.map((v) => (
                  <li key={v.id} className="font-medium">
                    {format(new Date(v.date), "EEE d MMM", { locale: es })} · {v.time}
                  </li>
                ))}
              </ul>
            )}
          </div>
          <Button variant="outline" size="sm" className="h-8 text-xs shrink-0" onClick={() => setOpen((p) => !p)}>
            <CalendarClock className="mr-2 h-3 w-3" />
            {open ? "Cerrar" : "Agendar"}
          </Button>
        </div>

        {open && (
          <div className="pt-1 space-y-4 animate-in slide-in-from-top-2 duration-200">
            <Separator />
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label className="text-sm">Fecha</Label>
                <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label className="text-sm">Hora</Label>
                <Input type="time" step={900} value={time} onChange={(e) => setTime(e.target.value)} />
              </div>
            </div>
            <div className="flex justify-end">
              <Button onClick={handleSave} disabled={saving} className="h-10 cursor-pointer">
                {saving ? "Guardando..." : "Agendar visita"}
              </Button>
            </div>
          </div>
        )}

        {done.length > 0 && (
          <ul className="space-y-1.5 border-t border-border-subtle pt-3 text-sm">
            {done.map((v) => (
              <li key={v.id} className="flex flex-wrap items-center gap-2">
                <span className="text-muted-foreground">{format(new Date(v.date), "d MMM", { locale: es })}</span>
                <StatusBadge tone={OUTCOME_TONE[v.outcome as VisitOutcome] ?? "neutral"}>{OUTCOME_LABELS[v.outcome as VisitOutcome] ?? v.outcome}</StatusBadge>
                {v.outcome_note && <span className="w-full text-xs text-muted-foreground">{v.outcome_note}</span>}
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

// "¿Cómo fue?": un clic para el resultado, comentario opcional y próximo
// paso sugerido según cómo salió.
function OutcomeForm({ visit, today, suggestNext, onSaved }: { visit: VisitEvent; today: string; suggestNext: boolean; onSaved: () => void }) {
  const [outcome, setOutcome] = useState<VisitOutcome | null>(null);
  const [note, setNote] = useState("");
  const [useNext, setUseNext] = useState(true);
  const [busy, setBusy] = useState(false);
  // Lead cerrado o descartado: se registra el resultado, sin próximo paso.
  const suggestion = outcome && suggestNext ? OUTCOME_NEXT_STEP[outcome] : null;

  const save = async () => {
    if (!outcome) return;
    setBusy(true);
    const res = await recordVisitOutcomeAction({
      event_id: visit.id, outcome, note: note || undefined,
      next: suggestion && useNext ? { action: suggestion.action, at: addDays(today, suggestion.inDays) } : undefined,
    });
    setBusy(false);
    if (!res.success) { toast.error(res.message); return; }
    toast.success(res.message);
    onSaved();
  };

  return (
    <div className="space-y-2.5 rounded-md border border-warning/40 bg-warning/5 p-3">
      <p className="text-sm font-medium">
        ¿Cómo fue la visita del {format(new Date(visit.date), "EEE d MMM", { locale: es })}?
      </p>
      <div className="flex flex-wrap gap-1.5">
        {OUTCOMES.map((o) => (
          <button key={o} type="button" onClick={() => setOutcome(o)} aria-pressed={outcome === o}
            className={cn("rounded-md border px-2 py-1 text-xs font-medium transition-colors",
              outcome === o ? "border-primary bg-primary/10 text-foreground" : "border-border text-muted-foreground hover:text-foreground")}>
            {OUTCOME_LABELS[o]}
          </button>
        ))}
      </div>
      {outcome && (
        <>
          <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Comentario (opcional): qué dijo, qué objetó" maxLength={500} aria-label="Comentario de la visita" />
          {suggestion && (
            <label className="flex items-start gap-2 text-xs text-muted-foreground">
              <input type="checkbox" checked={useNext} onChange={(e) => setUseNext(e.target.checked)} className="mt-0.5" />
              Próximo paso: {suggestion.action} ({suggestion.inDays === 1 ? "mañana" : `en ${suggestion.inDays} días`})
            </label>
          )}
          <div className="flex justify-end">
            <Button size="sm" disabled={busy} onClick={save}>{busy && <Loader2 className="size-4 animate-spin" />} Guardar</Button>
          </div>
        </>
      )}
    </div>
  );
}
