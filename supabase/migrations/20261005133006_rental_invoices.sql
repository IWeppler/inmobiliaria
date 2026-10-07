-- Facturación electrónica ARCA (ex AFIP) de honorarios (E4.19).
--
-- Se factura la comisión de administración de cada liquidación, una
-- factura por titular (según su %), por WSFEv1. Las facturas las inserta el
-- servidor con service role después de obtener el CAE: un agente no puede
-- crear filas con un CAE inventado. Los agentes leen las de sus contratos.

alter table public.rental_contacts
  add column iva_condition text check (iva_condition in ('RI', 'MONOTRIBUTO', 'EXENTO', 'CONSUMIDOR_FINAL'));

-- Ticket de acceso de WSAA (vale 12 h). Solo service role.
create table public.afip_tokens (
  service text not null,
  environment text not null check (environment in ('HOMOLOGACION', 'PRODUCCION')),
  token text not null,
  sign text not null,
  expires_at timestamptz not null,
  primary key (service, environment)
);
alter table public.afip_tokens enable row level security;
revoke all on public.afip_tokens from anon, authenticated;

create table public.rental_invoices (
  id uuid primary key default gen_random_uuid(),
  settlement_id uuid references public.rental_settlements(id) on delete restrict,
  share_id uuid references public.rental_settlement_shares(id) on delete restrict,
  contact_id uuid not null references public.rental_contacts(id) on delete restrict,
  kind text not null check (kind in ('FACTURA', 'NOTA_CREDITO')),
  cbte_tipo integer not null,
  pto_vta integer not null,
  cbte_nro integer not null,
  environment text not null check (environment in ('HOMOLOGACION', 'PRODUCCION')),
  issued_on date not null,
  receptor_name text not null,
  receptor_doc_tipo integer not null,
  receptor_doc_nro text not null,
  receptor_iva text not null,
  description text not null,
  currency text not null check (currency in ('ARS', 'USD')),
  exchange_rate numeric(14,6) not null default 1,
  net numeric(14,2) not null,
  vat numeric(14,2) not null default 0,
  total numeric(14,2) not null check (total > 0),
  service_from date,
  service_to date,
  cae text not null,
  cae_due date not null,
  credited_invoice_id uuid references public.rental_invoices(id) on delete restrict,
  voided boolean not null default false,
  created_by uuid,
  created_at timestamptz not null default now(),
  unique (environment, pto_vta, cbte_tipo, cbte_nro)
);
-- Una sola factura vigente por titular de cada liquidación.
create unique index rental_invoices_one_per_share on public.rental_invoices(share_id)
  where kind = 'FACTURA' and not voided;
create index rental_invoices_settlement on public.rental_invoices(settlement_id);

alter table public.rental_invoices enable row level security;
revoke all on public.rental_invoices from anon, authenticated;
grant select on public.rental_invoices to authenticated;
create policy "Facturas: contrato visible" on public.rental_invoices for select to authenticated
using (public.is_admin() or exists (
  select 1 from public.rental_settlements s join public.rental_contracts c on c.id = s.contract_id
  where s.id = settlement_id and c.agent_id = auth.uid()));
