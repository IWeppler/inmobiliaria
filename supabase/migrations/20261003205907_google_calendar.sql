-- Sincronización de la agenda con Google Calendar (una vía: panel -> Google).
-- Cada integrante del equipo conecta su propia cuenta; los eventos cuyo
-- agent_id es suyo se crean / borran en su calendario.

create table if not exists "public"."google_calendar_connections" (
  "agent_id" uuid primary key references "public"."agents" ("id") on delete cascade,
  "google_email" text,
  "calendar_id" text not null default 'primary',
  "refresh_token" text not null,
  "access_token" text,
  "access_token_expires_at" timestamptz,
  "last_error" text,
  "created_at" timestamptz not null default now(),
  "updated_at" timestamptz not null default now()
);

comment on table "public"."google_calendar_connections" is
  'Tokens OAuth de Google Calendar por agente. Solo service_role: RLS activa sin policies, nunca se lee desde el cliente.';

alter table "public"."google_calendar_connections" enable row level security;

-- Id del evento espejo en Google, para poder borrarlo / actualizarlo.
alter table "public"."events"
  add column if not exists "google_event_id" text;

comment on column "public"."events"."google_event_id" is
  'Id del evento en el Google Calendar del agente (null si no está sincronizado).';
