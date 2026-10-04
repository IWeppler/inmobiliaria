"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Copy, Loader2 } from "lucide-react";
import { Button } from "@/shared/components/ui/button";
import { Checkbox } from "@/shared/components/ui/checkbox";
import { Input } from "@/shared/components/ui/input";
import { Label } from "@/shared/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/shared/components/ui/card";
import { StatusBadge } from "@/shared/components/StatusBadge";
import { updateRentalNoticeSettingsAction } from "@/features/rentals/actions";
import { RENTAL_TEMPLATES, type NoticeKind } from "@/features/rentals/noticeTemplates";

export type NoticeSettings = {
  notify_receipts: boolean; notify_adjustments: boolean; notify_due: boolean; notify_overdue: boolean;
  adjustment_notice_days: number; due_reminder_days: number; overdue_reminder_days: number;
};

type Row = {
  kind: NoticeKind; flag: keyof NoticeSettings; daysKey?: keyof NoticeSettings; maxDays?: number;
  when: (days: number) => string; recipients: string;
};
const ROWS: Row[] = [
  { kind: "RECIBO", flag: "notify_receipts", when: () => "Al registrar cada cobro", recipients: "Inquilino" },
  { kind: "AUMENTO", flag: "notify_adjustments", daysKey: "adjustment_notice_days", maxDays: 60,
    when: (d) => `${d} días antes del ajuste (o al aplicarse, si el índice sale ese día)`, recipients: "Inquilino y propietario" },
  { kind: "VENCIMIENTO", flag: "notify_due", daysKey: "due_reminder_days", maxDays: 15,
    when: (d) => `${d} días antes del vencimiento de la cuota`, recipients: "Inquilino" },
  { kind: "DEUDA", flag: "notify_overdue", daysKey: "overdue_reminder_days", maxDays: 30,
    when: (d) => `${d} días después del vencimiento, si sigue impaga`, recipients: "Inquilino" },
];

// Avisos automáticos a inquilinos y propietarios. Cada uno necesita su
// plantilla aprobada en Meta: por eso arrancan apagados y acá se muestra
// el texto exacto a registrar. Solo admin.
export function RentalNoticeSettings({ initial, whatsappConfigured }: { initial: NoticeSettings; whatsappConfigured: boolean }) {
  const router = useRouter();
  const [v, setV] = useState(initial);
  const [busy, setBusy] = useState(false);
  const dirty = JSON.stringify(v) !== JSON.stringify(initial);

  const save = async () => {
    setBusy(true);
    try {
      const res = await updateRentalNoticeSettingsAction(v);
      if (res.success) { toast.success(res.message); router.refresh(); }
      else toast.error(res.message);
    } finally {
      setBusy(false);
    }
  };

  const copy = async (text: string) => {
    try { await navigator.clipboard.writeText(text); toast.success("Copiado."); }
    catch { toast.error("No se pudo copiar."); }
  };

  return (
    <Card>
      <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-3">
        <div className="space-y-1.5">
          <CardTitle>Avisos de alquileres por WhatsApp</CardTitle>
          <CardDescription className="max-w-2xl">
            Antes de activar un aviso, creá su plantilla en WhatsApp Manager (categoría Utilidad, idioma Español (ARG))
            con el nombre y el texto de abajo, y esperá a que Meta la apruebe. Cada aviso se envía una sola vez.
          </CardDescription>
        </div>
        <StatusBadge tone={whatsappConfigured ? "success" : "warning"}>{whatsappConfigured ? "WhatsApp conectado" : "WhatsApp sin configurar"}</StatusBadge>
      </CardHeader>
      <CardContent className="space-y-4">
        {!whatsappConfigured && (
          <p className="rounded-md bg-warning/10 p-3 text-sm text-warning">
            Faltan las credenciales de WhatsApp Business (ver Integraciones). Podés dejar los avisos configurados: se empiezan a enviar cuando se conecte.
          </p>
        )}
        <ul className="divide-y divide-border rounded-md border border-border">
          {ROWS.map((row) => {
            const template = RENTAL_TEMPLATES[row.kind];
            const enabled = v[row.flag] as boolean;
            return (
              <li key={row.kind} className="space-y-3 p-3 text-sm">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <label className="flex items-center gap-2 font-medium">
                    <Checkbox checked={enabled} onCheckedChange={(checked) => setV({ ...v, [row.flag]: checked === true })} />
                    {template.label}
                  </label>
                  <span className="text-xs text-muted-foreground">{row.recipients}</span>
                </div>
                <div className="flex flex-wrap items-center gap-2 text-muted-foreground">
                  {row.daysKey ? (
                    <>
                      <Label htmlFor={`days-${row.kind}`} className="sr-only">Días</Label>
                      <Input id={`days-${row.kind}`} type="number" className="h-8 w-20" min={1} max={row.maxDays}
                        value={v[row.daysKey] as number} onChange={(e) => setV({ ...v, [row.daysKey!]: Number(e.target.value) })} />
                      <span>{row.when(v[row.daysKey] as number).replace(/^\d+ /, "")}</span>
                    </>
                  ) : <span>{row.when(0)}</span>}
                </div>
                <div className="rounded-md bg-muted/50 p-2.5 text-xs">
                  <div className="flex items-center justify-between gap-2">
                    <span>Plantilla <code className="font-mono font-medium text-foreground">{template.name}</code></span>
                    <Button type="button" size="sm" variant="ghost" className="h-7 text-xs" onClick={() => copy(template.body)}><Copy className="size-3.5" /> Copiar texto</Button>
                  </div>
                  <p className="mt-1 text-foreground">{template.body}</p>
                  <p className="mt-1 text-muted-foreground">{template.params.map((p, i) => `{{${i + 1}}} ${p}`).join(" · ")}</p>
                </div>
              </li>
            );
          })}
        </ul>
        <div className="flex justify-end">
          <Button onClick={save} disabled={busy || !dirty}>{busy ? <Loader2 className="size-4 animate-spin" /> : "Guardar avisos"}</Button>
        </div>
      </CardContent>
    </Card>
  );
}
