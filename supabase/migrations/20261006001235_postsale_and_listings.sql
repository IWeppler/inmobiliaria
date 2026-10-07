-- Postventa (reserva → escritura) y captación de propietarios.
--
-- 1. Postventa: el comprador sigue siendo un lead (decisión del roadmap):
--    la operación vive en columnas de `leads`, sin tocar el enum
--    lead_status del que dependen el Kanban y el embudo. deal_stage marca
--    en qué paso está; las fechas son previstas mientras la etapa no llega.
-- 2. Captación: una propiedad que todavía no está en el sistema. Tabla
--    propia, mismo criterio de acceso que leads (agente dueño o admin).

alter table public.leads
  add column deal_stage text check (deal_stage in ('RESERVA', 'BOLETO', 'FINANCIACION', 'ESCRITURA', 'ESCRITURADA', 'CAIDA')),
  add column deal_price numeric(14,2) check (deal_price > 0),
  add column deal_currency text check (deal_currency in ('ARS', 'USD')),
  add column reserva_at date,
  add column reserva_amount numeric(14,2) check (reserva_amount >= 0),
  add column reserva_expires_at date,
  add column boleto_at date,
  add column deal_financing boolean not null default false,
  add column deal_bank text check (char_length(deal_bank) <= 120),
  add column deal_loan_amount numeric(14,2) check (deal_loan_amount >= 0),
  add column deal_loan_status text check (deal_loan_status in ('EN_TRAMITE', 'APROBADO', 'RECHAZADO')),
  add column escritura_at date,
  add column escribano text check (char_length(escribano) <= 160),
  add column deal_checklist jsonb not null default '{}'::jsonb,
  add column deal_lost_reason text check (char_length(deal_lost_reason) <= 500),
  add column deal_updated_at timestamptz;
create index leads_deal_stage on public.leads(deal_stage) where deal_stage is not null;

create table public.owner_prospects (
  id uuid primary key default gen_random_uuid(),
  agent_id uuid default auth.uid() references public.agents(id) on delete set null,
  owner_name text not null check (char_length(owner_name) between 2 and 120),
  owner_phone text check (char_length(owner_phone) <= 40),
  owner_email text check (char_length(owner_email) <= 160),
  contact_id uuid references public.rental_contacts(id) on delete set null,
  address text check (char_length(address) <= 200),
  city text check (char_length(city) <= 120),
  operation text not null default 'venta' check (operation in ('venta', 'alquiler')),
  property_type_id integer references public.property_types(id) on delete set null,
  stage text not null default 'CONTACTO' check (stage in ('CONTACTO', 'TASACION', 'PROPUESTA', 'AUTORIZACION', 'PUBLICADA', 'PERDIDA')),
  source text check (char_length(source) <= 60),
  appraisal_value numeric(14,2) check (appraisal_value > 0),
  owner_price numeric(14,2) check (owner_price > 0),
  currency text not null default 'USD' check (currency in ('ARS', 'USD')),
  commission_pct numeric(5,2) check (commission_pct between 0 and 100),
  exclusive boolean not null default false,
  authorization_signed_at date,
  authorization_expires_at date,
  property_id uuid references public.properties(id) on delete set null,
  next_action text check (char_length(next_action) <= 200),
  next_action_at date,
  lost_reason text check (char_length(lost_reason) <= 500),
  notes text check (char_length(notes) <= 4000),
  stage_changed_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);
create index owner_prospects_agent on public.owner_prospects(agent_id);
create index owner_prospects_open on public.owner_prospects(stage) where stage not in ('PUBLICADA', 'PERDIDA');

alter table public.owner_prospects enable row level security;
revoke all on public.owner_prospects from anon, authenticated;
grant select, insert, update, delete on public.owner_prospects to authenticated;
create policy "Captaciones: agente dueño o admin" on public.owner_prospects for all to authenticated
using (agent_id = auth.uid() or public.is_admin())
with check (agent_id = auth.uid() or public.is_admin());
