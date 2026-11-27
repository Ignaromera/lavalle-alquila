-- Suscripciones de Lavalle Alquila: planes, suscripciones, destacados y vencimiento.
-- Se pega UNA vez en Supabase > SQL Editor. Es idempotente (se puede repetir) y
-- NO lleva secretos. Necesita que ya exista private.avisar_mail (migración de mails).
--
-- Qué hace:
--   1. Tabla plans: límites y precios por plan (free, plus, pro).
--   2. profiles.plan acepta también 'plus'.
--   3. Tabla subscriptions: una fila por cada intento/contrato con Mercado Pago.
--      Solo la escriben las Edge Functions (service_role). Cada usuario lee las suyas.
--   4. public.activar_plan(user, plan): cambia plan, tope de avisos y turnero, y al
--      bajar de plan hace vencer los avisos de más (los más nuevos se quedan).
--   5. public.set_featured(aviso, activar): el dueño destaca sus avisos según su plan.
--   6. Mails por pg_net (mismo método que bienvenida y aviso publicado).
--   7. Vencimiento diario (pg_cron si está disponible) + public.vencer_suscripciones().

------------------------------------------------------------------ 1. planes
create table if not exists public.plans (
  id text primary key check (id in ('free', 'plus', 'pro')),
  name text not null,
  max_listings integer not null check (max_listings >= 1),
  featured_slots integer not null default 0 check (featured_slots >= 0),
  stats boolean not null default false,
  turnero boolean not null default false,
  price_month_ars integer not null default 0 check (price_month_ars >= 0),
  price_year_ars integer not null default 0 check (price_year_ars >= 0),
  sort_order integer not null default 0
);

comment on table public.plans is 'Planes de Lavalle Alquila. max_listings = 1000 significa ilimitado. Los precios son los que cobra crear-suscripcion.';

insert into public.plans (id, name, max_listings, featured_slots, stats, turnero, price_month_ars, price_year_ars, sort_order) values
  ('free', 'Gratis', 1,    0, false, false,     0,      0, 1),
  ('plus', 'Plus',   3,    0, true,  false,  6900,  49000, 2),
  ('pro',  'Pro',    1000, 2, true,  true,  14900, 100000, 3)
on conflict (id) do update set
  name = excluded.name,
  max_listings = excluded.max_listings,
  featured_slots = excluded.featured_slots,
  stats = excluded.stats,
  turnero = excluded.turnero,
  price_month_ars = excluded.price_month_ars,
  price_year_ars = excluded.price_year_ars,
  sort_order = excluded.sort_order;

alter table public.plans enable row level security;
drop policy if exists plans_read on public.plans;
create policy plans_read on public.plans for select to anon, authenticated using (true);
grant select on public.plans to anon, authenticated, service_role;

------------------------------------------------------- 2. profiles.plan: + plus
do $$
declare c record;
begin
  for c in
    select conname from pg_constraint
    where conrelid = 'public.profiles'::regclass and contype = 'c'
      and pg_get_constraintdef(oid) ilike '%''free''%'
  loop
    execute format('alter table public.profiles drop constraint %I', c.conname);
  end loop;
end $$;

alter table public.profiles drop constraint if exists profiles_plan_check;
alter table public.profiles
  add constraint profiles_plan_check check (plan in ('free', 'plus', 'pro'));

comment on column public.profiles.plan is 'free, plus o pro. Lo cambia public.activar_plan (suscripción paga) o un admin a mano.';

------------------------------------------------------------ 3. suscripciones
create table if not exists public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  plan_id text not null references public.plans (id),
  billing_interval text not null check (billing_interval in ('month', 'year')),
  amount_ars integer not null check (amount_ars > 0),
  status text not null default 'pending'
    check (status in ('pending', 'authorized', 'paused', 'cancelled', 'expired')),
  mp_preapproval_id text unique,
  mp_status text,
  init_point text,
  next_payment_at timestamptz,
  last_paid_at timestamptz,
  access_until timestamptz,
  payment_failed_at timestamptz,
  last_failed_payment_id text,
  cancelled_at timestamptz,
  ended_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.subscriptions is 'Contratos con Mercado Pago (preapproval). Solo las Edge Functions escriben. access_until = próximo cobro + 3 días de gracia.';

create index if not exists subscriptions_user_idx on public.subscriptions (user_id, created_at desc);
create index if not exists subscriptions_vence_idx on public.subscriptions (status, access_until);

create or replace function private.subscriptions_touch()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists subscriptions_touch on public.subscriptions;
create trigger subscriptions_touch
  before update on public.subscriptions
  for each row execute function private.subscriptions_touch();

alter table public.subscriptions enable row level security;
drop policy if exists subscriptions_own_read on public.subscriptions;
create policy subscriptions_own_read on public.subscriptions
  for select to authenticated using (user_id = auth.uid());

revoke all on public.subscriptions from anon, authenticated;
grant select on public.subscriptions to authenticated;
grant select, insert, update, delete on public.subscriptions to service_role;
grant select, update on public.profiles to service_role;
grant select, update on public.listings to service_role;

----------------------------------------------------------- 4. activar_plan
create or replace function public.activar_plan(p_user uuid, p_plan text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  pl public.plans%rowtype;
begin
  select * into pl from public.plans where id = p_plan;
  if not found then
    raise exception 'Plan desconocido: %', p_plan;
  end if;

  update public.profiles
  set plan = pl.id,
      max_listings = pl.max_listings,
      booking_enabled = pl.turnero
  where id = p_user;
  if not found then
    raise exception 'El usuario % no tiene perfil', p_user;
  end if;

  -- Turnero en los quinchos y salones que ya existen.
  update public.listings
  set booking_enabled = pl.turnero
  where owner_id = p_user
    and type in ('quincho', 'salon')
    and status <> 'deleted'
    and booking_enabled is distinct from pl.turnero;

  -- Si el plan tiene tope, los avisos de más vencen (se quedan los más nuevos).
  -- El dueño los puede renovar cuando haya lugar. No se borra nada.
  if pl.max_listings < 1000 then
    update public.listings
    set expires_at = now()
    where id in (
      select id from (
        select id, row_number() over (order by created_at desc) as rn
        from public.listings
        where owner_id = p_user and status in ('active', 'hidden') and expires_at > now()
      ) ranked
      where rn > pl.max_listings
    );
  end if;

  -- Destacados de más: se sacan los más viejos.
  update public.listings
  set featured = false
  where id in (
    select id from (
      select id, row_number() over (order by created_at desc) as rn
      from public.listings
      where owner_id = p_user and featured
    ) ranked
    where rn > pl.featured_slots
  );
end;
$$;

revoke all on function public.activar_plan(uuid, text) from public, anon, authenticated;
grant execute on function public.activar_plan(uuid, text) to service_role;

------------------------------------------------------------- 5. destacados
create or replace function public.set_featured(p_id uuid, p_on boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  l public.listings%rowtype;
  slots integer;
  cnt integer;
begin
  if uid is null then
    raise exception 'Entrá con tu cuenta';
  end if;
  select * into l from public.listings where id = p_id and owner_id = uid;
  if not found then
    raise exception 'No autorizado';
  end if;

  if p_on then
    if l.status <> 'active' or l.expires_at <= now() then
      raise exception 'Solo se pueden destacar avisos activos';
    end if;
    select pl.featured_slots into slots
    from public.profiles pr join public.plans pl on pl.id = pr.plan
    where pr.id = uid;
    if coalesce(slots, 0) < 1 then
      raise exception 'Los avisos destacados son del plan Pro';
    end if;
    select count(*) into cnt
    from public.listings
    where owner_id = uid and featured and id <> p_id and status = 'active' and expires_at > now();
    if cnt >= slots then
      raise exception 'Ya usaste tus % destacados. Sacale el destacado a uno para destacar otro.', slots;
    end if;
  end if;

  update public.listings set featured = p_on where id = p_id;
end;
$$;

revoke all on function public.set_featured(uuid, boolean) from public, anon;
grant execute on function public.set_featured(uuid, boolean) to authenticated;

--------------------------------------------------------------------- 6. mails
create or replace function private.trg_suscripcion_mail()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- Suscripción nueva autorizada por Mercado Pago.
  if new.status = 'authorized' and (tg_op = 'INSERT' or old.status is distinct from 'authorized') then
    perform private.avisar_mail(jsonb_build_object(
      'type', 'subscription_started',
      'user_id', new.user_id,
      'plan', new.plan_id,
      'interval', new.billing_interval,
      'amount', new.amount_ars,
      'until', new.access_until
    ));
  end if;

  -- Falló un cobro: una vez por cobro fallido.
  if new.payment_failed_at is not null
     and (tg_op = 'INSERT' or new.payment_failed_at is distinct from old.payment_failed_at) then
    perform private.avisar_mail(jsonb_build_object(
      'type', 'payment_failed',
      'user_id', new.user_id,
      'plan', new.plan_id,
      'until', new.access_until
    ));
  end if;

  -- El usuario canceló: el plan sigue hasta access_until.
  if tg_op = 'UPDATE' and new.status = 'cancelled' and old.status is distinct from 'cancelled' then
    perform private.avisar_mail(jsonb_build_object(
      'type', 'subscription_cancelled',
      'user_id', new.user_id,
      'plan', new.plan_id,
      'until', new.access_until
    ));
  end if;
  return new;
exception when others then
  raise warning 'trg_suscripcion_mail falló: %', sqlerrm;
  return new;
end;
$$;
revoke all on function private.trg_suscripcion_mail() from public, anon, authenticated;

drop trigger if exists mail_suscripcion on public.subscriptions;
create trigger mail_suscripcion
  after insert or update on public.subscriptions
  for each row execute function private.trg_suscripcion_mail();

-------------------------------------------------------------- 7. vencimiento
create or replace function private.vencer_suscripciones()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  r record;
  n integer := 0;
begin
  -- Intentos de pago que nunca se completaron.
  delete from public.subscriptions
  where status = 'pending' and created_at < now() - interval '7 days';

  for r in
    select * from public.subscriptions
    where status in ('authorized', 'paused', 'cancelled')
      and access_until is not null
      and access_until < now()
  loop
    update public.subscriptions set status = 'expired', ended_at = now() where id = r.id;
    if not exists (
      select 1 from public.subscriptions s
      where s.user_id = r.user_id and s.id <> r.id
        and s.status in ('authorized', 'paused', 'cancelled')
        and s.access_until > now()
    ) then
      perform public.activar_plan(r.user_id, 'free');
      perform private.avisar_mail(jsonb_build_object(
        'type', 'subscription_ended',
        'user_id', r.user_id,
        'plan', r.plan_id
      ));
      n := n + 1;
    end if;
  end loop;
  return n;
end;
$$;
revoke all on function private.vencer_suscripciones() from public, anon, authenticated;

create or replace function public.vencer_suscripciones()
returns integer
language sql
security definer
set search_path = public
as $$
  select private.vencer_suscripciones();
$$;
revoke all on function public.vencer_suscripciones() from public, anon, authenticated;
grant execute on function public.vencer_suscripciones() to service_role;

-- Una pasada por día a las 06:17 UTC (03:17 de Argentina). Si pg_cron no está
-- disponible, esto avisa y sigue; el webhook también corre el vencimiento.
do $$
begin
  create extension if not exists pg_cron;
  perform cron.unschedule(jobid) from cron.job where jobname = 'vencer-suscripciones';
  perform cron.schedule('vencer-suscripciones', '17 6 * * *', 'select private.vencer_suscripciones()');
exception when others then
  raise notice 'pg_cron no quedó activo (%). Activalo en Database > Extensions y repetí este bloque.', sqlerrm;
end $$;
