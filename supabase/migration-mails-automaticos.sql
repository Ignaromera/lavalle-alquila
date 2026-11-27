-- Mails automáticos de Lavalle Alquila (bienvenida y aviso publicado).
-- Se pega UNA vez en Supabase > SQL Editor. Es idempotente (se puede repetir).
-- Antes de correrlo, reemplazá __WEBHOOK_SECRET__ por el mismo valor que le
-- pusiste al secret WEBHOOK_SECRET de la Edge Function «enviar-mail».
--
-- Los triggers jamás rompen el registro ni la publicación: si el mail falla,
-- solo se anota un aviso y la operación sigue.

create extension if not exists pg_net with schema extensions;

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

create or replace function private.avisar_mail(payload jsonb)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform net.http_post(
    url := 'https://tfiggzureidsozbzkyif.supabase.co/functions/v1/enviar-mail',
    body := payload,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-webhook-secret', '__WEBHOOK_SECRET__'
    ),
    timeout_milliseconds := 5000
  );
exception when others then
  raise warning 'avisar_mail falló: %', sqlerrm;
end;
$$;
revoke all on function private.avisar_mail(jsonb) from public, anon, authenticated;

-- Bienvenida: una sola vez, cuando la cuenta queda confirmada.
--  * Google: la cuenta nace ya confirmada (INSERT con email_confirmed_at).
--  * Mail y contraseña: llega primero «Confirmá tu mail» y la bienvenida sale
--    recién al confirmar (UPDATE de null a fecha). Así no hay doble saludo.
create or replace function private.trg_bienvenida()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.email is not null and new.email_confirmed_at is not null
     and (tg_op = 'INSERT' or old.email_confirmed_at is null) then
    perform private.avisar_mail(jsonb_build_object('type', 'welcome', 'user_id', new.id));
  end if;
  return new;
end;
$$;
revoke all on function private.trg_bienvenida() from public, anon, authenticated;

drop trigger if exists mail_bienvenida on auth.users;
create trigger mail_bienvenida
  after insert or update of email_confirmed_at on auth.users
  for each row execute function private.trg_bienvenida();

-- Aviso publicado: al crearse un aviso activo (los avisos nacen 'active').
-- No se manda al reactivar ni al editar.
create or replace function private.trg_aviso_publicado()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status = 'active' then
    -- Mandamos owner_id y title en el payload: la función no depende
    -- de poder hacer SELECT sobre public.listings (eso hacía fallar el envío).
    perform private.avisar_mail(jsonb_build_object(
      'type', 'listing_published',
      'listing_id', new.id,
      'owner_id', new.owner_id,
      'title', new.title
    ));
  end if;
  return new;
end;
$$;
revoke all on function private.trg_aviso_publicado() from public, anon, authenticated;

drop trigger if exists mail_aviso_publicado on public.listings;
create trigger mail_aviso_publicado
  after insert on public.listings
  for each row execute function private.trg_aviso_publicado();
