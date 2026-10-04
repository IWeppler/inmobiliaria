-- Si se crea un contrato (formulario, importación o carga desde PDF) sobre
-- una propiedad sin dueños registrados, el titular del contrato pasa a ser
-- su dueño. Si ya tiene dueños no se toca: el contrato es la foto, la
-- propiedad es la fuente.
create function public.property_owners_from_contract() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from property_owners where property_id = new.property_id) then
    insert into property_owners (property_id, contact_id, share_pct, is_primary)
    values (new.property_id, new.owner_id, 100, true);
  end if;
  return new;
end $$;
revoke execute on function public.property_owners_from_contract() from public, anon, authenticated;
create trigger rental_contracts_property_owners
after insert on public.rental_contracts
for each row execute function public.property_owners_from_contract();
