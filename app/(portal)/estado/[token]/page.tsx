import { createHash } from "node:crypto";
import type { Metadata } from "next";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { ymdInAppTz } from "@/lib/dates";
import { BRAND, whatsappLink } from "@/lib/brand";
import { formatDate } from "@/features/rentals/logic";
import { loadContactStatement, parseStatementYear } from "@/features/rentals/contactStatement";
import { ContactStatementView } from "@/features/rentals/ContactStatementView";
import { PrintSummaryButton } from "@/features/rentals/PrintSummaryButton";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Estado de cuenta",
  robots: { index: false, follow: false },
  // El token va en la URL: que no viaje en el Referer a sitios externos.
  referrer: "no-referrer",
};

// /estado/[token]: estado de cuenta de solo lectura para un inquilino o
// propietario, sin usuario. Se valida el hash del token (vigente y no
// revocado) y se lee con service_role solo lo de ese contacto.
export default async function EstadoDeCuentaPage({ params, searchParams }: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ anio?: string }>;
}) {
  const { token } = await params;
  const { anio } = await searchParams;

  const tokenHash = /^[A-Za-z0-9_-]{20,64}$/.test(token) ? createHash("sha256").update(token).digest("hex") : null;
  const { data: link } = tokenHash
    ? await supabaseAdmin.from("rental_portal_links")
      .select("id, contact_id, expires_at, revoked_at, view_count")
      .eq("token_hash", tokenHash).maybeSingle()
    : { data: null };
  const valid = link && !link.revoked_at && new Date(link.expires_at) > new Date();
  if (!valid) return <InvalidLink />;

  await supabaseAdmin.from("rental_portal_links")
    .update({ last_viewed_at: new Date().toISOString(), view_count: link.view_count + 1 }).eq("id", link.id);

  const today = ymdInAppTz();
  const year = parseStatementYear(anio, today);
  const data = await loadContactStatement(supabaseAdmin, link.contact_id, { today, year, internal: false });
  if (!data) return <InvalidLink />;

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

      <ContactStatementView data={data} year={year} internal={false} yearHref={(y) => `?anio=${y ?? "todo"}`} />

      <footer className="border-t border-border pt-4 text-xs text-muted-foreground">
        <p>Información de solo lectura emitida por {BRAND.name}. No válida como factura.</p>
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
