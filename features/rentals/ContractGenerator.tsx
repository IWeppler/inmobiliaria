"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { AlertTriangle, Copy, Download, FolderUp, Loader2 } from "lucide-react";
import { Button } from "@/shared/components/ui/button";
import { Label } from "@/shared/components/ui/label";
import { Textarea } from "@/shared/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/shared/components/ui/select";
import { createClientBrowser } from "@/lib/supabase-browser";
import { buildTemplateValues, renderTemplate, toBlocks, type TemplateData } from "@/features/rentals/contractTemplate";
import { registerDocumentAction } from "@/features/rentals/lifecycleActions";

type Template = { id: string; name: string; body: string; is_default: boolean };

async function renderPdf(text: string, title: string): Promise<Blob> {
  const [{ pdf }, { ContractPdf }] = await Promise.all([import("@react-pdf/renderer"), import("@/features/rentals/ContractPdf")]);
  return pdf(<ContractPdf blocks={toBlocks(text)} title={title} />).toBlob();
}

// Genera el contrato desde una plantilla: texto editable, lo que falta
// marcado como [COMPLETAR: ...], y salida a PDF, portapapeles o Documentos.
export function ContractGenerator({ contractId, data, templates }: { contractId: string; data: TemplateData; templates: Template[] }) {
  const router = useRouter();
  const values = useMemo(() => buildTemplateValues(data), [data]);
  const initial = templates.find((t) => t.is_default) ?? templates[0];
  const [templateId, setTemplateId] = useState(initial?.id ?? "");
  const [text, setText] = useState(() => (initial ? renderTemplate(initial.body, values).text : ""));
  const [edited, setEdited] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);

  const missing = useMemo(() => [...new Set([...text.matchAll(/\[COMPLETAR: ([^\]]+)\]/g)].map((m) => m[1]))], [text]);
  const tenantName = data.tenants[0]?.full_name ?? "inquilino";
  const title = `Contrato de locación - ${tenantName}`;
  const fileName = `${title}.pdf`.replace(/[\\/:*?"<>|]/g, "");

  if (!initial) {
    return <p className="text-sm text-muted-foreground">No hay plantillas cargadas. Un administrador puede crearlas en Ajustes.</p>;
  }

  const changeTemplate = (id: string) => {
    if (edited && !window.confirm("Se van a perder los cambios hechos al texto. ¿Seguir?")) return;
    const template = templates.find((t) => t.id === id);
    if (!template) return;
    setTemplateId(id);
    setText(renderTemplate(template.body, values).text);
    setEdited(false);
  };

  const download = async () => {
    setBusy("pdf");
    try {
      const url = URL.createObjectURL(await renderPdf(text, title));
      const link = document.createElement("a");
      link.href = url; link.download = fileName; link.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch {
      toast.error("No se pudo generar el PDF.");
    } finally {
      setBusy(null);
    }
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text.replace(/^#{1,2} /gm, ""));
      toast.success("Texto copiado. Pegalo en Word o Google Docs.");
    } catch {
      toast.error("No se pudo copiar.");
    }
  };

  const saveToDocuments = async () => {
    setBusy("save");
    try {
      const blob = await renderPdf(text, title);
      const path = `${contractId}/${crypto.randomUUID()}.pdf`;
      const { error } = await createClientBrowser().storage.from("rental-docs").upload(path, blob, { contentType: "application/pdf" });
      if (error) { toast.error(error.message); return; }
      const res = await registerDocumentAction({ contract_id: contractId, kind: "OTRO", path, file_name: `Para firmar - ${fileName}`.slice(0, 200) });
      if (!res.success) { toast.error(res.message); return; }
      toast.success("Guardado en los documentos del contrato.");
      router.refresh();
    } catch {
      toast.error("No se pudo guardar el PDF.");
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3">
        <div className="min-w-56 flex-1 space-y-2">
          <Label>Plantilla</Label>
          <Select value={templateId} onValueChange={changeTemplate}>
            <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
            <SelectContent>{templates.map((t) => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={copy} disabled={!!busy}><Copy className="size-4" /> Copiar texto</Button>
          <Button variant="outline" onClick={saveToDocuments} disabled={!!busy}>
            {busy === "save" ? <Loader2 className="size-4 animate-spin" /> : <FolderUp className="size-4" />} Guardar en documentos
          </Button>
          <Button onClick={download} disabled={!!busy}>
            {busy === "pdf" ? <Loader2 className="size-4 animate-spin" /> : <Download className="size-4" />} Descargar PDF
          </Button>
        </div>
      </div>

      {missing.length > 0 && (
        <div className="rounded-lg border border-warning/40 bg-warning/5 p-4 text-sm">
          <p className="flex items-center gap-2 font-medium">
            <AlertTriangle className="size-4 text-warning" aria-hidden />
            Faltan {missing.length} {missing.length === 1 ? "dato" : "datos"} antes de firmar
          </p>
          <p className="mt-1 text-muted-foreground">
            {missing.join(", ")}. Completalos en el texto o cargalos en el <Link href={`/dashboard/alquileres/${contractId}`} className="underline underline-offset-4">contrato</Link> (partes y domicilios) y volvé a generar.
          </p>
        </div>
      )}

      <div className="space-y-2">
        <Label htmlFor="contract-text">Texto del contrato</Label>
        <Textarea id="contract-text" rows={28} className="leading-relaxed" value={text}
          onChange={(e) => { setText(e.target.value); setEdited(true); }} />
        <p className="text-xs text-muted-foreground">
          Los cambios valen solo para este documento; la plantilla no se modifica. La plantilla modelo es orientativa: revisala con tu asesor legal.
        </p>
      </div>
    </div>
  );
}
