import { notFound, redirect } from "next/navigation";
import { createClientServer } from "@/lib/supabase";
import { ymdInAppTz } from "@/lib/dates";
import { Page, PageHeader } from "@/shared/components/PageShell";
import { formatDate } from "@/features/rentals/logic";
import { loadContactStatement, parseStatementYear } from "@/features/rentals/contactStatement";
import { ContactStatementView } from "@/features/rentals/ContactStatementView";
import { PrintSummaryButton } from "@/features/rentals/PrintSummaryButton";
import { EditContactDialog } from "@/features/rentals/EditContractDialog";
import { PortalLinksPanel, type PortalLink } from "@/features/rentals/PortalLinksPanel";

const KIND_LABELS: Record<string, string> = { owner: "Propietario", tenant: "Inquilino", guarantor: "Garante" };

// /dashboard/alquileres/contactos/[id]: cuenta corriente consolidada de una
// persona en todos sus contratos, y links privados para compartírsela.
// RLS: el agente ve los contratos que administra.
export default async function ContactoPage({ params, searchParams }: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ anio?: string }>;
}) {
  const { id } = await params;
  const { anio } = await searchParams;
  const supabase = await createClientServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();

  const today = ymdInAppTz();
  const year = parseStatementYear(anio, today);
  const [data, { data: links }] = await Promise.all([
    loadContactStatement(supabase, id, { today, year, internal: true }),
    supabase.from("rental_portal_links")
      .select("id, created_at, expires_at, revoked_at, last_viewed_at, view_count")
      .eq("contact_id", id).order("created_at", { ascending: false }).limit(5),
  ]);
  if (!data) notFound();
  const { contact } = data;

  return (
    <Page>
      <div className="print:hidden">
        <PageHeader
          backHref="/dashboard/alquileres/contactos"
          title={contact.full_name}
          aside={<EditContactDialog contact={contact} />}
          description={[KIND_LABELS[contact.kind] ?? contact.kind, contact.document, contact.phone, contact.email].filter(Boolean).join(" · ")}
          actions={<PrintSummaryButton />}
        />
      </div>

      {/* Encabezado solo para la versión impresa / PDF */}
      <div className="hidden print:block">
        <h1 className="text-xl font-semibold">Estado de cuenta · {contact.full_name}</h1>
        <p className="text-sm text-muted-foreground">
          {[contact.document, contact.address].filter(Boolean).join(" · ")}
          {` · ${year ? `Año ${year}` : "Todo el historial"} · emitido el ${formatDate(today)}`}
        </p>
      </div>

      {(data.isTenant || data.isOwner) && (
        <PortalLinksPanel contactId={contact.id} contactName={contact.full_name} phone={contact.phone}
          links={(links ?? []) as PortalLink[]} now={new Date().toISOString()} />
      )}

      <ContactStatementView data={data} year={year} internal yearHref={(y) => `?anio=${y ?? "todo"}`} />

      <p className="hidden text-xs text-muted-foreground print:block">Estado de cuenta emitido por la administración. No válido como factura.</p>
    </Page>
  );
}
