-- Correcciones de los advisors de seguridad de Supabase.

-- 1. search_path fijo: sin esto, una función se puede resolver contra
--    objetos de otro schema según el search_path de quien la invoca.
alter function public.update_all_normalized_prices(numeric) set search_path = public;
alter function public.rental_sync_payment_summary() set search_path = public;
alter function public.rental_validate_payment_entry() set search_path = public;
alter function public.rental_protect_paid_charge() set search_path = public;
alter function public.rental_protect_settled_charge() set search_path = public;
alter function public.rental_validate_settlement() set search_path = public;

-- 2. Tokens OAuth de Google Calendar: RLS sin policies ya bloquea las filas,
--    pero la tabla nació con el GRANT ALL por defecto a anon/authenticated.
--    Solo la usa service_role (lib/google-calendar.ts).
revoke all on public.google_calendar_connections from anon, authenticated;
