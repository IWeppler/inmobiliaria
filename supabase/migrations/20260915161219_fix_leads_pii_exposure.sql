-- Cierra un hallazgo más grave que el de exchange_rates: "leads" tenía una
-- policy de SELECT sin "TO" explícito (aplica a PUBLIC, incluyendo anon) y
-- con USING (true) -- exponía nombre, email, teléfono, notas internas,
-- source y status de TODOS los leads a cualquiera con la anon key, y a
-- cualquier agente autenticado sin filtrar por dueño.
--
-- Esta policy era puramente redundante para los casos de uso legítimos:
--   - "Agentes ven sus propios leads" (FOR ALL, TO authenticated,
--     agent_id = auth.uid() OR created_by = auth.uid()) ya cubre el SELECT
--     de un agente sobre sus propios leads.
--   - "Admins pueden ver todos los leads" (FOR ALL, TO authenticated,
--     agents.role = 'admin') ya cubre el SELECT de un admin sobre todos.
-- Ninguna de las dos necesita la policy abierta -- se puede borrar sin
-- perder ningún acceso legítimo.

drop policy "Enable read access for all users" on "public"."leads";

-- Defensa en profundidad: revocar el grant de tabla a anon (igual criterio
-- que exchange_rates). Los 3 flujos públicos que insertaban leads
-- (contacto, tasación, consulta por propiedad) pasan a usar un cliente
-- service_role desde las Server Actions -- no necesitan la anon key para
-- escribir en esta tabla.
revoke all on "public"."leads" from "anon";
revoke all on "public"."lead_notes" from "anon";

-- === Resolución de la inconsistencia user_id vs agent_id en leads ===
-- "leads" arrastraba dos columnas para el mismo concepto: user_id
-- (NOT NULL, default auth.uid(), resto de un diseño anterior) y agent_id
-- (FK real a agents, la que usa toda la app: filtros del dashboard,
-- reasignación desde el detalle del lead, policies de leads). Ningún
-- código lee user_id -- solo las Server Actions públicas lo escribían
-- espejando agent_id para satisfacer el NOT NULL. El problema concreto:
-- al reasignar un lead (update agent_id) user_id quedaba apuntando al
-- agente anterior, y la policy de lead_notes que dependía de leads.user_id
-- dejaba de coincidir con la de leads. Se elimina la columna y todo queda
-- sobre agent_id (+ created_by para el autor).
--
-- Primero se saca la única dependencia: la policy de lead_notes que la
-- referenciaba. Además de cambiar la columna, se acota "TO authenticated"
-- (corría TO public; la condición ya impedía que anon pasara porque
-- auth.uid() es NULL para anon, pero se hace explícito).
drop policy "Agents can manage notes for their own leads" on "public"."lead_notes";

create policy "Agents can manage notes for their own leads"
on "public"."lead_notes"
as permissive
for all
to authenticated
using (
  (auth.uid() = user_id)
  and exists (
    select 1 from public.leads
    where leads.id = lead_notes.lead_id
      and leads.agent_id = auth.uid()
  )
);

alter table "public"."leads" drop column "user_id";

-- No se toca "agents" ("Cualquiera puede ver agentes" / "Enable read
-- access for all users", ambas USING(true) sin TO): es un directorio de
-- staff (nombre/email/teléfono de agentes), no de clientes, y la landing
-- pública lo necesita para mostrar "contactar al agente" en cada
-- propiedad. Tampoco se toca "properties"/"property_amenities"/
-- "property_images"/"property_types"/"amenities" -- son datos públicos
-- por diseño (la landing los necesita sin sesión).
