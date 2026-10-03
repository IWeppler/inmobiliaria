"use client";

import { useRef, useState } from "react";
import { toast } from "sonner";
import { FileText, Loader2, Trash2, Upload } from "lucide-react";
import { Button } from "@/shared/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/shared/components/ui/select";
import { createClientBrowser } from "@/lib/supabase-browser";
import { deleteDocumentAction, documentUrlAction, registerDocumentAction } from "@/features/rentals/lifecycleActions";
import { formatDate } from "@/features/rentals/logic";
import { useRunAction } from "@/features/rentals/useRunAction";

type Kind = "CONTRATO" | "INVENTARIO_ENTRADA" | "INVENTARIO_SALIDA" | "GARANTIA" | "OTRO";
export type RentalDocument = { id: string; kind: Kind; file_name: string; created_at: string };

const KIND_LABELS: Record<Kind, string> = {
  CONTRATO: "Contrato firmado",
  INVENTARIO_ENTRADA: "Inventario de entrada",
  INVENTARIO_SALIDA: "Inventario de salida",
  GARANTIA: "Garantía / póliza",
  OTRO: "Otro",
};
// Mismo límite y tipos que el bucket rental-docs.
const MAX_BYTES = 10 * 1024 * 1024;
const ACCEPT = "application/pdf,image/jpeg,image/png,image/webp";

export function DocumentsCard({ contractId, documents }: { contractId: string; documents: RentalDocument[] }) {
  const { busy, run } = useRunAction();
  const [kind, setKind] = useState<Kind>("CONTRATO");
  const [uploading, setUploading] = useState(false);
  const input = useRef<HTMLInputElement>(null);

  const upload = async (file: File) => {
    if (file.size > MAX_BYTES) { toast.error("El archivo supera los 10 MB."); return; }
    if (!ACCEPT.split(",").includes(file.type)) { toast.error("Solo PDF o imágenes (JPG, PNG, WebP)."); return; }
    setUploading(true);
    try {
      const ext = file.name.includes(".") ? file.name.split(".").pop()!.toLowerCase() : "bin";
      const path = `${contractId}/${crypto.randomUUID()}.${ext}`;
      const { error } = await createClientBrowser().storage.from("rental-docs").upload(path, file, { contentType: file.type });
      if (error) { toast.error(error.message); return; }
      await run("register", () => registerDocumentAction({ contract_id: contractId, kind, path, file_name: file.name.slice(0, 200) }));
    } finally {
      setUploading(false);
      if (input.current) input.current.value = "";
    }
  };

  const openDoc = async (id: string) => {
    // La pestaña se abre antes del await para que el navegador no la bloquee.
    const tab = window.open("", "_blank");
    const result = await documentUrlAction(id);
    if (result.success && result.data) {
      if (tab) tab.location.href = result.data.url; else window.location.href = result.data.url;
    } else {
      tab?.close();
      toast.error(result.message);
    }
  };

  return (
    <Card>
      <CardHeader><CardTitle>Documentos</CardTitle></CardHeader>
      <CardContent className="space-y-3 text-sm">
        {documents.length === 0 && <p className="text-muted-foreground">Subí el contrato firmado y el inventario de entrada.</p>}
        {documents.map((doc) => (
          <div key={doc.id} className="flex items-center justify-between gap-2">
            <button type="button" className="flex min-w-0 items-center gap-2 text-left" onClick={() => openDoc(doc.id)}>
              <FileText className="size-4 shrink-0 text-muted-foreground" />
              <span className="min-w-0">
                <span className="block truncate font-medium hover:underline">{doc.file_name}</span>
                <span className="block text-xs text-muted-foreground">{KIND_LABELS[doc.kind]} · {formatDate(doc.created_at)}</span>
              </span>
            </button>
            <Button size="icon" variant="ghost" className="size-7 shrink-0" aria-label={`Eliminar ${doc.file_name}`} disabled={!!busy}
              onClick={() => run(`doc-${doc.id}`, () => deleteDocumentAction(doc.id))}><Trash2 className="size-3.5" /></Button>
          </div>
        ))}
        <div className="flex gap-2 border-t border-border pt-3">
          <Select value={kind} onValueChange={(value) => setKind(value as Kind)}>
            <SelectTrigger className="flex-1"><SelectValue /></SelectTrigger>
            <SelectContent>{(Object.keys(KIND_LABELS) as Kind[]).map((key) => <SelectItem key={key} value={key}>{KIND_LABELS[key]}</SelectItem>)}</SelectContent>
          </Select>
          <input ref={input} type="file" accept={ACCEPT} className="hidden" onChange={(e) => { const file = e.target.files?.[0]; if (file) upload(file); }} />
          <Button size="sm" variant="outline" disabled={uploading || !!busy} onClick={() => input.current?.click()}>
            {uploading ? <Loader2 className="size-4 animate-spin" /> : <Upload />} Subir
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
