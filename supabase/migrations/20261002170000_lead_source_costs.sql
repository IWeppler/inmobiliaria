-- Costo mensual de cada fuente de leads (portales, publicidad), para medir
-- el retorno por fuente en Reportes. Es información financiera del negocio:
-- solo admin, igual que cash_movements. Un registro por fuente y mes; cargar
-- de nuevo el mismo mes lo reemplaza.
create table if not exists public.lead_source_costs (
  id uuid primary key default gen_random_uuid(),
  -- Misma clave normalizada que usa Reportes (ZONAPROP, ARGENPROP, ...).
  source text not null check (source ~ '^[A-Z_]+$'),
  -- Primer día del mes al que corresponde el costo.
  month date not null check (month = date_trunc('month', month)::date),
  amount numeric(14,2) not null check (amount > 0),
  currency text not null check (currency in ('ARS', 'USD')),
  created_by uuid references auth.users(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  unique (source, month)
);

alter table public.lead_source_costs enable row level security;

revoke all on public.lead_source_costs from anon;

create policy "Costos de fuentes: solo admin"
on public.lead_source_costs for all to authenticated
using (public.is_admin()) with check (public.is_admin());
