-- Liquidaciones con varios propietarios (condominios, sucesiones).
--
-- El neto de cada liquidación se reparte entre los titulares del contrato:
-- el propietario principal (owner_id) y los co-propietarios cargados en
-- rental_contract_parties con su share_pct. El principal se queda con el
-- resto hasta 100 %. El reparto se congela al emitir (foto de ese momento)
-- y cada parte registra su propia transferencia. rental_settlements
-- .paid_to_owner_at pasa a ser derivado: se completa cuando se pagaron
-- todas las partes.

-- === Validación de porcentajes de co-propietarios ===
alter table public.rental_contract_parties add constraint rental_contract_parties_co_owner_share
  check (role <> 'CO_PROPIETARIO' or (share_pct is not null and share_pct > 0));

create function public.rental_validate_owner_shares() returns trigger
language plpgsql set search_path = public as $$
declare v_total numeric;
begin
  if new.role <> 'CO_PROPIETARIO' then return new; end if;
  select coalesce(sum(share_pct), 0) into v_total from public.rental_contract_parties
    where contract_id = new.contract_id and role = 'CO_PROPIETARIO' and id <> new.id;
  if v_total + new.share_pct >= 100 then
    raise exception 'Los co-propietarios suman % %%: el propietario principal tiene que conservar una parte', v_total + new.share_pct;
  end if;
  return new;
end $$;
create trigger rental_contract_parties_owner_shares
before insert or update of share_pct, role on public.rental_contract_parties
for each row execute function public.rental_validate_owner_shares();

-- === Titulares de un contrato con su porcentaje ===
create function public.rental_owner_shares(p_contract_id uuid)
returns table (contact_id uuid, share_pct numeric, is_primary boolean)
language sql stable set search_path = public as $$
  select c.owner_id, 100 - coalesce((
      select sum(p.share_pct) from public.rental_contract_parties p
      where p.contract_id = c.id and p.role = 'CO_PROPIETARIO'), 0), true
  from public.rental_contracts c where c.id = p_contract_id
  union all
  select p.contact_id, p.share_pct, false from public.rental_contract_parties p
  where p.contract_id = p_contract_id and p.role = 'CO_PROPIETARIO';
$$;
revoke all on function public.rental_owner_shares(uuid) from public, anon;
grant execute on function public.rental_owner_shares(uuid) to authenticated;

-- === Partes de cada liquidación ===
create table public.rental_settlement_shares (
  id uuid primary key default gen_random_uuid(),
  settlement_id uuid not null references public.rental_settlements(id) on delete cascade,
  contact_id uuid not null references public.rental_contacts(id) on delete restrict,
  share_pct numeric(5,2) not null check (share_pct > 0 and share_pct <= 100),
  amount numeric(14,2) not null,
  is_primary boolean not null default false,
  paid_to_owner_at date,
  payout_method text check (payout_method is null or payout_method in ('TRANSFERENCIA', 'EFECTIVO', 'OTRO')),
  payout_reference text,
  created_at timestamptz not null default now(),
  unique (settlement_id, contact_id)
);
create index rental_settlement_shares_contact on public.rental_settlement_shares(contact_id);
create index rental_settlement_shares_unpaid on public.rental_settlement_shares(settlement_id) where paid_to_owner_at is null;

-- Al emitir: una parte por titular. Los centavos de redondeo van al
-- principal para que la suma sea exactamente el neto.
create function public.rental_create_settlement_shares() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.rental_settlement_shares (settlement_id, contact_id, share_pct, amount, is_primary)
  select new.id, s.contact_id, s.share_pct, round(new.net_amount * s.share_pct / 100, 2), s.is_primary
  from public.rental_owner_shares(new.contract_id) s
  where s.share_pct > 0;

  update public.rental_settlement_shares sh
    set amount = sh.amount + (new.net_amount - (select sum(x.amount) from public.rental_settlement_shares x where x.settlement_id = new.id))
  where sh.settlement_id = new.id and sh.is_primary;
  return new;
end $$;
revoke execute on function public.rental_create_settlement_shares() from public, anon, authenticated;
create trigger rental_settlements_create_shares
after insert on public.rental_settlements
for each row execute function public.rental_create_settlement_shares();

-- La liquidación queda transferida cuando todas sus partes lo están.
create function public.rental_sync_settlement_paid() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  update public.rental_settlements s set paid_to_owner_at = (
    select case when bool_and(x.paid_to_owner_at is not null) then max(x.paid_to_owner_at) end
    from public.rental_settlement_shares x where x.settlement_id = s.id)
  where s.id = new.settlement_id;
  return null;
end $$;
revoke execute on function public.rental_sync_settlement_paid() from public, anon, authenticated;
create trigger rental_settlement_shares_sync_paid
after update of paid_to_owner_at on public.rental_settlement_shares
for each row execute function public.rental_sync_settlement_paid();

-- === Permisos ===
-- Las partes las crea el trigger; el usuario solo lee y registra el pago.
-- El pago a nivel liquidación deja de editarse directo (lo deriva el trigger).
alter table public.rental_settlement_shares enable row level security;
revoke all on public.rental_settlement_shares from anon, authenticated;
grant select on public.rental_settlement_shares to authenticated;
grant update (paid_to_owner_at, payout_method, payout_reference) on public.rental_settlement_shares to authenticated;
revoke update (paid_to_owner_at, payout_method, payout_reference) on public.rental_settlements from authenticated;

create policy "Partes de liquidación: contrato visible" on public.rental_settlement_shares for all to authenticated
using (exists (select 1 from public.rental_settlements s join public.rental_contracts c on c.id = s.contract_id
  where s.id = settlement_id and (c.agent_id = auth.uid() or public.is_admin())))
with check (exists (select 1 from public.rental_settlements s join public.rental_contracts c on c.id = s.contract_id
  where s.id = settlement_id and (c.agent_id = auth.uid() or public.is_admin())));

-- === Liquidaciones ya emitidas: 100 % al propietario principal ===
insert into public.rental_settlement_shares (settlement_id, contact_id, share_pct, amount, is_primary, paid_to_owner_at, payout_method, payout_reference)
select s.id, c.owner_id, 100, s.net_amount, true, s.paid_to_owner_at, s.payout_method, s.payout_reference
from public.rental_settlements s join public.rental_contracts c on c.id = s.contract_id;
