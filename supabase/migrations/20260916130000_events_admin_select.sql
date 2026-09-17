-- Los admins ven todos los eventos (visitas de todo el equipo), igual que
-- ya ven todos los leads y propiedades. Hasta ahora la única policy de
-- SELECT era "propios eventos", y el dashboard del admin mostraba 0
-- visitas. Solo lectura: crear/borrar sigue siendo por dueño.
create policy "Admins ven todos los eventos"
  on public.events for select to authenticated
  using (exists (select 1 from public.agents where agents.id = auth.uid() and agents.role = 'admin'));
