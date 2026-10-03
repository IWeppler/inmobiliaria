"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { createClientBrowser } from "@/lib/supabase-browser";
import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import { Label } from "@/shared/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/components/ui/select";
import { SOURCE_LABELS } from "./reportMetrics";

// Solo admin (RLS lo exige): costo mensual de una fuente para medir su
// retorno. Cargar el mismo mes de nuevo lo reemplaza; un monto vacío lo borra.
export function SourceCostForm() {
  const supabase = createClientBrowser();
  const router = useRouter();
  const [source, setSource] = useState("ZONAPROP");
  const [month, setMonth] = useState(new Date().toISOString().slice(0, 7));
  const [amount, setAmount] = useState("");
  const [currency, setCurrency] = useState("ARS");
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (!month) return;
    const value = Number(amount.replace(/\./g, "").replace(",", "."));
    setSaving(true);
    const monthStart = `${month}-01`;
    const { error } =
      amount.trim() === "" || value === 0
        ? await supabase
            .from("lead_source_costs")
            .delete()
            .eq("source", source)
            .eq("month", monthStart)
        : await supabase
            .from("lead_source_costs")
            .upsert(
              { source, month: monthStart, amount: value, currency },
              { onConflict: "source,month" },
            );
    setSaving(false);
    if (error || value < 0) {
      toast.error("No se pudo guardar el costo");
      return;
    }
    toast.success(
      amount.trim() === "" || value === 0 ? "Costo borrado" : "Costo guardado",
    );
    setAmount("");
    router.refresh();
  };

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-[1.4fr_1fr_1fr_90px_auto] sm:items-end">
        <div className="space-y-1.5">
          <Label>Fuente</Label>
          <Select value={source} onValueChange={setSource}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {SOURCE_LABELS.filter(([key]) => key !== "SIN_REGISTRAR").map(
                ([key, label]) => (
                  <SelectItem key={key} value={key}>
                    {label}
                  </SelectItem>
                ),
              )}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label>Mes</Label>
          <Input
            type="month"
            value={month}
            onChange={(e) => setMonth(e.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label>Monto</Label>
          <Input
            inputMode="decimal"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="Vacío = borrar"
          />
        </div>
        <div className="space-y-1.5">
          <Label>Moneda</Label>
          <Select value={currency} onValueChange={setCurrency}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ARS">ARS</SelectItem>
              <SelectItem value="USD">USD</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <Button
          onClick={save}
          disabled={saving}
          className="col-span-2 sm:col-span-1"
        >
          {saving ? "Guardando…" : "Guardar"}
        </Button>
      </div>
    </div>
  );
}
