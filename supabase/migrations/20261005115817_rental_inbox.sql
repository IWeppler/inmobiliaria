-- WhatsApp entrante con IA (E4.18).
--
-- Mensajes de inquilinos y propietarios (números que coinciden con un
-- contacto de alquileres). La IA los clasifica y extrae datos; el agente
-- confirma: nada se registra solo. Lo escribe el webhook (service role);
-- los agentes leen y resuelven los de sus contratos, admin todos.

create table public.rental_inbox (
  id uuid primary key default gen_random_uuid(),
  wa_message_id text not null unique,
  contact_id uuid not null references public.rental_contacts(id) on delete cascade,
  contract_id uuid references public.rental_contracts(id) on delete set null,
  received_at timestamptz not null default now(),
  text text,
  media_path text,
  media_mime text,
  kind text not null default 'PENDIENTE_IA'
    check (kind in ('PENDIENTE_IA', 'COMPROBANTE', 'RECLAMO', 'CONSULTA', 'OTRO')),
  ai_summary text,
  ai_data jsonb,
  ai_error text,
  status text not null default 'PENDIENTE' check (status in ('PENDIENTE', 'CONFIRMADO', 'DESCARTADO')),
  result_note text,
  resolved_by uuid,
  resolved_at timestamptz
);
create index rental_inbox_pending on public.rental_inbox(received_at desc) where status = 'PENDIENTE';
create index rental_inbox_contract on public.rental_inbox(contract_id);

alter table public.rental_inbox enable row level security;
revoke all on public.rental_inbox from anon, authenticated;
grant select on public.rental_inbox to authenticated;
grant update (kind, status, result_note, resolved_by, resolved_at) on public.rental_inbox to authenticated;

create policy "Mensajes: contrato visible" on public.rental_inbox for select to authenticated
using (public.is_admin() or exists (select 1 from public.rental_contracts c
  where c.id = contract_id and c.agent_id = auth.uid()));
create policy "Mensajes: resolver los visibles" on public.rental_inbox for update to authenticated
using (public.is_admin() or exists (select 1 from public.rental_contracts c
  where c.id = contract_id and c.agent_id = auth.uid()))
with check (public.is_admin() or exists (select 1 from public.rental_contracts c
  where c.id = contract_id and c.agent_id = auth.uid()));
