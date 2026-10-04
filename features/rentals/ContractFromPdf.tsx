"use client";

import { useRef, useState } from "react";
import { toast } from "sonner";
import { AlertTriangle, FileText, Loader2, Sparkles, Upload, X } from "lucide-react";
import { Button } from "@/shared/components/ui/button";
import { cn } from "@/lib/utils";
import { createClientBrowser } from "@/lib/supabase-browser";
import { ContractForm } from "@/features/rentals/ContractForm";
import { extractContractFromPdfAction, type ContractExtraction } from "@/features/rentals/contractExtraction";
import type { PropertyOwner } from "@/features/rentals/propertyOwners";

type Option = { id: string; label: string };
const MAX_BYTES = 10 * 1024 * 1024; // límite del bucket rental-docs

// Nuevo contrato con lectura del PDF firmado: el archivo va directo a
// storage (borrador del agente), el servidor lo lee con IA y el formulario
// se remonta prellenado para revisar. Al guardar, el PDF queda adjunto.
export function ContractFromPdf({ properties, owners, tenants, userId, propertyOwners, initialPropertyId }: {
  properties: Option[]; owners: Option[]; tenants: Option[]; userId: string;
  propertyOwners: Record<string, PropertyOwner[]>; initialPropertyId?: string;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [status, setStatus] = useState<"idle" | "uploading" | "reading">("idle");
  const [dragging, setDragging] = useState(false);
  const [result, setResult] = useState<{ fileName: string; extraction: ContractExtraction } | null>(null);
  const [formKey, setFormKey] = useState(0);

  const handleFile = async (file: File) => {
    if (file.type !== "application/pdf") { toast.error("Subí el contrato en PDF."); return; }
    if (file.size > MAX_BYTES) { toast.error("El PDF supera los 10 MB."); return; }

    const supabase = createClientBrowser();
    const path = `drafts/${userId}/${crypto.randomUUID()}.pdf`;
    setStatus("uploading");
    try {
      const { error } = await supabase.storage.from("rental-docs").upload(path, file, { contentType: "application/pdf" });
      if (error) { toast.error(error.message); return; }
      setStatus("reading");
      const res = await extractContractFromPdfAction({ path, file_name: file.name });
      if (!res.success || !res.data) {
        toast.error(res.message);
        await supabase.storage.from("rental-docs").remove([path]);
        return;
      }
      // El borrador anterior ya no se usa.
      const previous = result?.extraction.initial.source_pdf_path;
      if (previous) void supabase.storage.from("rental-docs").remove([previous]);
      setResult({ fileName: file.name, extraction: res.data });
      setFormKey((k) => k + 1);
      toast.success(res.message);
    } finally {
      setStatus("idle");
      if (input.current) input.current.value = "";
    }
  };

  const clear = () => {
    const previous = result?.extraction.initial.source_pdf_path;
    if (previous) void createClientBrowser().storage.from("rental-docs").remove([previous]);
    setResult(null);
    setFormKey((k) => k + 1);
  };

  const busy = status !== "idle";
  const extraction = result?.extraction;
  const pending = extraction ? [
    !extraction.property_matched && `Propiedad: no se encontró en el sistema${extraction.property_address ? ` (${extraction.property_address})` : ""}. Elegila o cargala primero.`,
    extraction.owner && !extraction.owner.matched_id && `Propietario nuevo: revisá el alta de ${extraction.owner.full_name} y guardala.`,
    extraction.tenant && !extraction.tenant.matched_id && `Inquilino nuevo: revisá el alta de ${extraction.tenant.full_name} y guardala.`,
    ...extraction.warnings,
  ].filter((item): item is string => !!item) : [];

  return (
    <div className="space-y-6">
      {!result ? (
        <div
          onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => { e.preventDefault(); setDragging(false); const file = e.dataTransfer.files[0]; if (file && !busy) void handleFile(file); }}
          className={cn(
            "flex flex-col gap-4 rounded-lg border border-dashed border-border p-5 sm:flex-row sm:items-center",
            dragging && "border-primary bg-primary/5",
          )}
        >
          <Sparkles className="size-5 shrink-0 text-primary" aria-hidden />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium">¿Tenés el contrato firmado?</p>
            <p className="text-sm text-muted-foreground">
              {status === "reading"
                ? "Leyendo el contrato. Puede tardar hasta un minuto."
                : "Subí el PDF y completamos partes, fechas, canon, ajuste y garantía. Vos revisás antes de guardar."}
            </p>
          </div>
          <input ref={input} type="file" accept="application/pdf" className="hidden"
            onChange={(e) => { const file = e.target.files?.[0]; if (file) void handleFile(file); }} />
          <Button type="button" variant="outline" disabled={busy} onClick={() => input.current?.click()}>
            {busy ? <Loader2 className="size-4 animate-spin" /> : <Upload className="size-4" />}
            {status === "uploading" ? "Subiendo..." : status === "reading" ? "Leyendo..." : "Subir PDF"}
          </Button>
        </div>
      ) : (
        <div className="rounded-lg border border-border bg-card p-4">
          <div className="flex items-start gap-3">
            <FileText className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{result.fileName}</p>
              <p className="text-xs text-muted-foreground">Datos leídos con IA. Se adjunta al contrato como contrato firmado.</p>
            </div>
            <Button type="button" size="icon" variant="ghost" className="size-7" aria-label="Descartar PDF" onClick={clear}>
              <X className="size-4" />
            </Button>
          </div>
          {pending.length > 0 && (
            <ul className="mt-3 space-y-1.5 border-t border-border pt-3">
              {pending.map((item, index) => (
                <li key={index} className="flex gap-2 text-sm">
                  <AlertTriangle className="mt-0.5 size-3.5 shrink-0 text-warning" aria-hidden />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      <ContractForm
        key={formKey}
        properties={properties}
        owners={owners}
        tenants={tenants}
        initial={extraction
          ? { ...extraction.initial, property_id: extraction.initial.property_id || initialPropertyId || "" }
          : initialPropertyId ? { property_id: initialPropertyId } : undefined}
        propertyOwners={propertyOwners}
        contactDrafts={extraction ? {
          owner: extraction.owner && !extraction.owner.matched_id ? extraction.owner : undefined,
          tenant: extraction.tenant && !extraction.tenant.matched_id ? extraction.tenant : undefined,
        } : undefined}
      />
    </div>
  );
}
