-- Buyer Intelligence: la demanda del comprador vive en el propio lead (una
-- persona, una búsqueda). Todo nullable: un lead sin search_operation es un
-- contacto sin búsqueda cargada y no participa del matching. RLS: las
-- policies existentes de leads (agente asignado / admin) ya cubren estas
-- columnas, así que un agente solo ve compradores propios y un admin todos.
alter table public.leads
  add column if not exists search_operation text
    check (search_operation in ('venta', 'alquiler')),
  add column if not exists search_type_ids bigint[] not null default '{}',
  add column if not exists search_locations text[] not null default '{}',
  add column if not exists search_budget_min numeric check (search_budget_min >= 0),
  add column if not exists search_budget_max numeric check (search_budget_max >= 0),
  add column if not exists search_currency text
    check (search_currency in ('USD', 'ARS')),
  add column if not exists search_bedrooms_min smallint check (search_bedrooms_min >= 0),
  add column if not exists search_bathrooms_min smallint check (search_bathrooms_min >= 0),
  add column if not exists search_financing boolean,
  add column if not exists search_urgency text
    check (search_urgency in ('alta', 'media', 'baja')),
  -- Última vez que alguien confirmó que sigue buscando; pondera el ranking.
  add column if not exists search_confirmed_at timestamptz;

create index if not exists leads_search_operation_idx
  on public.leads (search_operation)
  where search_operation is not null;
