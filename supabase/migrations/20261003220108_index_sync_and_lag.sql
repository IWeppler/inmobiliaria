-- Ajustes por índice: fuente oficial y rezago.
--
-- 1. index_values.source: de dónde salió el valor. BCRA (ICL, API de
--    estadísticas v4) e INDEC (IPC vía datos.gob.ar) los escribe la
--    sincronización automática; MANUAL, la carga desde Ajustes.
-- 2. rental_contracts.index_lag_months: meses de rezago del índice. El
--    IPC de un mes se publica a mediados del mes siguiente, así que un
--    ajuste del 1/10 no puede usar el IPC de octubre. Con rezago N, el
--    factor es índice[mes de ajuste - N] / índice[mes base - N]: se miden
--    los mismos meses de variación, corridos a meses ya publicados.
--    Default: IPC 2 (siempre publicado al día 1), ICL 0 (diario).

alter table public.index_values
  add column source text not null default 'MANUAL' check (source in ('MANUAL', 'BCRA', 'INDEC')),
  add column updated_at timestamptz not null default now();

alter table public.rental_contracts
  add column index_lag_months smallint check (index_lag_months between 0 and 6);
update public.rental_contracts
  set index_lag_months = case when adjustment_index = 'IPC' then 2 else 0 end;

-- El alta (formulario o importación CSV) puede omitirlo: se completa según
-- el índice. Así rental_import_contracts no necesita cambios.
create function public.rental_default_index_lag() returns trigger
language plpgsql set search_path = public as $$
begin
  if new.index_lag_months is null then
    new.index_lag_months := case when new.adjustment_index = 'IPC' then 2 else 0 end;
  end if;
  return new;
end $$;
create trigger rental_contracts_default_index_lag
before insert or update of adjustment_index, index_lag_months on public.rental_contracts
for each row execute function public.rental_default_index_lag();

alter table public.rental_contracts alter column index_lag_months set not null;

-- Mismo cálculo que antes, con los períodos de índice corridos por el rezago.
create or replace function public.rental_apply_adjustment(p_contract_id uuid, p_manual_amount numeric default null)
returns jsonb language plpgsql security invoker set search_path = public as $$
declare c public.rental_contracts%rowtype; v_period date; v_base numeric; v_target numeric;
  v_base_index_period date; v_target_index_period date;
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
    v_base_index_period := (c.base_period - make_interval(months => c.index_lag_months))::date;
    v_target_index_period := (v_period - make_interval(months => c.index_lag_months))::date;
    select value into v_base from public.index_values where index_code = c.adjustment_index and period = v_base_index_period;
    select value into v_target from public.index_values where index_code = c.adjustment_index and period = v_target_index_period;
    if v_base is null or v_target is null then
      raise exception 'Falta el índice % de %', c.adjustment_index,
        to_char(case when v_base is null then v_base_index_period else v_target_index_period end, 'MM/YYYY')
        using errcode = 'P0002';
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
