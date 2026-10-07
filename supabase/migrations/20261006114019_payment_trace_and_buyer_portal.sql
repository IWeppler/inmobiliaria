-- 1) Pago informado con traza ------------------------------------------

-- Rechazo con motivo, visible para el inquilino en su portal.
alter table public.rental_inbox drop constraint rental_inbox_status_check;
alter table public.rental_inbox add constraint rental_inbox_status_check
  check (status in ('PENDIENTE', 'CONFIRMADO', 'DESCARTADO', 'RECHAZADO'));
alter table public.rental_inbox add column if not exists reject_reason text;

-- Cada cobro sabe quién lo registró y de qué comprobante salió.
alter table public.rental_payment_entries
  add column if not exists recorded_by uuid default auth.uid() references public.agents(id) on delete set null,
  add column if not exists inbox_id uuid references public.rental_inbox(id) on delete set null;
create index if not exists rental_payment_entries_inbox on public.rental_payment_entries(inbox_id);

-- Historial del contrato. Lo escriben solo los triggers: así queda todo,
-- se registre el cobro por el portal, WhatsApp, a mano o conciliando.
create table public.rental_activity (
  id uuid primary key default gen_random_uuid(),
  contract_id uuid not null references public.rental_contracts(id) on delete cascade,
  at timestamptz not null default now(),
  actor_kind text not null check (actor_kind in ('AGENTE', 'CONTACTO', 'SISTEMA')),
  actor_agent_id uuid references public.agents(id) on delete set null,
  actor_contact_id uuid references public.rental_contacts(id) on delete set null,
  action text not null,
  detail text,
  amount numeric,
  currency text,
  ref_id uuid
);
create index rental_activity_contract on public.rental_activity(contract_id, at desc);
alter table public.rental_activity enable row level security;
create policy "Historial: contrato visible" on public.rental_activity for select to authenticated
  using (exists (select 1 from public.rental_contracts c where c.id = contract_id and (c.agent_id = auth.uid() or public.is_admin())));

create or replace function public.rental_log_inbox() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_amount numeric := nullif(new.ai_data #>> '{payment,amount}', '')::numeric;
  v_via text := case when new.source = 'PORTAL' then 'desde el portal' else 'por WhatsApp' end;
begin
  if new.contract_id is null then return new; end if;
  if tg_op = 'INSERT' then
    -- WhatsApp llega sin clasificar: se registra cuando la IA o el agente lo clasifica.
    if new.kind in ('COMPROBANTE', 'RECLAMO') then
      insert into rental_activity (contract_id, at, actor_kind, actor_contact_id, action, detail, amount, ref_id)
      values (new.contract_id, new.received_at, 'CONTACTO', new.contact_id,
        case when new.kind = 'COMPROBANTE' then 'PAGO_INFORMADO' else 'RECLAMO_INFORMADO' end,
        case when new.kind = 'COMPROBANTE' then 'Informó un pago ' || v_via || case when new.media_path is not null then ', con comprobante' else '' end
             else 'Reportó un problema ' || v_via end,
        case when new.kind = 'COMPROBANTE' then v_amount end, new.id);
    end if;
    return new;
  end if;

  if new.kind = 'COMPROBANTE' and old.kind is distinct from 'COMPROBANTE' and old.status = 'PENDIENTE' then
    insert into rental_activity (contract_id, at, actor_kind, actor_contact_id, action, detail, amount, ref_id)
    values (new.contract_id, new.received_at, 'CONTACTO', new.contact_id, 'PAGO_INFORMADO',
      'Informó un pago ' || v_via || case when new.media_path is not null then ', con comprobante' else '' end, v_amount, new.id);
  end if;
  if old.status = 'PENDIENTE' and new.status = 'RECHAZADO' then
    insert into rental_activity (contract_id, actor_kind, actor_agent_id, action, detail, amount, ref_id)
    values (new.contract_id, case when auth.uid() is null then 'SISTEMA' else 'AGENTE' end, auth.uid(), 'PAGO_RECHAZADO',
      'Rechazó el pago informado' || coalesce(': ' || new.reject_reason, ''), v_amount, new.id);
  elsif old.status = 'PENDIENTE' and new.status = 'DESCARTADO' and new.kind in ('COMPROBANTE', 'RECLAMO') then
    insert into rental_activity (contract_id, actor_kind, actor_agent_id, action, detail, ref_id)
    values (new.contract_id, case when auth.uid() is null then 'SISTEMA' else 'AGENTE' end, auth.uid(), 'MENSAJE_DESCARTADO',
      'Descartó ' || case when new.kind = 'COMPROBANTE' then 'el pago informado' else 'el reclamo' end, new.id);
  end if;
  return new;
end $$;

create trigger rental_inbox_activity after insert or update on public.rental_inbox
  for each row execute function public.rental_log_inbox();

create or replace function public.rental_log_payment_entry() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  r record := case when tg_op = 'DELETE' then old else new end;
  v_charge record;
begin
  select ch.contract_id, ch.description, ch.currency into v_charge from rental_charges ch where ch.id = r.charge_id;
  if v_charge.contract_id is null then return r; end if;
  if tg_op = 'INSERT' then
    insert into rental_activity (contract_id, actor_kind, actor_agent_id, action, detail, amount, currency, ref_id)
    values (v_charge.contract_id, case when auth.uid() is null then 'SISTEMA' else 'AGENTE' end, auth.uid(),
      case when new.inbox_id is not null then 'PAGO_CONFIRMADO' else 'COBRO_REGISTRADO' end,
      case when new.inbox_id is not null then 'Confirmó e imputó a ' else 'Registró un cobro de ' end || v_charge.description
        || ' · recibo R-' || lpad(new.receipt_number::text, 4, '0')
        || case when new.bank_movement_id is not null then ' · conciliado con el banco' else '' end,
      new.amount, v_charge.currency, new.id);
  else
    insert into rental_activity (contract_id, actor_kind, actor_agent_id, action, detail, amount, currency, ref_id)
    values (v_charge.contract_id, case when auth.uid() is null then 'SISTEMA' else 'AGENTE' end, auth.uid(), 'COBRO_ANULADO',
      'Anuló el cobro de ' || v_charge.description || ' · recibo R-' || lpad(old.receipt_number::text, 4, '0'),
      old.amount, v_charge.currency, old.id);
  end if;
  return r;
end $$;

create trigger rental_payment_entry_activity after insert or delete on public.rental_payment_entries
  for each row execute function public.rental_log_payment_entry();

-- Historial previo: los cobros y envíos que ya existen (sin autor conocido).
insert into public.rental_activity (contract_id, at, actor_kind, action, detail, amount, currency, ref_id)
select ch.contract_id, e.created_at, 'SISTEMA', 'COBRO_REGISTRADO',
  'Cobro de ' || ch.description || ' · recibo R-' || lpad(e.receipt_number::text, 4, '0'), e.amount, ch.currency, e.id
from public.rental_payment_entries e join public.rental_charges ch on ch.id = e.charge_id;
insert into public.rental_activity (contract_id, at, actor_kind, actor_contact_id, action, detail, ref_id)
select i.contract_id, i.received_at, 'CONTACTO', i.contact_id,
  case when i.kind = 'COMPROBANTE' then 'PAGO_INFORMADO' else 'RECLAMO_INFORMADO' end,
  case when i.kind = 'COMPROBANTE' then 'Informó un pago' else 'Reportó un problema' end
    || case when i.source = 'PORTAL' then ' desde el portal' else ' por WhatsApp' end, i.id
from public.rental_inbox i where i.contract_id is not null and i.kind in ('COMPROBANTE', 'RECLAMO');

-- 3) Portal del comprador ----------------------------------------------

create table public.deal_portal_links (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references public.leads(id) on delete cascade,
  token_hash text not null unique,
  expires_at timestamptz not null default now() + interval '180 days',
  revoked_at timestamptz,
  last_viewed_at timestamptz,
  view_count integer not null default 0,
  created_by uuid default auth.uid() references public.agents(id) on delete set null,
  created_at timestamptz not null default now()
);
create index deal_portal_links_lead on public.deal_portal_links(lead_id);
alter table public.deal_portal_links enable row level security;
create policy "Links de operación: lead visible" on public.deal_portal_links for all to authenticated
  using (exists (select 1 from public.leads l where l.id = lead_id and (l.agent_id = auth.uid() or public.is_admin())))
  with check (exists (select 1 from public.leads l where l.id = lead_id and (l.agent_id = auth.uid() or public.is_admin())));
