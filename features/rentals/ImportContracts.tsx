"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Download, Loader2, Upload } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import { importRentalContractsAction } from "@/features/rentals/actions";

const HEADERS = [
  "property_id", "property_title", "owner_name", "owner_document", "owner_phone",
  "tenant_name", "tenant_document", "tenant_phone", "start_date", "end_date",
  "rent_amount", "currency", "adjustment_index", "adjustment_months", "adjustment_pct",
  "last_adjustment_date", "next_adjustment_date", "commission_pct", "payment_due_day",
  "first_unpaid_period",
  "guarantee_type", "guarantee_detail", "deposit_amount", "late_fee_pct_daily",
  "late_fee_fixed", "notes",
];
const REQUIRED = ["owner_name", "tenant_name", "start_date", "end_date", "rent_amount"];

function parseCsv(text: string): Record<string, string>[] {
  const firstLine = text.slice(0, text.indexOf("\n") < 0 ? undefined : text.indexOf("\n"));
  const delimiter = (firstLine.match(/;/g)?.length ?? 0) > (firstLine.match(/,/g)?.length ?? 0) ? ";" : ",";
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  const source = text.replace(/^\uFEFF/, "");
  for (let i = 0; i < source.length; i++) {
    const char = source[i];
    if (char === '"') {
      if (quoted && source[i + 1] === '"') { cell += '"'; i++; }
      else quoted = !quoted;
    } else if (char === delimiter && !quoted) { row.push(cell.trim()); cell = ""; }
    else if ((char === "\n" || char === "\r") && !quoted) {
      if (char === "\r" && source[i + 1] === "\n") i++;
      row.push(cell.trim());
      if (row.some(Boolean)) rows.push(row);
      row = []; cell = "";
    } else cell += char;
  }
  if (quoted) throw new Error("Hay una celda con comillas sin cerrar.");
  row.push(cell.trim());
  if (row.some(Boolean)) rows.push(row);
  const [headers, ...values] = rows;
  if (!headers) throw new Error("El archivo está vacío.");
  const names = headers.map((header) => header.trim().toLowerCase());
  if (new Set(names).size !== names.length) throw new Error("Hay columnas duplicadas.");
  for (const column of REQUIRED) if (!names.includes(column)) throw new Error(`Falta la columna ${column}.`);
  if (!names.includes("property_id") && !names.includes("property_title")) throw new Error("Falta property_id o property_title.");
  return values.map((fields, index) => {
    if (fields.length !== names.length) throw new Error(`La fila ${index + 2} tiene ${fields.length} columnas; se esperaban ${names.length}.`);
    return Object.fromEntries(names.map((name, column) => [name, fields[column]]));
  });
}

function downloadCsv(name: string, rows: string[][]) {
  const escape = (cell: string) => `"${cell.replaceAll('"', '""')}"`;
  const blob = new Blob(["\uFEFF", rows.map((row) => row.map(escape).join(",")).join("\r\n")], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a"); link.href = url; link.download = name; link.click();
  URL.revokeObjectURL(url);
}

export function ImportContracts({ properties }: { properties: { id: string; title: string }[] }) {
  const router = useRouter();
  const [rows, setRows] = useState<Record<string, string>[]>([]);
  const [filename, setFilename] = useState("");
  const [busy, setBusy] = useState(false);

  const readFile = async (file: File | undefined) => {
    if (!file) return;
    if (file.size > 2_000_000) { toast.error("El archivo no puede superar 2 MB."); return; }
    try {
      const parsed = parseCsv(await file.text());
      if (!parsed.length || parsed.length > 500) throw new Error("El archivo debe tener entre 1 y 500 contratos.");
      setRows(parsed); setFilename(file.name);
    } catch (error) { setRows([]); toast.error(error instanceof Error ? error.message : "CSV inválido."); }
  };

  return <div className="space-y-6">
    <div className="rounded-lg border border-border bg-card p-5 text-sm">
      <h2 className="font-semibold">Preparar el archivo</h2>
      <p className="mt-2 text-muted-foreground">Descargá la plantilla y el catálogo de propiedades. Identificá cada inmueble por su ID o por un título único. Las fechas van como AAAA-MM-DD y los importes usan punto decimal. El canon debe ser el vigente y la fecha del último ajuste ya aplicado.</p>
      <p className="mt-2 text-muted-foreground">adjustment_index acepta ICL, IPC, CASA_PROPIA, FIJO, MANUAL o NINGUNO (por defecto ICL). adjustment_months va de 1 a 36 (por defecto 3). Los contratos con IPC toman un rezago de 2 meses y los demás, ninguno.</p>
      <p className="mt-2 text-muted-foreground">El lote se importa completo o se rechaza completo. Completá first_unpaid_period (AAAA-MM-01) si la cuenta corriente debe empezar en otro mes; por defecto comienza en el actual. No se inventan deudas anteriores.</p>
      <div className="mt-4 flex flex-wrap gap-2">
        <Button variant="outline" onClick={() => downloadCsv("plantilla-contratos.csv", [HEADERS])}><Download /> Plantilla CSV</Button>
        <Button variant="outline" onClick={() => downloadCsv("catalogo-propiedades.csv", [["property_id", "property_title"], ...properties.map((property) => [property.id, property.title])])}><Download /> Catálogo de propiedades</Button>
      </div>
    </div>
    <div className="rounded-lg border border-border bg-card p-5">
      <label htmlFor="rental-csv" className="mb-2 block text-sm font-medium">Archivo CSV</label>
      <Input id="rental-csv" type="file" accept=".csv,text/csv" onChange={(event) => readFile(event.target.files?.[0])} />
      {filename && <p className="mt-2 text-sm text-muted-foreground">{filename} · {rows.length} contratos</p>}
    </div>
    {rows.length > 0 && <div className="rounded-lg border border-border bg-card p-5">
      <h2 className="font-semibold">Vista previa</h2>
      <div className="mt-3 space-y-2 text-sm">{rows.slice(0, 8).map((row, index) => <p key={index} className="border-b border-border pb-2">{index + 1}. {row.property_title || row.property_id} · {row.tenant_name} · {row.currency || "ARS"} {row.rent_amount} · {row.start_date} → {row.end_date}</p>)}{rows.length > 8 && <p className="text-muted-foreground">Y {rows.length - 8} contratos más…</p>}</div>
      <Button className="mt-4" disabled={busy} onClick={async () => {
        setBusy(true);
        try {
          const result = await importRentalContractsAction(rows);
          if (result.success) { toast.success(result.message); router.push("/dashboard/alquileres"); router.refresh(); }
          else toast.error(result.message);
        } catch { toast.error("No se pudo importar el archivo."); }
        finally { setBusy(false); }
      }}>{busy ? <Loader2 className="size-4 animate-spin" /> : <Upload />} Importar {rows.length} contratos</Button>
    </div>}
  </div>;
}
