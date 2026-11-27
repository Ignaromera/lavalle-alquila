-- Botón de arrepentimiento (Ley 24.240 art. 34, Res. SCI 424/2020).
-- Se pega en Supabase > SQL Editor. Es idempotente y NO lleva secretos.
-- Necesita private.avisar_mail (migración de mails) y public.is_admin().
--
-- Qué hace:
--   1. Tabla regret_requests: una fila por pedido. Cualquiera la puede cargar (sin cuenta);
--      solo un admin la lee y la marca resuelta.
--   2. Código de trámite automático (ARR-AAAAMMDD-0001) al guardar.
--   3. public.pedir_arrepentimiento(...): guarda el pedido y devuelve el código al instante.
--   4. Mail al equipo y a quien lo pide (enviar-mail, tipo regret_requested).

create sequence if not exists public.regret_code_seq;

create table if not exists public.regret_requests (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  full_name text not null check (char_length(full_name) between 2 and 120),
  contact_email text not null check (char_length(contact_email) <= 200 and contact_email ~* '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$'),
  account_email text not null check (char_length(account_email) <= 200 and account_email ~* '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$'),
  reason text not null default '' check (char_length(reason) <= 1000),
  user_id uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  resolved_at timestamptz,
  resolved_by uuid references public.profiles (id) on delete set null
);

comment on table public.regret_requests is 'Pedidos del botón de arrepentimiento. Insert anónimo; lectura y resolución solo admin.';

create index if not exists regret_requests_open_idx on public.regret_requests (created_at desc) where resolved_at is null;

create or replace function private.regret_before_insert()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  total integer;
begin
  new.full_name := btrim(coalesce(new.full_name, ''));
  new.contact_email := lower(btrim(coalesce(new.contact_email, '')));
  new.account_email := lower(btrim(coalesce(new.account_email, '')));
  new.reason := left(btrim(coalesce(new.reason, '')), 1000);
  new.user_id := auth.uid();
  new.created_at := now();
  new.resolved_at := null;
  new.resolved_by := null;
  select count(*) into total
  from public.regret_requests
  where contact_email = new.contact_email and created_at > now() - interval '24 hours';
  if total >= 5 then
    raise exception 'Ya recibimos varios pedidos desde este mail hoy. Te vamos a responder igual.';
  end if;
  new.code := 'ARR-' || to_char(now() at time zone 'America/Argentina/Mendoza', 'YYYYMMDD')
    || '-' || lpad(nextval('public.regret_code_seq')::text, 4, '0');
  return new;
end;
$$;

drop trigger if exists regret_before_insert on public.regret_requests;
create trigger regret_before_insert
  before insert on public.regret_requests
  for each row execute function private.regret_before_insert();

alter table public.regret_requests enable row level security;

drop policy if exists regret_insert on public.regret_requests;
create policy regret_insert on public.regret_requests
  for insert to anon, authenticated
  with check (resolved_at is null and resolved_by is null);

drop policy if exists regret_admin_read on public.regret_requests;
create policy regret_admin_read on public.regret_requests
  for select to authenticated using (public.is_admin());

drop policy if exists regret_admin_update on public.regret_requests;
create policy regret_admin_update on public.regret_requests
  for update to authenticated using (public.is_admin()) with check (public.is_admin());

revoke all on public.regret_requests from anon, authenticated;
grant insert on public.regret_requests to anon, authenticated;
grant select, update on public.regret_requests to authenticated;
grant usage on sequence public.regret_code_seq to anon, authenticated;

-- El navegador no puede leer la tabla, así que el código vuelve por esta función.
create or replace function public.pedir_arrepentimiento(
  p_nombre text, p_email text, p_email_cuenta text, p_motivo text default ''
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  c text;
begin
  insert into public.regret_requests (full_name, contact_email, account_email, reason)
  values (p_nombre, p_email, coalesce(nullif(btrim(p_email_cuenta), ''), p_email), coalesce(p_motivo, ''))
  returning code into c;
  return c;
end;
$$;

revoke all on function public.pedir_arrepentimiento(text, text, text, text) from public;
grant execute on function public.pedir_arrepentimiento(text, text, text, text) to anon, authenticated;

create or replace function private.trg_arrepentimiento_mail()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.avisar_mail(jsonb_build_object(
    'type', 'regret_requested',
    'code', new.code,
    'name', new.full_name,
    'contact_email', new.contact_email,
    'account_email', new.account_email,
    'reason', left(new.reason, 1000),
    'created_at', new.created_at
  ));
  return new;
exception when others then
  raise warning 'trg_arrepentimiento_mail falló: %', sqlerrm;
  return new;
end;
$$;
revoke all on function private.trg_arrepentimiento_mail() from public, anon, authenticated;

drop trigger if exists mail_arrepentimiento on public.regret_requests;
create trigger mail_arrepentimiento
  after insert on public.regret_requests
  for each row execute function private.trg_arrepentimiento_mail();
