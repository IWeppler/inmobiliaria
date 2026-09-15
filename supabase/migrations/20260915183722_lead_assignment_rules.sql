-- E1.2: reglas de asignación custom, por encima del round-robin de E0.4.
-- Una regla dice "los leads de <ciudad X> / <tipo de propiedad Y> van a
-- <agente>". Si hay varios agentes con regla para el mismo valor, se
-- reparte por round-robin entre ellos (menor priority primero, y a igual
-- priority el menos recientemente asignado). Sin regla que matchee, cae
-- al round-robin general. La asignación manual con override de admin ya
-- existe en el detalle del lead (reasignar) y no pasa por acá.
create table "public"."lead_assignment_rules" (
    "id" uuid primary key default gen_random_uuid(),
    "agent_id" uuid not null references public.agents(id) on delete cascade,
    "match_type" text not null check (match_type in ('city', 'property_type')),
    "match_value" text not null check (length(trim(match_value)) > 0),
    "priority" integer not null default 0,
    "created_at" timestamptz not null default now(),
    unique (agent_id, match_type, match_value)
);

comment on table "public"."lead_assignment_rules" is
  'Reglas de asignación automática de leads públicos (E1.2). match_type = city | property_type; match_value se compara case-insensitive y por prefijo en ambos sentidos ("Terreno" matchea "Terreno / Lote").';

create index "idx_lead_assignment_rules_match"
  on "public"."lead_assignment_rules" ("match_type", lower("match_value"));

-- === RLS: solo admin lee/escribe. anon no tiene acceso; la asignación
-- pública corre dentro de next_agent_for_lead (SECURITY DEFINER).
alter table "public"."lead_assignment_rules" enable row level security;

revoke all on "public"."lead_assignment_rules" from "anon";
revoke all on "public"."lead_assignment_rules" from "authenticated";
grant select, insert, update, delete on "public"."lead_assignment_rules" to "authenticated";

create policy "Admin gestiona reglas de asignación"
on "public"."lead_assignment_rules"
for all
to authenticated
using ((select a.role from public.agents a where a.id = auth.uid()) = 'admin')
with check ((select a.role from public.agents a where a.id = auth.uid()) = 'admin');

-- === RPC: reemplaza la firma sin argumentos de E0.4 ===
-- Orden de resolución:
--   1. reglas por ciudad (si p_city viene)
--   2. reglas por tipo de propiedad (si p_property_type viene)
--   3. round-robin general (comportamiento de E0.4)
-- En cada nivel, entre los candidatos se elige por priority asc y luego
-- por "menos recientemente asignado".
drop function if exists "public"."next_agent_for_lead"();

create or replace function "public"."next_agent_for_lead"(
  p_city text default null,
  p_property_type text default null
)
returns uuid
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_agent uuid;
begin
  if p_city is not null and length(trim(p_city)) > 0 then
    select r.agent_id into v_agent
    from public.lead_assignment_rules r
    join public.agents a on a.id = r.agent_id
    left join lateral (
      select max(l.created_at) as last_assigned_at
      from public.leads l where l.agent_id = a.id
    ) la on true
    where r.match_type = 'city'
      and (
        lower(trim(p_city)) like lower(trim(r.match_value)) || '%'
        or lower(trim(r.match_value)) like lower(trim(p_city)) || '%'
      )
    order by r.priority asc, la.last_assigned_at asc nulls first, a.created_at asc
    limit 1;
    if v_agent is not null then return v_agent; end if;
  end if;

  if p_property_type is not null and length(trim(p_property_type)) > 0 then
    select r.agent_id into v_agent
    from public.lead_assignment_rules r
    join public.agents a on a.id = r.agent_id
    left join lateral (
      select max(l.created_at) as last_assigned_at
      from public.leads l where l.agent_id = a.id
    ) la on true
    where r.match_type = 'property_type'
      and (
        lower(trim(p_property_type)) like lower(trim(r.match_value)) || '%'
        or lower(trim(r.match_value)) like lower(trim(p_property_type)) || '%'
      )
    order by r.priority asc, la.last_assigned_at asc nulls first, a.created_at asc
    limit 1;
    if v_agent is not null then return v_agent; end if;
  end if;

  select a.id into v_agent
  from public.agents a
  left join lateral (
    select max(l.created_at) as last_assigned_at
    from public.leads l where l.agent_id = a.id
  ) la on true
  order by la.last_assigned_at asc nulls first, a.created_at asc, a.id asc
  limit 1;

  return v_agent;
end;
$$;

comment on function "public"."next_agent_for_lead"(text, text) is
  'Asignación de leads públicos: reglas por ciudad, luego por tipo de propiedad (E1.2), luego round-robin general (E0.4). Solo invocable por service_role desde Server Actions.';

revoke execute on function "public"."next_agent_for_lead"(text, text) from "public";
revoke execute on function "public"."next_agent_for_lead"(text, text) from "anon";
revoke execute on function "public"."next_agent_for_lead"(text, text) from "authenticated";
