-- E0.4: asignación real de leads públicos. Hasta ahora las tres Server
-- Actions públicas (contacto, tasación, consulta por propiedad sin agente)
-- hacían `from("agents").select("id").limit(1).single()`: tomaban el
-- primer agente que devolvía Postgres sin ningún criterio. Con un solo
-- usuario da igual; con varios, todos los leads caían siempre en el mismo.
--
-- Round-robin por "menos recientemente asignado": se elige el agente cuya
-- última asignación de lead es la más antigua (o que nunca recibió uno).
-- No requiere estado extra (puntero de "último asignado") y se
-- autocorrige si se agregan/quitan agentes. La asignación manual desde el
-- dashboard (LeadForm / reasignación en el detalle) no pasa por acá.
create or replace function "public"."next_agent_for_lead"()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select a.id
  from public.agents a
  left join lateral (
    select max(l.created_at) as last_assigned_at
    from public.leads l
    where l.agent_id = a.id
  ) la on true
  order by la.last_assigned_at asc nulls first, a.created_at asc, a.id asc
  limit 1;
$$;

comment on function "public"."next_agent_for_lead"() is
  'Round-robin de asignación de leads públicos: devuelve el agente con la asignación más antigua (o sin ninguna). Solo invocable por service_role desde Server Actions.';

-- Mismo criterio que update_all_normalized_prices / log_status_change:
-- nada invocable directo por anon/authenticated (ni vía PUBLIC).
revoke execute on function "public"."next_agent_for_lead"() from "public";
revoke execute on function "public"."next_agent_for_lead"() from "anon";
revoke execute on function "public"."next_agent_for_lead"() from "authenticated";
