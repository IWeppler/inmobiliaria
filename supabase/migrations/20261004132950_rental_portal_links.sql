-- Portal, etapa 1: link privado de solo lectura con el estado de cuenta
-- de un contacto (inquilino o propietario), sin usuario ni contraseña.
--
-- Solo se guarda el hash SHA-256 del token: una filtración de la base no
-- expone links válidos. Por eso el link se muestra una única vez al crearlo.
-- Vence (expires_at) y se puede revocar. La página pública lo valida con
-- service_role y muestra solo los datos de ese contacto.

create table public.rental_portal_links (
  id uuid primary key default gen_random_uuid(),
  contact_id uuid not null references public.rental_contacts(id) on delete cascade,
  token_hash text not null unique check (length(token_hash) = 64),
  expires_at timestamptz not null default now() + interval '90 days',
  revoked_at timestamptz,
  last_viewed_at timestamptz,
  view_count integer not null default 0,
  created_by uuid references auth.users(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now()
);
create index rental_portal_links_contact on public.rental_portal_links(contact_id, created_at desc);

-- Los contactos son un directorio compartido: cualquier agente puede
-- generar o revocar el link de un contacto. Nunca anon.
alter table public.rental_portal_links enable row level security;
revoke all on public.rental_portal_links from anon, authenticated;
grant select, insert on public.rental_portal_links to authenticated;
grant update (revoked_at) on public.rental_portal_links to authenticated;
create policy "Links de estado de cuenta: agentes" on public.rental_portal_links for all to authenticated
  using (true) with check (true);
