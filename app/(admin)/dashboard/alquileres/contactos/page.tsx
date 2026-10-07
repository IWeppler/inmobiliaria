import { redirect } from "next/navigation";
import { createClientServer } from "@/lib/supabase";
import { Page, PageHeader } from "@/shared/components/PageShell";
import { RentalsNav } from "@/features/rentals/RentalsNav";
import { ContactsView, type ContactRow } from "@/features/rentals/ContactsView";

type ContractRef = { id: string; status: string; owner_id: string; tenant_id: string; properties: { title: string } | null };

// /dashboard/alquileres/contactos: directorio de propietarios, inquilinos y
// garantes con los contratos en los que participan. Los contactos son
// compartidos; los contratos que se listan respetan el RLS del usuario.
export default async function ContactosPage() {
  const supabase = await createClientServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [{ data: contacts }, { data: contracts }, { data: parties }] = await Promise.all([
    supabase.from("rental_contacts").select("id, kind, full_name, document, phone, email, address, notes, iva_condition").order("full_name"),
    supabase.from("rental_contracts").select("id, status, owner_id, tenant_id, properties(title)"),
    supabase.from("rental_contract_parties").select("contact_id, contract_id"),
  ]);

  const contractList = (contracts ?? []) as unknown as ContractRef[];
  const byId = new Map(contractList.map((c) => [c.id, c]));
  const links = new Map<string, Set<string>>();
  const link = (contactId: string, contractId: string) => {
    if (!links.has(contactId)) links.set(contactId, new Set());
    links.get(contactId)!.add(contractId);
  };
  for (const c of contractList) { link(c.owner_id, c.id); link(c.tenant_id, c.id); }
  for (const p of parties ?? []) link(p.contact_id, p.contract_id);

  const rows: ContactRow[] = (contacts ?? []).map((contact) => ({
    ...contact,
    kind: contact.kind as ContactRow["kind"],
    contracts: [...(links.get(contact.id) ?? [])]
      .map((id) => byId.get(id))
      .filter((c): c is ContractRef => !!c)
      .map((c) => ({ id: c.id, title: c.properties?.title ?? "Contrato", active: c.status === "ACTIVO" }))
      .sort((a, b) => Number(b.active) - Number(a.active)),
  }));

  return (
    <Page>
      <PageHeader title="Alquileres" description="Propietarios, inquilinos y garantes" />
      <RentalsNav />
      <ContactsView contacts={rows} />
    </Page>
  );
}
