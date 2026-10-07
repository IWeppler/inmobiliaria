-- Motor de tareas proactivo.
--
-- Hasta ahora la bandeja Hoy solo tenía alertas derivadas de los datos (se
-- calculan en cada carga y se cierran solas). Esto agrega tareas guardadas:
-- las que nacen de un evento del ciclo de vida de la propiedad (reglas) y
-- las que alguien carga a mano. Se asignan a cualquier usuario: agente,
-- admin o administración.
--
-- 1. task_rules: el "playbook". Qué tareas se generan, para quién (null =
--    el agente de la propiedad), en cuántos días y con qué prioridad. Lo
--    edita el admin en Ajustes.
-- 2. tasks: cada tarea. rule = null es manual. dedupe_key evita que una
--    regla cree dos veces la misma tarea para la misma propiedad.
-- 3. Trigger sobre properties: al publicarse (EN_VENTA / EN_ALQUILER) crea
--    las tareas de las reglas activas; si deja de estar publicada cancela
--    las pendientes, y si vuelve a publicarse las reabre.
-- 4. Al asignarle una tarea a otra persona, le llega una notificación.

create table public.task_rules (
  key text primary key,
  label text not null check (char_length(label) between 2 and 120),
  description text check (char_length(description) <= 300),
  enabled boolean not null default true,
  assignee_id uuid references public.agents(id) on delete set null,
  due_days integer not null default 0 check (due_days between 0 and 60),
  priority text not null default 'media' check (priority in ('alta', 'media', 'baja')),
  sort integer not null default 0,
  updated_at timestamptz not null default now()
);

insert into public.task_rules (key, label, description, due_days, priority, sort) values
  ('PROP_COMPRADORES', 'Avisar a compradores compatibles', 'Compartí la propiedad con los compradores de la base cuya búsqueda coincide. Se cierra sola cuando no queda ninguno sin contactar.', 0, 'alta', 1),
  ('PROP_FICHA', 'Completar la ficha', 'Al menos 5 fotos y una descripción de 200 caracteres. Se cierra sola cuando se cumple.', 1, 'media', 2),
  ('PROP_INSTAGRAM', 'Pieza de Instagram', 'Generá la pieza para redes y publicala. Se cierra sola al descargarla.', 1, 'media', 3),
  ('PROP_PORTALES', 'Verificar en portales', 'Los portales leen el feed solos: revisá que el aviso aparezca bien en Zonaprop, Argenprop y MercadoLibre.', 2, 'baja', 4),
  ('PROP_CARTEL', 'Colocar el cartel', 'Cartel de venta o alquiler en el frente de la propiedad.', 3, 'baja', 5);

alter table public.task_rules enable row level security;
revoke all on public.task_rules from anon, authenticated;
grant select, update on public.task_rules to authenticated;
create policy "Reglas de tareas: lectura" on public.task_rules for select to authenticated using (true);
create policy "Reglas de tareas: admin edita" on public.task_rules for update to authenticated
using (public.is_admin()) with check (public.is_admin());

create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(title) between 2 and 200),
  notes text check (char_length(notes) <= 2000),
  status text not null default 'PENDIENTE' check (status in ('PENDIENTE', 'HECHA', 'CANCELADA')),
  priority text not null default 'media' check (priority in ('alta', 'media', 'baja')),
  due_date date,
  assignee_id uuid references public.agents(id) on delete set null,
  -- null: la creó el motor.
  created_by uuid default auth.uid() references public.agents(id) on delete set null,
  property_id uuid references public.properties(id) on delete cascade,
  lead_id uuid references public.leads(id) on delete cascade,
  contract_id uuid references public.rental_contracts(id) on delete cascade,
  rule text references public.task_rules(key) on delete set null,
  dedupe_key text unique,
  -- Cómo terminó, si no fue a mano: "Sin compradores compatibles", "La propiedad pasó a reservada".
  resolution text check (char_length(resolution) <= 200),
  done_at timestamptz,
  done_by uuid references public.agents(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index tasks_open_by_assignee on public.tasks(assignee_id, due_date) where status = 'PENDIENTE';
create index tasks_property on public.tasks(property_id) where property_id is not null;
create index tasks_lead on public.tasks(lead_id) where lead_id is not null;
create index tasks_contract on public.tasks(contract_id) where contract_id is not null;

alter table public.tasks enable row level security;
revoke all on public.tasks from anon, authenticated;
grant select, insert, update, delete on public.tasks to authenticated;

-- Ve y actualiza una tarea: el responsable, quien la creó, el agente de la
-- propiedad o del lead vinculado, y el admin.
create or replace function public.can_see_task(p_assignee uuid, p_creator uuid, p_property uuid, p_lead uuid)
returns boolean
language sql
stable
security definer
set search_path to 'public'
as $$
  select auth.uid() is not null and (
    p_assignee = auth.uid()
    or p_creator = auth.uid()
    or public.is_admin()
    or (p_property is not null and exists (select 1 from public.properties p where p.id = p_property and p.agent_id = auth.uid()))
    or (p_lead is not null and exists (select 1 from public.leads l where l.id = p_lead and l.agent_id = auth.uid()))
  );
$$;
revoke all on function public.can_see_task(uuid, uuid, uuid, uuid) from public, anon;
grant execute on function public.can_see_task(uuid, uuid, uuid, uuid) to authenticated;

create policy "Tareas: lectura" on public.tasks for select to authenticated
using (public.can_see_task(assignee_id, created_by, property_id, lead_id));
create policy "Tareas: alta propia" on public.tasks for insert to authenticated
with check (created_by = auth.uid() and rule is null);
create policy "Tareas: edición" on public.tasks for update to authenticated
using (public.can_see_task(assignee_id, created_by, property_id, lead_id))
-- Sin with check propio: al reasignar, quien la pasa puede dejar de verla.
with check (true);
create policy "Tareas: baja de manuales" on public.tasks for delete to authenticated
using (rule is null and (created_by = auth.uid() or public.is_admin()));

-- Marca de tiempo y autor al cerrar; se limpian al reabrir. Las que se
-- cierran solas traen resolution y quedan sin autor.
create or replace function public.tasks_touch()
returns trigger
language plpgsql
set search_path to 'public'
as $$
begin
  new.updated_at := now();
  if new.status = 'HECHA' and old.status is distinct from 'HECHA' then
    new.done_at := now();
    new.done_by := case when new.resolution is null then auth.uid() end;
  elsif new.status = 'PENDIENTE' and old.status is distinct from 'PENDIENTE' then
    new.done_at := null;
    new.done_by := null;
    new.resolution := null;
  end if;
  return new;
end $$;
create trigger trg_tasks_touch before update on public.tasks for each row execute function public.tasks_touch();

-- Aviso al responsable cuando otro le asigna una tarea (o se la reasigna).
create or replace function public.tasks_notify_assignee()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  if new.assignee_id is null or new.status <> 'PENDIENTE' then return null; end if;
  if tg_op = 'UPDATE' and old.assignee_id is not distinct from new.assignee_id then return null; end if;
  if new.assignee_id = auth.uid() then return null; end if;
  -- Las del motor van al agente de la propiedad: solo se avisa si la regla
  -- las manda a otra persona.
  if new.rule is not null and new.property_id is not null
     and exists (select 1 from public.properties p where p.id = new.property_id and p.agent_id = new.assignee_id) then
    return null;
  end if;
  insert into public.notifications (user_id, title, message, link, type)
  values (
    new.assignee_id,
    'Te asignaron una tarea',
    new.title || coalesce(' (vence el ' || to_char(new.due_date, 'DD/MM') || ')', ''),
    '/dashboard/hoy',
    'task'
  );
  return null;
end $$;
create trigger trg_tasks_notify after insert or update of assignee_id on public.tasks
for each row execute function public.tasks_notify_assignee();

-- Ciclo de vida de la propiedad.
create or replace function public.task_engine_property()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  r record;
  v_today date := (now() at time zone 'America/Argentina/Buenos_Aires')::date;
  v_published boolean := new.status in ('EN_VENTA', 'EN_ALQUILER');
  v_was_published boolean := tg_op = 'UPDATE' and old.status in ('EN_VENTA', 'EN_ALQUILER');
begin
  if v_published and not v_was_published then
    for r in select * from public.task_rules where enabled and key like 'PROP\_%' order by sort loop
      insert into public.tasks (title, priority, due_date, assignee_id, created_by, property_id, rule, dedupe_key)
      values (r.label, r.priority, v_today + r.due_days, coalesce(r.assignee_id, new.agent_id), null, new.id, r.key, r.key || ':' || new.id)
      on conflict (dedupe_key) do update
        set status = 'PENDIENTE', due_date = excluded.due_date, assignee_id = excluded.assignee_id
        where public.tasks.status = 'CANCELADA';
    end loop;
  elsif v_was_published and not v_published then
    update public.tasks
    set status = 'CANCELADA',
        resolution = 'La propiedad pasó a ' || case new.status
          when 'RESERVADO' then 'reservada' when 'VENDIDO' then 'vendida' when 'ALQUILADO' then 'alquilada'
          else lower(new.status::text) end
    where property_id = new.id and rule like 'PROP\_%' and status = 'PENDIENTE';
  end if;
  return null;
end $$;
create trigger trg_properties_task_engine after insert or update of status on public.properties
for each row execute function public.task_engine_property();

-- Funciones de trigger: no se llaman por RPC.
revoke all on function public.tasks_touch() from public, anon, authenticated;
revoke all on function public.tasks_notify_assignee() from public, anon, authenticated;
revoke all on function public.task_engine_property() from public, anon, authenticated;
