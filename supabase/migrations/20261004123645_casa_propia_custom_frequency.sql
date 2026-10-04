-- Ajuste por coeficiente Casa Propia y frecuencia de ajuste libre.
--
-- Casa Propia (Ministerio de Desarrollo Territorial y Hábitat) no es un
-- índice de nivel como ICL o IPC: cada mes se publica un coeficiente que
-- se aplica directo al canon del período (ej. 1,3817 sobre $100.000 da
-- $138.170). Se guarda en index_values con index_code CASA_PROPIA, un
-- valor por mes de ajuste, cargado a mano (no hay API oficial) y el
-- factor es ese coeficiente: no hay cociente contra un mes base.
--
-- Frecuencia: la base ya aceptaba 1 a 36 meses; el formulario y la
-- importación la limitaban a 3, 4, 6 o 12.

alter table public.rental_contracts drop constraint rental_contracts_adjustment_index_check;
alter table public.rental_contracts add constraint rental_contracts_adjustment_index_check
  check (adjustment_index in ('ICL', 'IPC', 'CASA_PROPIA', 'FIJO', 'MANUAL', 'NINGUNO'));

alter table public.index_values drop constraint index_values_index_code_check;
alter table public.index_values add constraint index_values_index_code_check
  check (index_code in ('ICL', 'IPC', 'CASA_PROPIA'));

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
  v_target_index_period := (v_period - make_interval(months => c.index_lag_months))::date;
  if c.adjustment_index = 'MANUAL' then
    if p_manual_amount is null or p_manual_amount <= 0 then raise exception 'Ingresá el nuevo canon manual'; end if;
    v_amount := round(p_manual_amount, 2);
    v_factor := v_amount / c.rent_amount;
  elsif c.adjustment_index = 'FIJO' then
    v_factor := 1 + coalesce(c.adjustment_pct, 0) / 100;
    v_amount := round(c.base_rent_amount * v_factor, 2);
  elsif c.adjustment_index = 'CASA_PROPIA' then
    select value into v_factor from public.index_values where index_code = 'CASA_PROPIA' and period = v_target_index_period;
    if v_factor is null then
      raise exception 'Falta el coeficiente Casa Propia de %', to_char(v_target_index_period, 'MM/YYYY') using errcode = 'P0002';
    end if;
    v_amount := round(c.base_rent_amount * v_factor, 2);
  elsif c.adjustment_index in ('ICL', 'IPC') then
    v_base_index_period := (c.base_period - make_interval(months => c.index_lag_months))::date;
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

-- El cron también aplica Casa Propia cuando el coeficiente está cargado.
do $$
declare d text; n text;
begin
  d := pg_get_functiondef('public.rental_apply_due_adjustments()'::regprocedure);
  n := replace(d, 'adjustment_index in (''ICL'', ''IPC'', ''FIJO'')', 'adjustment_index in (''ICL'', ''IPC'', ''CASA_PROPIA'', ''FIJO'')');
  if n = d then raise exception 'rental_apply_due_adjustments: no se encontró el texto a reemplazar'; end if;
  execute n;
end $$;

-- Importación CSV: acepta CASA_PROPIA y cualquier frecuencia de 1 a 36 meses.
do $$
declare d text; n text;
begin
  d := pg_get_functiondef('public.rental_import_contracts(jsonb)'::regprocedure);
  n := replace(d, '''ICL'',''IPC'',''FIJO'',''MANUAL'',''NINGUNO''', '''ICL'',''IPC'',''CASA_PROPIA'',''FIJO'',''MANUAL'',''NINGUNO''');
  n := replace(n, 'v_months not in (3,4,6,12)', 'v_months not between 1 and 36');
  if position('CASA_PROPIA' in n) = 0 or position('v_months not between 1 and 36' in n) = 0 then
    raise exception 'rental_import_contracts: no se encontró el texto a reemplazar';
  end if;
  execute n;
end $$;
