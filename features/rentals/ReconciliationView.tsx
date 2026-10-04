"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { CheckCircle2, FileSpreadsheet, Loader2, RotateCcw, Upload } from "lucide-react";
import { Button } from "@/shared/components/ui/button";
import { Checkbox } from "@/shared/components/ui/checkbox";
import { Input } from "@/shared/components/ui/input";
import { Label } from "@/shared/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/shared/components/ui/select";
import { StatusBadge, type StatusTone } from "@/shared/components/StatusBadge";
import { cn } from "@/lib/utils";
import { formatDate, money } from "@/features/rentals/logic";
import {
  allocate, detectColumns, extractMovements, movementHashes, suggestContract,
  type BankMovement, type Cell, type ColumnMap, type ContractCandidate, type Suggestion,
} from "@/features/rentals/reconciliation";
import {
  confirmReconciliationAction, ignoreMovementsAction, knownMovementsAction,
} from "@/features/rentals/reconciliationActions";

type Row = BankMovement & { hash: string; suggestion: Suggestion | null; contractId: string; selected: boolean };

const NONE = "none";
const ACCOUNT_KEY = "terranova:conciliacion:cuenta";
const CONFIDENCE_TONE: Record<Suggestion["confidence"], StatusTone> = { alta: "success", media: "warning", baja: "neutral" };

// CSV con ; o , y comillas. Devuelve celdas como texto.
function parseCsv(text: string): Cell[][] {
  const source = text.replace(/^﻿/, "");
  const firstLine = source.slice(0, source.indexOf("\n") < 0 ? undefined : source.indexOf("\n"));
  const delimiter = [";", ",", "\t"].sort((a, b) => firstLine.split(b).length - firstLine.split(a).length)[0];
  const rows: Cell[][] = [];
  let row: Cell[] = [];
  let cell = "";
  let quoted = false;
  for (let i = 0; i < source.length; i++) {
    const char = source[i];
    if (char === '"') {
      if (quoted && source[i + 1] === '"') { cell += '"'; i++; } else quoted = !quoted;
    } else if (char === delimiter && !quoted) { row.push(cell.trim()); cell = ""; }
    else if ((char === "\n" || char === "\r") && !quoted) {
      if (char === "\r" && source[i + 1] === "\n") i++;
      row.push(cell.trim());
      if (row.some(Boolean)) rows.push(row);
      row = []; cell = "";
    } else cell += char;
  }
  row.push(cell.trim());
  if (row.some(Boolean)) rows.push(row);
  return rows;
}

async function readStatement(file: File): Promise<Cell[][]> {
  const name = file.name.toLowerCase();
  if (name.endsWith(".xlsx")) {
    const { readSheet } = await import("read-excel-file/browser");
    return (await readSheet(file)) as unknown as Cell[][];
  }
  if (name.endsWith(".xls")) throw new Error("El formato .xls viejo no se puede leer: guardalo como .xlsx o exportá en CSV.");
  return parseCsv(await file.text());
}

export function ReconciliationView({ candidates }: { candidates: ContractCandidate[] }) {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [account, setAccount] = useState("");
  const [currency, setCurrency] = useState<"ARS" | "USD">("ARS");
  const [sheet, setSheet] = useState<{ fileName: string; cells: Cell[][] } | null>(null);
  const [map, setMap] = useState<ColumnMap | null>(null);
  const [rows, setRows] = useState<Row[]>([]);
  const [known, setKnown] = useState(0);
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    try { setAccount(localStorage.getItem(ACCOUNT_KEY) ?? ""); } catch { /* sin storage */ }
  }, []);

  const contracts = useMemo(() => candidates.filter((c) => c.currency === currency), [candidates, currency]);
  const byId = useMemo(() => new Map(contracts.map((c) => [c.id, c])), [contracts]);

  // Arma las filas con sugerencia a partir del extracto y las columnas.
  const build = async (cells: Cell[][], columns: ColumnMap) => {
    const movements = extractMovements(cells, columns);
    if (!movements.length) { toast.error("No encontramos créditos en el extracto. Revisá las columnas."); setRows([]); return; }
    const hashes = movementHashes(movements, account || "cuenta");
    setBusy("check");
    const res = await knownMovementsAction(hashes);
    setBusy(null);
    const done = res.success && res.data ? res.data : {};
    const fresh = movements
      .map((m, i) => ({ ...m, hash: hashes[i] }))
      .filter((m) => !done[m.hash]);
    setKnown(movements.length - fresh.length);
    setRows(fresh.map((m) => {
      const suggestion = suggestContract(m, contracts);
      return { ...m, suggestion, contractId: suggestion?.contractId ?? NONE, selected: suggestion?.confidence === "alta" };
    }));
  };

  const onFile = async (file: File) => {
    if (!account.trim()) { toast.error("Indicá primero la cuenta bancaria del extracto."); return; }
    try { localStorage.setItem(ACCOUNT_KEY, account.trim()); } catch { /* sin storage */ }
    try {
      const cells = await readStatement(file);
      if (!cells.length) throw new Error("El archivo está vacío.");
      const columns = detectColumns(cells);
      setSheet({ fileName: file.name, cells });
      setMap(columns);
      if (columns) await build(cells, columns);
      else setRows([]);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se pudo leer el extracto.");
    } finally {
      if (input.current) input.current.value = "";
    }
  };

  // Vista previa del reparto, en orden, para no imputar dos veces el mismo cargo.
  const previews = useMemo(() => {
    const used = new Map<string, number>();
    const result = new Map<string, ReturnType<typeof allocate>>();
    for (const row of rows) {
      const contract = row.contractId !== NONE ? byId.get(row.contractId) : undefined;
      if (!contract || !row.selected) continue;
      result.set(row.hash, allocate(contract.open, row.amount, row.date, used));
    }
    return result;
  }, [rows, byId]);

  const selected = rows.filter((r) => r.selected && r.contractId !== NONE);
  const selectedTotal = selected.reduce((s, r) => s + r.amount, 0);
  const unassigned = rows.filter((r) => r.contractId === NONE);

  const update = (hash: string, patch: Partial<Row>) => setRows((prev) => prev.map((r) => (r.hash === hash ? { ...r, ...patch } : r)));

  const confirm = async () => {
    setBusy("confirm");
    const res = await confirmReconciliationAction({
      account: account.trim(), currency,
      items: selected.map((r) => ({ hash: r.hash, date: r.date, description: r.description, amount: r.amount, contract_id: r.contractId })),
    });
    setBusy(null);
    if (!res.success) { toast.error(res.message); return; }
    toast.success(res.message);
    for (const note of [...(res.data?.skipped ?? []), ...(res.data?.leftovers ?? [])]) toast.warning(note, { duration: 10000 });
    const done = new Set(selected.map((r) => r.hash));
    setRows((prev) => prev.filter((r) => !done.has(r.hash)));
    setKnown((k) => k + (res.data?.registered ?? 0));
    router.refresh();
  };

  const ignore = async (items: Row[]) => {
    setBusy("ignore");
    const res = await ignoreMovementsAction({
      account: account.trim(), currency,
      items: items.map((r) => ({ hash: r.hash, date: r.date, description: r.description, amount: r.amount })),
    });
    setBusy(null);
    if (!res.success) { toast.error(res.message); return; }
    toast.success(res.message);
    const done = new Set(items.map((r) => r.hash));
    setRows((prev) => prev.filter((r) => !done.has(r.hash)));
    setKnown((k) => k + items.length);
  };

  const reset = () => { setSheet(null); setMap(null); setRows([]); setKnown(0); };

  // === Paso 1: subir el extracto ===
  if (!sheet) {
    return (
      <div className="grid gap-4 rounded-lg border border-border bg-card p-5 md:grid-cols-[1fr_auto] md:items-end">
        <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_140px]">
          <div className="space-y-2">
            <Label htmlFor="bank-account">Cuenta bancaria</Label>
            <Input id="bank-account" placeholder="Ej.: Galicia CC 4021-3" value={account} onChange={(e) => setAccount(e.target.value)} />
            <p className="text-xs text-muted-foreground">Queda en cada recibo como cuenta de cobro.</p>
          </div>
          <div className="space-y-2">
            <Label>Moneda de la cuenta</Label>
            <Select value={currency} onValueChange={(v) => setCurrency(v as "ARS" | "USD")}>
              <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="ARS">ARS</SelectItem><SelectItem value="USD">USD</SelectItem></SelectContent>
            </Select>
          </div>
        </div>
        <div>
          <input ref={input} type="file" accept=".csv,.txt,.xlsx" className="hidden"
            onChange={(e) => { const file = e.target.files?.[0]; if (file) void onFile(file); }} />
          <Button onClick={() => input.current?.click()} disabled={!account.trim()}>
            <Upload className="size-4" /> Subir extracto
          </Button>
        </div>
        <p className="text-sm text-muted-foreground md:col-span-2">
          CSV o Excel (.xlsx) exportado del home banking. Se leen solo los créditos; nada se registra hasta que confirmes.
          {candidates.length === 0 && " Ahora no hay contratos con deuda pendiente."}
        </p>
      </div>
    );
  }

  const headerRow = map ? sheet.cells[map.header] : sheet.cells.find((r) => r.filter(Boolean).length >= 3) ?? sheet.cells[0];
  const columnOptions = (headerRow ?? []).map((cell, i) => ({ value: String(i), label: `${i + 1}. ${String(cell ?? "").slice(0, 30) || "(vacía)"}` }));

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3 text-sm">
        <FileSpreadsheet className="size-4 text-muted-foreground" aria-hidden />
        <span className="font-medium">{sheet.fileName}</span>
        <span className="text-muted-foreground">{account} · {currency}</span>
        {known > 0 && <span className="text-muted-foreground">{known} ya {known === 1 ? "resuelto" : "resueltos"} antes</span>}
        <Button size="sm" variant="ghost" className="ml-auto" onClick={reset}><RotateCcw className="size-4" /> Otro extracto</Button>
      </div>

      {!map && (
        <ColumnPicker
          options={columnOptions}
          headerIndex={sheet.cells.indexOf(headerRow ?? [])}
          onApply={(columns) => { setMap(columns); void build(sheet.cells, columns); }}
        />
      )}

      {map && busy === "check" && (
        <p className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="size-4 animate-spin" /> Buscando coincidencias...</p>
      )}

      {map && busy !== "check" && rows.length === 0 && (
        <div className="rounded-lg border border-dashed border-border px-4 py-12 text-center">
          <CheckCircle2 className="mx-auto size-8 text-success" aria-hidden />
          <p className="mt-3 font-medium">No queda nada por conciliar en este extracto</p>
        </div>
      )}

      {rows.length > 0 && (
        <>
          <ul className="divide-y divide-border-subtle overflow-hidden rounded-lg border border-border bg-card">
            {rows.map((row) => {
              const preview = previews.get(row.hash);
              return (
                <li key={row.hash} className="grid gap-3 px-4 py-3 lg:grid-cols-[auto_minmax(0,1.2fr)_minmax(0,1fr)_15rem] lg:items-center">
                  <Checkbox
                    checked={row.selected}
                    disabled={row.contractId === NONE}
                    onCheckedChange={(checked) => update(row.hash, { selected: checked === true })}
                    aria-label={`Conciliar ${row.description}`}
                  />
                  <div className="min-w-0">
                    <p className="flex flex-wrap items-baseline gap-x-3 text-sm">
                      <span className="font-medium tabular-nums">{money(row.amount, currency)}</span>
                      <span className="text-muted-foreground">{formatDate(row.date)}</span>
                    </p>
                    <p className="truncate text-xs text-muted-foreground" title={row.description}>{row.description}</p>
                  </div>
                  <div className="min-w-0 space-y-1">
                    <Select value={row.contractId} onValueChange={(id) => update(row.hash, { contractId: id, selected: id !== NONE })}>
                      <SelectTrigger className="w-full min-w-0 [&>span]:truncate"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value={NONE}>Sin asignar</SelectItem>
                        {contracts.map((c) => <SelectItem key={c.id} value={c.id}>{c.label}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    {preview && (
                      <p className={cn("text-xs", preview.leftover > 0 ? "text-warning" : "text-muted-foreground")}>
                        {preview.allocations.map((a) => a.charge.description).join(", ") || "Sin deuda pendiente"}
                        {preview.leftover > 0 && `. Sobran ${money(preview.leftover, currency)}`}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-2 lg:justify-end">
                    {row.suggestion && row.contractId === row.suggestion.contractId && (
                      <StatusBadge tone={CONFIDENCE_TONE[row.suggestion.confidence]}>
                        <span title={row.suggestion.reasons.join(", ")}>Coincidencia {row.suggestion.confidence}</span>
                      </StatusBadge>
                    )}
                    <Button size="sm" variant="ghost" disabled={!!busy} onClick={() => ignore([row])}>Ignorar</Button>
                  </div>
                </li>
              );
            })}
          </ul>

          <div className="sticky bottom-0 flex flex-wrap items-center gap-3 border-t border-border bg-background/95 py-3 backdrop-blur">
            <span className="text-sm text-muted-foreground">
              {selected.length} {selected.length === 1 ? "transferencia" : "transferencias"} · {money(selectedTotal, currency)}
            </span>
            <div className="ml-auto flex gap-2">
              {unassigned.length > 0 && (
                <Button variant="outline" disabled={!!busy} onClick={() => ignore(unassigned)}>
                  Ignorar sin asignar ({unassigned.length})
                </Button>
              )}
              <Button disabled={!selected.length || !!busy} onClick={confirm}>
                {busy === "confirm" && <Loader2 className="size-4 animate-spin" />}
                Registrar cobros
              </Button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// Si no se reconocen las columnas, el agente las elige.
function ColumnPicker({ options, headerIndex, onApply }: {
  options: { value: string; label: string }[];
  headerIndex: number;
  onApply: (map: ColumnMap) => void;
}) {
  const [date, setDate] = useState("");
  const [description, setDescription] = useState("");
  const [credit, setCredit] = useState("");
  const pick = (label: string, value: string, set: (v: string) => void) => (
    <div className="space-y-2">
      <Label>{label}</Label>
      <Select value={value} onValueChange={set}>
        <SelectTrigger className="w-full"><SelectValue placeholder="Elegir columna" /></SelectTrigger>
        <SelectContent>{options.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
      </Select>
    </div>
  );
  return (
    <div className="space-y-4 rounded-lg border border-border bg-card p-4">
      <p className="text-sm">No reconocimos las columnas del extracto. Indicá cuál es cuál:</p>
      <div className="grid gap-4 sm:grid-cols-3">
        {pick("Fecha", date, setDate)}
        {pick("Concepto", description, setDescription)}
        {pick("Importe acreditado", credit, setCredit)}
      </div>
      <div className="flex justify-end">
        <Button disabled={!date || !credit} onClick={() => onApply({
          header: Math.max(0, headerIndex), date: Number(date), description: description ? Number(description) : -1, credit: Number(credit), debit: null,
        })}>Aplicar</Button>
      </div>
    </div>
  );
}
