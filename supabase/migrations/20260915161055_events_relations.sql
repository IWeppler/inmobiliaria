-- Etapa 3 (fundación de datos), parte 2: relacionar events con leads y
-- properties. Hoy "events" es texto libre (title) sin ningún vínculo a una
-- entidad -- eso impide construir la etapa "Visita Agendada" del funnel de
-- conversión (no hay forma de saber si un evento del calendario corresponde
-- a la visita de un lead concreto).
--
-- Todo nullable a propósito: las filas existentes hoy no tienen esta
-- información y no se puede reconstruir retroactivamente (no sabemos a qué
-- lead/property correspondía un evento pasado con solo un título de texto
-- libre). type también nullable por lo mismo -- no hay forma de inferir
-- "visita" vs. evento genérico de las filas existentes.
alter table "public"."events"
  add column "lead_id" uuid null references public.leads(id) on delete set null,
  add column "property_id" uuid null references public.properties(id) on delete set null,
  add column "type" text null;

comment on column "public"."events"."lead_id" is
  'Lead al que corresponde el evento (ej. visita agendada). Null en filas creadas antes de esta columna, y en eventos genéricos sin lead asociado.';
comment on column "public"."events"."property_id" is
  'Property a la que corresponde el evento. Null por los mismos motivos que lead_id.';
comment on column "public"."events"."type" is
  'Clasificación libre del evento (ej. ''visita''). Null = evento genérico sin clasificar, incluye todas las filas previas a esta columna.';

-- Índices parciales: la gran mayoría de las filas existentes van a tener
-- estas columnas en null (backfill imposible, ver arriba), así que un
-- índice parcial "where ... is not null" evita indexar filas que nunca se
-- van a buscar por este criterio.
create index "idx_events_lead_id" on "public"."events" ("lead_id") where "lead_id" is not null;
create index "idx_events_property_id" on "public"."events" ("property_id") where "property_id" is not null;

-- === Revisión de RLS de events (mismo criterio pedido para status_history) ===
-- No hace falta ningún cambio de policy. Repaso de lo que ya existe hoy
-- (20260710181500_remote_schema.sql):
--   - SELECT "Ver propios eventos": using (auth.uid() = agent_id)
--   - INSERT "Crear propios eventos": with check (auth.uid() = agent_id)
--   - DELETE "Borrar propios eventos": using (auth.uid() = agent_id)
--   - No hay policy de UPDATE -> bajo RLS, sin policy permisiva, UPDATE
--     queda denegado por default para anon/authenticated. Coincide con el
--     código actual (Calendar.tsx solo hace insert/select/delete, nunca
--     update), así que no es un gap, es el estado esperado.
-- A diferencia de leads/properties, "events" nunca tuvo una policy
-- "USING (true)" abierta a todos los roles -- ya nace con el criterio de
-- "dueño únicamente" que sí queremos para status_history. Agregar
-- lead_id/property_id/type no cambia esto: siguen siendo columnas del
-- mismo row, cubiertas por las mismas policies a nivel fila.
