"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Check, Flag, Loader2, Pencil } from "lucide-react";
import { Button } from "@/shared/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/components/ui/card";
import { Input } from "@/shared/components/ui/input";
import { cn } from "@/lib/utils";
import { addDays, ymdInAppTz } from "@/lib/dates";
import { formatDate } from "@/features/rentals/logic";
import { DUE_PRESETS, NEXT_ACTION_PRESETS, nextActionState } from "@/features/dashboard/leads/followUp";
import { completeNextActionAction, setNextActionAction } from "@/features/dashboard/leads/followUpActions";

const STATE_STYLE = {
  vencido: "text-danger",
  hoy: "text-warning",
  pendiente: "text-muted-foreground",
  sin_definir: "text-muted-foreground",
} as const;

// Próximo paso del lead: qué hacer y cuándo. Un lead abierto sin próximo
// paso es un lead que se olvida; la bandeja Hoy se arma con esto.
export function NextActionCard({ leadId, action, at, closed }: {
  leadId: string; action: string | null; at: string | null; closed: boolean;
}) {
  const router = useRouter();
  const today = ymdInAppTz();
  const [editing, setEditing] = useState(!action && !closed);
  const [text, setText] = useState(action ?? "");
  const [due, setDue] = useState(at ?? addDays(today, 1));
  const [busy, setBusy] = useState<"save" | "done" | null>(null);
  const state = nextActionState(at, today);

  const save = async () => {
    setBusy("save");
    const res = await setNextActionAction({ lead_id: leadId, action: text, at: due });
    setBusy(null);
    if (!res.success) { toast.error(res.message); return; }
    toast.success(res.message);
    setEditing(false);
    router.refresh();
  };

  const done = async () => {
    setBusy("done");
    const res = await completeNextActionAction({ lead_id: leadId });
    setBusy(null);
    if (!res.success) { toast.error(res.message); return; }
    toast.success(res.message);
    setText(""); setDue(addDays(today, 1)); setEditing(true);
    router.refresh();
  };

  return (
    <Card className={cn(state === "vencido" && !closed && "border-danger/50")}>
      <CardHeader className="flex flex-row items-center justify-between gap-2 pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Flag className="size-4 text-muted-foreground" aria-hidden /> Próximo paso
        </CardTitle>
        {action && !editing && (
          <Button size="icon" variant="ghost" className="size-7" aria-label="Editar próximo paso"
            onClick={() => { setText(action); setDue(at ?? addDays(today, 1)); setEditing(true); }}>
            <Pencil className="size-3.5" />
          </Button>
        )}
      </CardHeader>
      <CardContent className="space-y-3">
        {!editing ? (
          action ? (
            <div className="space-y-3">
              <div>
                <p className="text-sm font-medium">{action}</p>
                <p className={cn("text-xs", STATE_STYLE[state])}>
                  {state === "vencido" ? `Vencido desde el ${formatDate(at)}` : state === "hoy" ? "Para hoy" : `Para el ${formatDate(at)}`}
                </p>
              </div>
              <Button size="sm" variant="outline" disabled={!!busy} onClick={done}>
                {busy === "done" ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />} Hecho
              </Button>
            </div>
          ) : (
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">{closed ? "Lead cerrado." : "Sin próximo paso definido."}</p>
              {!closed && <Button size="sm" variant="outline" onClick={() => setEditing(true)}>Definir</Button>}
            </div>
          )
        ) : (
          <div className="space-y-3">
            <Input value={text} onChange={(e) => setText(e.target.value)} placeholder="Qué hay que hacer" aria-label="Próximo paso" maxLength={200} />
            <div className="flex flex-wrap gap-1.5">
              {NEXT_ACTION_PRESETS.map((p) => (
                <button key={p} type="button" onClick={() => setText(p)}
                  className="rounded-md border border-border px-2 py-0.5 text-xs text-muted-foreground hover:bg-muted hover:text-foreground">
                  {p}
                </button>
              ))}
            </div>
            <div className="flex flex-wrap items-center gap-1.5">
              {DUE_PRESETS.map((p) => {
                const value = addDays(today, p.days);
                return (
                  <button key={p.label} type="button" onClick={() => setDue(value)} aria-pressed={due === value}
                    className={cn("rounded-md px-2 py-1 text-xs font-medium",
                      due === value ? "bg-muted text-foreground" : "text-muted-foreground hover:text-foreground")}>
                    {p.label}
                  </button>
                );
              })}
              <Input type="date" min={today} value={due} onChange={(e) => setDue(e.target.value)} className="h-8 w-auto text-xs" aria-label="Fecha del próximo paso" />
            </div>
            <div className="flex justify-end gap-2">
              {action && <Button size="sm" variant="ghost" onClick={() => setEditing(false)}>Cancelar</Button>}
              <Button size="sm" disabled={!!busy || text.trim().length < 2 || !due} onClick={save}>
                {busy === "save" && <Loader2 className="size-4 animate-spin" />} Guardar
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
