-- Buyer Intelligence, seguimiento: cada vez que un asesor contacta a un
-- comprador por una propiedad queda un registro. Sirve para no contactar
-- dos veces por lo mismo y para medir cuánta venta sale de la base propia.
-- El estado vigente de un (lead, propiedad) es el último registro.
create table if not exists public.buyer_contacts (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  lead_id uuid not null references public.leads(id) on delete cascade,
  property_id uuid not null references public.properties(id) on delete cascade,
  outcome text not null
    check (outcome in ('contactado', 'respondio', 'visita', 'no_interesado')),
  reason text,
  created_by uuid default auth.uid() references auth.users(id) on delete set null
);

create index if not exists buyer_contacts_property_idx
  on public.buyer_contacts (property_id, created_at desc);
create index if not exists buyer_contacts_lead_idx
  on public.buyer_contacts (lead_id, created_at desc);

alter table public.buyer_contacts enable row level security;

-- Mismo alcance que el lead: agente asignado, creador o admin.
create policy "Contactos de compradores: dueño del lead o admin"
on public.buyer_contacts for all to authenticated
using (
  public.is_admin()
  or exists (
    select 1 from public.leads l
    where l.id = buyer_contacts.lead_id
      and (l.agent_id = auth.uid() or l.created_by = auth.uid())
  )
)
with check (
  public.is_admin()
  or exists (
    select 1 from public.leads l
    where l.id = buyer_contacts.lead_id
      and (l.agent_id = auth.uid() or l.created_by = auth.uid())
  )
);

revoke all on public.buyer_contacts from anon;
