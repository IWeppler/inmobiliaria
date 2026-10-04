"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Trash2, Loader2, RefreshCw } from "lucide-react";
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
import { StatusBadge } from "@/shared/components/StatusBadge";
import { deleteIndexValueAction, syncIndexValuesAction, upsertIndexValueAction } from "@/features/rentals/actions";
import { formatPeriodTitle } from "@/features/rentals/logic";

export type IndexValueRow = { id: string; index_code: string; period: string; value: number; source: string; updated_at: string };

const SOURCE_LABELS: Record<string, string> = { BCRA: "BCRA", INDEC: "INDEC", MANUAL: "Manual" };

// Fecha y hora en hora argentina, igual en servidor y navegador (el formato
// por defecto difiere en zona horaria y espacios y rompía la hidratación).
function syncLabel(iso: string) {
  const p = Object.fromEntries(new Intl.DateTimeFormat("es-AR", {
    timeZone: "America/Argentina/Buenos_Aires", day: "numeric", month: "numeric", year: "2-digit",
    hour: "2-digit", minute: "2-digit", hourCycle: "h23",
  }).formatToParts(new Date(iso)).map((part) => [part.type, part.value]));
  return `${p.day}/${p.month}/${p.year} ${p.hour}:${p.minute} hs`;
}
type IndexCode = "ICL" | "IPC" | "CASA_PROPIA";
const CODE_LABELS: Record<IndexCode, string> = { ICL: "ICL", IPC: "IPC", CASA_PROPIA: "Casa Propia" };

// E4.2: índices de ajuste. Se sincronizan solos todos los días desde el
// BCRA (ICL) y el INDEC (IPC); la carga manual queda para correcciones o
// para un índice que la fuente todavía no publicó. Solo admin (RLS).
export function IndexValues({ initial }: { initial: IndexValueRow[] }) {
  const router = useRouter();
  const [code, setCode] = useState<IndexCode>("ICL");
  const [period, setPeriod] = useState(new Date().toISOString().slice(0, 7));
  const [value, setValue] = useState("");
  const [busy, setBusy] = useState<"save" | "sync" | null>(null);

  const save = async () => {
    setBusy("save");
    const res = await upsertIndexValueAction({ index_code: code, period, value: Number(value) });
    setBusy(null);
    if (res.success) {
      toast.success(res.message);
      setValue("");
      router.refresh();
    } else toast.error(res.message);
  };

  const sync = async () => {
    setBusy("sync");
    try {
      const res = await syncIndexValuesAction();
      if (res.success) { toast.success(res.message); router.refresh(); }
      else toast.error(res.message);
    } catch {
      toast.error("No se pudo conectar con las fuentes oficiales.");
    } finally {
      setBusy(null);
    }
  };

  const remove = async (id: string) => {
    const res = await deleteIndexValueAction(id);
    if (res.success) router.refresh();
    else toast.error(res.message);
  };

  const grouped = (["ICL", "IPC", "CASA_PROPIA"] as const).map((c) => {
    const rows = initial.filter((r) => r.index_code === c).sort((a, b) => b.period.localeCompare(a.period));
    const official = rows.filter((r) => r.source !== "MANUAL");
    return { code: c, rows, latestOfficial: official[0]?.period ?? null };
  });
  const lastSync = initial.filter((r) => r.source !== "MANUAL").map((r) => r.updated_at).sort().at(-1);

  return (
    <Card>
      <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-3">
        <div className="space-y-1.5">
          <CardTitle>Índices de ajuste</CardTitle>
          <CardDescription className="max-w-2xl">
            Se actualizan solos todos los días: ICL del BCRA (valor del día 1 de cada mes) e IPC nivel
            general del INDEC. Casa Propia no tiene fuente automática: cargá el coeficiente de cada mes tal como lo publica el
            Ministerio de Desarrollo Territorial y Hábitat. Para ICL e IPC, la carga manual vale hasta la próxima actualización oficial.
            {lastSync && ` Última actualización: ${syncLabel(lastSync)}.`}
          </CardDescription>
        </div>
        <Button variant="outline" onClick={sync} disabled={!!busy}>
          {busy === "sync" ? <Loader2 className="size-4 animate-spin" /> : <RefreshCw className="size-4" />}
          Actualizar ahora
        </Button>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          {grouped.map((g) => (
            <div key={g.code} className="rounded-md border border-border">
              <div className="flex items-center justify-between gap-2 border-b border-border px-3 py-2 text-sm">
                <span className="font-medium">{CODE_LABELS[g.code]}</span>
                <span className="text-xs text-muted-foreground">
                  {g.code === "CASA_PROPIA" ? "Carga manual" : g.latestOfficial ? `Último oficial: ${formatPeriodTitle(g.latestOfficial)}` : "Sin datos oficiales"}
                </span>
              </div>
              {g.rows.length === 0 ? (
                <p className="px-3 py-3 text-sm text-muted-foreground">Sin valores. Tocá &ldquo;Actualizar ahora&rdquo;.</p>
              ) : (
                <ul className="divide-y divide-border text-sm max-h-64 overflow-y-auto">
                  {g.rows.map((r) => (
                    <li key={r.id} className="flex items-center justify-between gap-2 px-3 py-1.5">
                      <span>{formatPeriodTitle(r.period)}</span>
                      <span className="flex items-center gap-2 tabular-nums">
                        <StatusBadge tone={r.source === "MANUAL" ? "warning" : "neutral"}>{SOURCE_LABELS[r.source] ?? r.source}</StatusBadge>
                        {r.value.toLocaleString("es-AR", { maximumFractionDigits: 6 })}
                        <button
                          type="button"
                          onClick={() => remove(r.id)}
                          className="text-muted-foreground hover:text-danger"
                          aria-label={`Eliminar ${CODE_LABELS[g.code]} de ${formatPeriodTitle(r.period)}`}
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

        <details className="rounded-md border border-border px-3 py-2 text-sm">
          <summary className="cursor-pointer font-medium">Cargar o corregir un valor a mano</summary>
          <div className="mt-3 grid grid-cols-1 items-end gap-3 sm:grid-cols-[120px_1fr_1fr_auto]">
            <div className="space-y-2">
              <Label>Índice</Label>
              <Select value={code} onValueChange={(v) => setCode(v as IndexCode)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="ICL">ICL</SelectItem>
                  <SelectItem value="IPC">IPC</SelectItem>
                  <SelectItem value="CASA_PROPIA">Casa Propia</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="index-period">Mes</Label>
              <Input id="index-period" type="month" value={period} onChange={(e) => setPeriod(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="index-value">Valor</Label>
              <Input
                id="index-value"
                type="number"
                step="0.000001"
                value={value}
                onChange={(e) => setValue(e.target.value)}
                placeholder={code === "ICL" ? "Ej: 36.54" : code === "IPC" ? "Ej: 12276.77" : "Ej: 1.0521"}
              />
            </div>
            <Button onClick={save} disabled={!!busy || !value || !period}>
              {busy === "save" ? <Loader2 className="size-4 animate-spin" /> : "Guardar"}
            </Button>
          </div>
        </details>
      </CardContent>
    </Card>
  );
}
