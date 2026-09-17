-- Consultas "leídas" en el dashboard: null = sin leer. Se marca desde el
-- widget de consultas recientes. RLS: la policy de update existente de
-- leads ya limita al agente asignado / admin.
alter table public.leads add column if not exists read_at timestamptz;

create index if not exists leads_read_at_idx on public.leads (read_at) where read_at is null;
