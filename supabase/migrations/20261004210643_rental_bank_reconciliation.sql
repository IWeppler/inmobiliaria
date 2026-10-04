-- Conciliación bancaria (E4.15).
--
-- Los movimientos del extracto se procesan en el navegador; acá solo quedan
-- los que el agente resolvió: CONCILIADO (generó cobros) o IGNORADO (no es
-- un alquiler). El hash (fecha|importe|concepto|cuenta) evita duplicar si el
-- mismo extracto se sube dos veces, aunque lo suba otro agente de la misma
-- inmobiliaria. Cada cobro generado apunta a su movimiento; si se revierten
-- todos los cobros, el movimiento se borra y vuelve a aparecer como pendiente.

create table public.rental_bank_movements (
  id uuid primary key default gen_random_uuid(),
  hash text not null unique,
  movement_date date not null,
  description text not null,
  amount numeric(14,2) not null check (amount > 0),
  currency text not null check (currency in ('ARS', 'USD')),
  account text not null,
  status text not null check (status in ('CONCILIADO', 'IGNORADO')),
  contract_id uuid references public.rental_contracts(id) on delete set null,
  created_by uuid not null default auth.uid(),
  created_at timestamptz not null default now(),
  check (status <> 'CONCILIADO' or contract_id is not null)
);
create index rental_bank_movements_contract on public.rental_bank_movements(contract_id);

alter table public.rental_payment_entries
  add column bank_movement_id uuid references public.rental_bank_movements(id) on delete set null;
create index rental_payment_entries_bank_movement on public.rental_payment_entries(bank_movement_id)
  where bank_movement_id is not null;
grant insert (bank_movement_id) on public.rental_payment_entries to authenticated;

alter table public.rental_bank_movements enable row level security;
revoke all on public.rental_bank_movements from anon, authenticated;
grant select, insert, delete on public.rental_bank_movements to authenticated;

-- Lectura: todos los agentes (el hash tiene que verse para no duplicar entre
-- agentes de la misma cuenta bancaria). Alta: a nombre propio y, si
-- concilia, sobre un contrato visible. Baja: el autor o admin.
create policy "Movimientos bancarios: lectura interna" on public.rental_bank_movements
  for select to authenticated using (true);
create policy "Movimientos bancarios: alta propia" on public.rental_bank_movements
  for insert to authenticated with check (
    created_by = auth.uid()
    and (contract_id is null or exists (select 1 from public.rental_contracts c
      where c.id = contract_id and (c.agent_id = auth.uid() or public.is_admin()))));
create policy "Movimientos bancarios: baja del autor o admin" on public.rental_bank_movements
  for delete to authenticated using (created_by = auth.uid() or public.is_admin());

-- Revertir el último cobro de un movimiento conciliado lo libera.
create function public.rental_release_bank_movement() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if old.bank_movement_id is not null and not exists (
    select 1 from rental_payment_entries where bank_movement_id = old.bank_movement_id
  ) then
    delete from rental_bank_movements where id = old.bank_movement_id and status = 'CONCILIADO';
  end if;
  return null;
end $$;
revoke execute on function public.rental_release_bank_movement() from public, anon, authenticated;
create trigger rental_payment_entries_release_movement
after delete on public.rental_payment_entries
for each row execute function public.rental_release_bank_movement();
