-- Ledger, garantías, renovaciones y ajustes auditables para alquileres.
alter table public.rental_contracts
  add column guarantee_type text not null default 'NINGUNA' check (guarantee_type in ('NINGUNA', 'GARANTE', 'CAUCION')),
  add column guarantee_detail text,
  add column deposit_amount numeric(14,2) not null default 0 check (deposit_amount >= 0),
  add column late_fee_fixed numeric(14,2) not null default 0 check (late_fee_fixed >= 0),
  add column last_adjustment_date date,
  add column renewed_from_id uuid references public.rental_contracts(id) on delete set null;

alter table public.rental_contracts drop constraint rental_contracts_adjustment_index_check;
alter table public.rental_contracts add constraint rental_contracts_adjustment_index_check
  check (adjustment_index in ('ICL', 'IPC', 'FIJO', 'MANUAL', 'NINGUNO'));
alter table public.rental_settlements add column other_collected_amount numeric(14,2) not null default 0;
create unique index rental_contracts_one_renewal on public.rental_contracts(renewed_from_id) where renewed_from_id is not null;

create table public.rental_charges (
  id uuid primary key default gen_random_uuid(),
  contract_id uuid not null references public.rental_contracts(id) on delete cascade,
  rent_payment_id uuid unique references public.rental_payments(id) on delete cascade,
  period date not null,
  due_date date not null,
  kind text not null check (kind in ('ALQUILER', 'EXPENSAS', 'SERVICIOS', 'PUNITORIOS', 'REPARACIONES')),
  description text not null,
  amount numeric(14,2) not null check (amount >= 0),
  currency text not null check (currency in ('ARS', 'USD')),
  created_at timestamptz not null default now(),
  check ((kind = 'ALQUILER') = (rent_payment_id is not null))
);
create index rental_charges_contract_period on public.rental_charges(contract_id, period);
create index rental_charges_due on public.rental_charges(due_date);

create table public.rental_payment_entries (
  id uuid primary key default gen_random_uuid(),
  charge_id uuid not null references public.rental_charges(id) on delete restrict,
  paid_at date not null,
  amount numeric(14,2) not null check (amount > 0),
  method text not null check (method in ('TRANSFERENCIA', 'EFECTIVO', 'OTRO')),
  account text,
  notes text,
  receipt_number bigint generated always as identity unique,
  created_at timestamptz not null default now()
);
create index rental_payment_entries_charge on public.rental_payment_entries(charge_id);

create table public.rental_adjustments (
  id uuid primary key default gen_random_uuid(),
  contract_id uuid not null references public.rental_contracts(id) on delete cascade,
  effective_date date not null,
  previous_amount numeric(14,2) not null,
  new_amount numeric(14,2) not null,
  factor numeric(16,8),
  index_code text not null,
  applied_at timestamptz not null default now(),
  unique(contract_id, effective_date)
);

-- Migración de cuotas y cobranzas históricas sin perder los montos registrados.
insert into public.rental_charges(contract_id, rent_payment_id, period, due_date, kind, description, amount, currency)
select contract_id, id, period, due_date, 'ALQUILER', 'Alquiler ' || to_char(period, 'MM/YYYY'), amount, currency
from public.rental_payments;

insert into public.rental_payment_entries(charge_id, paid_at, amount, method, notes)
select c.id, p.paid_at, least(coalesce(p.paid_amount, p.amount), p.amount), case upper(coalesce(p.method, ''))
  when 'TRANSFERENCIA' then 'TRANSFERENCIA' when 'EFECTIVO' then 'EFECTIVO' else 'OTRO' end,
  coalesce(p.notes, 'Cobranza migrada')
from public.rental_payments p join public.rental_charges c on c.rent_payment_id = p.id
where p.paid_at is not null and least(coalesce(p.paid_amount, p.amount), p.amount) > 0;

insert into public.rental_charges(contract_id, period, due_date, kind, description, amount, currency)
select p.contract_id, p.period, p.paid_at, 'PUNITORIOS', 'Diferencia cobrada en la cuota ' || to_char(p.period, 'MM/YYYY'),
  p.paid_amount - p.amount, p.currency
from public.rental_payments p where p.paid_at is not null and p.paid_amount > p.amount;

insert into public.rental_payment_entries(charge_id, paid_at, amount, method, notes)
select ch.id, p.paid_at, ch.amount, case upper(coalesce(p.method, ''))
  when 'TRANSFERENCIA' then 'TRANSFERENCIA' when 'EFECTIVO' then 'EFECTIVO' else 'OTRO' end, 'Diferencia migrada'
from public.rental_charges ch join public.rental_payments p on p.contract_id = ch.contract_id and p.period = ch.period
where ch.kind = 'PUNITORIOS' and ch.description like 'Diferencia cobrada en la cuota %';

create function public.rental_sync_payment_summary() returns trigger language plpgsql as $$
declare v_charge uuid; v_rent uuid;
begin
  if tg_op = 'DELETE' then v_charge := old.charge_id; else v_charge := new.charge_id; end if;
  select rent_payment_id into v_rent from public.rental_charges where id = v_charge;
  if v_rent is not null then
    update public.rental_payments p set
      paid_amount = (select coalesce(sum(e.amount), 0) from public.rental_payment_entries e where e.charge_id = v_charge),
      paid_at = (select max(e.paid_at) from public.rental_payment_entries e where e.charge_id = v_charge)
    where p.id = v_rent;
  end if;
  return null;
end $$;
create trigger rental_payment_entry_summary after insert or update or delete on public.rental_payment_entries
for each row execute function public.rental_sync_payment_summary();

create function public.rental_validate_payment_entry() returns trigger language plpgsql as $$
declare v_amount numeric(14,2); v_paid numeric(14,2);
begin
  select amount into v_amount from public.rental_charges where id = new.charge_id for update;
  select coalesce(sum(amount), 0) into v_paid from public.rental_payment_entries
    where charge_id = new.charge_id and id <> new.id;
  if v_amount is null or v_paid + new.amount > v_amount then
    raise exception 'El pago supera el saldo del cargo';
  end if;
  return new;
end $$;
create trigger rental_payment_entry_limit before insert or update on public.rental_payment_entries
for each row execute function public.rental_validate_payment_entry();

create function public.rental_protect_paid_charge() returns trigger language plpgsql as $$
begin
  if exists (select 1 from public.rental_payment_entries where charge_id = old.id) then
    raise exception 'Un cargo con cobros registrados no puede modificarse';
  end if;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end $$;
create trigger rental_charge_immutable_after_payment before update or delete on public.rental_charges
for each row execute function public.rental_protect_paid_charge();

create function public.rental_protect_settled_charge() returns trigger language plpgsql as $$
begin
  if tg_op <> 'INSERT' and exists (
    select 1 from public.rental_settlements
    where contract_id = old.contract_id and period = old.period
  ) then
    raise exception 'No se pueden modificar cargos de un período liquidado';
  end if;
  if tg_op <> 'DELETE' and exists (
    select 1 from public.rental_settlements
    where contract_id = new.contract_id and period = new.period
  ) then
    raise exception 'No se pueden agregar cargos a un período liquidado';
  end if;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end $$;
create trigger rental_charge_settled_guard before insert or update or delete on public.rental_charges
for each row execute function public.rental_protect_settled_charge();

alter table public.rental_charges enable row level security;
alter table public.rental_payment_entries enable row level security;
alter table public.rental_adjustments enable row level security;
revoke all on public.rental_charges, public.rental_payment_entries, public.rental_adjustments from anon, authenticated;
grant select, insert, update, delete on public.rental_charges, public.rental_adjustments to authenticated;
grant select, insert, delete on public.rental_payment_entries to authenticated;
revoke update, delete on public.rental_settlements from authenticated;

create function public.rental_validate_settlement() returns trigger language plpgsql as $$
declare v_pct numeric; v_currency text; v_rent numeric; v_other numeric; v_expenses numeric;
begin
  select commission_pct, currency into v_pct, v_currency from public.rental_contracts where id = new.contract_id;
  if not found then raise exception 'Contrato no encontrado'; end if;
  if not exists (select 1 from public.rental_charges where contract_id = new.contract_id and period = new.period)
    or exists (select 1 from public.rental_charges ch where ch.contract_id = new.contract_id and ch.period = new.period
      and ch.amount > (select coalesce(sum(e.amount), 0) from public.rental_payment_entries e where e.charge_id = ch.id) + 0.005)
  then raise exception 'Hay cargos pendientes de cobro en el período'; end if;
  select coalesce(sum(e.amount) filter (where ch.kind = 'ALQUILER'), 0),
         coalesce(sum(e.amount) filter (where ch.kind <> 'ALQUILER'), 0)
    into v_rent, v_other from public.rental_charges ch
    join public.rental_payment_entries e on e.charge_id = ch.id
    where ch.contract_id = new.contract_id and ch.period = new.period;
  if jsonb_typeof(new.expenses) <> 'array' then raise exception 'Gastos inválidos'; end if;
  if exists (select 1 from jsonb_array_elements(new.expenses) item where (item->>'amount')::numeric < 0)
    then raise exception 'Los gastos no pueden ser negativos'; end if;
  select coalesce(sum((item->>'amount')::numeric), 0) into v_expenses from jsonb_array_elements(new.expenses) item;
  new.rent_amount := round(v_rent, 2);
  new.other_collected_amount := round(v_other, 2);
  new.commission_amount := round(v_rent * v_pct / 100, 2);
  new.expenses_amount := round(v_expenses, 2);
  new.net_amount := new.rent_amount + new.other_collected_amount - new.commission_amount - new.expenses_amount;
  new.currency := v_currency;
  return new;
end $$;
create trigger rental_settlement_totals before insert on public.rental_settlements
for each row execute function public.rental_validate_settlement();

create policy "Cargos: contrato visible" on public.rental_charges for all to authenticated
using (exists (select 1 from public.rental_contracts c where c.id = contract_id and (c.agent_id = auth.uid() or public.is_admin())))
with check (exists (select 1 from public.rental_contracts c where c.id = contract_id and (c.agent_id = auth.uid() or public.is_admin())));
create policy "Cobros: lectura" on public.rental_payment_entries for select to authenticated
using (exists (select 1 from public.rental_charges ch join public.rental_contracts c on c.id = ch.contract_id where ch.id = charge_id and (c.agent_id = auth.uid() or public.is_admin())));
create policy "Cobros: alta antes de liquidar" on public.rental_payment_entries for insert to authenticated
with check (exists (select 1 from public.rental_charges ch join public.rental_contracts c on c.id = ch.contract_id
  where ch.id = charge_id and (c.agent_id = auth.uid() or public.is_admin())
  and not exists (select 1 from public.rental_settlements s where s.contract_id = c.id and s.period = ch.period)));
create policy "Cobros: reversión antes de liquidar" on public.rental_payment_entries for delete to authenticated
using (exists (select 1 from public.rental_charges ch join public.rental_contracts c on c.id = ch.contract_id
  where ch.id = charge_id and (c.agent_id = auth.uid() or public.is_admin())
  and not exists (select 1 from public.rental_settlements s where s.contract_id = c.id and s.period = ch.period)));
create policy "Ajustes: contrato visible" on public.rental_adjustments for all to authenticated
using (exists (select 1 from public.rental_contracts c where c.id = contract_id and (c.agent_id = auth.uid() or public.is_admin())))
with check (exists (select 1 from public.rental_contracts c where c.id = contract_id and (c.agent_id = auth.uid() or public.is_admin())));

-- Una sola transacción actualiza canon, cuotas futuras y auditoría.
create function public.rental_apply_adjustment(p_contract_id uuid, p_manual_amount numeric default null)
returns jsonb language plpgsql security invoker set search_path = public as $$
declare c public.rental_contracts%rowtype; v_period date; v_base numeric; v_target numeric;
  v_factor numeric; v_amount numeric(14,2); v_next date;
begin
  select * into c from public.rental_contracts where id = p_contract_id for update;
  if not found or c.status <> 'ACTIVO' or c.next_adjustment_date is null then
    raise exception 'Contrato sin ajuste pendiente';
  end if;
  if c.next_adjustment_date > current_date then raise exception 'El ajuste todavía no corresponde'; end if;
  v_period := date_trunc('month', c.next_adjustment_date)::date;
  if c.adjustment_index = 'MANUAL' then
    if p_manual_amount is null or p_manual_amount <= 0 then raise exception 'Ingresá el nuevo canon manual'; end if;
    v_amount := round(p_manual_amount, 2);
    v_factor := v_amount / c.rent_amount;
  elsif c.adjustment_index = 'FIJO' then
    v_factor := 1 + coalesce(c.adjustment_pct, 0) / 100;
    v_amount := round(c.base_rent_amount * v_factor, 2);
  elsif c.adjustment_index in ('ICL', 'IPC') then
    select value into v_base from public.index_values where index_code = c.adjustment_index and period = c.base_period;
    select value into v_target from public.index_values where index_code = c.adjustment_index and period = v_period;
    if v_base is null or v_target is null then
      raise exception 'Falta cargar el índice % para el período base o de ajuste', c.adjustment_index using errcode = 'P0002';
    end if;
    v_factor := v_target / v_base;
    v_amount := round(c.base_rent_amount * v_factor, 2);
  else
    raise exception 'El contrato no tiene ajuste';
  end if;
  v_next := (c.next_adjustment_date + make_interval(months => c.adjustment_months))::date;
  insert into public.rental_adjustments(contract_id, effective_date, previous_amount, new_amount, factor, index_code)
    values (c.id, c.next_adjustment_date, c.rent_amount, v_amount, v_factor, c.adjustment_index);
  update public.rental_contracts set rent_amount = v_amount, base_rent_amount = v_amount,
    base_period = v_period, last_adjustment_date = c.next_adjustment_date,
    next_adjustment_date = case when v_next <= c.end_date then v_next else null end
  where id = c.id;
  update public.rental_charges ch set amount = v_amount
    where ch.contract_id = c.id and ch.kind = 'ALQUILER' and ch.period >= v_period
      and not exists (select 1 from public.rental_payment_entries e where e.charge_id = ch.id);
  update public.rental_payments p set amount = v_amount
    where p.contract_id = c.id and p.period >= v_period and coalesce(p.paid_amount, 0) = 0;
  return jsonb_build_object('amount', v_amount, 'factor', v_factor);
end $$;
revoke all on function public.rental_apply_adjustment(uuid, numeric) from public, anon;
grant execute on function public.rental_apply_adjustment(uuid, numeric) to authenticated, service_role;

create function public.rental_apply_due_adjustments() returns integer
language plpgsql security invoker set search_path = public as $$
declare c record; v_count integer := 0; v_date date;
begin
  for c in select id from public.rental_contracts
    where status = 'ACTIVO' and adjustment_index in ('ICL', 'IPC', 'FIJO')
      and next_adjustment_date <= current_date
  loop
    loop
      select next_adjustment_date into v_date from public.rental_contracts where id = c.id;
      exit when v_date is null or v_date > current_date;
      begin
        perform public.rental_apply_adjustment(c.id, null);
        v_count := v_count + 1;
      exception when sqlstate 'P0002' then
        -- Índice todavía no cargado: queda pendiente y visible en la UI.
        exit;
      end;
    end loop;
  end loop;
  return v_count;
end $$;
revoke all on function public.rental_apply_due_adjustments() from public, anon;
grant execute on function public.rental_apply_due_adjustments() to authenticated, service_role;

-- Importación atómica: cualquier fila inválida revierte el lote completo.
create function public.rental_import_contracts(p_rows jsonb) returns integer
language plpgsql security invoker set search_path = public as $$
declare r jsonb; v_number integer := 0; v_property uuid; v_matches integer;
  v_owner uuid; v_tenant uuid; v_contract uuid; v_start date; v_end date;
  v_rent numeric; v_currency text; v_index text; v_months integer;
  v_last date; v_next date; v_due integer; v_first_unpaid date; p record;
begin
  if not public.is_admin() then raise exception 'Solo un administrador puede importar contratos'; end if;
  if jsonb_typeof(p_rows) <> 'array' or jsonb_array_length(p_rows) = 0 or jsonb_array_length(p_rows) > 500 then
    raise exception 'El archivo debe contener entre 1 y 500 contratos';
  end if;
  for r in select value from jsonb_array_elements(p_rows)
  loop
    v_number := v_number + 1;
    if nullif(r->>'property_id', '') is not null then
      select id into v_property from public.properties where id = (r->>'property_id')::uuid;
    else
      select count(*), min(id) into v_matches, v_property from public.properties
        where lower(trim(title)) = lower(trim(r->>'property_title'));
      if v_matches <> 1 then raise exception 'Fila %: propiedad inexistente o nombre ambiguo', v_number; end if;
    end if;
    if v_property is null then raise exception 'Fila %: propiedad no encontrada', v_number; end if;
    if exists (select 1 from public.rental_contracts where property_id = v_property and status = 'ACTIVO') then
      raise exception 'Fila %: la propiedad ya tiene un contrato activo', v_number;
    end if;
    v_start := (r->>'start_date')::date;
    v_end := (r->>'end_date')::date;
    v_rent := (r->>'rent_amount')::numeric;
    v_currency := upper(coalesce(nullif(r->>'currency', ''), 'ARS'));
    v_index := upper(coalesce(nullif(r->>'adjustment_index', ''), 'ICL'));
    v_months := coalesce(nullif(r->>'adjustment_months', '')::integer, 3);
    v_due := coalesce(nullif(r->>'payment_due_day', '')::integer, 10);
    if v_end <= v_start or v_end < current_date or v_rent <= 0 or v_currency not in ('ARS', 'USD')
       or v_index not in ('ICL','IPC','FIJO','MANUAL','NINGUNO')
       or v_months not in (3,4,6,12) or v_due not between 1 and 28 then
      raise exception 'Fila %: condiciones de contrato inválidas', v_number;
    end if;
    if nullif(trim(r->>'owner_name'), '') is null or nullif(trim(r->>'tenant_name'), '') is null then
      raise exception 'Fila %: faltan propietario o inquilino', v_number;
    end if;
    select id into v_owner from public.rental_contacts where kind = 'owner'
      and ((nullif(r->>'owner_document','') is not null and document = r->>'owner_document')
        or (nullif(r->>'owner_document','') is null and lower(full_name) = lower(trim(r->>'owner_name'))))
      order by created_at limit 1;
    if v_owner is null then
      insert into public.rental_contacts(kind, full_name, document, phone)
      values ('owner', trim(r->>'owner_name'), nullif(r->>'owner_document',''), nullif(r->>'owner_phone','')) returning id into v_owner;
    end if;
    select id into v_tenant from public.rental_contacts where kind = 'tenant'
      and ((nullif(r->>'tenant_document','') is not null and document = r->>'tenant_document')
        or (nullif(r->>'tenant_document','') is null and lower(full_name) = lower(trim(r->>'tenant_name'))))
      order by created_at limit 1;
    if v_tenant is null then
      insert into public.rental_contacts(kind, full_name, document, phone)
      values ('tenant', trim(r->>'tenant_name'), nullif(r->>'tenant_document',''), nullif(r->>'tenant_phone','')) returning id into v_tenant;
    end if;
    v_last := coalesce(nullif(r->>'last_adjustment_date','')::date, v_start);
    if v_last < v_start or v_last > current_date then raise exception 'Fila %: último ajuste fuera de la vigencia aplicada', v_number; end if;
    v_first_unpaid := coalesce(nullif(r->>'first_unpaid_period','')::date, date_trunc('month', current_date)::date);
    if extract(day from v_first_unpaid) <> 1 then raise exception 'Fila %: first_unpaid_period debe ser el día 1 del mes', v_number; end if;
    v_next := case when v_index = 'NINGUNO' then null
      else coalesce(nullif(r->>'next_adjustment_date','')::date, (v_last + make_interval(months => v_months))::date) end;
    if v_next is not null and v_next <= v_last then raise exception 'Fila %: próximo ajuste inválido', v_number; end if;
    if v_next > v_end then v_next := null; end if;
    insert into public.rental_contracts(property_id, owner_id, tenant_id, agent_id,
      start_date, end_date, rent_amount, currency, adjustment_index, adjustment_months,
      adjustment_pct, base_rent_amount, base_period, next_adjustment_date, last_adjustment_date,
      commission_pct, late_fee_pct_daily, late_fee_fixed, payment_due_day,
      guarantee_type, guarantee_detail, deposit_amount, notes)
    values (v_property, v_owner, v_tenant, auth.uid(), v_start, v_end, v_rent, v_currency,
      v_index, v_months, case when v_index = 'FIJO' then coalesce(nullif(r->>'adjustment_pct','')::numeric, 0) else null end,
      v_rent, date_trunc('month', v_last)::date, v_next, v_last,
      coalesce(nullif(r->>'commission_pct','')::numeric, 0),
      coalesce(nullif(r->>'late_fee_pct_daily','')::numeric, 0),
      coalesce(nullif(r->>'late_fee_fixed','')::numeric, 0), v_due,
      coalesce(nullif(upper(r->>'guarantee_type'),''), 'NINGUNA'), nullif(r->>'guarantee_detail',''),
      coalesce(nullif(r->>'deposit_amount','')::numeric, 0), nullif(r->>'notes','')) returning id into v_contract;
    -- Se abre la cuenta corriente desde el mes actual: no se inventa deuda pasada.
    for p in select generate_series(greatest(date_trunc('month', v_start)::date, v_first_unpaid),
      case when extract(day from v_end) = 1 then (date_trunc('month', v_end) - interval '1 month')::date
        else date_trunc('month', v_end)::date end, interval '1 month')::date as period
    loop
      insert into public.rental_payments(contract_id, period, due_date, amount, currency)
        values (v_contract, p.period, p.period + (v_due - 1), v_rent, v_currency);
    end loop;
    insert into public.rental_charges(contract_id, rent_payment_id, period, due_date, kind, description, amount, currency)
      select v_contract, id, period, due_date, 'ALQUILER', 'Alquiler ' || to_char(period, 'MM/YYYY'), amount, currency
      from public.rental_payments where contract_id = v_contract;
    update public.properties set status = 'ALQUILADO' where id = v_property;
    v_owner := null; v_tenant := null; v_property := null;
  end loop;
  return v_number;
end $$;
revoke all on function public.rental_import_contracts(jsonb) from public, anon;
grant execute on function public.rental_import_contracts(jsonb) to authenticated;
