-- Página pública de un anunciante: nombre y cantidad, sin abrir profiles.
-- También suma owner_id a seeks_public (es un uuid, no es sensible).
-- listings_public ya expone owner_id.

drop view if exists public.seeks_public;

create view public.seeks_public
with (security_invoker = false) as
select
  s.id,
  s.owner_id,
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

grant select on public.seeks_public to anon, authenticated;

create or replace function public.advertiser_public(p_id uuid)
returns table (
  id uuid,
  full_name text,
  listing_count integer,
  seek_count integer
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  has_public boolean;
begin
  select
    exists (
      select 1
      from public.listings l
      where l.owner_id = p_id
        and l.status = 'active'
        and l.expires_at > now()
    )
    or exists (
      select 1
      from public.seeks s
      where s.owner_id = p_id
        and s.status = 'active'
        and s.expires_at > now()
    )
  into has_public;

  if not has_public and not public.is_admin() then
    return;
  end if;

  return query
  select
    p.id,
    p.full_name,
    (
      select count(*)::integer
      from public.listings l
      where l.owner_id = p.id
        and l.status = 'active'
        and l.expires_at > now()
    ) as listing_count,
    (
      select count(*)::integer
      from public.seeks s
      where s.owner_id = p.id
        and s.status = 'active'
        and s.expires_at > now()
    ) as seek_count
  from public.profiles p
  where p.id = p_id;
end;
$$;

revoke all on function public.advertiser_public(uuid) from public;
grant execute on function public.advertiser_public(uuid) to anon, authenticated;

create or replace function public.advertiser_names(p_ids uuid[])
returns table (
  id uuid,
  full_name text
)
language sql
stable
security definer
set search_path = public
as $$
  select p.id, p.full_name
  from public.profiles p
  where p.id = any(p_ids)
    and (
      public.is_admin()
      or exists (
        select 1
        from public.listings l
        where l.owner_id = p.id
          and l.status = 'active'
          and l.expires_at > now()
      )
      or exists (
        select 1
        from public.seeks s
        where s.owner_id = p.id
          and s.status = 'active'
          and s.expires_at > now()
      )
    );
$$;

revoke all on function public.advertiser_names(uuid[]) from public;
grant execute on function public.advertiser_names(uuid[]) to anon, authenticated;
