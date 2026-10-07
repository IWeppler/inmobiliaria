import type { Metadata } from "next";
import { FileText } from "lucide-react";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { ymdInAppTz } from "@/lib/dates";
import { BRAND, whatsappLink } from "@/lib/brand";
import { formatDate, formatPeriod, money } from "@/features/rentals/logic";
import { loadContactStatement, parseStatementYear } from "@/features/rentals/contactStatement";
import { ContactStatementView } from "@/features/rentals/ContactStatementView";
import { PrintSummaryButton } from "@/features/rentals/PrintSummaryButton";
import { resolvePortalLink } from "@/features/rentals/portal";
import { PortalRequests, type PortalSubmission } from "@/features/rentals/PortalRequests";
import { CBTE_LABELS, formatInvoiceNumber } from "@/features/rentals/invoicing";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Estado de cuenta",
  robots: { index: false, follow: false },
  // El token va en la URL: que no viaje en el Referer a sitios externos.
  referrer: "no-referrer",
};

// /estado/[token]: portal de un inquilino o propietario, sin usuario. Se
// valida el hash del token (vigente y no revocado) y se lee con
// service_role solo lo de ese contacto. Etapa 2: descargar recibos,
// liquidaciones y facturas; informar pagos y reportar problemas.
export default async function EstadoDeCuentaPage({ params, searchParams }: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ anio?: string }>;
}) {
  const { token } = await params;
  const { anio } = await searchParams;

  const access = await resolvePortalLink(token);
  if (!access) return <InvalidLink />;
  await supabaseAdmin.from("rental_portal_links")
    .update({ last_viewed_at: new Date().toISOString(), view_count: access.viewCount + 1 }).eq("id", access.linkId);

  const today = ymdInAppTz();
  const year = parseStatementYear(anio, today);
  const base = `/estado/${token}`;
  const [data, { data: submissionsRaw }, { data: invoices }] = await Promise.all([
    loadContactStatement(supabaseAdmin, access.contactId, { today, year, internal: false, portalBase: base }),
    supabaseAdmin.from("rental_inbox").select("id, kind, status, received_at, ai_summary, reject_reason, resolved_at, entries:rental_payment_entries(id, receipt_number)")
      .eq("contact_id", access.contactId).eq("source", "PORTAL").order("received_at", { ascending: false }).limit(8),
    supabaseAdmin.from("rental_invoices").select("id, kind, cbte_tipo, pto_vta, cbte_nro, issued_on, total, currency, voided, service_from, environment")
      .eq("contact_id", access.contactId).order("issued_on", { ascending: false }).limit(24),
  ]);
  if (!data) return <InvalidLink />;

  const submissions: PortalSubmission[] = (submissionsRaw ?? []).map((s) => ({
    id: s.id, kind: s.kind, status: s.status, receivedAt: s.received_at, summary: s.ai_summary ?? "",
    rejectReason: s.reject_reason, resolvedAt: s.resolved_at,
    // Recibos del cobro que salió de este pago informado.
    receipts: ((s.entries ?? []) as { id: string; receipt_number: number }[])
      .map((e) => ({ href: `${base}/recibo/${e.id}`, number: e.receipt_number })),
  }));
  // Solo comprobantes con validez fiscal: los de homologación son de prueba.
  const fiscal = (invoices ?? []).filter((i) => i.environment === "PRODUCCION");

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 py-6 md:px-6">
      <header className="flex flex-wrap items-start justify-between gap-4 border-b border-border pb-4">
        <div>
          <p className="text-sm font-semibold">{BRAND.name}</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight">Estado de cuenta</h1>
          <p className="text-sm text-muted-foreground">{data.contact.full_name} · actualizado al {formatDate(today)}</p>
        </div>
        <div className="print:hidden"><PrintSummaryButton /></div>
      </header>

      {access.activeTenantContractId && <PortalRequests token={token} submissions={submissions} today={today} />}

      <ContactStatementView data={data} year={year} internal={false} yearHref={(y) => `?anio=${y ?? "todo"}`} />

      {fiscal.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-lg font-semibold tracking-tight">Facturas de honorarios</h2>
          <ul className="divide-y divide-border-subtle rounded-lg border border-border bg-card text-sm">
            {fiscal.map((inv) => (
              <li key={inv.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-2.5">
                <a href={`${base}/factura/${inv.id}`} target="_blank" rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 font-medium underline-offset-4 hover:underline">
                  <FileText className="size-4 text-muted-foreground" aria-hidden />
                  {CBTE_LABELS[inv.cbte_tipo]} {formatInvoiceNumber(inv.pto_vta, inv.cbte_nro)}
                </a>
                <span className="text-muted-foreground">{formatDate(inv.issued_on)}{inv.service_from ? ` · ${formatPeriod(inv.service_from)}` : ""}</span>
                <span className="ml-auto tabular-nums">{money(Number(inv.total), inv.currency)}</span>
                {inv.voided && <span className="text-xs text-muted-foreground">Anulada</span>}
              </li>
            ))}
          </ul>
        </section>
      )}

      <footer className="border-t border-border pt-4 text-xs text-muted-foreground">
        <p>Información emitida por {BRAND.name}. El estado de cuenta y los recibos no son válidos como factura.</p>
        <p className="mt-1 print:hidden">
          ¿Ves algo que no coincide? <a href={whatsappLink(`Hola, tengo una consulta sobre mi estado de cuenta (${data.contact.full_name}).`)}
            target="_blank" rel="noopener noreferrer" className="font-medium text-foreground underline-offset-4 hover:underline">Escribinos por WhatsApp</a>
          {BRAND.email && <> o a <a href={`mailto:${BRAND.email}`} className="font-medium text-foreground underline-offset-4 hover:underline">{BRAND.email}</a></>}.
        </p>
      </footer>
    </main>
  );
}

function InvalidLink() {
  return (
    <main className="mx-auto flex min-h-[100dvh] max-w-md flex-col items-center justify-center gap-3 px-4 text-center">
      <p className="text-sm font-semibold">{BRAND.name}</p>
      <h1 className="text-xl font-semibold tracking-tight">Este link ya no está disponible</h1>
      <p className="text-sm text-muted-foreground">Puede haber vencido o haber sido reemplazado por uno nuevo. Pedile a la inmobiliaria que te envíe un link actualizado.</p>
      <a href={whatsappLink("Hola, necesito un link nuevo para ver mi estado de cuenta.")} target="_blank" rel="noopener noreferrer"
        className="mt-2 text-sm font-medium underline-offset-4 hover:underline">Pedir un link nuevo por WhatsApp</a>
    </main>
  );
}
