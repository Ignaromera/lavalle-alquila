-- Estadísticas por aviso y por búsqueda.
-- Corré este archivo una sola vez si el proyecto ya existía.
-- Una instalación nueva no lo necesita: schema.sql ya lo incluye.

create table if not exists public.stat_daily (
  subject_type text not null check (subject_type in ('listing', 'seek')),
  subject_id uuid not null,
  kind text not null check (kind in ('view', 'share', 'whatsapp')),
  day date not null,
  count integer not null default 0 check (count >= 0 and count < 1000000),
  primary key (subject_type, subject_id, kind, day)
);

alter table public.stat_daily enable row level security;

drop policy if exists stat_daily_read on public.stat_daily;
create policy stat_daily_read on public.stat_daily
  for select to authenticated
  using (
    public.is_admin()
    or (
      subject_type = 'listing'
      and exists (
        select 1 from public.listings l
        where l.id = stat_daily.subject_id and l.owner_id = auth.uid()
      )
    )
    or (
      subject_type = 'seek'
      and exists (
        select 1 from public.seeks s
        where s.id = stat_daily.subject_id and s.owner_id = auth.uid()
      )
    )
  );

create or replace function public.track_stat(
  p_subject_type text,
  p_subject_id uuid,
  p_kind text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  visible boolean := false;
  today date := (timezone('America/Argentina/Mendoza', now()))::date;
begin
  if p_kind not in ('view', 'share', 'whatsapp') then
    return;
  end if;
  if p_subject_type = 'listing' then
    select exists (
      select 1 from public.listings
      where id = p_subject_id and status = 'active' and expires_at > now()
    ) into visible;
  elsif p_subject_type = 'seek' then
    select exists (
      select 1 from public.seeks
      where id = p_subject_id and status = 'active' and expires_at > now()
    ) into visible;
  else
    return;
  end if;
  if not visible then
    return;
  end if;
  insert into public.stat_daily (subject_type, subject_id, kind, day, count)
  values (p_subject_type, p_subject_id, p_kind, today, 1)
  on conflict (subject_type, subject_id, kind, day)
  do update set count = public.stat_daily.count + 1;
end;
$$;

revoke all on function public.track_stat(text, uuid, text) from public;
grant execute on function public.track_stat(text, uuid, text) to anon, authenticated;
revoke all on public.stat_daily from anon, authenticated;
grant select on public.stat_daily to authenticated;
