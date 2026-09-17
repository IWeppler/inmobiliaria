"use client";

import { useMemo, useState } from "react";
import Image from "next/image";
import { Download, Link2, Check, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import { Label } from "@/shared/components/ui/label";
import { Checkbox } from "@/shared/components/ui/checkbox";
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

const FORMATS = [
  // maxW: ancho del preview para que la pieza entre en pantalla sin scroll.
  { value: "square", label: "Cuadrado", hint: "1:1 · 1080×1080", ratio: "1 / 1", maxW: 520 },
  { value: "portrait", label: "Feed", hint: "4:5 · 1080×1350", ratio: "4 / 5", maxW: 440 },
  { value: "story", label: "Historia", hint: "9:16 · 1080×1920", ratio: "9 / 16", maxW: 330 },
] as const;
type Format = (typeof FORMATS)[number]["value"];

const LAYOUT_OPTIONS: { value: Layout; label: string; hint: string }[] = [
  { value: "photo", label: "Foto completa", hint: "Datos sobre la foto, degradé abajo" },
  { value: "split", label: "Foto + panel", hint: "Foto arriba, datos en un panel" },
  { value: "minimal", label: "Mínima", hint: "Solo precio, ubicación y marca" },
];

const SHOW_OPTIONS: { key: ShowKey; label: string }[] = [
  { key: "price", label: "Precio" },
  { key: "title", label: "Título" },
  { key: "location", label: "Ubicación" },
  { key: "specs", label: "Dormitorios, baños, superficie" },
  { key: "type", label: "Tipo de propiedad" },
  { key: "brand", label: "Marca" },
];

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
}: {
  propertyId: string;
  title: string;
  images: string[];
}) {
  const [format, setFormat] = useState<Format>("square");
  const [o, setO] = useState<CardOptions>(DEFAULT_OPTIONS);
  const [copied, setCopied] = useState(false);
  const [accentInput, setAccentInput] = useState(DEFAULT_OPTIONS.accent);

  const set = <K extends keyof CardOptions>(k: K, v: CardOptions[K]) =>
    setO((s) => ({ ...s, [k]: v }));
  const toggleShow = (k: ShowKey) =>
    setO((s) => ({ ...s, show: { ...s.show, [k]: !s.show[k] } }));

  const query = useMemo(() => {
    const q = optionsToSearch(o);
    q.set("format", format);
    return q.toString();
  }, [o, format]);
  const imageUrl = `/api/social/${propertyId}?${query}`;
  const current = FORMATS.find((f) => f.value === format)!;
  const isDefault = query === "format=square";

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
    setO(DEFAULT_OPTIONS);
    setAccentInput(DEFAULT_OPTIONS.accent);
    setFormat("square");
  };

  return (
    <Page>
      <PageHeader
        backHref={`/dashboard/propiedades/${propertyId}`}
        title="Pieza para Instagram"
        description={title}
        actions={
          <>
            <Button variant="outline" onClick={copyLink}>
              {copied ? <Check /> : <Link2 />}
              Copiar link
            </Button>
            <Button asChild>
              <a href={`${imageUrl}&download=1`}>
                <Download />
                Descargar PNG
              </a>
            </Button>
          </>
        }
      />

      <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
        {/* PREVIEW */}
        <div className="flex flex-col gap-3 lg:sticky lg:top-[68px]">
          <div className="flex items-center justify-between">
            <div className="flex rounded-md border border-border bg-card p-0.5" role="group" aria-label="Formato">
              {FORMATS.map((f) => (
                <button
                  key={f.value}
                  type="button"
                  onClick={() => setFormat(f.value)}
                  aria-pressed={format === f.value}
                  title={f.hint}
                  className={cn(
                    "h-7 rounded-[4px] px-3 text-sm transition-colors",
                    format === f.value
                      ? "bg-muted font-medium text-foreground"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  {f.label}
                </button>
              ))}
            </div>
            <span className="text-xs text-muted-foreground">{current.hint}</span>
          </div>
          <div className="flex justify-center rounded-lg border border-border bg-sunken p-6">
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
            <h2 className="text-base font-semibold tracking-tight">Opciones</h2>
            {!isDefault && (
              <Button variant="ghost" size="sm" onClick={reset}>
                <RotateCcw /> Restablecer
              </Button>
            )}
          </div>

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
            {o.layout === "split" && (
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
                  o.layout === "minimal" && (s.key === "title" || s.key === "specs" || s.key === "type");
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
                      <span className="text-xs text-muted-foreground">· no aplica a Mínima</span>
                    )}
                  </Label>
                );
              })}
            </div>
          </Group>
        </aside>
      </div>
    </Page>
  );
}
