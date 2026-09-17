"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Trash2, Loader2 } from "lucide-react";
import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import { Label } from "@/shared/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/shared/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/components/ui/select";
import { deleteIndexValueAction, upsertIndexValueAction } from "@/features/rentals/actions";
import { formatPeriod } from "@/features/rentals/logic";

export type IndexValueRow = { id: string; index_code: string; period: string; value: number };

// E4.2 — Carga manual de índices (ICL BCRA / IPC INDEC). Solo admin
// (RLS). Un valor por mes; el ajuste usa el cociente entre el mes de
// ajuste y el mes base del contrato.
export function IndexValues({ initial }: { initial: IndexValueRow[] }) {
  const router = useRouter();
  const [code, setCode] = useState<"ICL" | "IPC">("ICL");
  const [period, setPeriod] = useState(new Date().toISOString().slice(0, 7));
  const [value, setValue] = useState("");
  const [busy, setBusy] = useState(false);

  const save = async () => {
    setBusy(true);
    const res = await upsertIndexValueAction({ index_code: code, period, value: Number(value) });
    setBusy(false);
    if (res.success) {
      toast.success(res.message);
      setValue("");
      router.refresh();
    } else toast.error(res.message);
  };

  const remove = async (id: string) => {
    const res = await deleteIndexValueAction(id);
    if (res.success) router.refresh();
    else toast.error(res.message);
  };

  const grouped = ["ICL", "IPC"].map((c) => ({
    code: c,
    rows: initial.filter((r) => r.index_code === c).sort((a, b) => b.period.localeCompare(a.period)),
  }));

  return (
    <Card>
      <CardHeader>
        <CardTitle>Índices de ajuste (ICL / IPC)</CardTitle>
        <CardDescription>
          Cargá el valor mensual publicado. ICL: valor del BCRA al primer día del mes.
          IPC: nivel general del INDEC (número índice). Los contratos ajustan por el
          cociente entre el mes de ajuste y su mes base.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-[120px_1fr_1fr_auto] gap-3 items-end">
          <div className="space-y-2">
            <Label>Índice</Label>
            <Select value={code} onValueChange={(v) => setCode(v as "ICL" | "IPC")}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ICL">ICL</SelectItem>
                <SelectItem value="IPC">IPC</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Mes</Label>
            <Input type="month" value={period} onChange={(e) => setPeriod(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Valor</Label>
            <Input
              type="number"
              step="0.000001"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder={code === "ICL" ? "Ej: 12.34" : "Ej: 8123.45"}
            />
          </div>
          <Button onClick={save} disabled={busy || !value || !period}>
            {busy ? <Loader2 className="size-4 animate-spin" /> : "Guardar"}
          </Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {grouped.map((g) => (
            <div key={g.code} className="rounded-md border border-border">
              <div className="px-3 py-2 border-b border-border text-sm font-medium">{g.code}</div>
              {g.rows.length === 0 ? (
                <p className="px-3 py-3 text-sm text-muted-foreground">Sin valores cargados.</p>
              ) : (
                <ul className="divide-y divide-border text-sm max-h-64 overflow-y-auto">
                  {g.rows.map((r) => (
                    <li key={r.id} className="flex items-center justify-between px-3 py-1.5">
                      <span className="capitalize">{formatPeriod(r.period)}</span>
                      <span className="flex items-center gap-2 tabular-nums">
                        {r.value.toLocaleString("es-AR", { maximumFractionDigits: 6 })}
                        <button
                          type="button"
                          onClick={() => remove(r.id)}
                          className="text-muted-foreground hover:text-danger"
                          aria-label="Eliminar"
                        >
                          <Trash2 className="size-3.5" />
                        </button>
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
