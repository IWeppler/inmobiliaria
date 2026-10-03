-- Historial de precios de propiedades. Permite medir qué pasó con las
-- consultas y vistas antes y después de cada cambio de precio. Mismo patrón
-- que status_history: se llena solo por trigger (SECURITY DEFINER) y no hay
-- policies de escritura para anon/authenticated.
create table if not exists public.property_price_history (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references public.properties(id) on delete cascade,
  price numeric not null,
  currency text,
  changed_at timestamptz not null default now(),
  changed_by uuid references auth.users(id) on delete set null
);

create index if not exists idx_price_history_property
  on public.property_price_history (property_id, changed_at desc);

alter table public.property_price_history enable row level security;

revoke all on public.property_price_history from anon;
revoke all on public.property_price_history from authenticated;
grant select on public.property_price_history to authenticated;

-- SELECT: agente de la propiedad o admin (igual criterio que status_history).
create policy "Ver historial de precios: dueño o admin"
on public.property_price_history
for select
to authenticated
using (
  exists (
    select 1 from public.properties p
    where p.id = property_price_history.property_id
      and (p.agent_id = auth.uid() or public.is_admin())
  )
);

-- La primera fila es el precio inicial; las siguientes, cambios reales.
-- Un precio nulo o en cero no se registra (propiedades "a consultar").
create or replace function public.log_price_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if NEW.price is null or NEW.price <= 0 then
    return NEW;
  end if;

  if TG_OP = 'INSERT'
     or OLD.price is distinct from NEW.price
     or OLD.currency is distinct from NEW.currency then
    insert into public.property_price_history (property_id, price, currency, changed_by)
    values (NEW.id, NEW.price, NEW.currency, auth.uid());
  end if;
  return NEW;
end;
$$;

revoke execute on function public.log_price_change() from public;
revoke execute on function public.log_price_change() from anon;
revoke execute on function public.log_price_change() from authenticated;

drop trigger if exists trg_properties_price_history on public.properties;
create trigger trg_properties_price_history
  after insert or update of price, currency on public.properties
  for each row execute function public.log_price_change();

-- Baseline: no sabemos a qué precio se publicó cada propiedad existente, así
-- que se registra el precio ACTUAL con la fecha de alta. Los cambios
-- anteriores a esta migración no existen en el historial.
insert into public.property_price_history (property_id, price, currency, changed_at)
select p.id, p.price, p.currency, p.created_at
from public.properties p
where p.price is not null
  and p.price > 0
  and not exists (
    select 1 from public.property_price_history h where h.property_id = p.id
  );
