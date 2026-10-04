"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, Plus, Trash2 } from "lucide-react";
import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import { Label } from "@/shared/components/ui/label";
import { Textarea } from "@/shared/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/shared/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/shared/components/ui/select";
import { TEMPLATE_VARIABLES } from "@/features/rentals/contractTemplate";
import { deleteContractTemplateAction, saveContractTemplateAction } from "@/features/rentals/templateActions";

export type ContractTemplateRow = { id: string; name: string; body: string; is_default: boolean };

const NEW = "new";

// Plantillas de contrato de locación (E4.16). Texto con variables {{...}};
// "# " título y "## " encabezado de cláusula. Solo admin.
export function ContractTemplates({ initial }: { initial: ContractTemplateRow[] }) {
  const router = useRouter();
  const area = useRef<HTMLTextAreaElement>(null);
  const first = initial.find((t) => t.is_default) ?? initial[0];
  const [selected, setSelected] = useState(first?.id ?? NEW);
  const [draft, setDraft] = useState({ name: first?.name ?? "", body: first?.body ?? "", is_default: first?.is_default ?? false });
  const [busy, setBusy] = useState<string | null>(null);

  const current = initial.find((t) => t.id === selected);
  const dirty = !current || current.name !== draft.name || current.body !== draft.body || current.is_default !== draft.is_default;

  const pick = (id: string) => {
    if (dirty && !window.confirm("Hay cambios sin guardar. ¿Descartarlos?")) return;
    const t = initial.find((x) => x.id === id);
    setSelected(id);
    setDraft(t ? { name: t.name, body: t.body, is_default: t.is_default } : { name: "Nueva plantilla", body: current?.body ?? "", is_default: false });
  };

  // Inserta la variable donde está el cursor.
  const insert = (key: string) => {
    const el = area.current;
    const token = `{{${key}}}`;
    if (!el) { setDraft((d) => ({ ...d, body: d.body + token })); return; }
    const { selectionStart: start, selectionEnd: end } = el;
    const body = draft.body.slice(0, start) + token + draft.body.slice(end);
    setDraft((d) => ({ ...d, body }));
    requestAnimationFrame(() => { el.focus(); el.setSelectionRange(start + token.length, start + token.length); });
  };

  const save = async () => {
    setBusy("save");
    const res = await saveContractTemplateAction({ id: selected === NEW ? undefined : selected, ...draft });
    setBusy(null);
    if (!res.success || !res.data) { toast.error(res.message); return; }
    toast.success(res.message);
    setSelected(res.data.id);
    router.refresh();
  };

  const remove = async () => {
    if (!current || !window.confirm(`¿Eliminar la plantilla "${current.name}"?`)) return;
    setBusy("delete");
    const res = await deleteContractTemplateAction(current.id);
    setBusy(null);
    if (!res.success) { toast.error(res.message); return; }
    toast.success(res.message);
    const next = initial.find((t) => t.id !== current.id);
    if (next) { setSelected(next.id); setDraft({ name: next.name, body: next.body, is_default: next.is_default }); }
    router.refresh();
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Plantillas de contrato</CardTitle>
        <CardDescription>
          Texto base para generar contratos de locación con los datos cargados. La plantilla modelo es orientativa: revisala con tu asesor legal.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap items-end gap-2">
          <div className="min-w-48 flex-1 space-y-2">
            <Label>Plantilla</Label>
            <Select value={selected} onValueChange={pick}>
              <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
              <SelectContent>
                {initial.map((t) => <SelectItem key={t.id} value={t.id}>{t.name}{t.is_default ? " (por defecto)" : ""}</SelectItem>)}
                {selected === NEW && <SelectItem value={NEW}>Nueva plantilla</SelectItem>}
              </SelectContent>
            </Select>
          </div>
          <Button variant="outline" onClick={() => pick(NEW)} disabled={selected === NEW}><Plus className="size-4" /> Nueva (copia)</Button>
          {current && initial.length > 1 && (
            <Button variant="ghost" size="icon" aria-label="Eliminar plantilla" disabled={!!busy} onClick={remove}><Trash2 className="size-4" /></Button>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="template-name">Nombre</Label>
          <Input id="template-name" value={draft.name} onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))} />
        </div>

        <div className="space-y-2">
          <Label htmlFor="template-body">Texto</Label>
          <Textarea id="template-body" ref={area} rows={18} className="font-mono text-xs leading-relaxed"
            value={draft.body} onChange={(e) => setDraft((d) => ({ ...d, body: e.target.value }))} />
          <p className="text-xs text-muted-foreground">
            Párrafos separados por una línea en blanco. Una línea que empieza con <code># </code> es el título y con <code>## </code> el encabezado de una cláusula.
          </p>
        </div>

        <div className="space-y-2">
          <p className="text-xs font-medium text-muted-foreground">Variables (clic para insertar)</p>
          <div className="flex flex-wrap gap-1.5">
            {TEMPLATE_VARIABLES.map((v) => (
              <button key={v.key} type="button" title={v.label} onClick={() => insert(v.key)}
                className="rounded-md border border-border px-2 py-0.5 font-mono text-xs text-muted-foreground hover:bg-muted hover:text-foreground">
                {v.key}
              </button>
            ))}
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={draft.is_default} onChange={(e) => setDraft((d) => ({ ...d, is_default: e.target.checked }))} />
            Usar por defecto
          </label>
          <Button onClick={save} disabled={!dirty || !!busy || draft.name.trim().length < 3 || draft.body.length < 20}>
            {busy === "save" && <Loader2 className="size-4 animate-spin" />} Guardar plantilla
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
