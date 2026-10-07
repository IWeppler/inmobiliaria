"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Clock, FileText, Loader2, Paperclip, Receipt, Wrench, X, XCircle } from "lucide-react";
import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import { Label } from "@/shared/components/ui/label";
import { Textarea } from "@/shared/components/ui/textarea";
import { cn } from "@/lib/utils";
import { createClientBrowser } from "@/lib/supabase-browser";
import { formatDate } from "@/features/rentals/logic";
import { receiptCode } from "@/features/rentals/codes";
import { parseAmount } from "@/features/rentals/reconciliation";
import {
  createPortalUploadAction, submitPortalClaimAction, submitPortalPaymentAction,
} from "@/features/rentals/portalSubmitActions";

export type PortalSubmission = {
  id: string; kind: string; status: string; receivedAt: string; summary: string;
  rejectReason: string | null; resolvedAt: string | null; receipts: { href: string; number: number }[];
};

// Lo que ve el inquilino de cada envío. "Revisado" cubre los descartados
// (por ejemplo, un comprobante duplicado que ya se había registrado).
function submissionState(s: PortalSubmission) {
  if (s.status === "PENDIENTE") return { label: "En revisión", tone: "text-warning", icon: Clock };
  if (s.status === "RECHAZADO") return { label: "Rechazado", tone: "text-danger", icon: XCircle };
  if (s.status === "CONFIRMADO") return { label: s.kind === "RECLAMO" ? "En gestión" : "Registrado", tone: "text-success", icon: CheckCircle2 };
  return { label: "Revisado", tone: "text-muted-foreground", icon: CheckCircle2 };
}

const ACCEPT = "image/jpeg,image/png,image/webp,application/pdf";
const URGENCIES = [
  { value: "BAJA", label: "Puede esperar" },
  { value: "MEDIA", label: "Esta semana" },
  { value: "ALTA", label: "Lo antes posible" },
  { value: "URGENTE", label: "Urgente (gas, agua, luz)" },
] as const;

// Portal etapa 2: el inquilino informa pagos y reporta problemas desde su
// link. Todo entra a revisión de la inmobiliaria; acá solo se envía.
export function PortalRequests({ token, submissions, today }: { token: string; submissions: PortalSubmission[]; today: string }) {
  const [mode, setMode] = useState<"pago" | "reclamo" | null>(null);
  const [sent, setSent] = useState<string | null>(null);

  return (
    <section className="space-y-4 print:hidden">
      <h2 className="text-lg font-semibold tracking-tight">¿Necesitás algo?</h2>
      {sent && (
        <p role="status" className="flex items-start gap-2 rounded-lg border border-success/40 bg-success/5 px-4 py-3 text-sm">
          <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-success" aria-hidden /> {sent}
        </p>
      )}
      <div className="grid gap-3 sm:grid-cols-2">
        <ModeButton active={mode === "pago"} icon={Receipt} title="Informar un pago" text="Mandanos el comprobante de tu transferencia."
          onClick={() => { setMode(mode === "pago" ? null : "pago"); setSent(null); }} />
        <ModeButton active={mode === "reclamo"} icon={Wrench} title="Reportar un problema" text="Algo que se rompió o necesita reparación."
          onClick={() => { setMode(mode === "reclamo" ? null : "reclamo"); setSent(null); }} />
      </div>

      {mode === "pago" && <PaymentForm token={token} today={today} onDone={(m) => { setSent(m); setMode(null); }} />}
      {mode === "reclamo" && <ClaimForm token={token} onDone={(m) => { setSent(m); setMode(null); }} />}

      {submissions.length > 0 && (
        <div>
          <h3 className="mb-2 text-sm font-medium text-muted-foreground">Tus envíos</h3>
          <ul className="divide-y divide-border-subtle rounded-lg border border-border bg-card text-sm">
            {submissions.map((s) => {
              const state = submissionState(s);
              return (
                <li key={s.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-2.5">
                  <span className="font-medium">{s.kind === "RECLAMO" ? "Reclamo" : "Pago informado"}</span>
                  <span className="text-muted-foreground">{formatDate(s.receivedAt.slice(0, 10))}</span>
                  <span className="min-w-0 flex-1 truncate text-muted-foreground">{s.summary}</span>
                  <span className={cn("inline-flex items-center gap-1 text-xs font-medium", state.tone)}>
                    <state.icon className="size-3.5" aria-hidden /> {state.label}
                  </span>
                  {s.status === "RECHAZADO" && s.rejectReason && (
                    <p className="w-full text-xs text-danger">
                      {s.rejectReason}. Si ya pagaste, volvé a enviarlo con el comprobante o escribinos.
                    </p>
                  )}
                  {s.receipts.length > 0 && (
                    <p className="flex w-full flex-wrap gap-x-3 text-xs">
                      {s.resolvedAt && <span className="text-muted-foreground">Confirmado el {formatDate(s.resolvedAt.slice(0, 10))}</span>}
                      {s.receipts.map((r) => (
                        <a key={r.href} href={r.href} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 font-medium underline-offset-4 hover:underline">
                          <FileText className="size-3.5" aria-hidden /> Recibo {receiptCode(r.number)}
                        </a>
                      ))}
                    </p>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </section>
  );
}

function ModeButton({ active, icon: Icon, title, text, onClick }: {
  active: boolean; icon: typeof Receipt; title: string; text: string; onClick: () => void;
}) {
  return (
    <button type="button" onClick={onClick} aria-expanded={active}
      className={cn("flex items-start gap-3 rounded-lg border p-4 text-left transition-colors",
        active ? "border-primary bg-primary/5" : "border-border bg-card hover:bg-muted/50")}>
      <Icon className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden />
      <span>
        <span className="block font-medium">{title}</span>
        <span className="block text-sm text-muted-foreground">{text}</span>
      </span>
    </button>
  );
}

// Sube el archivo directo a storage con la URL firmada del servidor.
async function uploadFile(token: string, file: File): Promise<{ path: string; mime: string } | string> {
  const prep = await createPortalUploadAction({ token, mime: file.type, size: file.size });
  if (!prep.success || !prep.data) return prep.message;
  const { error } = await createClientBrowser().storage.from("rental-docs")
    .uploadToSignedUrl(prep.data.path, prep.data.uploadToken, file, { contentType: file.type });
  if (error) return "No se pudo subir el archivo. Probá de nuevo.";
  return { path: prep.data.path, mime: file.type };
}

function FilePicker({ file, onChange, label }: { file: File | null; onChange: (f: File | null) => void; label: string }) {
  const input = useRef<HTMLInputElement>(null);
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      <input ref={input} type="file" accept={ACCEPT} className="hidden" onChange={(e) => onChange(e.target.files?.[0] ?? null)} />
      {file ? (
        <div className="flex items-center gap-2 rounded-md border border-border px-3 py-2 text-sm">
          <Paperclip className="size-4 shrink-0 text-muted-foreground" aria-hidden />
          <span className="min-w-0 flex-1 truncate">{file.name}</span>
          <button type="button" aria-label="Quitar archivo" onClick={() => { onChange(null); if (input.current) input.current.value = ""; }}>
            <X className="size-4 text-muted-foreground" />
          </button>
        </div>
      ) : (
        <Button type="button" variant="outline" onClick={() => input.current?.click()}>
          <Paperclip className="size-4" /> Elegir foto o PDF
        </Button>
      )}
      <p className="text-xs text-muted-foreground">Foto (JPG, PNG) o PDF, hasta 10 MB.</p>
    </div>
  );
}

function PaymentForm({ token, today, onDone }: { token: string; today: string; onDone: (message: string) => void }) {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(today);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const value = parseAmount(amount);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true); setError(null);
    try {
      let upload: { path: string; mime: string } | null = null;
      if (file) {
        const result = await uploadFile(token, file);
        if (typeof result === "string") { setError(result); return; }
        upload = result;
      }
      const res = await submitPortalPaymentAction({
        token, path: upload?.path, mime: upload?.mime, amount: value && value > 0 ? value : undefined, date, note: note || undefined,
      });
      if (!res.success) { setError(res.message); return; }
      onDone(res.message);
      router.refresh();
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="space-y-4 rounded-lg border border-border bg-card p-4">
      <FilePicker file={file} onChange={setFile} label="Comprobante" />
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="portal-amount">Monto transferido</Label>
          <Input id="portal-amount" inputMode="decimal" placeholder="Ej.: 594.224" value={amount} onChange={(e) => setAmount(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="portal-date">Fecha del pago</Label>
          <Input id="portal-date" type="date" max={today} value={date} onChange={(e) => setDate(e.target.value)} />
        </div>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="portal-note">Comentario (opcional)</Label>
        <Textarea id="portal-note" rows={2} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Ej.: incluye las expensas de octubre" />
      </div>
      {error && <p role="alert" className="text-sm text-danger">{error}</p>}
      <Button type="submit" disabled={busy || (!file && !(value && value > 0))}>
        {busy && <Loader2 className="size-4 animate-spin" />} Enviar pago
      </Button>
    </form>
  );
}

function ClaimForm({ token, onDone }: { token: string; onDone: (message: string) => void }) {
  const router = useRouter();
  const [description, setDescription] = useState("");
  const [urgency, setUrgency] = useState<(typeof URGENCIES)[number]["value"]>("MEDIA");
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true); setError(null);
    try {
      let upload: { path: string; mime: string } | null = null;
      if (file) {
        const result = await uploadFile(token, file);
        if (typeof result === "string") { setError(result); return; }
        upload = result;
      }
      const res = await submitPortalClaimAction({ token, description, urgency, path: upload?.path, mime: upload?.mime });
      if (!res.success) { setError(res.message); return; }
      onDone(res.message);
      router.refresh();
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="space-y-4 rounded-lg border border-border bg-card p-4">
      <div className="space-y-1.5">
        <Label htmlFor="portal-claim">¿Qué pasa?</Label>
        <Textarea id="portal-claim" rows={4} value={description} onChange={(e) => setDescription(e.target.value)}
          placeholder="Ej.: pierde agua la canilla de la cocina desde ayer y moja el mueble." />
      </div>
      <fieldset className="space-y-1.5">
        <legend className="text-sm font-medium">¿Qué tan urgente es?</legend>
        <div className="grid gap-2 sm:grid-cols-2">
          {URGENCIES.map((u) => (
            <label key={u.value} className={cn("flex cursor-pointer items-center gap-2 rounded-md border px-3 py-2 text-sm",
              urgency === u.value ? "border-primary bg-primary/5" : "border-border")}>
              <input type="radio" name="urgency" value={u.value} checked={urgency === u.value} onChange={() => setUrgency(u.value)} />
              {u.label}
            </label>
          ))}
        </div>
      </fieldset>
      <FilePicker file={file} onChange={setFile} label="Foto (opcional)" />
      {error && <p role="alert" className="text-sm text-danger">{error}</p>}
      <Button type="submit" disabled={busy || description.trim().length < 10}>
        {busy && <Loader2 className="size-4 animate-spin" />} Enviar reclamo
      </Button>
    </form>
  );
}
