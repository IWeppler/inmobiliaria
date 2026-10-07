"use client";

import { useMemo, useState } from "react";
import Image from "next/image";
import { Download, Link2, Check, RotateCcw, ChevronLeft, ChevronRight } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import { Label } from "@/shared/components/ui/label";
import { Checkbox } from "@/shared/components/ui/checkbox";
import { Textarea } from "@/shared/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/shared/components/ui/select";
import { Page, PageHeader } from "@/shared/components/PageShell";
import { cn } from "@/lib/utils";
import {
  DEFAULT_OPTIONS,
  optionsToSearch,
  type CardOptions,
  type Layout,
  type ShowKey,
  type Theme,
} from "@/features/social/propertyCard";
import { completeRuleTaskAction } from "@/features/tasks/actions";

const FORMATS = [
  // maxW: mantiene cada formato legible sin dejar demasiado espacio vacío.
  { value: "square", label: "Cuadrado", hint: "1:1 · 1080×1080", ratio: "1 / 1", maxW: 600 },
  { value: "portrait", label: "Feed", hint: "4:5 · 1080×1350", ratio: "4 / 5", maxW: 500 },
  { value: "story", label: "Historia", hint: "9:16 · 1080×1920", ratio: "9 / 16", maxW: 370 },
] as const;
type Format = (typeof FORMATS)[number]["value"];
type Step = 1 | 2 | 3;
const STEPS = [
  { number: 1, title: "Datos", detail: "Contenido del inmueble" },
  { number: 2, title: "Diseño", detail: "Estilo y elementos" },
  { number: 3, title: "Revisar", detail: "Formato y descarga" },
] as const;

const LAYOUT_OPTIONS: { value: Layout; label: string; hint: string }[] = [
  { value: "photo", label: "Foto completa", hint: "Datos sobre la foto, degradé abajo" },
  { value: "split", label: "Foto + panel", hint: "Foto arriba, datos en un panel" },
  { value: "minimal", label: "Mínima", hint: "Foto completa y datos esenciales" },
  { value: "editorial", label: "Editorial", hint: "Fotografía lateral y jerarquía tipográfica" },
  { value: "framed", label: "Enmarcada", hint: "Foto protagonista con marco y pie de datos" },
];

const SHOW_OPTIONS: { key: ShowKey; label: string }[] = [
  { key: "price", label: "Precio" },
  { key: "title", label: "Título" },
  { key: "location", label: "Ubicación" },
  { key: "specs", label: "Dormitorios, baños, superficie" },
  { key: "type", label: "Tipo de propiedad" },
];

const FONT_OPTIONS = [
  { value: "sans", label: "Moderna", hint: "Sans serif clara y versátil" },
  { value: "serif", label: "Editorial", hint: "Crimson Text, de estilo clásico" },
  { value: "mono", label: "Técnica", hint: "IBM Plex Mono, de trazo uniforme" },
] as const;

// Acentos sugeridos: el de la marca primero, después neutros y un par
// de colores sobrios. También se acepta un hex libre.
const ACCENTS = [DEFAULT_OPTIONS.accent, "#111418", "#1e4fd8", "#0f766e", "#7c2d12", "#7c3aed"];

const BADGE_PRESETS = ["Oportunidad", "Nuevo", "Precio rebajado", "Última unidad", "Apto crédito"];

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-3 border-b border-border py-5 first:pt-0 last:border-0 last:pb-0">
      <h3 className="text-xs font-medium text-muted-foreground">{title}</h3>
      {children}
    </section>
  );
}

function Chip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "h-7 rounded-md border px-2.5 text-xs transition-colors",
        active ? "border-primary bg-primary/5 text-foreground" : "border-border text-fg-secondary hover:bg-muted/50",
      )}
    >
      {children}
    </button>
  );
}

// E2.2 — Generador de pieza para Instagram. La imagen se renderiza en el
// servidor (/api/social/[id]) a partir de las opciones serializadas en la
// query. Sin integración con Meta: descargar y subir desde la app.
export function InstagramPieceClient({
  propertyId,
  title,
  images,
  description,
  location,
  phone,
  operation,
}: {
  propertyId: string;
  title: string;
  images: string[];
  description: string;
  location: string;
  phone: string;
  operation: "venta" | "alquiler";
}) {
  const [step, setStep] = useState<Step>(1);
  const [furthestStep, setFurthestStep] = useState<Step>(1);
  const [format, setFormat] = useState<Format>("square");
  const initialOptions = useMemo<CardOptions>(() => ({
    ...DEFAULT_OPTIONS,
    copy: { title, description: description.slice(0, 240), location: location.slice(0, 140), phone: phone.slice(0, 60) },
  }), [title, description, location, phone]);
  const [o, setO] = useState<CardOptions>(initialOptions);
  const [copied, setCopied] = useState(false);
  const [accentInput, setAccentInput] = useState(DEFAULT_OPTIONS.accent);

  const set = <K extends keyof CardOptions>(k: K, v: CardOptions[K]) =>
    setO((s) => ({ ...s, [k]: v }));
  const toggleShow = (k: ShowKey) =>
    setO((s) => ({ ...s, show: { ...s.show, [k]: !s.show[k] } }));
  const setCopy = (key: keyof CardOptions["copy"], value: string) =>
    setO((s) => ({ ...s, copy: { ...s.copy, [key]: value } }));

  const query = useMemo(() => {
    const q = optionsToSearch(o);
    q.set("format", format);
    return q.toString();
  }, [o, format]);
  const imageUrl = `/api/social/${propertyId}?${query}`;
  const current = FORMATS.find((f) => f.value === format)!;
  const isDefault = format === "square" && JSON.stringify(o) === JSON.stringify(initialOptions);

  const applyAccent = (hex: string) => {
    setAccentInput(hex);
    if (/^#[0-9a-fA-F]{6}$/.test(hex)) set("accent", hex);
  };

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(`${window.location.origin}${imageUrl}`);
      setCopied(true);
      toast.success("Link de la imagen copiado.");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("No se pudo copiar.");
    }
  };

  const reset = () => {
    setO(initialOptions);
    setAccentInput(DEFAULT_OPTIONS.accent);
    setFormat("square");
  };

  const nextStep = () => {
    if (step >= 3) return;
    const next = (step + 1) as Step;
    setStep(next);
    setFurthestStep((current) => Math.max(current, next) as Step);
  };

  return (
    <Page>
      <PageHeader
        backHref={`/dashboard/propiedades/${propertyId}`}
        title="Pieza para Instagram"
        description={title}
      />

      <nav aria-label="Etapas del flyer" className="grid grid-cols-3 gap-2 rounded-lg border border-border bg-card p-2">
        {STEPS.map((item) => (
          <button
            key={item.number}
            type="button"
            onClick={() => setStep(item.number)}
            disabled={item.number > furthestStep}
            aria-current={step === item.number ? "step" : undefined}
            className={cn(
              "flex min-w-0 items-center gap-2 rounded-md px-2 py-2 text-left transition-colors sm:px-3",
              step === item.number ? "bg-primary/10 text-foreground" : "text-muted-foreground hover:bg-muted/50",
              item.number > furthestStep && "cursor-not-allowed opacity-50",
            )}
          >
            <span className={cn("flex size-7 shrink-0 items-center justify-center rounded-full border text-xs font-semibold", step === item.number ? "border-primary bg-primary text-primary-foreground" : item.number < step ? "border-primary text-primary" : "border-border")}>{item.number}</span>
            <span className="min-w-0"><span className="block text-sm font-medium">{item.title}</span><span className="hidden truncate text-xs text-muted-foreground sm:block">{item.detail}</span></span>
          </button>
        ))}
      </nav>

      <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
        {/* PREVIEW */}
        <div className={cn("flex flex-col gap-3 lg:sticky lg:top-[68px] lg:order-1", step === 3 ? "order-1" : "order-2")}>
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">Vista previa</span>
            <span className="text-xs text-muted-foreground">{current.hint}</span>
          </div>
          <div className="flex justify-center rounded-lg border border-border bg-sunken p-3 sm:p-4">
            <div
              className="w-full overflow-hidden rounded-md bg-muted shadow-md"
              style={{ aspectRatio: current.ratio, maxWidth: current.maxW }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                key={imageUrl}
                src={imageUrl}
                alt="Vista previa de la pieza"
                className="h-full w-full object-contain"
              />
            </div>
          </div>
        </div>

        {/* OPCIONES */}
        <aside className="rounded-lg border border-border bg-card px-4 py-5">
          <div className="mb-1 flex items-center justify-between">
            <div>
              <h2 className="text-base font-semibold tracking-tight">{STEPS[step - 1].title}</h2>
              <p className="text-xs text-muted-foreground">{STEPS[step - 1].detail}</p>
            </div>
            {!isDefault && step !== 3 && (
              <Button variant="ghost" size="sm" onClick={reset}>
                <RotateCcw /> Restablecer
              </Button>
            )}
          </div>

          {step === 1 && (
          <Group title="Datos del flyer">
            <div className="grid gap-3">
              <div className="grid gap-1.5"><Label htmlFor="flyer-title">Título</Label><Input id="flyer-title" value={o.copy.title ?? ""} maxLength={100} onChange={(event) => setCopy("title", event.target.value)} /></div>
              <div className="grid gap-1.5"><Label htmlFor="flyer-description">Descripción</Label><Textarea id="flyer-description" value={o.copy.description ?? ""} maxLength={240} onChange={(event) => setCopy("description", event.target.value)} rows={3} /><span className="text-xs text-muted-foreground">Se resume para que entre en el diseño.</span></div>
              <div className="grid gap-1.5"><Label htmlFor="flyer-location">Ubicación</Label><Input id="flyer-location" value={o.copy.location ?? ""} maxLength={140} onChange={(event) => setCopy("location", event.target.value)} /></div>
              <div className="grid gap-1.5"><Label htmlFor="flyer-phone">Teléfono de contacto</Label><Input id="flyer-phone" type="tel" value={o.copy.phone ?? ""} maxLength={60} placeholder="Ej.: +54 9 341 555 1234" onChange={(event) => setCopy("phone", event.target.value)} /></div>
              <div className="grid gap-1.5"><Label>Tipo de operación</Label><Select value={o.copy.operation ?? operation} onValueChange={(value) => setCopy("operation", value)}><SelectTrigger className="w-full" aria-label="Tipo de operación"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="venta">Venta</SelectItem><SelectItem value="alquiler">Alquiler</SelectItem></SelectContent></Select></div>
            </div>
            <p className="text-xs text-muted-foreground">Estos cambios solo modifican la pieza; la ficha de la propiedad conserva sus datos.</p>
          </Group>
          )}

          {step === 2 && <>
          <Group title="Plantilla">
            <div className="flex flex-col gap-1.5">
              {LAYOUT_OPTIONS.map((l) => (
                <button
                  key={l.value}
                  type="button"
                  onClick={() => set("layout", l.value)}
                  aria-pressed={o.layout === l.value}
                  className={cn(
                    "flex flex-col items-start rounded-md border px-3 py-2 text-left transition-colors",
                    o.layout === l.value ? "border-primary bg-primary/5" : "border-border hover:bg-muted/50",
                  )}
                >
                  <span className="text-sm font-medium text-foreground">{l.label}</span>
                  <span className="text-xs text-muted-foreground">{l.hint}</span>
                </button>
              ))}
            </div>
          </Group>

          <Group title="Tipografía">
            <div className="grid gap-1.5">
              {FONT_OPTIONS.map((font) => <button key={font.value} type="button" onClick={() => set("font", font.value)} aria-pressed={o.font === font.value} className={cn("flex items-center justify-between rounded-md border px-3 py-2 text-left transition-colors", o.font === font.value ? "border-primary bg-primary/5" : "border-border hover:bg-muted/50")}>
                <span className="text-sm font-medium">{font.label}</span><span className="text-xs text-muted-foreground">{font.hint}</span>
              </button>)}
            </div>
          </Group>

          {images.length > 1 && (
            <Group title={`Foto · ${o.photo + 1} de ${images.length}`}>
              <div className="grid grid-cols-4 gap-1.5">
                {images.map((src, i) => (
                  <button
                    key={src}
                    type="button"
                    onClick={() => set("photo", i)}
                    aria-pressed={o.photo === i}
                    aria-label={`Foto ${i + 1}`}
                    className={cn(
                      "relative aspect-square overflow-hidden rounded-md border-2 transition-colors",
                      o.photo === i ? "border-primary" : "border-transparent hover:border-border-strong",
                    )}
                  >
                    <Image src={src} alt="" fill sizes="80px" className="object-cover" unoptimized />
                  </button>
                ))}
              </div>
            </Group>
          )}

          <Group title="Color de acento">
            <div className="flex items-center gap-2">
              <div className="flex gap-1.5">
                {ACCENTS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => applyAccent(c)}
                    aria-label={c}
                    aria-pressed={o.accent.toLowerCase() === c.toLowerCase()}
                    className={cn(
                      "size-7 rounded-full border-2 transition-transform",
                      o.accent.toLowerCase() === c.toLowerCase()
                        ? "scale-110 border-foreground"
                        : "border-transparent",
                    )}
                    style={{ backgroundColor: c }}
                  />
                ))}
              </div>
              <Input
                value={accentInput}
                onChange={(e) => applyAccent(e.target.value)}
                aria-label="Color hex"
                className="w-24 font-mono text-xs"
                maxLength={7}
              />
            </div>
            {(o.layout === "split" || o.layout === "framed") && (
              <div className="flex rounded-md border border-border bg-card p-0.5" role="group" aria-label="Tema del panel">
                {(["dark", "light"] as Theme[]).map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => set("theme", t)}
                    aria-pressed={o.theme === t}
                    className={cn(
                      "h-7 flex-1 rounded-[4px] text-sm transition-colors",
                      o.theme === t
                        ? "bg-muted font-medium text-foreground"
                        : "text-muted-foreground hover:text-foreground",
                    )}
                  >
                    {t === "dark" ? "Panel de color" : "Panel blanco"}
                  </button>
                ))}
              </div>
            )}
          </Group>

          <Group title="Logo y marca">
            <Label className="flex cursor-pointer items-center gap-2 font-normal">
              <Checkbox checked={o.show.brand} onCheckedChange={() => toggleShow("brand")} />
              Mostrar logo o nombre de marca
            </Label>
            <p className="text-xs text-muted-foreground">Si no hay un logo configurado, se usa el nombre de la inmobiliaria.</p>
          </Group>

          <Group title="Etiqueta">
            <div className="flex flex-wrap gap-1.5">
              <Chip
                active={!o.noBadge && o.badge === ""}
                onClick={() => setO((s) => ({ ...s, badge: "", noBadge: false }))}
              >
                Automática
              </Chip>
              {BADGE_PRESETS.map((b) => (
                <Chip
                  key={b}
                  active={!o.noBadge && o.badge === b}
                  onClick={() => setO((s) => ({ ...s, badge: b, noBadge: false }))}
                >
                  {b}
                </Chip>
              ))}
              <Chip active={o.noBadge} onClick={() => setO((s) => ({ ...s, noBadge: true }))}>
                Sin etiqueta
              </Chip>
            </div>
            <Input
              value={o.noBadge ? "" : o.badge}
              disabled={o.noBadge}
              onChange={(e) =>
                setO((s) => ({ ...s, badge: e.target.value.slice(0, 24), noBadge: false }))
              }
              placeholder="Texto propio (máx. 24)"
              aria-label="Etiqueta personalizada"
            />
          </Group>

          <Group title="Mostrar">
            <div className="flex flex-col gap-2">
              {SHOW_OPTIONS.map((s) => {
                const disabled =
                  (o.layout === "minimal" && (s.key === "specs" || s.key === "type")) ||
                  ((o.layout === "editorial" || o.layout === "framed") && s.key === "specs") ||
                  (o.layout === "framed" && s.key === "type");
                return (
                  <Label
                    key={s.key}
                    className={cn("flex h-7 cursor-pointer items-center gap-2 font-normal", disabled && "opacity-50")}
                  >
                    <Checkbox
                      checked={o.show[s.key]}
                      disabled={disabled}
                      onCheckedChange={() => toggleShow(s.key)}
                    />
                    {s.label}
                    {disabled && (
                      <span className="text-xs text-muted-foreground">· no aplica a esta plantilla</span>
                    )}
                  </Label>
                );
              })}
            </div>
          </Group>
          </>}

          {step === 3 && <>
            <Group title="Formato de la pieza">
              <div className="grid gap-1.5" role="group" aria-label="Formato">
                {FORMATS.map((item) => (
                  <button
                    key={item.value}
                    type="button"
                    onClick={() => setFormat(item.value)}
                    aria-pressed={format === item.value}
                    className={cn(
                      "flex items-center justify-between rounded-md border px-3 py-2 text-left transition-colors",
                      format === item.value ? "border-primary bg-primary/5" : "border-border hover:bg-muted/50",
                    )}
                  >
                    <span className="text-sm font-medium">{item.label}</span>
                    <span className="text-xs text-muted-foreground">{item.hint}</span>
                  </button>
                ))}
              </div>
            </Group>
            <Group title="Resumen">
              <div className="grid gap-3 text-sm">
                <div className="flex items-start justify-between gap-3"><span className="text-muted-foreground">Propiedad</span><span className="max-w-48 text-right font-medium">{o.copy.title || "Sin título"}</span></div>
                <div className="flex items-center justify-between gap-3"><span className="text-muted-foreground">Operación</span><span className="font-medium capitalize">{o.copy.operation ?? operation}</span></div>
                <div className="flex items-center justify-between gap-3"><span className="text-muted-foreground">Diseño</span><span className="font-medium">{LAYOUT_OPTIONS.find((item) => item.value === o.layout)?.label}</span></div>
                <div className="flex items-center justify-between gap-3"><span className="text-muted-foreground">Tipografía</span><span className="font-medium">{FONT_OPTIONS.find((item) => item.value === o.font)?.label}</span></div>
                <div className="flex items-center justify-between gap-3"><span className="text-muted-foreground">Marca</span><span className="font-medium">{o.show.brand ? "Visible" : "Oculta"}</span></div>
              </div>
              <div className="flex gap-2">
                <Button type="button" variant="ghost" size="sm" onClick={() => setStep(1)}>Editar datos</Button>
                <Button type="button" variant="ghost" size="sm" onClick={() => setStep(2)}>Editar diseño</Button>
              </div>
            </Group>
          </>}

          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border pt-5">
            {step > 1 ? (
              <Button type="button" variant="outline" onClick={() => setStep((step - 1) as Step)}>
                <ChevronLeft /> Anterior
              </Button>
            ) : <span />}
            {step < 3 ? (
              <Button type="button" onClick={nextStep}>
                Siguiente <ChevronRight />
              </Button>
            ) : (
              <div className="flex flex-wrap gap-2">
                <Button type="button" variant="outline" onClick={copyLink}>
                  {copied ? <Check /> : <Link2 />} Copiar link
                </Button>
                <Button asChild>
                  {/* Descargar la pieza cierra la tarea "Pieza de Instagram" del motor. */}
                  <a href={`${imageUrl}&download=1`} onClick={() => {
                    void completeRuleTaskAction({ property_id: propertyId, rule: "PROP_INSTAGRAM" })
                      .then((r) => { if (r.success && r.message) toast.success(r.message); })
                      .catch(() => {});
                  }}><Download /> Descargar PNG</a>
                </Button>
              </div>
            )}
          </div>
        </aside>
      </div>
    </Page>
  );
}
