"use client";

import { useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import {
  ArrowLeft,
  Download,
  Sparkles,
  Copy,
  Check,
  Loader2,
} from "lucide-react";
import { Button } from "@/shared/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/shared/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/shared/components/ui/tabs";
import { cn } from "@/lib/utils";

type Variant = { tone: string; caption: string; hashtags: string[] };

const FORMATS = [
  { value: "square", label: "Cuadrado 1:1", ratio: "1 / 1" },
  { value: "portrait", label: "Feed 4:5", ratio: "4 / 5" },
  { value: "story", label: "Historia 9:16", ratio: "9 / 16" },
] as const;

type Format = (typeof FORMATS)[number]["value"];

// E2.2 — Generador de pieza para Instagram. Imagen renderizada en
// servidor (/api/social/[id]) con template white-label; copys generados
// por IA (/api/social/copy). Sin integración con Meta: el flujo es
// descargar + copiar y pegar en la app de Instagram.
export function InstagramPieceClient({
  propertyId,
  title,
}: {
  propertyId: string;
  title: string;
}) {
  const [format, setFormat] = useState<Format>("square");
  const [variants, setVariants] = useState<Variant[] | null>(null);
  const [generating, setGenerating] = useState(false);
  const [copiedIdx, setCopiedIdx] = useState<number | null>(null);

  const imageUrl = `/api/social/${propertyId}?format=${format}`;
  const current = FORMATS.find((f) => f.value === format)!;

  const generate = async () => {
    setGenerating(true);
    try {
      const res = await fetch("/api/social/copy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ propertyId }),
      });
      if (!res.ok) throw new Error(await res.text());
      const data = (await res.json()) as { variants: Variant[] };
      setVariants(data.variants);
    } catch (e) {
      toast.error(
        `No se pudo generar el copy: ${e instanceof Error ? e.message : ""}`
      );
    } finally {
      setGenerating(false);
    }
  };

  const fullText = (v: Variant) =>
    `${v.caption.trim()}\n\n${v.hashtags.map((h) => `#${h.replace(/^#/, "")}`).join(" ")}`;

  const copy = async (v: Variant, idx: number) => {
    try {
      await navigator.clipboard.writeText(fullText(v));
      setCopiedIdx(idx);
      toast.success("Copy copiado. Pegalo en Instagram.");
      setTimeout(() => setCopiedIdx(null), 2000);
    } catch {
      toast.error("No se pudo copiar.");
    }
  };

  return (
    <div className="theme-tn flex flex-col w-full max-w-[1400px] mx-auto px-4 py-6 gap-6">
      <div className="flex items-center gap-4">
        <Button asChild variant="outline" size="icon">
          <Link href="/dashboard/propiedades">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div className="min-w-0">
          <h1 className="text-[26px] font-serif font-semibold tracking-tight text-foreground truncate">
            Pieza para Instagram
          </h1>
          <p className="text-muted-foreground text-sm mt-1 truncate">{title}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,420px)_1fr] gap-6 items-start">
        {/* IMAGEN */}
        <Card className="shadow-none border-border rounded-md">
          <CardHeader>
            <CardTitle className="font-serif font-semibold">Imagen</CardTitle>
            <CardDescription>
              Template con precio, superficie, ubicación y tu marca.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Tabs value={format} onValueChange={(v) => setFormat(v as Format)}>
              <TabsList className="w-full">
                {FORMATS.map((f) => (
                  <TabsTrigger key={f.value} value={f.value} className="flex-1">
                    {f.label}
                  </TabsTrigger>
                ))}
              </TabsList>
            </Tabs>
            <div
              className="w-full bg-secondary rounded-md overflow-hidden border border-border"
              style={{ aspectRatio: current.ratio }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                key={imageUrl}
                src={imageUrl}
                alt="Vista previa de la pieza"
                className="w-full h-full object-contain"
              />
            </div>
            <Button asChild className="w-full">
              <a href={`${imageUrl}&download=1`}>
                <Download className="mr-2 h-4 w-4" />
                Descargar PNG
              </a>
            </Button>
          </CardContent>
        </Card>

        {/* COPY */}
        <Card className="shadow-none border-border rounded-md">
          <CardHeader className="flex flex-row items-start justify-between gap-4">
            <div>
              <CardTitle className="font-serif font-semibold">Copy</CardTitle>
              <CardDescription>
                3 variantes con hashtags locales. Elegí una y copiala.
              </CardDescription>
            </div>
            <Button onClick={generate} disabled={generating} className="shrink-0">
              {generating ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Sparkles className="mr-2 h-4 w-4" />
              )}
              {variants ? "Regenerar" : "Generar con IA"}
            </Button>
          </CardHeader>
          <CardContent>
            {!variants ? (
              <p className="text-sm text-muted-foreground py-8 text-center">
                Todavía no generaste copys para esta propiedad.
              </p>
            ) : (
              <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
                {variants.map((v, idx) => (
                  <div
                    key={idx}
                    className="flex flex-col rounded-md border border-border bg-secondary/30"
                  >
                    <div className="flex items-center justify-between px-3 py-2 border-b border-border">
                      <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                        {v.tone}
                      </span>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 text-xs"
                        onClick={() => copy(v, idx)}
                      >
                        {copiedIdx === idx ? (
                          <Check className="mr-1.5 h-3.5 w-3.5 text-green-600" />
                        ) : (
                          <Copy className="mr-1.5 h-3.5 w-3.5" />
                        )}
                        {copiedIdx === idx ? "Copiado" : "Copiar"}
                      </Button>
                    </div>
                    <p className="px-3 py-3 text-sm whitespace-pre-line text-foreground flex-1">
                      {v.caption}
                    </p>
                    <p
                      className={cn(
                        "px-3 pb-3 text-xs text-muted-foreground break-words"
                      )}
                    >
                      {v.hashtags.map((h) => `#${h.replace(/^#/, "")}`).join(" ")}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
