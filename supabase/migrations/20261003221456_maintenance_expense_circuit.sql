-- Circuito de gastos de mantenimiento según quién paga:
--   INQUILINO    → cargo REPARACIONES en su cuenta corriente (charge_id),
--                  ya resuelto desde la app.
--   PROPIETARIO  → gasto de la liquidación. El ítem de expenses lleva
--                  maintenance_id y al emitir se enlaza (settlement_id):
--                  no se puede descontar dos veces.
--   INMOBILIARIA → egreso MANTENIMIENTO en cash_movements, sincronizado
--                  por trigger mientras el reclamo esté resuelto con costo.
-- Una vez cargado al inquilino o liquidado al propietario, el costo y quién
-- paga quedan fijos: cambiarlos desincronizaría lo ya cobrado o descontado.

-- === Finanzas: categoría MANTENIMIENTO y vínculo al reclamo ===
alter table public.cash_movements drop constraint cash_movements_category_check;
alter table public.cash_movements add constraint cash_movements_category_check check (category in (
  'COMISION_ALQUILER', 'COMISION_VENTA', 'HONORARIOS', 'VENTA_PROPIEDAD', 'OTRO_INGRESO',
  'COMISION_AGENTE', 'SUELDOS', 'OFICINA', 'MARKETING', 'COMPRA_PROPIEDAD', 'OBRA', 'IMPUESTOS', 'OTRO_EGRESO', 'MANTENIMIENTO'
));
alter table public.cash_movements drop constraint cash_movements_check;
alter table public.cash_movements add constraint cash_movements_check check (
  (direction = 'INGRESO' and nature is null and category in ('COMISION_ALQUILER', 'COMISION_VENTA', 'HONORARIOS', 'VENTA_PROPIEDAD', 'OTRO_INGRESO'))
  or (direction = 'EGRESO' and nature is not null and category in ('COMISION_AGENTE', 'SUELDOS', 'OFICINA', 'MARKETING', 'COMPRA_PROPIEDAD', 'OBRA', 'IMPUESTOS', 'OTRO_EGRESO', 'MANTENIMIENTO'))
);
alter table public.cash_movements
  add column maintenance_id uuid unique references public.rental_maintenance(id) on delete cascade;

-- === Reclamo a cargo de la inmobiliaria → egreso ===
create function public.sync_maintenance_cash_movement() returns trigger
language plpgsql security definer set search_path = public as $$
declare c public.rental_contracts%rowtype;
begin
  if new.payer = 'INMOBILIARIA' and new.status = 'RESUELTO' and coalesce(new.cost, 0) > 0 then
    select * into c from public.rental_contracts where id = new.contract_id;
    insert into public.cash_movements
      (occurred_on, direction, category, nature, description, amount, currency, property_id, contract_id, maintenance_id, agent_id, created_by)
    values
      (coalesce(new.resolved_at, current_date), 'EGRESO', 'MANTENIMIENTO', 'VARIABLE', 'Mantenimiento: ' || new.title,
       new.cost, coalesce(new.currency, c.currency), c.property_id, c.id, new.id, c.agent_id, auth.uid())
    on conflict (maintenance_id) do update set
      occurred_on = excluded.occurred_on,
      description = excluded.description,
      amount = excluded.amount,
      currency = excluded.currency;
  else
    delete from public.cash_movements where maintenance_id = new.id;
  end if;
  return null;
end $$;
revoke execute on function public.sync_maintenance_cash_movement() from public, anon, authenticated;
create trigger rental_maintenance_cash_movement
after insert or update of payer, status, cost, currency, title, resolved_at on public.rental_maintenance
for each row execute function public.sync_maintenance_cash_movement();

-- === Integridad: lo ya cobrado o liquidado no se modifica ===
create function public.rental_protect_billed_maintenance() returns trigger
language plpgsql set search_path = public as $$
begin
  if old.settlement_id is not null and new.settlement_id is distinct from old.settlement_id then
    raise exception 'El reclamo ya se descontó en una liquidación';
  end if;
  if old.settlement_id is not null and (new.cost is distinct from old.cost or new.payer is distinct from old.payer or new.currency is distinct from old.currency) then
    raise exception 'El reclamo ya se descontó en una liquidación: el costo y quién paga no se pueden cambiar';
  end if;
  if old.charge_id is not null and (new.cost is distinct from old.cost or new.payer is distinct from old.payer) then
    raise exception 'El reclamo ya se cargó al inquilino: el costo y quién paga no se pueden cambiar';
  end if;
  return new;
end $$;
create trigger rental_maintenance_protect_billed
before update on public.rental_maintenance
for each row execute function public.rental_protect_billed_maintenance();

-- === Liquidación → enlaza los reclamos descontados ===
-- Cada ítem de expenses puede traer maintenance_id. Se valida que el
-- reclamo sea de este contrato, a cargo del propietario y no liquidado.
create function public.rental_link_settlement_maintenance() returns trigger
language plpgsql security definer set search_path = public as $$
declare item jsonb; v_id uuid; m public.rental_maintenance%rowtype;
begin
  for item in select value from jsonb_array_elements(new.expenses)
  loop
    if nullif(item->>'maintenance_id', '') is null then continue; end if;
    v_id := (item->>'maintenance_id')::uuid;
    select * into m from public.rental_maintenance where id = v_id for update;
    if not found or m.contract_id <> new.contract_id then
      raise exception 'El reclamo % no pertenece a este contrato', v_id;
    end if;
    if m.payer is distinct from 'PROPIETARIO' or m.status = 'CANCELADO' then
      raise exception 'El reclamo "%" no es un gasto a cargo del propietario', m.title;
    end if;
    if m.settlement_id is not null then
      raise exception 'El reclamo "%" ya se descontó en otra liquidación', m.title;
    end if;
    update public.rental_maintenance set settlement_id = new.id where id = v_id;
  end loop;
  return new;
end $$;
revoke execute on function public.rental_link_settlement_maintenance() from public, anon, authenticated;
create trigger rental_settlements_link_maintenance
after insert on public.rental_settlements
for each row execute function public.rental_link_settlement_maintenance();
