-- Punitorio automático y alertas configurables.
--
-- 1. Punitorio: por contrato, AUTO o MANUAL, con días de gracia. En AUTO,
--    rental_accrue_late_fees() mantiene un cargo PUNITORIOS por cada cuota
--    de alquiler atrasada (enlazado por late_fee_of) y lo recalcula a
--    diario: % diario × días de atraso (desde el vencimiento) + fijo, sobre
--    el saldo impago; si la cuota ya se pagó, se congela a la fecha del
--    último cobro. Si el punitorio tiene cobros o el período ya está
--    liquidado, no se toca más. Mismo cálculo que lateFee() en logic.ts.
--    Los contratos existentes quedan en MANUAL para no generar de golpe
--    punitorios sobre deudas ya existentes; los nuevos nacen en AUTO.
-- 2. rental_settings: anticipación de las alertas de vencimiento y de
--    ajuste (una sola fila). Lee cualquier agente, edita admin.

alter table public.rental_contracts
  add column late_fee_mode text not null default 'AUTO' check (late_fee_mode in ('AUTO', 'MANUAL')),
  add column late_fee_grace_days smallint not null default 0 check (late_fee_grace_days between 0 and 30);
update public.rental_contracts set late_fee_mode = 'MANUAL';

alter table public.rental_charges
  add column late_fee_of uuid unique references public.rental_charges(id) on delete cascade;

create function public.rental_accrue_late_fees() returns integer
language plpgsql security invoker set search_path = public as $$
declare r record; v_paid numeric; v_last_paid date; v_balance numeric; v_until date; v_days integer;
  v_fee numeric(14,2); v_fee_id uuid; v_changes integer := 0;
begin
  for r in
    select ch.id, ch.contract_id, ch.period, ch.due_date, ch.amount, ch.currency,
           c.late_fee_pct_daily, c.late_fee_fixed, c.late_fee_grace_days
    from public.rental_charges ch
    join public.rental_contracts c on c.id = ch.contract_id
    where ch.kind = 'ALQUILER' and c.late_fee_mode = 'AUTO' and ch.due_date < current_date
      and (c.late_fee_pct_daily > 0 or c.late_fee_fixed > 0)
      and not exists (select 1 from public.rental_settlements s where s.contract_id = ch.contract_id and s.period = ch.period)
      -- Un punitorio cargado a mano en el mismo mes reemplaza al automático.
      and not exists (select 1 from public.rental_charges m where m.contract_id = ch.contract_id and m.period = ch.period
                        and m.kind = 'PUNITORIOS' and m.late_fee_of is null)
  loop
    select coalesce(sum(e.amount), 0), max(e.paid_at) into v_paid, v_last_paid
      from public.rental_payment_entries e where e.charge_id = r.id;
    v_balance := r.amount - v_paid;
    v_until := case when v_balance > 0.005 then current_date else v_last_paid end;
    v_days := coalesce(v_until - r.due_date, 0);
    v_fee := case when v_days <= r.late_fee_grace_days then 0
      else round((case when v_balance > 0.005 then v_balance else r.amount end) * r.late_fee_pct_daily / 100 * v_days + r.late_fee_fixed, 2) end;

    v_fee_id := null;
    select id into v_fee_id from public.rental_charges where late_fee_of = r.id;
    if v_fee_id is not null then
      -- Con cobros registrados el punitorio queda congelado.
      if exists (select 1 from public.rental_payment_entries e where e.charge_id = v_fee_id) then continue; end if;
      if v_fee <= 0 then
        delete from public.rental_charges where id = v_fee_id;
        v_changes := v_changes + 1;
      else
        update public.rental_charges set amount = v_fee where id = v_fee_id and amount <> v_fee;
        if found then v_changes := v_changes + 1; end if;
      end if;
    elsif v_fee > 0 then
      insert into public.rental_charges (contract_id, period, due_date, kind, description, amount, currency, late_fee_of)
      values (r.contract_id, r.period, r.due_date, 'PUNITORIOS', 'Punitorio alquiler ' || to_char(r.period, 'MM/YYYY'), v_fee, r.currency, r.id);
      v_changes := v_changes + 1;
    end if;
  end loop;
  return v_changes;
end $$;
revoke all on function public.rental_accrue_late_fees() from public, anon;
grant execute on function public.rental_accrue_late_fees() to authenticated, service_role;

create table public.rental_settings (
  id smallint primary key default 1 check (id = 1),
  expiry_alert_days smallint not null default 90 check (expiry_alert_days between 15 and 365),
  adjustment_alert_days smallint not null default 30 check (adjustment_alert_days between 1 and 90),
  updated_at timestamptz not null default now()
);
insert into public.rental_settings default values;

alter table public.rental_settings enable row level security;
revoke all on public.rental_settings from anon, authenticated;
grant select on public.rental_settings to authenticated;
grant update (expiry_alert_days, adjustment_alert_days, updated_at) on public.rental_settings to authenticated;
create policy "Configuración de alquileres: lectura" on public.rental_settings for select to authenticated using (true);
create policy "Configuración de alquileres: admin edita" on public.rental_settings for update to authenticated
  using (public.is_admin()) with check (public.is_admin());
