import type { Metadata } from "next";
import { Check, Circle, CircleDot, Mail, Phone } from "lucide-react";
import { FaWhatsapp } from "react-icons/fa";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { ymdInAppTz } from "@/lib/dates";
import { BRAND, whatsappLink } from "@/lib/brand";
import { cn } from "@/lib/utils";
import { daysBetween, formatDate, money } from "@/features/rentals/logic";
import { resolveDealLink } from "@/features/dashboard/deals/dealPortal";
import {
  BUYER_CHECKLIST, BUYER_STAGE_TEXT, DEAL_CHECKLIST, DEAL_PARTY_LABELS, DEAL_STAGE_LABELS, LOAN_STATUS_LABELS,
  dealSteps, type DealChecklist, type DealStage,
} from "@/features/dashboard/deals/deal";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Tu compra",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

type Deal = {
  name: string; deal_stage: string | null; deal_price: number | null; deal_currency: string | null;
  reserva_at: string | null; reserva_amount: number | null; reserva_expires_at: string | null; boleto_at: string | null;
  deal_financing: boolean; deal_bank: string | null; deal_loan_status: string | null;
  escritura_at: string | null; escribano: string | null; deal_checklist: unknown;
  property: { title: string; street_address: string | null; neighborhood: string | null; city: string | null; property_images: { image_url: string; order: number | null }[] } | null;
  agent: { full_name: string; phone: string | null; email: string | null } | null;
};

// /operacion/[token]: el comprador sigue su compra sin llamar. Ve la etapa,
// las fechas, qué falta y de quién depende cada paso. Solo lectura.
export default async function OperacionPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const access = await resolveDealLink(token);
  if (!access) return <InvalidLink />;

  const { data } = await supabaseAdmin.from("leads")
    .select(`name, deal_stage, deal_price, deal_currency, reserva_at, reserva_amount, reserva_expires_at, boleto_at,
      deal_financing, deal_bank, deal_loan_status, escritura_at, escribano, deal_checklist,
      property:properties(title, street_address, neighborhood, city, property_images(image_url, order)),
      agent:agents(full_name, phone, email)`)
    .eq("id", access.leadId).maybeSingle();
  const deal = data as unknown as Deal | null;
  if (!deal?.deal_stage) return <InvalidLink />;
  await supabaseAdmin.from("deal_portal_links")
    .update({ last_viewed_at: new Date().toISOString(), view_count: access.viewCount + 1 }).eq("id", access.linkId);

  const today = ymdInAppTz();
  const stage = deal.deal_stage as DealStage;
  const steps = dealSteps(deal.deal_financing);
  const currentIdx = steps.indexOf(stage);
  const checklist = (deal.deal_checklist as DealChecklist) ?? {};
  const currency = deal.deal_currency ?? "USD";
  const photo = [...(deal.property?.property_images ?? [])].sort((a, b) => (a.order ?? 0) - (b.order ?? 0))[0]?.image_url;
  const address = [deal.property?.street_address, deal.property?.neighborhood, deal.property?.city].filter(Boolean).join(", ");
  const firstName = deal.name.split(" ")[0];
  const agentPhone = deal.agent?.phone?.replace(/\D/g, "");
  const contactHref = agentPhone
    ? `https://wa.me/${agentPhone}?text=${encodeURIComponent(`Hola ${deal.agent?.full_name.split(" ")[0] ?? ""}, te escribo por la compra de ${deal.property?.title ?? "la propiedad"}.`)}`
    : whatsappLink(`Hola, soy ${deal.name}, te escribo por la compra de ${deal.property?.title ?? "la propiedad"}.`);

  // Fecha de cada etapa: la cumplida o la prevista.
  const stepDate: Partial<Record<DealStage, string | null>> = {
    RESERVA: deal.reserva_at, BOLETO: deal.boleto_at, ESCRITURA: deal.escritura_at, ESCRITURADA: stage === "ESCRITURADA" ? deal.escritura_at : null,
  };
  const items = stage in DEAL_CHECKLIST ? DEAL_CHECKLIST[stage as keyof typeof DEAL_CHECKLIST].map((i) => ({ key: i.key, ...BUYER_CHECKLIST[i.key], done: !!checklist[i.key] })) : [];
  const yours = items.filter((i) => i.who === "comprador" && !i.done);
  const active = stage !== "CAIDA" && stage !== "ESCRITURADA";

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-6 md:px-6">
      <header className="border-b border-border pb-4">
        <p className="text-sm font-semibold">{BRAND.name}</p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight">Hola {firstName}, así va tu compra</h1>
        <p className="text-sm text-muted-foreground">Actualizado al {formatDate(today)}</p>
      </header>

      {deal.property && (
        <section className="flex items-center gap-4 rounded-lg border border-border bg-card p-3">
          {/* eslint-disable-next-line @next/next/no-img-element -- foto pública de la propiedad */}
          {photo && <img src={photo} alt="" className="size-20 shrink-0 rounded-md object-cover sm:size-24" />}
          <div className="min-w-0">
            <p className="font-medium">{deal.property.title}</p>
            {address && <p className="text-sm text-muted-foreground">{address}</p>}
            {deal.deal_price && <p className="mt-1 text-sm tabular-nums">{money(deal.deal_price, currency)}</p>}
          </div>
        </section>
      )}

      <section className={cn("rounded-lg border p-4", stage === "ESCRITURADA" ? "border-success/40 bg-success/5" : stage === "CAIDA" ? "border-border bg-muted/40" : "border-primary/30 bg-primary/5")}>
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Etapa actual</p>
        <p className="mt-1 text-lg font-semibold">{DEAL_STAGE_LABELS[stage]}</p>
        <p className="mt-1 text-sm">{BUYER_STAGE_TEXT[stage]}</p>
      </section>

      {stage !== "CAIDA" && (
        <section aria-label="Etapas de la compra">
          <ol className="space-y-0">
            {steps.map((s, i) => {
              const done = i < currentIdx || stage === "ESCRITURADA";
              const current = i === currentIdx && stage !== "ESCRITURADA";
              const date = stepDate[s];
              const Icon = done ? Check : current ? CircleDot : Circle;
              return (
                <li key={s} className="relative flex gap-3 pb-5 last:pb-0">
                  {i < steps.length - 1 && <span className={cn("absolute left-[11px] top-6 h-[calc(100%-1.25rem)] w-px", done ? "bg-success" : "bg-border")} aria-hidden />}
                  <span className={cn("flex size-6 shrink-0 items-center justify-center rounded-full border",
                    done ? "border-success bg-success text-white" : current ? "border-primary text-primary" : "border-border text-muted-foreground")}>
                    <Icon className="size-3.5" aria-hidden />
                  </span>
                  <div className="min-w-0 pt-0.5">
                    <p className={cn("text-sm", current ? "font-semibold" : done ? "font-medium" : "text-muted-foreground")}>{DEAL_STAGE_LABELS[s]}</p>
                    {date && <p className="text-xs text-muted-foreground">{done ? formatDate(date) : `Previsto para el ${formatDate(date)}`}</p>}
                  </div>
                </li>
              );
            })}
          </ol>
        </section>
      )}

      {active && yours.length > 0 && (
        <section className="space-y-2 rounded-lg border border-warning/40 bg-warning/5 p-4">
          <h2 className="font-semibold">Lo que necesitamos de vos</h2>
          <ul className="list-disc space-y-1 pl-5 text-sm">{yours.map((i) => <li key={i.key}>{i.label}</li>)}</ul>
          <p className="text-xs text-muted-foreground">Si ya lo hiciste, avisale a tu asesor para que lo marque.</p>
        </section>
      )}

      {active && items.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-lg font-semibold tracking-tight">En esta etapa</h2>
          <ul className="divide-y divide-border-subtle rounded-lg border border-border bg-card text-sm">
            {items.map((i) => (
              <li key={i.key} className="flex items-center gap-3 px-4 py-2.5">
                {i.done ? <Check className="size-4 shrink-0 text-success" aria-label="Listo" /> : <Circle className="size-4 shrink-0 text-muted-foreground" aria-label="Pendiente" />}
                <span className={cn("min-w-0 flex-1", i.done && "text-muted-foreground")}>{i.label}</span>
                <span className="shrink-0 text-xs text-muted-foreground">{i.done ? "Listo" : DEAL_PARTY_LABELS[i.who]}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {stage !== "CAIDA" && (
        <section className="space-y-2">
          <h2 className="text-lg font-semibold tracking-tight">Datos de la operación</h2>
          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 rounded-lg border border-border bg-card px-4 py-3 text-sm">
            {deal.deal_price && <><dt className="text-muted-foreground">Precio</dt><dd className="text-right tabular-nums">{money(deal.deal_price, currency)}</dd></>}
            {!!deal.reserva_amount && <><dt className="text-muted-foreground">Reserva entregada</dt><dd className="text-right tabular-nums">{money(deal.reserva_amount, currency)}</dd></>}
            {stage === "RESERVA" && deal.reserva_expires_at && (
              <><dt className="text-muted-foreground">La reserva vence</dt>
                <dd className="text-right">{formatDate(deal.reserva_expires_at)}{daysBetween(today, deal.reserva_expires_at) >= 0 && ` (en ${daysBetween(today, deal.reserva_expires_at)} días)`}</dd></>
            )}
            {deal.deal_financing && (
              <><dt className="text-muted-foreground">Crédito</dt>
                <dd className="text-right">{[deal.deal_bank, deal.deal_loan_status ? LOAN_STATUS_LABELS[deal.deal_loan_status] : "Por iniciar"].filter(Boolean).join(" · ")}</dd></>
            )}
            {deal.escribano && <><dt className="text-muted-foreground">Escribanía</dt><dd className="text-right">{deal.escribano}</dd></>}
          </dl>
        </section>
      )}

      <section className="space-y-3 rounded-lg border border-border bg-card p-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Tu asesor</p>
          <p className="mt-1 font-medium">{deal.agent?.full_name ?? BRAND.name}</p>
        </div>
        <div className="flex flex-wrap gap-2 text-sm">
          <a href={contactHref} target="_blank" rel="noopener noreferrer"
            className="inline-flex items-center gap-2 rounded-md bg-primary px-3 py-2 font-medium text-primary-foreground hover:bg-primary/90">
            <FaWhatsapp className="size-4" aria-hidden /> Escribir por WhatsApp
          </a>
          {agentPhone && (
            <a href={`tel:+${agentPhone}`} className="inline-flex items-center gap-2 rounded-md border border-border px-3 py-2 font-medium hover:bg-muted">
              <Phone className="size-4" aria-hidden /> Llamar
            </a>
          )}
          {deal.agent?.email && (
            <a href={`mailto:${deal.agent.email}`} className="inline-flex items-center gap-2 rounded-md border border-border px-3 py-2 font-medium hover:bg-muted">
              <Mail className="size-4" aria-hidden /> Email
            </a>
          )}
        </div>
      </section>

      <footer className="border-t border-border pt-4 text-xs text-muted-foreground">
        Información de seguimiento enviada por {BRAND.name}. Las fechas previstas pueden cambiar; los documentos firmados son los que valen.
      </footer>
    </main>
  );
}

function InvalidLink() {
  return (
    <main className="mx-auto flex min-h-[100dvh] max-w-md flex-col items-center justify-center gap-3 px-4 text-center">
      <p className="text-sm font-semibold">{BRAND.name}</p>
      <h1 className="text-xl font-semibold tracking-tight">Este link ya no está disponible</h1>
      <p className="text-sm text-muted-foreground">Puede haber vencido o haber sido reemplazado por uno nuevo. Pedile a tu asesor que te envíe uno actualizado.</p>
      <a href={whatsappLink("Hola, necesito un link nuevo para seguir mi compra.")} target="_blank" rel="noopener noreferrer"
        className="mt-2 text-sm font-medium underline-offset-4 hover:underline">Pedir un link nuevo por WhatsApp</a>
    </main>
  );
}
