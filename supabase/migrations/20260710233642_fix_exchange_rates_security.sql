-- Etapa 2.5: cierra el gap encontrado en el pase de seguridad.
-- exchange_rates no tenía RLS activo y era legible/escribible directo con la
-- anon key (pública), sin pasar por la app. Ademas, update_all_normalized_prices
-- (SECURITY DEFINER) estaba grantada a anon/authenticated/PUBLIC sin ningún
-- chequeo de rol interno, así que cualquiera podía recalcular el precio de
-- todas las propiedades invocando el RPC directo.

-- 1. Activar RLS en exchange_rates.
alter table "public"."exchange_rates" enable row level security;

-- Lectura pública: el tipo de cambio se necesita para mostrar precios en la
-- landing pública, no es información sensible.
create policy "Cualquiera puede ver el tipo de cambio"
on "public"."exchange_rates"
for select
to anon, authenticated
using (true);

-- No se crean policies de INSERT/UPDATE/DELETE para anon/authenticated:
-- bajo RLS, sin una policy permisiva que las habilite, esas operaciones
-- quedan denegadas por defecto para esos roles. La única escritura queda
-- reservada a service_role (que bypassea RLS), invocado únicamente desde
-- Server Actions que verifican rol admin contra la sesión del servidor
-- (features/actions/updateRateActions.ts).

-- Defensa en profundidad: además de RLS, se sacan los grants de escritura a
-- nivel tabla para anon/authenticated (antes tenían GRANT ALL). Así, si RLS
-- se desactivara por error en el futuro, la tabla no vuelve a quedar abierta.
revoke all on "public"."exchange_rates" from "anon";
revoke all on "public"."exchange_rates" from "authenticated";
grant select on "public"."exchange_rates" to "anon";
grant select on "public"."exchange_rates" to "authenticated";

-- 2. Sacar los grants públicos del RPC update_all_normalized_prices.
-- Ojo: además del GRANT explícito a anon/authenticated, PostgreSQL le había
-- dejado el EXECUTE default a PUBLIC (todo rol lo hereda a través de PUBLIC
-- aunque no tenga un grant individual), así que hay que revocar también ahí
-- o la función sigue siendo invocable por cualquiera.
revoke execute on function "public"."update_all_normalized_prices"(numeric) from "public";
revoke execute on function "public"."update_all_normalized_prices"(numeric) from "anon";
revoke execute on function "public"."update_all_normalized_prices"(numeric) from "authenticated";
-- Queda ejecutable solo por service_role (y el owner postgres).
