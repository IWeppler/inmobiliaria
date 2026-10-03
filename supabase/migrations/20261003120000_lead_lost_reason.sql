-- Motivo de pérdida de un lead: se pide al descartarlo y alimenta Reportes
-- (por qué se cae el embudo). Nullable: los leads descartados antes de esta
-- migración no tienen motivo y se informan como "Sin motivo registrado".
-- RLS: las policies existentes de leads ya cubren estas columnas.
alter table public.leads
  add column if not exists lost_reason text
    check (lost_reason in (
      'PRECIO',          -- precio fuera de su presupuesto
      'FINANCIACION',    -- no consiguió crédito o financiación
      'OTRA_PROPIEDAD',  -- compró o alquiló otra propiedad
      'NO_CUMPLE',       -- la propiedad no cumple lo que busca
      'NO_RESPONDE',     -- dejó de responder
      'POSTERGO',        -- postergó la búsqueda
      'NO_CALIFICA',     -- no califica (garantía, requisitos)
      'DUPLICADO',       -- duplicado, spam o dato inválido
      'OTRO'
    )),
  add column if not exists lost_reason_note text
    check (char_length(lost_reason_note) <= 500);

-- El motivo solo tiene sentido mientras el lead sigue descartado: si se
-- reabre, se limpia para que Reportes no cuente un motivo vencido.
create or replace function public.clear_lead_lost_reason()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.status is distinct from 'DESCARTADO' then
    new.lost_reason := null;
    new.lost_reason_note := null;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_leads_clear_lost_reason on public.leads;
create trigger trg_leads_clear_lost_reason
  before insert or update of status, lost_reason, lost_reason_note on public.leads
  for each row execute function public.clear_lead_lost_reason();
