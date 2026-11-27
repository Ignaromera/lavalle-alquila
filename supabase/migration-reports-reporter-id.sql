-- El denunciante con cuenta queda grabado. El ocultamiento automático
-- solo cuenta denuncias de usuarios logueados distintos, no anónimas ni del dueño.

alter table public.reports
  add column if not exists reporter_id uuid references public.profiles (id) on delete set null;

create index if not exists reports_reporter_idx
  on public.reports (reporter_id)
  where reporter_id is not null;

create unique index if not exists reports_listing_reporter_uidx
  on public.reports (listing_id, reporter_id)
  where listing_id is not null and reporter_id is not null;

create unique index if not exists reports_seek_reporter_uidx
  on public.reports (seek_id, reporter_id)
  where seek_id is not null and reporter_id is not null;

create or replace function public.reports_before_insert()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  total integer;
begin
  -- Si hay sesión, el denunciante queda grabado acá. No se confía en lo que mande el cliente.
  new.reporter_id := auth.uid();
  select count(*) into total
  from public.reports
  where visitor_id = new.visitor_id
    and created_at > now() - interval '24 hours';
  if total >= 8 then
    raise exception 'Llegaste al límite de denuncias por hoy. Probá mañana.';
  end if;
  return new;
end;
$$;

create or replace function public.hide_after_three_reports()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  total integer;
begin
  if new.listing_id is null then
    return new;
  end if;
  select count(distinct r.reporter_id) into total
  from public.reports r
  join public.listings l on l.id = r.listing_id
  where r.listing_id = new.listing_id
    and r.resolved_at is null
    and r.reporter_id is not null
    and r.reporter_id is distinct from l.owner_id;
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

drop policy if exists reports_insert on public.reports;
create policy reports_insert on public.reports
  for insert to anon, authenticated
  with check (
    reason in ('estafa', 'alquilado', 'falso', 'falso_alquilado', 'datos', 'inapropiado', 'otro')
    and char_length(visitor_id) between 8 and 80
    and (reporter_id is null or reporter_id = auth.uid())
    and (
      (listing_id is not null and seek_id is null and not exists (
        select 1 from public.listings l
        where l.id = listing_id and l.owner_id = auth.uid()
      ))
      or
      (seek_id is not null and listing_id is null and not exists (
        select 1 from public.seeks s
        where s.id = seek_id and s.owner_id = auth.uid()
      ))
    )
  );
