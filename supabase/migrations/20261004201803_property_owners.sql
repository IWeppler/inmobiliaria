-- Dueños de la propiedad.
--
-- Hasta ahora el propietario existía solo dentro de cada contrato, así que
-- se podía combinar cualquier propiedad con cualquier propietario. Ahora la
-- titularidad es de la propiedad (sirve también para venta / captación) y el
-- contrato la copia al crearse: rental_contracts.owner_id + co-propietarios
-- en rental_contract_parties quedan como foto de quién era dueño al firmar,
-- para que contratos y liquidaciones viejos no cambien si la propiedad se
-- vende.
--
-- properties es de lectura pública: los dueños van en tabla aparte, visible
-- solo para usuarios autenticados. Se escribe únicamente con
-- set_property_owners (reemplaza el conjunto completo y valida).

create table public.property_owners (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references public.properties(id) on delete cascade,
  contact_id uuid not null references public.rental_contacts(id) on delete restrict,
  share_pct numeric(5,2) not null check (share_pct > 0 and share_pct <= 100),
  is_primary boolean not null default false,
  created_at timestamptz not null default now(),
  unique (property_id, contact_id)
);
create unique index property_owners_one_primary on public.property_owners(property_id) where is_primary;
create index property_owners_contact on public.property_owners(contact_id);

alter table public.property_owners enable row level security;
revoke all on public.property_owners from anon, authenticated;
grant select on public.property_owners to authenticated;
create policy "Dueños de propiedad: lectura interna" on public.property_owners for select to authenticated using (true);

-- p_owners: [{"contact_id": uuid, "share_pct": numeric, "is_primary": bool}]
-- Puede editar: admin, el agente de la propiedad, un agente con contrato en
-- ella, o cualquiera si la propiedad todavía no tiene dueños (alta inicial
-- desde el contrato).
create function public.set_property_owners(p_property_id uuid, p_owners jsonb)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_count int;
  v_primaries int;
  v_total numeric;
  v_distinct int;
begin
  if auth.uid() is null then raise exception 'No autenticado'; end if;
  if not exists (select 1 from properties where id = p_property_id) then
    raise exception 'Propiedad inexistente';
  end if;
  if not (
    public.is_admin()
    or exists (select 1 from properties where id = p_property_id and agent_id = auth.uid())
    or exists (select 1 from rental_contracts where property_id = p_property_id and agent_id = auth.uid())
    or not exists (select 1 from property_owners where property_id = p_property_id)
  ) then
    raise exception 'No podés modificar los dueños de esta propiedad';
  end if;

  if jsonb_typeof(p_owners) <> 'array' then raise exception 'Formato inválido'; end if;
  select count(*), count(*) filter (where coalesce((o->>'is_primary')::boolean, false)),
         coalesce(sum((o->>'share_pct')::numeric), 0), count(distinct o->>'contact_id')
    into v_count, v_primaries, v_total, v_distinct
  from jsonb_array_elements(p_owners) o;

  if v_count > 0 then
    if v_primaries <> 1 then raise exception 'Tiene que haber un propietario principal'; end if;
    if v_distinct <> v_count then raise exception 'Hay un propietario repetido'; end if;
    if v_total <> 100 then raise exception 'Los porcentajes suman % %%: tienen que sumar 100', v_total; end if;
    if exists (select 1 from jsonb_array_elements(p_owners) o where (o->>'share_pct')::numeric <= 0) then
      raise exception 'Cada propietario tiene que tener un porcentaje mayor a 0';
    end if;
  end if;

  delete from property_owners where property_id = p_property_id;
  insert into property_owners (property_id, contact_id, share_pct, is_primary)
  select p_property_id, (o->>'contact_id')::uuid, (o->>'share_pct')::numeric, coalesce((o->>'is_primary')::boolean, false)
  from jsonb_array_elements(p_owners) o;
end $$;
revoke all on function public.set_property_owners(uuid, jsonb) from public, anon;
grant execute on function public.set_property_owners(uuid, jsonb) to authenticated;

-- === Dueños actuales: desde el contrato más reciente de cada propiedad ===
with latest as (
  select distinct on (property_id) id, property_id, owner_id
  from public.rental_contracts
  order by property_id, (status = 'ACTIVO') desc, start_date desc
)
insert into public.property_owners (property_id, contact_id, share_pct, is_primary)
select l.property_id, l.owner_id,
       100 - coalesce((select sum(p.share_pct) from public.rental_contract_parties p
                       where p.contract_id = l.id and p.role = 'CO_PROPIETARIO'), 0),
       true
from latest l
union all
select l.property_id, p.contact_id, p.share_pct, false
from latest l join public.rental_contract_parties p on p.contract_id = l.id and p.role = 'CO_PROPIETARIO';
