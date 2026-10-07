-- El pago informado guarda la moneda del contrato.
create or replace function public.rental_set_activity_currency() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.currency is null and new.amount is not null then
    select c.currency into new.currency from rental_contracts c where c.id = new.contract_id;
  end if;
  return new;
end $$;

create trigger rental_activity_currency before insert on public.rental_activity
  for each row execute function public.rental_set_activity_currency();

update public.rental_activity a set currency = c.currency
from public.rental_contracts c where c.id = a.contract_id and a.currency is null and a.amount is not null;
