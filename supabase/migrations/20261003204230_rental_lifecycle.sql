-- Alquileres, fase 2: ciclo de vida completo del contrato.
--
--   1. rental_close_contract()   cierre/rescisión atómico: recorta cuotas
--                                futuras sin cobrar y opcionalmente carga
--                                la penalidad. Antes, cerrar dejaba las
--                                cuotas futuras vivas y terminaban figurando
--                                como "vencidas" en alertas y cobranza.
--   2. rental_contract_parties   co-inquilinos, co-propietarios y garantes
--                                (owner_id / tenant_id siguen siendo las
--                                partes principales).
--   3. Depósito en garantía      recepción, devolución y descuentos.
--   4. Pago al propietario       marca de transferencia sobre la liquidación.
--   5. rental_maintenance        reclamos / reparaciones con quién paga.
--   6. rental_documents          contrato firmado, inventarios, garantías
--                                (bucket privado rental-docs).

-- === Catálogos ===
alter table public.rental_contacts drop constraint rental_contacts_kind_check;
alter table public.rental_contacts add constraint rental_contacts_kind_check
  check (kind in ('owner', 'tenant', 'guarantor'));

alter table public.rental_charges drop constraint rental_charges_kind_check;
alter table public.rental_charges add constraint rental_charges_kind_check
  check (kind in ('ALQUILER', 'EXPENSAS', 'SERVICIOS', 'PUNITORIOS', 'REPARACIONES', 'PENALIDAD'));

-- === 1. Cierre de contrato ===
-- p_end_date: fecha real de salida (rescisión anticipada). null = fin pactado.
-- Las cuotas posteriores al último período quedan borradas salvo que tengan
-- cobros (pago adelantado) o estén liquidadas: esas se informan, no se tocan.
create function public.rental_close_contract(
  p_contract_id uuid,
  p_status text,
  p_end_date date default null,
  p_penalty numeric default 0
) returns jsonb
language plpgsql security invoker set search_path = public as $$
declare c public.rental_contracts%rowtype; v_end date; v_last date;
  v_charges uuid[]; v_payments uuid[]; v_removed integer; v_kept integer;
begin
  if p_status not in ('FINALIZADO', 'RESCINDIDO') then raise exception 'Estado de cierre inválido'; end if;
  select * into c from public.rental_contracts where id = p_contract_id for update;
  if not found then raise exception 'Contrato no encontrado'; end if;
  if c.status <> 'ACTIVO' then raise exception 'El contrato ya está cerrado'; end if;
  v_end := coalesce(p_end_date, c.end_date);
  if v_end <= c.start_date or v_end > c.end_date then
    raise exception 'La fecha de cierre debe estar dentro de la vigencia';
  end if;
  if coalesce(p_penalty, 0) < 0 then raise exception 'La penalidad no puede ser negativa'; end if;
  -- Mismo criterio que contractPeriods(): si termina el día 1, ese mes no se cobra.
  v_last := case when extract(day from v_end) = 1
    then (date_trunc('month', v_end) - interval '1 month')::date
    else date_trunc('month', v_end)::date end;

  select coalesce(array_agg(ch.id), '{}'),
         coalesce(array_agg(ch.rent_payment_id) filter (where ch.rent_payment_id is not null), '{}')
    into v_charges, v_payments
  from public.rental_charges ch
  where ch.contract_id = c.id and ch.period > v_last
    and not exists (select 1 from public.rental_payment_entries e where e.charge_id = ch.id)
    and not exists (select 1 from public.rental_settlements s where s.contract_id = c.id and s.period = ch.period);
  delete from public.rental_charges where id = any(v_charges);
  get diagnostics v_removed = row_count;
  delete from public.rental_payments where id = any(v_payments);

  select count(*) into v_kept from public.rental_charges
  where contract_id = c.id and period > v_last;

  if coalesce(p_penalty, 0) > 0 then
    insert into public.rental_charges(contract_id, period, due_date, kind, description, amount, currency)
    values (c.id, date_trunc('month', current_date)::date, current_date, 'PENALIDAD',
      'Penalidad por rescisión anticipada', round(p_penalty, 2), c.currency);
  end if;

  update public.rental_contracts
    set status = p_status, end_date = v_end, next_adjustment_date = null
  where id = c.id;

  if not exists (select 1 from public.rental_contracts where property_id = c.property_id and status = 'ACTIVO') then
    update public.properties set status = 'EN_ALQUILER' where id = c.property_id;
  end if;

  return jsonb_build_object('removed', v_removed, 'kept_with_payments', v_kept);
end $$;
revoke all on function public.rental_close_contract(uuid, text, date, numeric) from public, anon;
grant execute on function public.rental_close_contract(uuid, text, date, numeric) to authenticated;

-- === 2. Partes adicionales ===
create table public.rental_contract_parties (
  id uuid primary key default gen_random_uuid(),
  contract_id uuid not null references public.rental_contracts(id) on delete cascade,
  contact_id uuid not null references public.rental_contacts(id) on delete restrict,
  role text not null check (role in ('CO_INQUILINO', 'CO_PROPIETARIO', 'GARANTE')),
  -- Solo co-propietarios: porcentaje del neto que le corresponde.
  share_pct numeric(5,2) check (share_pct is null or share_pct between 0 and 100),
  notes text,
  created_at timestamptz not null default now(),
  unique (contract_id, contact_id, role)
);
create index rental_contract_parties_contact on public.rental_contract_parties(contact_id);

-- === 3. Depósito en garantía ===
alter table public.rental_contracts
  add column deposit_received_at date,
  add column deposit_returned_at date,
  add column deposit_returned_amount numeric(14,2) check (deposit_returned_amount is null or deposit_returned_amount >= 0),
  -- [{ "description": "Pintura", "amount": 80000 }]
  add column deposit_deductions jsonb not null default '[]'::jsonb
    check (jsonb_typeof(deposit_deductions) = 'array');

-- === 4. Pago al propietario ===
-- Las liquidaciones son inmutables (sin UPDATE para authenticated); solo se
-- habilitan las columnas del pago, así los totales siguen protegidos.
alter table public.rental_settlements
  add column paid_to_owner_at date,
  add column payout_method text check (payout_method is null or payout_method in ('TRANSFERENCIA', 'EFECTIVO', 'OTRO')),
  add column payout_reference text;
grant update (paid_to_owner_at, payout_method, payout_reference) on public.rental_settlements to authenticated;
create index rental_settlements_unpaid on public.rental_settlements(issued_at) where paid_to_owner_at is null;

-- === 5. Mantenimiento ===
create table public.rental_maintenance (
  id uuid primary key default gen_random_uuid(),
  contract_id uuid not null references public.rental_contracts(id) on delete cascade,
  title text not null,
  description text,
  priority text not null default 'MEDIA' check (priority in ('BAJA', 'MEDIA', 'ALTA', 'URGENTE')),
  status text not null default 'ABIERTO' check (status in ('ABIERTO', 'EN_CURSO', 'RESUELTO', 'CANCELADO')),
  -- INQUILINO → se carga como cargo REPARACIONES; PROPIETARIO → gasto en la
  -- liquidación; INMOBILIARIA → egreso propio en finanzas.
  payer text check (payer is null or payer in ('INQUILINO', 'PROPIETARIO', 'INMOBILIARIA')),
  provider text,
  cost numeric(14,2) check (cost is null or cost >= 0),
  currency text check (currency is null or currency in ('ARS', 'USD')),
  charge_id uuid references public.rental_charges(id) on delete set null,
  settlement_id uuid references public.rental_settlements(id) on delete set null,
  reported_at date not null default current_date,
  resolved_at date,
  created_by uuid references auth.users(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now()
);
create index rental_maintenance_contract on public.rental_maintenance(contract_id);
create index rental_maintenance_open on public.rental_maintenance(status) where status in ('ABIERTO', 'EN_CURSO');

-- === 6. Documentos ===
-- Archivo en storage: rental-docs/<contract_id>/<archivo>.
create table public.rental_documents (
  id uuid primary key default gen_random_uuid(),
  contract_id uuid not null references public.rental_contracts(id) on delete cascade,
  kind text not null check (kind in ('CONTRATO', 'INVENTARIO_ENTRADA', 'INVENTARIO_SALIDA', 'GARANTIA', 'OTRO')),
  path text not null unique,
  file_name text not null,
  uploaded_by uuid references auth.users(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now()
);
create index rental_documents_contract on public.rental_documents(contract_id);

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('rental-docs', 'rental-docs', false, 10485760,
  array['application/pdf', 'image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

create policy "Docs alquiler: contrato visible (lectura)" on storage.objects for select to authenticated
using (bucket_id = 'rental-docs' and exists (select 1 from public.rental_contracts c
  where c.id::text = (storage.foldername(name))[1] and (c.agent_id = auth.uid() or public.is_admin())));
create policy "Docs alquiler: contrato visible (alta)" on storage.objects for insert to authenticated
with check (bucket_id = 'rental-docs' and exists (select 1 from public.rental_contracts c
  where c.id::text = (storage.foldername(name))[1] and (c.agent_id = auth.uid() or public.is_admin())));
create policy "Docs alquiler: contrato visible (baja)" on storage.objects for delete to authenticated
using (bucket_id = 'rental-docs' and exists (select 1 from public.rental_contracts c
  where c.id::text = (storage.foldername(name))[1] and (c.agent_id = auth.uid() or public.is_admin())));

-- === RLS ===
alter table public.rental_contract_parties enable row level security;
alter table public.rental_maintenance enable row level security;
alter table public.rental_documents enable row level security;
revoke all on public.rental_contract_parties, public.rental_maintenance, public.rental_documents from anon, authenticated;
grant select, insert, update, delete on public.rental_contract_parties, public.rental_maintenance to authenticated;
grant select, insert, delete on public.rental_documents to authenticated;

create policy "Partes: contrato visible" on public.rental_contract_parties for all to authenticated
using (exists (select 1 from public.rental_contracts c where c.id = contract_id and (c.agent_id = auth.uid() or public.is_admin())))
with check (exists (select 1 from public.rental_contracts c where c.id = contract_id and (c.agent_id = auth.uid() or public.is_admin())));
create policy "Mantenimiento: contrato visible" on public.rental_maintenance for all to authenticated
using (exists (select 1 from public.rental_contracts c where c.id = contract_id and (c.agent_id = auth.uid() or public.is_admin())))
with check (exists (select 1 from public.rental_contracts c where c.id = contract_id and (c.agent_id = auth.uid() or public.is_admin())));
create policy "Documentos: contrato visible" on public.rental_documents for all to authenticated
using (exists (select 1 from public.rental_contracts c where c.id = contract_id and (c.agent_id = auth.uid() or public.is_admin())))
with check (exists (select 1 from public.rental_contracts c where c.id = contract_id and (c.agent_id = auth.uid() or public.is_admin())));
