-- increment_views solo desde el servidor. La ficha pública ahora registra
-- la vista con la server action features/actions/recordPropertyView.ts
-- (service_role + una vista por visitante y día). Con EXECUTE para anon,
-- cualquiera podía inflar el contador llamando al RPC con la anon key.
revoke execute on function public.increment_views(uuid) from public, anon, authenticated;
grant execute on function public.increment_views(uuid) to service_role;
