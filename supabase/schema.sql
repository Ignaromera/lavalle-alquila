-- Lavalle Alquila — esquema para el SQL Editor de Supabase (plan gratis).
-- Corré este archivo una sola vez, entero.
-- Crea tablas, políticas RLS, triggers y el bucket de fotos.
--
-- Ganchos para más adelante, sin pagos en esta versión:
--   profiles.plan             'free' o 'pro'
--   profiles.max_listings     tope de avisos activos (el plan gratis trae 1)
--   profiles.booking_enabled  si es true, los quinchos y salones nuevos salen con turnero
--   listings.featured         aviso destacado: se lista primero
--   listings.booking_enabled  turnero de ese aviso
-- Esos campos solo los cambia un admin o el rol del SQL Editor (postgres).

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- Administradores
-- ---------------------------------------------------------------------------

create table public.admin_emails (
  email text primary key,
  created_at timestamptz not null default now()
);

comment on table public.admin_emails is
  'Emails que pueden moderar. Después de este script: insert into public.admin_emails (email) values (''tu@email.com'');';

alter table public.admin_emails enable row level security;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.admin_emails
    where lower(email) = lower(coalesce(auth.jwt() ->> 'email', ''))
  );
$$;

revoke all on function public.is_admin() from public;
grant execute on function public.is_admin() to anon, authenticated;

create policy admin_emails_read on public.admin_emails
  for select to authenticated
  using (public.is_admin());

create or replace function public.point_in_lavalle(p_lat double precision, p_lng double precision)
returns boolean
language plpgsql
immutable
as $$
declare
  lats double precision[] := array[-32.799303, -32.823502, -32.830678, -32.832274, -32.840774, -32.859064, -32.838924, -32.869018, -32.862689, -32.858084, -32.823294, -32.817935, -32.801723, -32.802008, -32.765236, -32.723721, -32.727437, -32.991166, -33.015228, -33.110084, -33.085942, -33.077607, -33.061941, -33.043930, -33.039264, -33.003282, -32.995354, -32.982582, -32.971666, -32.910991, -32.897843, -32.871857, -32.864483, -32.856668, -32.846790, -32.820521, -32.787815, -32.769562, -32.758743, -32.728557, -32.716128, -32.703650, -32.697525, -32.682310, -32.634555, -32.625723, -32.603160, -32.586853, -32.570164, -32.552889, -32.533823, -32.536033, -32.519940, -32.512958, -32.470670, -32.446413, -32.443006, -32.424387, -32.372312, -32.350470, -32.352200, -32.330500, -32.327666, -32.306719, -32.294021, -32.261766, -32.239208, -32.243453, -32.237289, -32.228835, -32.220883, -32.240330, -32.236684, -32.246021, -32.232132, -32.242025, -32.240000, -32.225171, -32.238011, -32.234952, -32.245914, -32.240887, -32.237568, -32.222929, -32.225985, -32.235543, -32.219218, -32.227084, -32.226135, -32.215616, -32.218956, -32.197722, -32.189288, -32.180684, -32.175304, -32.155151, -32.146362, -32.138976, -32.132821, -32.124567, -32.113721, -32.110028, -32.121118, -32.096041, -32.096983, -32.079766, -32.085629, -32.078284, -32.076247, -32.070965, -32.079475, -32.099117, -32.084566, -32.092084, -32.100763, -32.099754, -32.119329, -32.109170, -32.127798, -32.115781, -32.091599, -32.137918, -32.137842, -32.237700, -32.261383, -32.339659, -32.431760, -32.600442, -32.676644, -32.747371, -32.741020, -32.799303];
  lngs double precision[] := array[-68.695534, -68.681182, -68.693741, -68.636969, -68.649407, -68.650741, -68.602211, -68.456335, -68.452945, -68.469943, -68.461006, -68.448250, -68.439011, -68.424532, -68.363227, -68.329502, -67.958904, -67.958637, -67.765315, -67.181563, -67.183429, -67.174066, -67.178614, -67.197937, -67.183367, -67.179537, -67.192020, -67.191747, -67.201986, -67.212593, -67.231035, -67.226704, -67.232000, -67.210260, -67.208791, -67.178067, -67.176639, -67.185946, -67.166472, -67.182924, -67.180526, -67.192625, -67.187816, -67.224872, -67.237546, -67.256851, -67.244086, -67.248827, -67.268866, -67.262755, -67.282230, -67.297367, -67.294165, -67.283217, -67.301629, -67.297794, -67.289186, -67.310774, -67.318808, -67.331906, -67.355200, -67.381700, -67.426386, -67.472865, -67.484187, -67.488099, -67.501367, -67.513063, -67.511461, -67.525504, -67.523543, -67.546855, -67.581971, -67.597144, -67.606907, -67.619240, -67.647575, -67.675937, -67.685767, -67.706600, -67.710822, -67.729549, -67.723299, -67.736544, -67.773349, -67.772201, -67.796529, -67.809237, -67.831806, -67.836252, -67.845399, -67.875225, -67.871271, -67.883550, -67.916499, -67.928520, -67.924084, -67.938242, -67.931000, -67.945145, -67.938574, -67.946529, -67.959774, -67.971025, -67.989459, -68.005565, -68.032826, -68.037483, -68.056419, -68.051688, -68.066612, -68.073510, -68.080622, -68.097541, -68.092747, -68.122659, -68.151981, -68.188468, -68.206085, -68.210848, -68.247830, -68.301074, -68.463044, -68.462900, -68.512117, -68.543643, -68.620665, -68.673213, -68.660608, -68.695394, -68.670143, -68.695534];
  i int;
  j int;
  n int;
  inside boolean := false;
begin
  if p_lat is null or p_lng is null then
    return false;
  end if;
  n := array_length(lats, 1);
  j := n;
  for i in 1..n loop
    if ((lats[i] > p_lat) <> (lats[j] > p_lat))
       and (p_lng < (lngs[j] - lngs[i]) * (p_lat - lats[i])
            / nullif(lats[j] - lats[i], 0) + lngs[i]) then
      inside := not inside;
    end if;
    j := i;
  end loop;
  return inside;
end;
$$;


comment on function public.point_in_lavalle(double precision, double precision) is
  'True si el punto cae dentro del departamento de Lavalle (límite de OpenStreetMap).';

-- ---------------------------------------------------------------------------
-- Distritos
-- ---------------------------------------------------------------------------

create table public.districts (
  name text primary key,
  lat double precision not null,
  lng double precision not null
);

insert into public.districts (name, lat, lng) values
  ('Villa Tulumaya', -32.721500, -68.595800),
  ('Jocolí', -32.655000, -68.620000),
  ('Jocolí Viejo', -32.708250, -68.674050),
  ('Costa de Araujo', -32.758100, -68.395000),
  ('Ingeniero Gustavo André', -32.680060, -68.316530),
  ('El Plumero', -32.683570, -68.461880),
  ('La Pega', -32.808250, -68.668480),
  ('Tres de Mayo', -32.679010, -68.635670),
  ('El Vergel', -32.784800, -68.612040),
  ('Las Violetas', -32.822420, -68.606130),
  ('La Holanda', -32.814190, -68.511650),
  ('Paramillo', -32.776300, -68.571860),
  ('El Carmen', -32.663800, -68.397860),
  ('La Asunción', -32.576100, -68.270020),
  ('El Retamo', -32.469450, -67.380310);

alter table public.districts enable row level security;

create policy districts_read on public.districts
  for select to anon, authenticated
  using (true);

-- ---------------------------------------------------------------------------
-- Perfiles
-- ---------------------------------------------------------------------------

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text,
  whatsapp text,
  plan text not null default 'free' check (plan in ('free', 'pro')),
  max_listings integer not null default 1 check (max_listings >= 1),
  booking_enabled boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint profile_name check (full_name is null or char_length(btrim(full_name)) >= 2),
  constraint profile_phone check (whatsapp is null or whatsapp ~ '^[0-9]{10,15}$')
);

comment on column public.profiles.plan is 'Gancho de plan pago: free o pro. Hoy no hay cobro.';
comment on column public.profiles.max_listings is 'Avisos activos permitidos. El gratis tiene 1. Subilo a mano cuando haya un plan pago.';
comment on column public.profiles.booking_enabled is 'Si es true, los quinchos y salones nuevos de esta cuenta salen con turnero.';

create or replace function public.is_db_owner()
returns boolean
language sql
stable
as $$
  select current_user in ('postgres', 'supabase_admin', 'supabase_auth_admin');
$$;

create or replace function public.profiles_before_write()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    if public.is_db_owner() then
      new.plan := coalesce(new.plan, 'free');
      new.max_listings := coalesce(new.max_listings, 1);
      new.booking_enabled := coalesce(new.booking_enabled, false);
    else
      if new.id is distinct from auth.uid() and not public.is_admin() then
        raise exception 'No autorizado';
      end if;
      if not public.is_admin() then
        new.plan := 'free';
        new.max_listings := 1;
        new.booking_enabled := false;
      end if;
    end if;
  else
    if not public.is_db_owner() and not public.is_admin() then
      if old.id is distinct from auth.uid() then
        raise exception 'No autorizado';
      end if;
      new.plan := old.plan;
      new.max_listings := old.max_listings;
      new.booking_enabled := old.booking_enabled;
      new.id := old.id;
    end if;
  end if;

  new.full_name := nullif(btrim(new.full_name), '');
  if new.full_name is not null and char_length(new.full_name) < 2 then
    raise exception 'Escribí tu nombre';
  end if;
  if new.whatsapp is not null and new.whatsapp !~ '^[0-9]{10,15}$' then
    raise exception 'Revisá el WhatsApp: solo números, con código de país';
  end if;
  new.updated_at := now();
  return new;
end;
$$;

create trigger profiles_before_write
  before insert or update on public.profiles
  for each row execute function public.profiles_before_write();

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id) values (new.id) on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

alter table public.profiles enable row level security;

create policy profiles_select on public.profiles
  for select to authenticated
  using (id = auth.uid() or public.is_admin());

create policy profiles_insert on public.profiles
  for insert to authenticated
  with check (id = auth.uid() or public.is_admin());

create policy profiles_update on public.profiles
  for update to authenticated
  using (id = auth.uid() or public.is_admin())
  with check (id = auth.uid() or public.is_admin());

-- ---------------------------------------------------------------------------
-- Avisos
-- ---------------------------------------------------------------------------

create table public.listings (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles (id) on delete cascade,
  type text not null check (type in ('casa', 'departamento', 'local', 'terreno', 'quincho', 'salon')),
  title text not null,
  description text not null,
  price_ars integer not null check (price_ars between 1000 and 200000000),
  price_unit text not null default 'mes' check (price_unit in ('mes', 'dia', 'turno')),
  district text not null references public.districts (name),
  requirements text not null default '',
  pets_allowed boolean not null default false,
  guarantee_required boolean not null default true,
  capacity integer,
  amenities text[] not null default '{}',
  lat double precision not null,
  lng double precision not null,
  photo_urls text[] not null default '{}',
  status text not null default 'active' check (status in ('active', 'rented', 'hidden', 'deleted')),
  featured boolean not null default false,
  booking_enabled boolean not null default false,
  hidden_reason text,
  expires_at timestamptz not null default (now() + interval '60 days'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint listing_title check (char_length(btrim(title)) between 8 and 80),
  constraint listing_description check (char_length(btrim(description)) between 20 and 2000),
  constraint listing_requirements check (char_length(requirements) <= 500),
  constraint listing_photos check (cardinality(photo_urls) <= 6),
  constraint listing_capacity check (capacity is null or capacity between 1 and 2000),
  constraint listing_booking_type check (booking_enabled = false or type in ('quincho', 'salon'))
);

comment on column public.listings.featured is 'Destacado. Solo admin. Se muestra primero.';
comment on column public.listings.booking_enabled is 'Turnero premium de este aviso. Solo admin, o se copia del perfil al publicar.';

create index listings_owner_idx on public.listings (owner_id);
create index listings_active_idx on public.listings (featured desc, created_at desc);

create or replace function public.amenities_ok(items text[])
returns boolean
language sql
immutable
as $$
  select coalesce(bool_and(item in ('pileta', 'parrilla', 'cocina', 'banos', 'estacionamiento')), true)
  from unnest(items) as item;
$$;

alter table public.listings
  add constraint listing_amenities check (public.amenities_ok(amenities));

create or replace function public.listings_before_write()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  lim integer;
  cnt integer;
  counts_new boolean;
  counts_old boolean;
  super boolean := public.is_db_owner();
begin
  -- El trigger de denuncias marca este GUC y corre como postgres.
  if current_setting('lavalle.system', true) = 'on' and super and tg_op = 'UPDATE' then
    new.owner_id := old.owner_id;
    new.featured := old.featured;
    new.booking_enabled := old.booking_enabled;
    new.expires_at := old.expires_at;
    new.title := old.title;
    new.description := old.description;
    new.price_ars := old.price_ars;
    new.price_unit := old.price_unit;
    new.district := old.district;
    new.requirements := old.requirements;
    new.pets_allowed := old.pets_allowed;
    new.guarantee_required := old.guarantee_required;
    new.capacity := old.capacity;
    new.amenities := old.amenities;
    new.lat := old.lat;
    new.lng := old.lng;
    new.photo_urls := old.photo_urls;
    new.created_at := old.created_at;
    new.type := old.type;
    new.status := 'hidden';
    new.hidden_reason := 'reports';
    new.updated_at := now();
    return new;
  end if;

  if tg_op = 'INSERT' then
    if not super and not public.is_admin() then
      new.owner_id := auth.uid();
      new.featured := false;
      new.status := 'active';
      new.hidden_reason := null;
      new.expires_at := now() + interval '60 days';
    end if;
  elsif not super and not public.is_admin() then
    if old.owner_id is distinct from auth.uid() then
      raise exception 'No autorizado';
    end if;
    new.owner_id := old.owner_id;
    new.featured := old.featured;
    new.booking_enabled := old.booking_enabled;
    new.hidden_reason := old.hidden_reason;
    if old.status = 'hidden' then
      new.status := 'hidden';
      new.expires_at := old.expires_at;
    else
      if new.status not in ('active', 'rented', 'deleted') then
        new.status := old.status;
      end if;
      if new.expires_at is null or new.expires_at > now() + interval '60 days' then
        new.expires_at := now() + interval '60 days';
      end if;
    end if;
  elsif not super and public.is_admin() then
    if new.expires_at is null or new.expires_at > now() + interval '60 days' then
      new.expires_at := now() + interval '60 days';
    end if;
  end if;

  if tg_op = 'INSERT' and not super and not public.is_admin() then
    if new.type in ('quincho', 'salon') and exists (
      select 1 from public.profiles p
      where p.id = new.owner_id and (p.booking_enabled or p.plan = 'pro')
    ) then
      new.booking_enabled := true;
    else
      new.booking_enabled := false;
    end if;
  end if;

  if new.booking_enabled and new.type not in ('quincho', 'salon') then
    new.booking_enabled := false;
  end if;

  if new.type not in ('quincho', 'salon') then
    new.capacity := null;
    new.amenities := '{}';
    new.price_unit := 'mes';
    new.pets_allowed := coalesce(new.pets_allowed, false);
    new.guarantee_required := coalesce(new.guarantee_required, true);
  else
    new.pets_allowed := false;
    new.guarantee_required := false;
    if new.price_unit not in ('dia', 'turno') then
      raise exception 'Indicá si el precio es por día o por turno';
    end if;
    if new.capacity is null or new.capacity < 1 or new.capacity > 2000 then
      raise exception 'Indicá la capacidad del lugar';
    end if;
  end if;

  if not public.point_in_lavalle(new.lat, new.lng) then
    raise exception 'La ubicación tiene que estar dentro del departamento de Lavalle';
  end if;

  if not exists (
    select 1 from public.profiles p
    where p.id = new.owner_id and p.full_name is not null and p.whatsapp is not null
  ) then
    raise exception 'Completá tu nombre y WhatsApp antes de publicar';
  end if;

  counts_new := new.status in ('active', 'hidden') and new.expires_at > now();
  counts_old := tg_op = 'UPDATE' and old.status in ('active', 'hidden') and old.expires_at > now();
  if counts_new and not coalesce(counts_old, false) then
    select max_listings into lim from public.profiles where id = new.owner_id;
    if lim is null then
      raise exception 'Completá tu perfil antes de publicar';
    end if;
    select count(*) into cnt
    from public.listings
    where owner_id = new.owner_id
      and id is distinct from new.id
      and status in ('active', 'hidden')
      and expires_at > now();
    if cnt >= lim then
      raise exception 'Tu plan permite % aviso(s) activo(s). Marcá como alquilado o eliminá el que ya tenés.', lim;
    end if;
  end if;

  new.updated_at := now();
  return new;
end;
$$;

create trigger listings_before_write
  before insert or update on public.listings
  for each row execute function public.listings_before_write();

alter table public.listings enable row level security;

create policy listings_select on public.listings
  for select to anon, authenticated
  using (
    (status = 'active' and expires_at > now())
    or owner_id = auth.uid()
    or public.is_admin()
  );

create policy listings_insert on public.listings
  for insert to authenticated
  with check (
    owner_id = auth.uid()
    and status = 'active'
    and featured = false
  );

create policy listings_update_owner on public.listings
  for update to authenticated
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid());

create policy listings_update_admin on public.listings
  for update to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create or replace function public.renew_listing(p_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.listings
  set expires_at = now() + interval '60 days'
  where id = p_id
    and owner_id = auth.uid()
    and status = 'active';
  if not found then
    raise exception 'No se pudo renovar';
  end if;
end;
$$;

revoke all on function public.renew_listing(uuid) from public;
grant execute on function public.renew_listing(uuid) to authenticated;

-- Vista pública: incluye el WhatsApp solo de avisos vigentes.
-- security_invoker = false a propósito, para poder mostrar el teléfono
-- sin abrir la tabla de perfiles. El where es el límite.
create view public.listings_public
with (security_invoker = false) as
select
  l.id,
  l.owner_id,
  l.type,
  l.title,
  l.description,
  l.price_ars,
  l.price_unit,
  l.district,
  l.requirements,
  l.pets_allowed,
  l.guarantee_required,
  l.capacity,
  l.amenities,
  l.lat,
  l.lng,
  l.photo_urls,
  l.status,
  l.featured,
  l.booking_enabled,
  l.expires_at,
  l.created_at,
  p.full_name as owner_name,
  p.whatsapp
from public.listings l
join public.profiles p on p.id = l.owner_id
where l.status = 'active'
  and l.expires_at > now();

-- ---------------------------------------------------------------------------
-- Denuncias: 3 y el aviso se oculta
-- ---------------------------------------------------------------------------

create table public.reports (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references public.listings (id) on delete cascade,
  visitor_id text not null check (char_length(visitor_id) between 8 and 80),
  reason text not null check (reason in ('estafa', 'alquilado', 'falso', 'otro')),
  details text not null default '' check (char_length(details) <= 500),
  created_at timestamptz not null default now(),
  unique (listing_id, visitor_id)
);

create index reports_listing_idx on public.reports (listing_id);

create or replace function public.hide_after_three_reports()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  total integer;
begin
  select count(*) into total from public.reports where listing_id = new.listing_id;
  if total >= 3 then
    perform set_config('lavalle.system', 'on', true);
    update public.listings
    set status = 'hidden',
        hidden_reason = 'reports'
    where id = new.listing_id
      and status = 'active';
    perform set_config('lavalle.system', 'off', true);
  end if;
  return new;
end;
$$;

create trigger hide_after_three_reports
  after insert on public.reports
  for each row execute function public.hide_after_three_reports();

alter table public.reports enable row level security;

create policy reports_insert on public.reports
  for insert to anon, authenticated
  with check (
    reason in ('estafa', 'alquilado', 'falso', 'otro')
    and char_length(visitor_id) between 8 and 80
    and not exists (
      select 1 from public.listings l
      where l.id = listing_id and l.owner_id = auth.uid()
    )
  );

create policy reports_admin_select on public.reports
  for select to authenticated
  using (public.is_admin());

-- ---------------------------------------------------------------------------
-- Busco alquiler
-- ---------------------------------------------------------------------------

create table public.seeks (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles (id) on delete cascade,
  type text not null check (type in ('casa', 'departamento', 'local', 'terreno', 'quincho', 'salon', 'cualquiera')),
  district text references public.districts (name),
  budget_ars integer not null check (budget_ars between 1000 and 200000000),
  note text not null check (char_length(btrim(note)) between 10 and 500),
  status text not null default 'active' check (status in ('active', 'deleted')),
  expires_at timestamptz not null default (now() + interval '60 days'),
  created_at timestamptz not null default now()
);

create index seeks_owner_idx on public.seeks (owner_id);

create or replace function public.seeks_before_write()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  total integer;
begin
  if tg_op = 'INSERT' then
    if not public.is_db_owner() and not public.is_admin() then
      new.owner_id := auth.uid();
      new.status := 'active';
      new.expires_at := now() + interval '60 days';
    end if;
  elsif not public.is_db_owner() and not public.is_admin() then
    if old.owner_id is distinct from auth.uid() then
      raise exception 'No autorizado';
    end if;
    new.owner_id := old.owner_id;
    if new.status not in ('active', 'deleted') then
      new.status := old.status;
    end if;
    if new.expires_at is null or new.expires_at > now() + interval '60 days' then
      new.expires_at := now() + interval '60 days';
    end if;
  end if;

  if not exists (
    select 1 from public.profiles p
    where p.id = new.owner_id and p.full_name is not null and p.whatsapp is not null
  ) then
    raise exception 'Completá tu nombre y WhatsApp antes de publicar';
  end if;

  if tg_op = 'INSERT' and new.status = 'active' then
    select count(*) into total
    from public.seeks
    where owner_id = new.owner_id
      and status = 'active'
      and expires_at > now();
    if total >= 5 then
      raise exception 'Ya tenés varias búsquedas activas. Renová o borrá una.';
    end if;
  end if;
  return new;
end;
$$;

create trigger seeks_before_write
  before insert or update on public.seeks
  for each row execute function public.seeks_before_write();

alter table public.seeks enable row level security;

create policy seeks_select on public.seeks
  for select to anon, authenticated
  using (
    (status = 'active' and expires_at > now())
    or owner_id = auth.uid()
    or public.is_admin()
  );

create policy seeks_insert on public.seeks
  for insert to authenticated
  with check (owner_id = auth.uid());

create policy seeks_update on public.seeks
  for update to authenticated
  using (owner_id = auth.uid() or public.is_admin())
  with check (owner_id = auth.uid() or public.is_admin());

create view public.seeks_public
with (security_invoker = false) as
select
  s.id,
  s.type,
  s.district,
  s.budget_ars,
  s.note,
  s.expires_at,
  s.created_at,
  p.full_name as owner_name,
  p.whatsapp
from public.seeks s
join public.profiles p on p.id = s.owner_id
where s.status = 'active'
  and s.expires_at > now();

create or replace function public.renew_seek(p_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.seeks
  set expires_at = now() + interval '60 days'
  where id = p_id
    and owner_id = auth.uid()
    and status = 'active';
  if not found then
    raise exception 'No se pudo renovar';
  end if;
end;
$$;

revoke all on function public.renew_seek(uuid) from public;
grant execute on function public.renew_seek(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Turnero (premium). Sin doble reserva: índice único por turno confirmado.
-- ---------------------------------------------------------------------------

create table public.booking_slots (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references public.listings (id) on delete cascade,
  slot_date date not null,
  shift text not null check (shift in ('dia', 'mediodia', 'noche')),
  status text not null default 'open' check (status in ('open', 'held', 'confirmed')),
  created_at timestamptz not null default now(),
  unique (listing_id, slot_date, shift)
);

create index booking_slots_listing_idx on public.booking_slots (listing_id, slot_date);

create table public.booking_requests (
  id uuid primary key default gen_random_uuid(),
  slot_id uuid not null references public.booking_slots (id) on delete cascade,
  listing_id uuid not null references public.listings (id) on delete cascade,
  requester_name text not null check (char_length(btrim(requester_name)) between 2 and 80),
  requester_whatsapp text not null check (requester_whatsapp ~ '^[0-9]{10,15}$'),
  guests integer not null check (guests between 1 and 2000),
  note text not null default '' check (char_length(note) <= 400),
  status text not null default 'pending' check (status in ('pending', 'confirmed', 'rejected')),
  created_at timestamptz not null default now()
);

-- Una sola reserva confirmada por turno, y un solo pedido pendiente.
create unique index booking_requests_one_confirmed
  on public.booking_requests (slot_id)
  where status = 'confirmed';

create unique index booking_requests_one_pending
  on public.booking_requests (slot_id)
  where status = 'pending';

create index booking_requests_listing_idx on public.booking_requests (listing_id, status);

create or replace function public.booking_slots_guard()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  row_listing public.listings;
begin
  select * into row_listing from public.listings where id = new.listing_id;
  if row_listing.id is null then
    raise exception 'No encontramos el aviso';
  end if;
  if row_listing.owner_id is distinct from auth.uid()
     and not public.is_admin()
     and not public.is_db_owner() then
    raise exception 'No autorizado';
  end if;
  if not row_listing.booking_enabled or row_listing.type not in ('quincho', 'salon') then
    raise exception 'El turnero no está activo en este aviso';
  end if;
  if row_listing.price_unit = 'dia' and new.shift <> 'dia' then
    raise exception 'Este lugar se reserva por día completo';
  end if;
  if row_listing.price_unit = 'turno' and new.shift not in ('mediodia', 'noche') then
    raise exception 'Elegí turno mediodía o noche';
  end if;
  if new.slot_date < current_date or new.slot_date > current_date + 180 then
    raise exception 'La fecha tiene que estar entre hoy y los próximos 6 meses';
  end if;
  if tg_op = 'INSERT' and new.status is distinct from 'open' and not public.is_admin() and not public.is_db_owner() then
    new.status := 'open';
  end if;
  return new;
end;
$$;

create trigger booking_slots_guard
  before insert or update on public.booking_slots
  for each row execute function public.booking_slots_guard();

alter table public.booking_slots enable row level security;
alter table public.booking_requests enable row level security;

create policy slots_select on public.booking_slots
  for select to anon, authenticated
  using (
    exists (
      select 1 from public.listings l
      where l.id = booking_slots.listing_id
        and l.booking_enabled
        and (
          (l.status = 'active' and l.expires_at > now())
          or l.owner_id = auth.uid()
          or public.is_admin()
        )
    )
  );

create policy slots_insert on public.booking_slots
  for insert to authenticated
  with check (
    status = 'open'
    and exists (
      select 1 from public.listings l
      where l.id = listing_id
        and l.owner_id = auth.uid()
        and l.booking_enabled
        and l.type in ('quincho', 'salon')
    )
  );

create policy slots_delete on public.booking_slots
  for delete to authenticated
  using (
    status = 'open'
    and exists (
      select 1 from public.listings l
      where l.id = listing_id and l.owner_id = auth.uid() and l.booking_enabled
    )
    and not exists (
      select 1 from public.booking_requests r
      where r.slot_id = booking_slots.id and r.status in ('pending', 'confirmed')
    )
  );

create policy requests_select on public.booking_requests
  for select to authenticated
  using (
    public.is_admin()
    or exists (
      select 1 from public.listings l
      where l.id = booking_requests.listing_id and l.owner_id = auth.uid()
    )
  );

-- Los pedidos entran solo por la función, así no se filtra el teléfono por un insert directo.
revoke all on table public.booking_requests from anon, authenticated;
grant select on table public.booking_requests to authenticated;

create or replace function public.create_booking_request(
  p_slot uuid,
  p_name text,
  p_whatsapp text,
  p_guests integer,
  p_note text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_listing uuid;
  v_status text;
  v_cap integer;
  v_enabled boolean;
  v_listing_status text;
  v_expires timestamptz;
  v_type text;
  v_phone text;
  new_id uuid;
begin
  select s.listing_id, s.status, l.capacity, l.booking_enabled, l.status, l.expires_at, l.type
    into v_listing, v_status, v_cap, v_enabled, v_listing_status, v_expires, v_type
  from public.booking_slots s
  join public.listings l on l.id = s.listing_id
  where s.id = p_slot
  for update;

  if v_listing is null or not v_enabled or v_type not in ('quincho', 'salon')
     or v_listing_status <> 'active' or v_expires <= now() then
    raise exception 'El turnero no está activo en este aviso';
  end if;
  if v_status <> 'open' then
    raise exception 'Ese turno ya está tomado o en consulta';
  end if;
  if p_guests is null or p_guests < 1 or p_guests > v_cap then
    raise exception 'La cantidad de personas no entra en la capacidad del lugar';
  end if;
  if char_length(btrim(coalesce(p_name, ''))) < 2 then
    raise exception 'Escribí tu nombre';
  end if;
  v_phone := regexp_replace(coalesce(p_whatsapp, ''), '\D', '', 'g');
  if v_phone !~ '^[0-9]{10,15}$' then
    raise exception 'Revisá el WhatsApp: solo números, con código de país';
  end if;

  insert into public.booking_requests (
    slot_id, listing_id, requester_name, requester_whatsapp, guests, note, status
  ) values (
    p_slot, v_listing, btrim(p_name), v_phone, p_guests, left(btrim(coalesce(p_note, '')), 400), 'pending'
  )
  returning id into new_id;

  update public.booking_slots set status = 'held' where id = p_slot and status = 'open';
  return new_id;
end;
$$;

revoke all on function public.create_booking_request(uuid, text, text, integer, text) from public;
grant execute on function public.create_booking_request(uuid, text, text, integer, text) to anon, authenticated;

create or replace function public.set_booking_status(p_request uuid, p_status text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_slot uuid;
  v_current text;
  v_owner uuid;
begin
  if p_status not in ('confirmed', 'rejected') then
    raise exception 'Estado inválido';
  end if;

  select r.slot_id, r.status, l.owner_id
    into v_slot, v_current, v_owner
  from public.booking_requests r
  join public.listings l on l.id = r.listing_id
  where r.id = p_request
  for update;

  if v_slot is null then
    raise exception 'No encontramos ese pedido';
  end if;
  if v_owner is distinct from auth.uid() and not public.is_admin() then
    raise exception 'No autorizado';
  end if;
  if v_current <> 'pending' then
    raise exception 'Ese pedido ya fue resuelto';
  end if;

  if p_status = 'confirmed' then
    if exists (
      select 1 from public.booking_requests
      where slot_id = v_slot and status = 'confirmed'
    ) then
      raise exception 'Ese turno ya tiene una reserva confirmada';
    end if;
    update public.booking_requests set status = 'confirmed' where id = p_request;
    update public.booking_slots set status = 'confirmed' where id = v_slot;
    update public.booking_requests
      set status = 'rejected'
      where slot_id = v_slot and id <> p_request and status = 'pending';
  else
    update public.booking_requests set status = 'rejected' where id = p_request;
    update public.booking_slots
      set status = 'open'
      where id = v_slot
        and not exists (
          select 1 from public.booking_requests
          where slot_id = v_slot and status in ('pending', 'confirmed')
        );
  end if;
end;
$$;

revoke all on function public.set_booking_status(uuid, text) from public;
grant execute on function public.set_booking_status(uuid, text) to authenticated;

-- ---------------------------------------------------------------------------
-- Permisos de las tablas
-- ---------------------------------------------------------------------------

grant usage on schema public to anon, authenticated;

grant select on public.districts to anon, authenticated;
grant select, insert, update on public.profiles to authenticated;
grant select on public.listings to anon, authenticated;
grant insert, update on public.listings to authenticated;
grant select on public.listings_public to anon, authenticated;
grant select, insert on public.reports to anon, authenticated;
grant select on public.seeks to anon, authenticated;
grant insert, update on public.seeks to authenticated;
grant select on public.seeks_public to anon, authenticated;
grant select, insert, delete on public.booking_slots to anon, authenticated;
revoke insert, update, delete on public.booking_slots from anon;

-- ---------------------------------------------------------------------------
-- Fotos
-- ---------------------------------------------------------------------------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'listing-photos',
  'listing-photos',
  true,
  2097152,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists listing_photos_read on storage.objects;
create policy listing_photos_read on storage.objects
  for select to anon, authenticated
  using (bucket_id = 'listing-photos');

drop policy if exists listing_photos_insert on storage.objects;
create policy listing_photos_insert on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'listing-photos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists listing_photos_update on storage.objects;
create policy listing_photos_update on storage.objects
  for update to authenticated
  using (
    bucket_id = 'listing-photos'
    and (storage.foldername(name))[1] = auth.uid()::text
  )
  with check (
    bucket_id = 'listing-photos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists listing_photos_delete on storage.objects;
create policy listing_photos_delete on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'listing-photos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
