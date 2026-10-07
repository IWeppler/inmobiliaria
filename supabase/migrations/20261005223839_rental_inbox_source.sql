-- Portal etapa 2 (E4.20): el inquilino también puede enviar comprobantes y
-- reclamos desde su link. Entran a la misma bandeja de Mensajes; `source`
-- distingue el canal (las respuestas por WhatsApp tienen sentido igual).
alter table public.rental_inbox
  add column source text not null default 'WHATSAPP' check (source in ('WHATSAPP', 'PORTAL'));
create index rental_inbox_portal_contact on public.rental_inbox(contact_id, received_at desc) where source = 'PORTAL';
