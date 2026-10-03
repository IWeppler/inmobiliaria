-- Property Performance: vistas por día. Hasta ahora solo existía el
-- contador acumulado properties.views_count, que no permite medir períodos
-- ni tendencias. increment_views sigue sumando a views_count (nada cambia
-- para quien ya lo usa) y además cuenta en el día. El histórico anterior
-- queda solo en views_count: la serie diaria empieza al aplicar esta
-- migración.
create table if not exists public.property_views_daily (
  property_id uuid not null references public.properties(id) on delete cascade,
  day date not null,
  views integer not null default 0 check (views >= 0),
  primary key (property_id, day)
);

alter table public.property_views_daily enable row level security;

-- Las vistas ya son visibles para cualquier agente vía properties.views_count.
create policy "Agentes leen vistas por día"
on public.property_views_daily for select to authenticated using (true);

revoke all on public.property_views_daily from anon;

create or replace function public.increment_views(property_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.properties
  set views_count = coalesce(views_count, 0) + 1
  where id = increment_views.property_id;

  -- El día se cuenta en hora argentina para que coincida con lo que ve el asesor.
  insert into public.property_views_daily (property_id, day, views)
  values (
    increment_views.property_id,
    (now() at time zone 'America/Argentina/Buenos_Aires')::date,
    1
  )
  on conflict on constraint property_views_daily_pkey
  do update set views = public.property_views_daily.views + 1;
end;
$$;
