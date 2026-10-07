"use client";

import { useId, useState } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/shared/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/shared/components/ui/dialog";
import { Label } from "@/shared/components/ui/label";
import { Textarea } from "@/shared/components/ui/textarea";
import {
  LOST_REASONS,
  type LostReason,
} from "@/features/dashboard/leads/lostReasons";

const NOTE_MAX = 500;

// Se abre al descartar un lead: el motivo es obligatorio para que Reportes
// pueda explicar las caídas del embudo. "Otro motivo" exige una nota.
export function LostReasonDialog({
  leadName,
  open,
  onOpenChange,
  onConfirm,
}: {
  leadName: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (reason: LostReason, note: string | null) => void;
}) {
  const [reason, setReason] = useState<LostReason | null>(null);
  const [note, setNote] = useState("");
  const noteId = useId();

  // Cada apertura arranca limpia: el motivo es de este lead, no del
  // anterior. Se ajusta durante el render al cambiar `open` (patrón de React
  // para derivar estado de una prop), sin un effect que renderice dos veces.
  const [wasOpen, setWasOpen] = useState(open);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) {
      setReason(null);
      setNote("");
    }
  }

  const noteRequired = reason === "OTRO";
  const canConfirm = !!reason && (!noteRequired || note.trim().length > 0);

  const confirm = () => {
    if (!reason || !canConfirm) return;
    onConfirm(reason, note.trim() || null);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Descartar lead</DialogTitle>
          <DialogDescription>
            ¿Por qué se pierde{leadName ? ` ${leadName}` : " este lead"}? El
            motivo se usa en Reportes para ver dónde se caen las operaciones.
          </DialogDescription>
        </DialogHeader>

        <form
          onSubmit={(event) => {
            event.preventDefault();
            confirm();
          }}
          className="space-y-4"
        >
          <fieldset className="space-y-1.5">
            <legend className="sr-only">Motivo</legend>
            {LOST_REASONS.map((option) => (
              <label
                key={option.value}
                className={cn(
                  "flex cursor-pointer items-center gap-3 rounded-md border px-3 py-2 text-sm transition-colors",
                  reason === option.value
                    ? "border-primary bg-primary/5 font-medium"
                    : "border-border hover:bg-muted",
                )}
              >
                <input
                  type="radio"
                  name="lost-reason"
                  value={option.value}
                  checked={reason === option.value}
                  onChange={() => setReason(option.value)}
                  className="size-4 accent-primary"
                />
                {option.label}
              </label>
            ))}
          </fieldset>

          <div className="space-y-1.5">
            <Label htmlFor={noteId}>
              Nota{" "}
              <span className="font-normal text-muted-foreground">
                {noteRequired ? "(obligatoria)" : "(opcional)"}
              </span>
            </Label>
            <Textarea
              id={noteId}
              value={note}
              onChange={(event) =>
                setNote(event.target.value.slice(0, NOTE_MAX))
              }
              rows={2}
              aria-required={noteRequired}
              aria-describedby={`${noteId}-help`}
            />
            <p id={`${noteId}-help`} className="text-xs text-muted-foreground">
              {noteRequired
                ? "Contá brevemente el motivo."
                : "Detalle útil para el equipo, por ejemplo con qué inmobiliaria cerró."}
            </p>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={!canConfirm}>
              Descartar lead
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
