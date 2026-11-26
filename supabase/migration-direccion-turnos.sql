-- Para proyectos que ya corrieron schema.sql de la v1.
-- Una instalación nueva no lo necesita.
-- Corré este archivo una sola vez en el SQL Editor.

alter table public.listings add column if not exists address text;
update public.listings
set address = 'Dirección a completar'
where address is null or btrim(address) = '';
alter table public.listings alter column address set not null;
alter table public.listings drop constraint if exists listing_address;
alter table public.listings
  add constraint listing_address check (char_length(btrim(address)) between 4 and 160);

create table if not exists public.listing_offers (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references public.listings (id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 2 and 40),
  starts_at time not null,
  ends_at time not null,
  price_ars integer not null check (price_ars between 1000 and 200000000),
  sort_order integer not null default 0,
  constraint offer_times check (starts_at <> ends_at)
);

alter table public.booking_slots add column if not exists offer_id uuid references public.listing_offers (id);
alter table public.booking_slots drop constraint if exists booking_slots_listing_id_slot_date_shift_key;
alter table public.booking_slots drop column if exists shift;

-- El índice único nuevo y las políticas completas están en schema.sql.
-- Si esta base ya tenía turnos con el campo shift, borrá esos turnos vacíos
-- y volvé a cargarlos desde el turnero después de definir los horarios.
