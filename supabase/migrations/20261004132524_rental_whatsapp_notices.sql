-- Avisos automáticos por WhatsApp a inquilinos y propietarios.
--
-- Cada tipo de aviso se activa por separado en Ajustes (todos arrancan
-- apagados: requieren crear y aprobar la plantilla en Meta primero).
--   RECIBO       al registrar un cobro (inquilino)
--   AUMENTO      antes del ajuste si el monto ya se puede calcular, o al
--                aplicarse (inquilino y propietario)
--   VENCIMIENTO  N días antes del vencimiento de la cuota (inquilino)
--   DEUDA        N días después del vencimiento, si sigue impaga (inquilino)
-- rental_notifications registra cada intento y evita repetir un aviso:
-- (kind, reference, contact_id) es único y un aviso ENVIADO no se reintenta.
-- Lo escribe el servidor con service_role; los agentes solo lo leen.

alter table public.rental_settings
  add column notify_receipts boolean not null default false,
  add column notify_adjustments boolean not null default false,
  add column notify_due boolean not null default false,
  add column notify_overdue boolean not null default false,
  add column adjustment_notice_days smallint not null default 10 check (adjustment_notice_days between 1 and 60),
  add column due_reminder_days smallint not null default 3 check (due_reminder_days between 1 and 15),
  add column overdue_reminder_days smallint not null default 3 check (overdue_reminder_days between 1 and 30);
grant update (notify_receipts, notify_adjustments, notify_due, notify_overdue,
  adjustment_notice_days, due_reminder_days, overdue_reminder_days) on public.rental_settings to authenticated;

create table public.rental_notifications (
  id uuid primary key default gen_random_uuid(),
  contract_id uuid not null references public.rental_contracts(id) on delete cascade,
  contact_id uuid not null references public.rental_contacts(id) on delete cascade,
  kind text not null check (kind in ('RECIBO', 'AUMENTO', 'VENCIMIENTO', 'DEUDA')),
  -- Qué disparó el aviso: id del cobro, del cargo o "contrato|fecha de ajuste".
  reference text not null,
  phone text,
  status text not null check (status in ('ENVIADO', 'FALLIDO', 'OMITIDO')),
  detail text,
  created_at timestamptz not null default now(),
  unique (kind, reference, contact_id)
);
create index rental_notifications_contract on public.rental_notifications(contract_id, created_at desc);

alter table public.rental_notifications enable row level security;
revoke all on public.rental_notifications from anon, authenticated;
grant select on public.rental_notifications to authenticated;
create policy "Avisos: contrato visible" on public.rental_notifications for select to authenticated
using (exists (select 1 from public.rental_contracts c where c.id = contract_id and (c.agent_id = auth.uid() or public.is_admin())));
