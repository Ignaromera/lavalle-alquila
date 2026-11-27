-- Parche: el mail de «aviso publicado» no salía porque la Edge Function
-- no podía leer public.listings y devolvía 404. El trigger ahora manda
-- owner_id y title en el payload. Es idempotente (se puede repetir).
-- Después de pegarlo, hay que redesplegar la Edge Function enviar-mail
-- con el index.ts nuevo del repo.

create or replace function private.trg_aviso_publicado()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status = 'active' then
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

-- Por las dudas, que service_role pueda leer el aviso si la función lo busca.
grant usage on schema public to service_role;
grant select on public.listings to service_role;
grant select on public.listings_public to service_role;
grant select on public.profiles to service_role;
