-- Rol "administracion": personal de administración o contabilidad que no
-- vende. Ve y opera alquileres y finanzas de toda la cartera, igual que un
-- admin, pero no ve leads ajenos ni gestiona el equipo, la configuración o
-- la importación de contratos (eso sigue siendo is_admin()).

alter table public.agents
  add constraint agents_role_check check (role in ('admin', 'agente', 'administracion'));

create or replace function public.is_back_office()
returns boolean
language sql
stable
security definer
set search_path to 'public'
as $$
  select coalesce((select a.role in ('admin', 'administracion') from public.agents a where a.id = auth.uid()), false);
$$;
revoke all on function public.is_back_office() from public, anon;
grant execute on function public.is_back_office() to authenticated;

-- Alquileres y finanzas: donde las políticas decían is_admin(), pasa a
-- is_back_office(). Se reescriben sobre la expresión vigente para no
-- duplicar (y desincronizar) cada política a mano.
do $$
declare
  p record;
  v_sql text;
begin
  for p in
    select schemaname, tablename, policyname, qual, with_check
    from pg_policies
    where (
        schemaname = 'public' and tablename in (
          'rental_contracts', 'rental_activity', 'rental_adjustments', 'rental_bank_movements', 'rental_charges',
          'rental_contract_parties', 'rental_documents', 'rental_inbox', 'rental_invoices', 'rental_maintenance',
          'rental_notifications', 'rental_payment_entries', 'rental_payments', 'rental_settlement_shares',
          'rental_settlements', 'cash_movements', 'recurring_expenses', 'property_sales'
        )
      ) or (schemaname = 'storage' and tablename = 'objects' and policyname like 'Docs alquiler:%')
  loop
    if coalesce(p.qual, '') not like '%is_admin()%' and coalesce(p.with_check, '') not like '%is_admin()%' then
      continue;
    end if;
    v_sql := format('alter policy %I on %I.%I', p.policyname, p.schemaname, p.tablename);
    if p.qual is not null then
      v_sql := v_sql || format(' using (%s)', replace(p.qual, 'is_admin()', 'is_back_office()'));
    end if;
    if p.with_check is not null then
      v_sql := v_sql || format(' with check (%s)', replace(p.with_check, 'is_admin()', 'is_back_office()'));
    end if;
    execute v_sql;
  end loop;
end $$;

-- Funciones de alquileres y finanzas que chequean el rol adentro.
do $$
declare
  f record;
begin
  for f in
    select oid from pg_proc
    where pronamespace = 'public'::regnamespace and proname in ('generate_recurring_expenses', 'set_property_owners')
  loop
    execute replace(pg_get_functiondef(f.oid), 'public.is_admin()', 'public.is_back_office()');
  end loop;
end $$;
