-- Vacancia (E4.17).
--
-- 1. Intención de renovación por contrato: el agente registra si el
--    inquilino renueva o se va; con eso la bandeja sabe si hay que armar la
--    renovación o salir a publicar antes de que se desocupe.
-- 2. Disponible desde: se puede publicar la propiedad mientras sigue
--    ocupada, avisando desde cuándo se puede alquilar.

alter table public.rental_contracts
  add column renewal_intent text check (renewal_intent in ('RENUEVA', 'NO_RENUEVA')),
  add column renewal_intent_at timestamptz,
  add column renewal_intent_note text check (char_length(renewal_intent_note) <= 500);

alter table public.properties
  add column available_from date;

-- Los permisos de update de rental_contracts son por columna en algunas
-- instalaciones: se habilitan explícitamente las nuevas.
grant update (renewal_intent, renewal_intent_at, renewal_intent_note) on public.rental_contracts to authenticated;
grant update (available_from) on public.properties to authenticated;
