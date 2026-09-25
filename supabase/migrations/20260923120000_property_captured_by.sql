alter table public.properties
  add column if not exists captured_by uuid references public.agents(id) on delete set null;

create index if not exists properties_captured_by_idx on public.properties(captured_by);

comment on column public.properties.captured_by is 'Agente que captó la propiedad; puede ser distinto del responsable comercial.';
