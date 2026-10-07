-- CRM: próximo paso por lead y resultado de cada visita.
--
-- 1. Próximo paso: qué hay que hacer con el lead y para cuándo. Es la base
--    de la bandeja "Hoy" de ventas: un lead sin próximo paso se olvida.
-- 2. Resultado de visita: cómo salió (interesado, caro, no vino...). Arma
--    las devoluciones por propiedad para el agente y el informe al dueño.

alter table public.leads
  add column next_action text check (char_length(next_action) <= 200),
  add column next_action_at date;
create index leads_next_action_at on public.leads(next_action_at) where next_action_at is not null;

alter table public.events
  add column outcome text check (outcome in ('INTERESADO', 'SEGUNDA_VISITA', 'CARO', 'NO_LE_GUSTO', 'NO_ASISTIO', 'OTRO')),
  add column outcome_note text check (char_length(outcome_note) <= 500),
  add column outcome_at timestamptz;

-- events no tenía política de edición: cada agente edita sus eventos
-- (admin, todos). Hace falta para registrar el resultado de la visita.
create policy "Editar propios eventos" on public.events for update to authenticated
using (auth.uid() = agent_id or public.is_admin())
with check (auth.uid() = agent_id or public.is_admin());
