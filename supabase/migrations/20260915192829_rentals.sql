-- Tier 4 (E4.1–E4.4): administración de alquileres. Modelo propio,
-- separado de leads/ventas: propietario e inquilino son contactos de
-- alquiler (rental_contacts), no leads -- un inquilino no es un
-- prospecto de venta y un propietario no pasa por el funnel.
--
-- Entidades:
--   rental_contacts    propietarios e inquilinos (kind)
--   rental_contracts   contrato: propiedad + propietario + inquilino,
--                      canon, moneda, índice de ajuste, comisión, punitorio
--   index_values       valores mensuales de ICL / IPC cargados a mano
--                      (BCRA / INDEC no exponen API estable)
--   rental_payments    una fila por período (mes) del contrato
--   rental_settlements liquidación al propietario por período:
--                      canon − comisión − gastos = neto
--
-- Permisos: mismo criterio que leads. Cada contrato tiene agent_id
-- (quien lo administra); agente ve/edita los suyos, admin todo. Los
-- contactos son directorio compartido de la inmobiliaria: cualquier
-- agente autenticado los ve y crea; anon no tiene acceso a nada.

-- === Contactos ===
create table "public"."rental_contacts" (
    "id" uuid primary key default gen_random_uuid(),
    "kind" text not null check (kind in ('owner', 'tenant')),
    "full_name" text not null,
    "document" text null,
    "phone" text null,
    "email" text null,
    "address" text null,
    "notes" text null,
    "created_at" timestamptz not null default now()
);
create index "idx_rental_contacts_kind_name" on "public"."rental_contacts" ("kind", lower("full_name"));

-- === Contratos ===
create table "public"."rental_contracts" (
    "id" uuid primary key default gen_random_uuid(),
    "property_id" uuid not null references public.properties(id) on delete restrict,
    "owner_id" uuid not null references public.rental_contacts(id) on delete restrict,
    "tenant_id" uuid not null references public.rental_contacts(id) on delete restrict,
    "agent_id" uuid null references public.agents(id) on delete set null,
    "start_date" date not null,
    "end_date" date not null check (end_date > start_date),
    "rent_amount" numeric(14,2) not null check (rent_amount > 0),
    "currency" text not null default 'ARS',
    -- ICL / IPC: ajuste por índice cargado en index_values.
    -- FIJO: ajuste por porcentaje fijo (adjustment_pct).
    -- NINGUNO: canon fijo todo el contrato.
    "adjustment_index" text not null default 'ICL'
      check (adjustment_index in ('ICL', 'IPC', 'FIJO', 'NINGUNO')),
    "adjustment_months" integer not null default 3 check (adjustment_months between 1 and 36),
    "adjustment_pct" numeric(6,2) null,
    -- Base del próximo ajuste por índice: canon y período (mes) sobre los
    -- que se calcula. Al aplicar un ajuste, ambos se actualizan.
    "base_rent_amount" numeric(14,2) not null,
    "base_period" date not null,
    "next_adjustment_date" date null,
    "commission_pct" numeric(5,2) not null default 0 check (commission_pct between 0 and 100),
    "late_fee_pct_daily" numeric(5,3) not null default 0 check (late_fee_pct_daily >= 0),
    "payment_due_day" integer not null default 10 check (payment_due_day between 1 and 28),
    "status" text not null default 'ACTIVO'
      check (status in ('ACTIVO', 'FINALIZADO', 'RESCINDIDO')),
    "notes" text null,
    "created_at" timestamptz not null default now()
);
create index "idx_rental_contracts_property" on "public"."rental_contracts" ("property_id");
create index "idx_rental_contracts_agent" on "public"."rental_contracts" ("agent_id");
create index "idx_rental_contracts_end" on "public"."rental_contracts" ("status", "end_date");

-- === Índices (ICL / IPC) ===
create table "public"."index_values" (
    "id" uuid primary key default gen_random_uuid(),
    "index_code" text not null check (index_code in ('ICL', 'IPC')),
    "period" date not null, -- primer día del mes
    "value" numeric(16,6) not null check (value > 0),
    "created_at" timestamptz not null default now(),
    unique ("index_code", "period")
);
comment on table "public"."index_values" is
  'Valores mensuales de índices de ajuste. ICL: valor diario del BCRA, se carga el del primer día del mes. IPC: nivel general INDEC (número índice, no la variación).';

-- === Pagos ===
create table "public"."rental_payments" (
    "id" uuid primary key default gen_random_uuid(),
    "contract_id" uuid not null references public.rental_contracts(id) on delete cascade,
    "period" date not null, -- primer día del mes que se paga
    "due_date" date not null,
    "amount" numeric(14,2) not null check (amount >= 0),
    "currency" text not null default 'ARS',
    "paid_at" date null,
    "paid_amount" numeric(14,2) null,
    "method" text null,
    "notes" text null,
    "created_at" timestamptz not null default now(),
    unique ("contract_id", "period")
);
create index "idx_rental_payments_due" on "public"."rental_payments" ("paid_at", "due_date");

-- === Liquidaciones ===
create table "public"."rental_settlements" (
    "id" uuid primary key default gen_random_uuid(),
    "contract_id" uuid not null references public.rental_contracts(id) on delete cascade,
    "period" date not null,
    "rent_amount" numeric(14,2) not null,
    "commission_amount" numeric(14,2) not null default 0,
    -- [{ "description": "Plomero", "amount": 15000 }]
    "expenses" jsonb not null default '[]'::jsonb,
    "expenses_amount" numeric(14,2) not null default 0,
    "net_amount" numeric(14,2) not null,
    "currency" text not null default 'ARS',
    "issued_at" date not null default current_date,
    "notes" text null,
    "created_at" timestamptz not null default now(),
    unique ("contract_id", "period")
);

-- === RLS ===
-- Por el ALTER DEFAULT PRIVILEGES del schema toda tabla nueva nace con
-- GRANT ALL a anon/authenticated: se revoca y se re-otorga solo lo
-- necesario (mismo criterio que status_history / lead_assignment_rules).
alter table "public"."rental_contacts" enable row level security;
alter table "public"."rental_contracts" enable row level security;
alter table "public"."index_values" enable row level security;
alter table "public"."rental_payments" enable row level security;
alter table "public"."rental_settlements" enable row level security;

revoke all on "public"."rental_contacts" from "anon", "authenticated";
revoke all on "public"."rental_contracts" from "anon", "authenticated";
revoke all on "public"."index_values" from "anon", "authenticated";
revoke all on "public"."rental_payments" from "anon", "authenticated";
revoke all on "public"."rental_settlements" from "anon", "authenticated";

grant select, insert, update, delete on "public"."rental_contacts" to "authenticated";
grant select, insert, update, delete on "public"."rental_contracts" to "authenticated";
grant select, insert, update, delete on "public"."index_values" to "authenticated";
grant select, insert, update, delete on "public"."rental_payments" to "authenticated";
grant select, insert, update, delete on "public"."rental_settlements" to "authenticated";

create or replace function "public"."is_admin"()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((select a.role = 'admin' from public.agents a where a.id = auth.uid()), false);
$$;
revoke execute on function "public"."is_admin"() from "public", "anon";
grant execute on function "public"."is_admin"() to "authenticated";

-- Contactos: directorio compartido dentro de la inmobiliaria.
create policy "Agentes gestionan contactos de alquiler"
on "public"."rental_contacts" for all to authenticated
using (true) with check (true);

-- Índices: cualquier agente los lee (los necesita para calcular ajustes);
-- solo admin los carga.
create policy "Agentes leen índices" on "public"."index_values"
for select to authenticated using (true);
create policy "Admin gestiona índices" on "public"."index_values"
for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- Contratos: dueño (agent_id) o admin.
create policy "Contratos: dueño o admin" on "public"."rental_contracts"
for all to authenticated
using (agent_id = auth.uid() or public.is_admin())
with check (agent_id = auth.uid() or public.is_admin());

-- Pagos y liquidaciones heredan el permiso del contrato.
create policy "Pagos: dueño del contrato o admin" on "public"."rental_payments"
for all to authenticated
using (exists (select 1 from public.rental_contracts c where c.id = rental_payments.contract_id and (c.agent_id = auth.uid() or public.is_admin())))
with check (exists (select 1 from public.rental_contracts c where c.id = rental_payments.contract_id and (c.agent_id = auth.uid() or public.is_admin())));

create policy "Liquidaciones: dueño del contrato o admin" on "public"."rental_settlements"
for all to authenticated
using (exists (select 1 from public.rental_contracts c where c.id = rental_settlements.contract_id and (c.agent_id = auth.uid() or public.is_admin())))
with check (exists (select 1 from public.rental_contracts c where c.id = rental_settlements.contract_id and (c.agent_id = auth.uid() or public.is_admin())));
