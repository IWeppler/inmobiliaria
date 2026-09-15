-- Etapa 3 (fundación de datos): tabla de historial de cambios de status
-- para properties y leads. Hoy no existe ningún registro de cuándo cambia
-- el status de una entidad -- eso bloquea el funnel de conversión, la
-- comparación de ingresos mes a mes, y las métricas del Kanban de leads.
--
-- Diseño: una sola tabla polimórfica (entity_type + entity_id) en vez de
-- dos tablas separadas (property_status_history / lead_status_history),
-- para no duplicar índices/policies/triggers cuando el patrón es idéntico.
-- El costo es que entity_id no puede llevar FK real (referencia a dos
-- tablas distintas según entity_type) -- se documenta y se compensa con
-- el índice compuesto de abajo.

create table "public"."status_history" (
    "id" uuid primary key default gen_random_uuid(),
    "entity_type" text not null check (entity_type in ('property', 'lead')),
    "entity_id" uuid not null,
    "status" text not null,
    "changed_at" timestamptz not null default now(),
    "changed_by" uuid null references auth.users(id) on delete set null
);

comment on table "public"."status_history" is
  'Historial de cambios de status de properties y leads. Poblada exclusivamente por triggers (log_status_change); no tiene policies de escritura para anon/authenticated.';
comment on column "public"."status_history"."entity_id" is
  'FK lógica a properties.id o leads.id según entity_type. Sin FK real en el schema porque referencia dos tablas distintas.';

-- Query más frecuente: "dame el historial de esta entidad puntual, más
-- reciente primero" (Kanban card, detalle de lead/property).
create index "idx_status_history_entity"
  on "public"."status_history" ("entity_type", "entity_id", "changed_at" desc);

-- Queries agregadas del funnel: "cuántas entidades pasaron a status X
-- dentro de un rango de fechas", sin filtrar por una entidad puntual.
create index "idx_status_history_funnel"
  on "public"."status_history" ("entity_type", "status", "changed_at");

-- === RLS ===
-- Importante: por el "ALTER DEFAULT PRIVILEGES ... GRANT ALL ON TABLES"
-- que ya existe en el schema (ver 20260710181500_remote_schema.sql), toda
-- tabla nueva nace con GRANT ALL a anon/authenticated. Mismo gap que se
-- cerró para exchange_rates -- hay que revocar explícitamente.
alter table "public"."status_history" enable row level security;

revoke all on "public"."status_history" from "anon";
revoke all on "public"."status_history" from "authenticated";

-- anon no recibe ningún grant: a diferencia de exchange_rates (dato
-- público de la landing), el historial de leads/properties es información
-- interna del negocio.
grant select on "public"."status_history" to "authenticated";

-- SELECT: dueño (agente asignado a la property/lead, o creador del lead)
-- o admin. No hay policy de INSERT/UPDATE/DELETE para anon/authenticated:
-- bajo RLS, sin una policy permisiva esas operaciones quedan denegadas por
-- default. La única escritura la hacen los triggers de abajo, corriendo
-- como SECURITY DEFINER (bypassean RLS al ejecutar con el owner de la
-- función, no con el rol de quien disparó el INSERT/UPDATE original).
create policy "Ver historial: dueño o admin"
on "public"."status_history"
for select
to authenticated
using (
  (
    entity_type = 'property'
    and exists (
      select 1 from public.properties p
      where p.id = status_history.entity_id
        and (
          p.agent_id = auth.uid()
          or (select a.role from public.agents a where a.id = auth.uid()) = 'admin'
        )
    )
  )
  or
  (
    entity_type = 'lead'
    and exists (
      select 1 from public.leads l
      where l.id = status_history.entity_id
        and (
          l.agent_id = auth.uid()
          or l.created_by = auth.uid()
          or (select a.role from public.agents a where a.id = auth.uid()) = 'admin'
        )
    )
  )
);

-- === Función de trigger (compartida entre properties y leads) ===
-- entity_type se pasa como argumento del trigger (TG_ARGV[0]) para no
-- duplicar la función. SECURITY DEFINER + search_path fijo (mismo
-- criterio que la revisión de update_all_normalized_prices): corre con
-- los privilegios del owner (postgres), no con los de quien disparó el
-- INSERT/UPDATE, así que puede escribir en status_history aunque el rol
-- invocante (authenticated) no tenga grant de INSERT ahí.
--
-- Nota sobre leads.status nullable: si el status llega NULL (leads.status
-- es nullable; NUEVO se representa hoy como null en la app, ver
-- app/(admin)/dashboard/page.tsx), no se inserta fila -- status_history.status
-- es NOT NULL y no hay forma de representar "sin status" ahí sin ensuciar
-- el enum. properties.status es NOT NULL así que esta rama nunca aplica
-- para properties.
create or replace function "public"."log_status_change"()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if TG_OP = 'INSERT' then
    if NEW.status is not null then
      insert into public.status_history (entity_type, entity_id, status, changed_by)
      values (TG_ARGV[0], NEW.id, NEW.status::text, auth.uid());
    end if;
  elsif TG_OP = 'UPDATE' then
    if NEW.status is not null and OLD.status is distinct from NEW.status then
      insert into public.status_history (entity_type, entity_id, status, changed_by)
      values (TG_ARGV[0], NEW.id, NEW.status::text, auth.uid());
    end if;
  end if;
  return NEW;
end;
$$;

-- Igual que con update_all_normalized_prices: sacar el EXECUTE default a
-- PUBLIC. No es estrictamente explotable como RPC directo (una función que
-- retorna "trigger" no se puede invocar fuera de un trigger, Postgres lo
-- rechaza), pero se revoca igual por consistencia con el criterio de
-- "nada invocable por anon/authenticated" y por si el día de mañana se
-- refactoriza a un tipo de retorno distinto.
revoke execute on function "public"."log_status_change"() from "public";
revoke execute on function "public"."log_status_change"() from "anon";
revoke execute on function "public"."log_status_change"() from "authenticated";

create trigger "trg_properties_status_history"
  after insert or update on "public"."properties"
  for each row execute function "public"."log_status_change"('property');

create trigger "trg_leads_status_history"
  after insert or update on "public"."leads"
  for each row execute function "public"."log_status_change"('lead');

-- === Backfill ===
-- Baseline sintético: no sabemos cuándo cambió realmente el status de las
-- filas que ya existen, así que se registra el status ACTUAL con
-- changed_at = created_at de la entidad y changed_by = null. A partir de
-- la aplicación de esta migración, todo lo que se registre en
-- status_history es un cambio real capturado por el trigger. Cualquier
-- métrica que dependa de "cuándo pasó a status X" para filas anteriores a
-- esta migración es aproximada (asume que el status actual es el único
-- que tuvo desde su creación).
insert into public.status_history (entity_type, entity_id, status, changed_at, changed_by)
select 'property', id, status::text, created_at, null
from public.properties;

-- Para leads con status null se guarda 'NUEVO': es el estado que la app ya
-- trata como equivalente a null hoy (ver newLeadsCount en
-- app/(admin)/dashboard/page.tsx, que cuenta `!l.status` como nuevo).
insert into public.status_history (entity_type, entity_id, status, changed_at, changed_by)
select 'lead', id, coalesce(status::text, 'NUEVO'), created_at, null
from public.leads;
