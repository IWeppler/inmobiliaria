"use client";

import { useId, useState } from "react";
import { Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { addDays } from "@/lib/dates";
import { Button } from "@/shared/components/ui/button";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/shared/components/ui/dialog";
import { Input } from "@/shared/components/ui/input";
import { Label } from "@/shared/components/ui/label";
import { Textarea } from "@/shared/components/ui/textarea";
import { DatePicker } from "@/shared/components/ui/date-picker";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/shared/components/ui/select";
import { useRunAction } from "@/features/rentals/useRunAction";
import { createTaskAction } from "@/features/tasks/actions";
import { PRIORITY_LABELS, roleLabel, type TaskPriority } from "@/features/tasks/rules";

export type TaskAssignee = { id: string; full_name: string | null; role: string | null };
export type TaskEntity = { property_id?: string; lead_id?: string; contract_id?: string; label?: string };

const DUE_PRESETS = [
  { label: "Hoy", days: 0 },
  { label: "Mañana", days: 1 },
  { label: "En una semana", days: 7 },
];

// Alta de una tarea manual, asignable a cualquier usuario (agente, admin o
// administración). Con entidad, queda colgada de esa propiedad, lead o
// contrato y aparece en su ficha.
export function NewTaskDialog({
  agents, currentUserId, today, entity, trigger = "button",
}: {
  agents: TaskAssignee[];
  currentUserId: string;
  today: string;
  entity?: TaskEntity;
  trigger?: "button" | "icon";
}) {
  const { busy, run } = useRunAction();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [assignee, setAssignee] = useState(currentUserId);
  const [due, setDue] = useState(today);
  const [priority, setPriority] = useState<TaskPriority>("media");
  const [notes, setNotes] = useState("");
  const id = useId();

  const reset = () => {
    setTitle(""); setAssignee(currentUserId); setDue(today); setPriority("media"); setNotes("");
  };

  const submit = async () => {
    const ok = await run("create-task", () => createTaskAction({
      title, notes: notes || undefined, assignee_id: assignee, due_date: due || null, priority,
      property_id: entity?.property_id, lead_id: entity?.lead_id, contract_id: entity?.contract_id,
    }));
    if (ok) { setOpen(false); reset(); }
  };

  return (
    <>
      {trigger === "icon" ? (
        <Button type="button" size="icon" variant="ghost" className="size-7" aria-label="Nueva tarea" onClick={() => setOpen(true)}>
          <Plus className="size-4" />
        </Button>
      ) : (
        <Button type="button" variant="outline" onClick={() => setOpen(true)}><Plus /> Nueva tarea</Button>
      )}
      <Dialog open={open} onOpenChange={(next) => { setOpen(next); if (!next) reset(); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Nueva tarea</DialogTitle>
            <DialogDescription>
              {entity?.label ? `Para ${entity.label}. ` : ""}Le aparece a quien la asignes en su bandeja Hoy.
            </DialogDescription>
          </DialogHeader>
          <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); void submit(); }}>
            <div className="space-y-1.5">
              <Label htmlFor={`${id}-title`}>Qué hay que hacer</Label>
              <Input id={`${id}-title`} value={title} onChange={(e) => setTitle(e.target.value.slice(0, 200))}
                placeholder="Ej.: Pedir la boleta de ABL al propietario" autoFocus />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor={`${id}-assignee`}>Responsable</Label>
                <Select value={assignee} onValueChange={setAssignee}>
                  <SelectTrigger id={`${id}-assignee`} className="w-full"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {agents.map((a) => (
                      <SelectItem key={a.id} value={a.id}>
                        {a.id === currentUserId ? "Yo" : a.full_name ?? "Sin nombre"}
                        <span className="text-muted-foreground"> · {roleLabel(a.role)}</span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor={`${id}-due`}>Vence</Label>
                <DatePicker id={`${id}-due`} value={due} onChange={setDue} className="w-full" />
              </div>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {DUE_PRESETS.map((p) => {
                const value = addDays(today, p.days);
                return (
                  <button key={p.label} type="button" onClick={() => setDue(value)} aria-pressed={due === value}
                    className={cn("rounded-md border px-2.5 py-1 text-xs transition-colors",
                      due === value ? "border-primary bg-primary/5 font-medium" : "border-border text-muted-foreground hover:bg-muted")}>
                    {p.label}
                  </button>
                );
              })}
              <button type="button" onClick={() => setDue("")} aria-pressed={!due}
                className={cn("rounded-md border px-2.5 py-1 text-xs transition-colors",
                  !due ? "border-primary bg-primary/5 font-medium" : "border-border text-muted-foreground hover:bg-muted")}>
                Sin fecha
              </button>
            </div>

            <fieldset className="space-y-1.5">
              <legend className="text-sm font-medium">Prioridad</legend>
              <div className="flex gap-1.5">
                {(["alta", "media", "baja"] as TaskPriority[]).map((p) => (
                  <label key={p} className={cn("flex flex-1 cursor-pointer items-center justify-center rounded-md border px-3 py-1.5 text-sm transition-colors",
                    priority === p ? "border-primary bg-primary/5 font-medium" : "border-border hover:bg-muted")}>
                    <input type="radio" name={`${id}-priority`} value={p} checked={priority === p} onChange={() => setPriority(p)} className="sr-only" />
                    {PRIORITY_LABELS[p]}
                  </label>
                ))}
              </div>
            </fieldset>

            <div className="space-y-1.5">
              <Label htmlFor={`${id}-notes`}>Nota <span className="font-normal text-muted-foreground">(opcional)</span></Label>
              <Textarea id={`${id}-notes`} rows={2} value={notes} onChange={(e) => setNotes(e.target.value.slice(0, 2000))} />
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
              <Button type="submit" disabled={title.trim().length < 2 || !!busy}>Crear tarea</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
