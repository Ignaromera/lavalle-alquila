-- Código de regalo de Pro (por ejemplo LAVALLE5: 15 días de Pro, 5 usos, uno por cuenta).
-- Se pega en Supabase > SQL Editor. Es idempotente y NO lleva secretos.
-- Necesita migration-suscripciones.sql (plans, subscriptions, activar_plan, vencer_suscripciones).
--
-- Cómo funciona:
--   * public.promo_codes guarda cada código: días de Pro, tope de usos, usos hechos y si está prendido.
--   * Quien tiene cuenta (en plan Gratis, con el mail confirmado y sin haber pagado nunca) carga el
--     código en «Mi cuenta». public.canjear_codigo toma un uso con un UPDATE condicional sobre
--     promo_codes.used (bloquea la fila): dos canjes simultáneos nunca dan un uso de más.
--   * Una vez por cuenta y por mail (public.promo_grants), aunque la cuenta se borre y se vuelva a crear.
--   * Al vencer, private.vencer_promos devuelve la cuenta a Gratis con public.activar_plan
--     (mismas reglas de bajada: quedan los avisos más nuevos hasta el tope) si no tiene una
--     suscripción paga vigente. Corre todos los días junto con vencer_suscripciones.
--
-- Apagar:   update public.promo_codes set enabled = false where code = 'LAVALLE5';
-- Prender:  update public.promo_codes set enabled = true where code = 'LAVALLE5';
-- Otro:     insert into public.promo_codes (code, days, max_uses) values ('QUINCHOS3', 15, 3);
-- Ver:      select * from public.promo_codes; select * from public.promo_grants order by granted_at;

------------------------------------------------------------------ 1. códigos
create table if not exists public.promo_codes (
  code text primary key check (code = upper(code) and code ~ '^[A-Z0-9]{3,30}$'),
  plan_id text not null default 'pro' references public.plans (id),
  days integer not null default 15 check (days between 1 and 365),
  max_uses integer not null default 5 check (max_uses >= 0),
  used integer not null default 0 check (used >= 0),
  enabled boolean not null default true,
  expires_at timestamptz,
  created_at timestamptz not null default now()
);

comment on table public.promo_codes is 'Códigos de regalo. used nunca pasa de max_uses (lo controla public.canjear_codigo).';

-- LAVALLE5: 15 días de Pro, 5 usos. Si ya existe, no se pisan los usos ni el estado.
insert into public.promo_codes (code, plan_id, days, max_uses)
values ('LAVALLE5', 'pro', 15, 5)
on conflict (code) do nothing;

alter table public.promo_codes enable row level security;
-- Sin políticas: el navegador nunca lee la lista de códigos.
revoke all on public.promo_codes from anon, authenticated;

----------------------------------------------------------------- 2. canjes
create table if not exists public.promo_grants (
  id uuid primary key default gen_random_uuid(),
  user_id uuid unique references auth.users (id) on delete set null,
  email text not null,
  code text references public.promo_codes (code) on update cascade,
  plan_id text not null default 'pro' references public.plans (id),
  days integer not null check (days > 0),
  granted_at timestamptz not null default now(),
  ends_at timestamptz not null,
  ended_at timestamptz
);

comment on table public.promo_grants is 'Una fila por cuenta que canjeó un código. Una vez por cuenta y por mail.';

create unique index if not exists promo_grants_email_uidx on public.promo_grants (lower(email));
create index if not exists promo_grants_vence_idx on public.promo_grants (ends_at) where ended_at is null;

alter table public.promo_grants enable row level security;
drop policy if exists promo_grants_own_read on public.promo_grants;
create policy promo_grants_own_read on public.promo_grants
  for select to authenticated using (user_id = auth.uid());
revoke all on public.promo_grants from anon, authenticated;
grant select on public.promo_grants to authenticated;

------------------------------------------------------- 3. canjear un código
create or replace function public.canjear_codigo(p_code text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  c public.promo_codes%rowtype;
  mail text;
  confirmed timestamptz;
  current_plan text;
  until timestamptz;
  wanted text := upper(regexp_replace(coalesce(p_code, ''), '[^A-Za-z0-9]', '', 'g'));
begin
  if uid is null then
    raise exception 'Entrá a tu cuenta para cargar el código.';
  end if;
  if wanted = '' then
    raise exception 'Escribí el código.';
  end if;

  select email, email_confirmed_at into mail, confirmed from auth.users where id = uid;
  if mail is null or confirmed is null then
    raise exception 'Confirmá tu mail antes de cargar el código.';
  end if;

  select plan into current_plan from public.profiles where id = uid;
  if current_plan is null then
    raise exception 'Completá tu nombre y WhatsApp antes de cargar el código.';
  end if;

  if exists (select 1 from public.promo_grants where user_id = uid or lower(email) = lower(mail)) then
    raise exception 'Ya usaste un código de regalo con esta cuenta.';
  end if;
  if current_plan <> 'free' or exists (
    select 1 from public.subscriptions where user_id = uid and status <> 'pending'
  ) then
    raise exception 'El código es para cuentas nuevas en el plan Gratis.';
  end if;

  select * into c from public.promo_codes where code = wanted;
  if not found or not c.enabled or (c.expires_at is not null and c.expires_at <= now()) then
    raise exception 'Ese código no existe o ya no está vigente.';
  end if;

  begin
    -- Uso atómico: el UPDATE bloquea la fila del código y vuelve a evaluar el WHERE con el
    -- valor ya actualizado por otra transacción, así used nunca pasa de max_uses.
    update public.promo_codes
    set used = used + 1
    where code = wanted and enabled and used < max_uses
      and (expires_at is null or expires_at > now())
    returning * into c;
    if not found then
      raise exception 'Ese código ya se usó todas las veces que se podía.';
    end if;

    until := now() + make_interval(days => c.days);
    insert into public.promo_grants (user_id, email, code, plan_id, days, ends_at)
    values (uid, mail, c.code, c.plan_id, c.days, until);
  exception when unique_violation then
    -- La misma cuenta lo cargó dos veces a la vez: el bloque se deshace entero (incluido el +1).
    raise exception 'Ya usaste un código de regalo con esta cuenta.';
  end;

  perform public.activar_plan(uid, c.plan_id);
  perform private.avisar_mail(jsonb_build_object(
    'type', 'promo_started',
    'user_id', uid,
    'plan', c.plan_id,
    'days', c.days,
    'until', until
  ));
  return jsonb_build_object('ok', true, 'plan', c.plan_id, 'days', c.days, 'until', until);
end;
$$;
revoke all on function public.canjear_codigo(text) from public, anon;
grant execute on function public.canjear_codigo(text) to authenticated;

-------------------------------------------------------------- 4. vencimiento
create or replace function private.promo_vigente(p_user uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.promo_grants
    where user_id = p_user and ended_at is null and ends_at > now()
  );
$$;
revoke all on function private.promo_vigente(uuid) from public, anon, authenticated;

create or replace function private.vencer_promos()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  r record;
  n integer := 0;
begin
  for r in
    select * from public.promo_grants
    where ended_at is null and ends_at <= now()
    for update skip locked
  loop
    update public.promo_grants set ended_at = now() where id = r.id;
    if r.user_id is null then
      continue;
    end if;
    -- Si mientras tanto se suscribió, manda la suscripción.
    if exists (
      select 1 from public.subscriptions s
      where s.user_id = r.user_id
        and s.status in ('authorized', 'paused', 'cancelled')
        and s.access_until > now()
    ) then
      continue;
    end if;
    if (select plan from public.profiles where id = r.user_id) = 'pro' then
      perform public.activar_plan(r.user_id, 'free');
      perform private.avisar_mail(jsonb_build_object(
        'type', 'subscription_ended',
        'user_id', r.user_id,
        'plan', 'pro'
      ));
      n := n + 1;
    end if;
  end loop;
  return n;
end;
$$;
revoke all on function private.vencer_promos() from public, anon, authenticated;

-- Misma función de migration-suscripciones.sql, con dos cambios:
--   * si se vence una suscripción y la cuenta tiene la promo vigente, vuelve a Pro (no a Gratis);
--   * al final corre private.vencer_promos(), así el cron diario y el webhook vencen las dos cosas.
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
      if private.promo_vigente(r.user_id) then
        perform public.activar_plan(r.user_id, 'pro');
      else
        perform public.activar_plan(r.user_id, 'free');
        perform private.avisar_mail(jsonb_build_object(
          'type', 'subscription_ended',
          'user_id', r.user_id,
          'plan', r.plan_id
        ));
        n := n + 1;
      end if;
    end if;
  end loop;
  n := n + private.vencer_promos();
  return n;
end;
$$;
revoke all on function private.vencer_suscripciones() from public, anon, authenticated;
