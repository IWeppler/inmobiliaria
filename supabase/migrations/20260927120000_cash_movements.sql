-- Flujo de caja del negocio: ingresos y egresos de la inmobiliaria (no del
-- propietario). Sirve para cualquier modelo: alquileres, ventas, flipping,
-- desarrollo. Cada movimiento tiene una categoría; el gráfico agrupa por ahí.
--
-- Origen de cada movimiento:
--   · Comisión de alquiler  → trigger sobre rental_settlements.
--   · Comisión de venta (+ comisión del agente) → trigger sobre property_sales.
--   · Gastos fijos → recurring_expenses, generados mes a mes.
--   · Resto → carga manual desde /dashboard/finanzas.

-- === Gastos fijos recurrentes ===
create table public.recurring_expenses (
  id uuid primary key default gen_random_uuid(),
  description text not null,
  category text not null check (category in (
    'COMISION_AGENTE', 'SUELDOS', 'OFICINA', 'MARKETING', 'COMPRA_PROPIEDAD', 'OBRA', 'IMPUESTOS', 'OTRO_EGRESO'
  )),
  amount numeric(14,2) not null check (amount > 0),
  currency text not null check (currency in ('ARS', 'USD')),
  day_of_month integer not null default 1 check (day_of_month between 1 and 28),
  -- Primer mes que se genera (primer día del mes).
  start_period date not null,
  active boolean not null default true,
  created_by uuid references auth.users(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now()
);

-- === Ventas cerradas ===
create table public.property_sales (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references public.properties(id) on delete restrict,
  sold_on date not null,
  sale_price numeric(14,2) not null check (sale_price > 0),
  currency text not null check (currency in ('ARS', 'USD')),
  commission_pct numeric(5,2) not null check (commission_pct between 0 and 100),
  commission_amount numeric(14,2) not null check (commission_amount >= 0),
  agent_id uuid references public.agents(id) on delete set null,
  agent_commission_pct numeric(5,2) not null default 0 check (agent_commission_pct between 0 and 100),
  -- Porcentaje sobre la comisión de la inmobiliaria, no sobre el precio.
  agent_commission_amount numeric(14,2) not null default 0 check (agent_commission_amount >= 0),
  notes text,
  created_by uuid references auth.users(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now()
);
create index property_sales_property on public.property_sales(property_id);

-- === Movimientos ===
create table public.cash_movements (
  id uuid primary key default gen_random_uuid(),
  occurred_on date not null,
  direction text not null check (direction in ('INGRESO', 'EGRESO')),
  category text not null check (category in (
    -- Ingresos
    'COMISION_ALQUILER', 'COMISION_VENTA', 'HONORARIOS', 'VENTA_PROPIEDAD', 'OTRO_INGRESO',
    -- Egresos
    'COMISION_AGENTE', 'SUELDOS', 'OFICINA', 'MARKETING', 'COMPRA_PROPIEDAD', 'OBRA', 'IMPUESTOS', 'OTRO_EGRESO'
  )),
  -- Solo egresos: fijo (se repite y se conoce de antemano) o variable.
  nature text check (nature in ('FIJO', 'VARIABLE')),
  description text not null,
  amount numeric(14,2) not null check (amount > 0),
  currency text not null check (currency in ('ARS', 'USD')),
  property_id uuid references public.properties(id) on delete set null,
  contract_id uuid references public.rental_contracts(id) on delete set null,
  settlement_id uuid unique references public.rental_settlements(id) on delete cascade,
  sale_id uuid references public.property_sales(id) on delete cascade,
  recurring_expense_id uuid references public.recurring_expenses(id) on delete set null,
  -- Mes que cubre un gasto fijo generado (primer día del mes).
  recurring_period date,
  agent_id uuid references public.agents(id) on delete set null,
  created_by uuid references auth.users(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  unique (recurring_expense_id, recurring_period),
  check (
    (direction = 'INGRESO' and nature is null and category in ('COMISION_ALQUILER', 'COMISION_VENTA', 'HONORARIOS', 'VENTA_PROPIEDAD', 'OTRO_INGRESO'))
    or (direction = 'EGRESO' and nature is not null and category in ('COMISION_AGENTE', 'SUELDOS', 'OFICINA', 'MARKETING', 'COMPRA_PROPIEDAD', 'OBRA', 'IMPUESTOS', 'OTRO_EGRESO'))
  )
);
create index cash_movements_occurred_on on public.cash_movements(occurred_on);
create index cash_movements_property on public.cash_movements(property_id);
create index cash_movements_sale on public.cash_movements(sale_id);

comment on table public.cash_movements is
  'Ingresos y egresos de la inmobiliaria. Comisiones de alquiler y de venta se generan por trigger; gastos fijos con generate_recurring_expenses(); el resto se carga a mano desde /dashboard/finanzas.';

-- === Permisos ===
-- Finanzas del negocio: solo admin. Las ventas las registra el agente de
-- la propiedad (o admin); sus movimientos los escribe el trigger.
alter table public.cash_movements enable row level security;
alter table public.recurring_expenses enable row level security;
alter table public.property_sales enable row level security;
revoke all on public.cash_movements, public.recurring_expenses, public.property_sales from anon, authenticated;
grant select, insert, update, delete on public.cash_movements, public.recurring_expenses, public.property_sales to authenticated;

create policy "Movimientos: solo admin" on public.cash_movements for all to authenticated
  using (public.is_admin()) with check (public.is_admin());
create policy "Gastos fijos: solo admin" on public.recurring_expenses for all to authenticated
  using (public.is_admin()) with check (public.is_admin());
create policy "Ventas: agente de la propiedad o admin" on public.property_sales for all to authenticated
  using (public.is_admin() or exists (select 1 from public.properties p where p.id = property_sales.property_id and p.agent_id = auth.uid()))
  with check (public.is_admin() or exists (select 1 from public.properties p where p.id = property_sales.property_id and p.agent_id = auth.uid()));

-- === Liquidación → comisión de alquiler ===
-- security definer: los agentes liquidan pero no escriben movimientos.
create or replace function public.sync_settlement_cash_movement()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare v_property uuid; v_agent uuid;
begin
  if new.commission_amount <= 0 then
    delete from public.cash_movements where settlement_id = new.id;
    return new;
  end if;
  select property_id, agent_id into v_property, v_agent
  from public.rental_contracts where id = new.contract_id;
  insert into public.cash_movements
    (occurred_on, direction, category, description, amount, currency, property_id, contract_id, settlement_id, agent_id, created_by)
  values
    (new.issued_at, 'INGRESO', 'COMISION_ALQUILER', 'Comisión alquiler ' || to_char(new.period, 'MM/YYYY'),
     new.commission_amount, new.currency, v_property, new.contract_id, new.id, v_agent, auth.uid())
  on conflict (settlement_id) do update set
    occurred_on = excluded.occurred_on,
    description = excluded.description,
    amount = excluded.amount,
    currency = excluded.currency;
  return new;
end;
$$;
revoke execute on function public.sync_settlement_cash_movement() from public, anon, authenticated;

create trigger rental_settlements_cash_movement
after insert or update of commission_amount, currency, issued_at, period on public.rental_settlements
for each row execute function public.sync_settlement_cash_movement();

-- === Venta → comisión de venta + comisión del agente ===
-- Se regeneran completos en cada insert/update; el delete de la venta
-- borra sus movimientos por cascade.
create or replace function public.sync_sale_cash_movements()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare v_title text;
begin
  select title into v_title from public.properties where id = new.property_id;
  delete from public.cash_movements where sale_id = new.id;
  if new.commission_amount > 0 then
    insert into public.cash_movements
      (occurred_on, direction, category, description, amount, currency, property_id, sale_id, agent_id, created_by)
    values
      (new.sold_on, 'INGRESO', 'COMISION_VENTA', 'Comisión venta — ' || coalesce(v_title, 'propiedad'),
       new.commission_amount, new.currency, new.property_id, new.id, new.agent_id, auth.uid());
  end if;
  if new.agent_commission_amount > 0 then
    insert into public.cash_movements
      (occurred_on, direction, category, nature, description, amount, currency, property_id, sale_id, agent_id, created_by)
    values
      (new.sold_on, 'EGRESO', 'COMISION_AGENTE', 'VARIABLE', 'Comisión agente — ' || coalesce(v_title, 'propiedad'),
       new.agent_commission_amount, new.currency, new.property_id, new.id, new.agent_id, auth.uid());
  end if;
  return new;
end;
$$;
revoke execute on function public.sync_sale_cash_movements() from public, anon, authenticated;

create trigger property_sales_cash_movements
after insert or update on public.property_sales
for each row execute function public.sync_sale_cash_movements();

-- === Gastos fijos → movimientos del mes ===
-- Genera los meses faltantes (desde start_period hasta el actual) de cada
-- gasto fijo activo cuya fecha ya llegó. Idempotente por el unique
-- (recurring_expense_id, recurring_period).
-- security invoker: lo corre el admin al abrir finanzas o el dashboard.
create or replace function public.generate_recurring_expenses()
returns integer
language plpgsql
set search_path = public
as $$
declare v_count integer;
begin
  if not public.is_admin() then
    return 0;
  end if;
  insert into public.cash_movements
    (occurred_on, direction, category, nature, description, amount, currency, recurring_expense_id, recurring_period)
  select (m.month + (r.day_of_month - 1) * interval '1 day')::date, 'EGRESO', r.category, 'FIJO',
         r.description, r.amount, r.currency, r.id, m.month::date
  from public.recurring_expenses r
  cross join lateral generate_series(r.start_period, date_trunc('month', current_date)::date, interval '1 month') as m(month)
  where r.active
    and (m.month + (r.day_of_month - 1) * interval '1 day')::date <= current_date
  on conflict (recurring_expense_id, recurring_period) do nothing;
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;
revoke execute on function public.generate_recurring_expenses() from public, anon;
grant execute on function public.generate_recurring_expenses() to authenticated;

-- === Histórico: liquidaciones ya emitidas ===
insert into public.cash_movements
  (occurred_on, direction, category, description, amount, currency, property_id, contract_id, settlement_id, agent_id, created_by)
select s.issued_at, 'INGRESO', 'COMISION_ALQUILER', 'Comisión alquiler ' || to_char(s.period, 'MM/YYYY'),
       s.commission_amount, s.currency, c.property_id, s.contract_id, s.id, c.agent_id, null
from public.rental_settlements s
join public.rental_contracts c on c.id = s.contract_id
where s.commission_amount > 0;
