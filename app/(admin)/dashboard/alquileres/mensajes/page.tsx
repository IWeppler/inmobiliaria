import { redirect } from "next/navigation";
import { createClientServer } from "@/lib/supabase";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { ymdInAppTz } from "@/lib/dates";
import { whatsappEnabled } from "@/lib/whatsapp";
import { Page, PageHeader } from "@/shared/components/PageShell";
import { RentalsNav } from "@/features/rentals/RentalsNav";
import { loadReconciliationCandidates } from "@/features/rentals/reconciliationData";
import { InboxView, type InboxItemView } from "@/features/rentals/InboxView";
import type { InboxAiData, InboxKind } from "@/features/rentals/inbox";

// /dashboard/alquileres/mensajes: WhatsApp de inquilinos y propietarios,
// clasificado por IA, para confirmar con un clic (E4.18).
export default async function MensajesPage() {
  const supabase = await createClientServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: rows } = await supabase.from("rental_inbox")
    .select(`id, received_at, text, media_path, media_mime, kind, ai_summary, ai_data, ai_error, status, result_note, contract_id, source, resolved_by, resolved_at,
      contact:rental_contacts(full_name, kind, phone),
      contract:rental_contracts(currency, property:properties(title))`)
    .order("received_at", { ascending: false })
    .limit(80);

  const items = rows ?? [];
  // Los adjuntos viven en una ruta sin policy de agentes: se firman acá,
  // solo para los mensajes que el usuario ya puede ver (RLS de la consulta).
  const signed = new Map<string, string>();
  await Promise.all(items.filter((i) => i.media_path && i.status === "PENDIENTE").map(async (i) => {
    const { data } = await supabaseAdmin.storage.from("rental-docs").createSignedUrl(i.media_path!, 3600);
    if (data?.signedUrl) signed.set(i.id, data.signedUrl);
  }));

  const contractIds = [...new Set(items.filter((i) => i.status === "PENDIENTE" && i.contract_id).map((i) => i.contract_id!))];
  const candidates = contractIds.length ? await loadReconciliationCandidates(supabase, ymdInAppTz(), contractIds) : [];
  // Quién resolvió cada mensaje (traza visible en "Resueltos").
  const resolverIds = [...new Set(items.map((i) => i.resolved_by).filter((id): id is string => !!id))];
  const { data: resolvers } = resolverIds.length
    ? await supabase.from("agents").select("id, full_name").in("id", resolverIds)
    : { data: [] as { id: string; full_name: string }[] };
  const resolverName = new Map((resolvers ?? []).map((a) => [a.id, a.full_name]));

  const view: InboxItemView[] = items.map((i) => {
    const contact = i.contact as unknown as { full_name: string; kind: string; phone: string | null } | null;
    const contract = i.contract as unknown as { currency: string; property: { title: string } | null } | null;
    return {
      id: i.id,
      receivedAt: i.received_at,
      text: i.text,
      mediaUrl: signed.get(i.id) ?? null,
      mediaMime: i.media_mime,
      kind: i.kind as InboxKind,
      summary: i.ai_summary,
      data: (i.ai_data as unknown as InboxAiData | null) ?? null,
      aiError: i.ai_error,
      status: i.status as InboxItemView["status"],
      resultNote: i.result_note,
      resolvedBy: i.resolved_by ? resolverName.get(i.resolved_by) ?? null : null,
      resolvedAt: i.resolved_at,
      contractId: i.contract_id,
      currency: contract?.currency ?? "ARS",
      propertyTitle: contract?.property?.title ?? null,
      contactName: contact?.full_name ?? "Contacto",
      contactRole: contact?.kind === "owner" ? "Propietario" : contact?.kind === "tenant" ? "Inquilino" : "Contacto",
      contactPhone: contact?.phone ?? null,
      source: i.source === "PORTAL" ? "PORTAL" : "WHATSAPP",
    };
  });

  return (
    <Page>
      <PageHeader title="Alquileres" description="Lo que mandan inquilinos y propietarios por WhatsApp o desde su portal, leído por IA. Nada se registra sin tu confirmación." />
      <RentalsNav />
      <InboxView items={view} candidates={candidates} today={ymdInAppTz()} whatsappConfigured={whatsappEnabled} />
    </Page>
  );
}
