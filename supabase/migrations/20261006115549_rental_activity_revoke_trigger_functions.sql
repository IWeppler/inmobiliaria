-- Funciones de trigger: no se llaman por la API.
revoke execute on function public.rental_log_inbox() from public, anon, authenticated;
revoke execute on function public.rental_log_payment_entry() from public, anon, authenticated;
revoke execute on function public.rental_set_activity_currency() from public, anon, authenticated;
