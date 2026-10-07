-- Mismo formato de recibo que el resto de la app ("recibo N.º 62").
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
        || ' · recibo N.º ' || new.receipt_number
        || case when new.bank_movement_id is not null then ' · conciliado con el banco' else '' end,
      new.amount, v_charge.currency, new.id);
  else
    insert into rental_activity (contract_id, actor_kind, actor_agent_id, action, detail, amount, currency, ref_id)
    values (v_charge.contract_id, case when auth.uid() is null then 'SISTEMA' else 'AGENTE' end, auth.uid(), 'COBRO_ANULADO',
      'Anuló el cobro de ' || v_charge.description || ' · recibo N.º ' || old.receipt_number,
      old.amount, v_charge.currency, old.id);
  end if;
  return r;
end $$;

update public.rental_activity set detail = regexp_replace(detail, 'recibo R-0*(\d+)', 'recibo N.º \1')
where detail ~ 'recibo R-';
