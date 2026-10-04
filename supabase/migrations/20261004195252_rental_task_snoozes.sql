-- Bandeja "Hoy" de alquileres: tareas pospuestas.
--
-- Las tareas no se guardan: se calculan en cada carga a partir de los datos
-- (deuda, ajustes, liquidaciones, vencimientos...) y desaparecen solas
-- cuando el dato cambia. Lo único persistente es "posponer": una tarea se
-- identifica por una clave determinística (ej. DEUDA:<contrato>:<vencimiento
-- más viejo>) y queda oculta hasta snoozed_until. Es compartido por el
-- equipo: si alguien ya reclamó, la tarea no le aparece al resto.

create table public.rental_task_snoozes (
  task_key text primary key check (length(task_key) between 3 and 200),
  snoozed_until date not null,
  reason text check (reason is null or length(reason) <= 120),
  created_by uuid references auth.users(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now()
);
create index rental_task_snoozes_until on public.rental_task_snoozes(snoozed_until);

alter table public.rental_task_snoozes enable row level security;
revoke all on public.rental_task_snoozes from anon, authenticated;
grant select, insert, update, delete on public.rental_task_snoozes to authenticated;
create policy "Tareas pospuestas: agentes" on public.rental_task_snoozes for all to authenticated
  using (true) with check (true);
