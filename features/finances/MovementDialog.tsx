"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import { Label } from "@/shared/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/shared/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/components/ui/select";
import { DatePicker } from "@/shared/components/ui/date-picker";
import { Combobox } from "@/shared/components/ui/combobox";
import { Checkbox } from "@/shared/components/ui/checkbox";
import { cn } from "@/lib/utils";
import { createMovementAction } from "./actions";
import { CATEGORIES, categoriesFor, defaultNature, type Category, type Direction, type Nature } from "./logic";

export type PropertyOption = { id: string; title: string; city?: string | null };

export type MovementDraft = {
  category?: Category;
  description?: string;
  property_id?: string | null;
  occurred_on?: string;
};

// Alta de un movimiento. `draft` precarga campos (ej. registrar la
// comisión de una venta desde la lista de ventas sin registrar).
export function MovementDialog({
  open,
  onOpenChange,
  properties,
  today,
  draft,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  properties: PropertyOption[];
  today: string;
  draft?: MovementDraft;
}) {
  const router = useRouter();
  const initialCategory = draft?.category ?? "SUELDOS";
  const [direction, setDirection] = useState<Direction>(CATEGORIES[initialCategory].direction);
  const [category, setCategory] = useState<Category>(initialCategory);
  const [occurredOn, setOccurredOn] = useState(draft?.occurred_on ?? today);
  const [description, setDescription] = useState(draft?.description ?? "");
  const [amount, setAmount] = useState("");
  const [currency, setCurrency] = useState<"ARS" | "USD">("ARS");
  const [propertyId, setPropertyId] = useState<string | null>(draft?.property_id ?? null);
  const [nature, setNature] = useState<Nature>(defaultNature(initialCategory));
  const [recurring, setRecurring] = useState(defaultNature(initialCategory) === "FIJO");
  const [busy, setBusy] = useState(false);
  const isExpense = direction === "EGRESO";
  const isRecurring = isExpense && nature === "FIJO" && recurring;

  // La categoría sugiere fijo/variable (sueldos → fijo, comisiones →
  // variable); el usuario puede cambiarlo después.
  const pickCategory = (next: Category) => {
    setCategory(next);
    setNature(defaultNature(next));
    setRecurring(defaultNature(next) === "FIJO");
  };

  const switchDirection = (next: Direction) => {
    setDirection(next);
    pickCategory(categoriesFor(next)[0]);
  };

  const save = async () => {
    setBusy(true);
    const res = await createMovementAction({
      occurred_on: occurredOn,
      category,
      description,
      amount: Number(amount),
      currency,
      property_id: propertyId,
      nature: isExpense ? nature : null,
      recurring: isRecurring,
    });
    setBusy(false);
    if (res.success) {
      toast.success(res.message);
      onOpenChange(false);
      router.refresh();
    } else toast.error(res.message);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{isRecurring ? "Nuevo gasto fijo" : "Nuevo movimiento"}</DialogTitle>
          <DialogDescription>Ingresos y egresos del negocio, no del propietario.</DialogDescription>
        </DialogHeader>

        <div className="grid min-w-0 gap-4">
          {/* Propiedad primero: el combobox necesita espacio hacia abajo
              para mostrar resultados sin chocar con el borde del modal. */}
          <div className="grid gap-2">
            <Label htmlFor="mv-property">Propiedad (opcional)</Label>
            <Combobox
              id="mv-property"
              value={propertyId}
              onChange={setPropertyId}
              options={properties.map((p) => ({ value: p.id, label: p.title, hint: p.city ?? undefined }))}
              placeholder="Sin propiedad"
              searchPlaceholder="Buscar por título o ciudad…"
              clearLabel="Sin propiedad"
            />
          </div>

          <Segmented
            label="Tipo"
            value={direction}
            onChange={switchDirection}
            options={[{ value: "EGRESO", label: "Egreso" }, { value: "INGRESO", label: "Ingreso" }]}
          />
          {!isExpense && (
            <p className="-mt-2 text-xs text-fg-secondary">
              Las comisiones de alquiler y de venta se registran solas al liquidar un contrato o cerrar una venta.
            </p>
          )}

          <div className="grid gap-2">
            <Label>Categoría</Label>
            <Select value={category} onValueChange={(v) => pickCategory(v as Category)}>
              <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
              <SelectContent>
                {categoriesFor(direction).map((key) => (
                  <SelectItem key={key} value={key}>{CATEGORIES[key].label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {isExpense && (
            <div className="grid gap-2">
              <Segmented
                label="Naturaleza del gasto"
                value={nature}
                onChange={(v) => {
                  setNature(v);
                  setRecurring(v === "FIJO");
                }}
                options={[{ value: "FIJO", label: "Fijo" }, { value: "VARIABLE", label: "Variable" }]}
              />
              {nature === "FIJO" && (
                <label className="flex items-center gap-2 text-sm text-fg-secondary">
                  <Checkbox checked={recurring} onCheckedChange={(v) => setRecurring(v === true)} />
                  Repetir todos los meses con el mismo monto
                </label>
              )}
            </div>
          )}

          <div className="grid gap-2">
            <Label htmlFor="mv-description">Descripción</Label>
            <Input
              id="mv-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={isRecurring ? "Ej: Alquiler oficina" : "Ej: Publicidad en portal, octubre"}
            />
          </div>

          <div className="grid grid-cols-[minmax(0,1fr)_96px] gap-3">
            <div className="grid min-w-0 gap-2">
              <Label htmlFor="mv-amount">Monto</Label>
              <Input
                id="mv-amount"
                type="number"
                inputMode="decimal"
                min="0"
                step="0.01"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="min-w-0"
              />
            </div>
            <div className="grid min-w-0 gap-2">
              <Label>Moneda</Label>
              <Select value={currency} onValueChange={(v) => setCurrency(v as "ARS" | "USD")}>
                {/* min-w-0: el trigger trae min-w-[120px] y desbordaba la columna */}
                <SelectTrigger className="w-full min-w-0"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="ARS">ARS</SelectItem>
                  <SelectItem value="USD">USD</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="mv-date">{isRecurring ? "Primer mes" : "Fecha"}</Label>
            <DatePicker id="mv-date" value={occurredOn} onChange={setOccurredOn} />
            {isRecurring && (
              <p className="text-xs text-fg-secondary">
                Se registra el día {Math.min(28, Number(occurredOn.slice(8, 10)) || 1)} de cada mes. Se pausa o edita desde Gastos fijos.
              </p>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={save} disabled={busy || !amount || Number(amount) <= 0 || description.trim().length < 2 || !occurredOn}>
            {busy ? <Loader2 className="size-4 animate-spin" /> : "Guardar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// Control segmentado (2 opciones) con semántica de radiogroup.
function Segmented<T extends string>({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: T;
  onChange: (value: T) => void;
  options: { value: T; label: string }[];
}) {
  return (
    <div className="grid grid-cols-2 rounded-md border border-border bg-sunken p-0.5" role="radiogroup" aria-label={label}>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={value === o.value}
          onClick={() => onChange(o.value)}
          className={cn(
            "rounded-[5px] py-1.5 text-sm font-medium transition-colors",
            value === o.value ? "bg-card text-foreground shadow-xs" : "text-fg-secondary hover:text-foreground",
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
