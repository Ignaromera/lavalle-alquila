-- Denuncias: búsquedas, marcar resueltas, motivos nuevos, tope por visitante y aviso por mail.

alter table public.reports
  alter column listing_id drop not null;

alter table public.reports
  add column if not exists seek_id uuid references public.seeks (id) on delete cascade,
  add column if not exists resolved_at timestamptz,
  add column if not exists resolved_by uuid references public.profiles (id) on delete set null;

alter table public.reports drop constraint if exists reports_listing_id_visitor_id_key;
drop index if exists reports_listing_id_visitor_id_key;

create unique index if not exists reports_listing_visitor_uidx
  on public.reports (listing_id, visitor_id)
  where listing_id is not null;

create unique index if not exists reports_seek_visitor_uidx
  on public.reports (seek_id, visitor_id)
  where seek_id is not null;

create index if not exists reports_seek_idx on public.reports (seek_id);
create index if not exists reports_unresolved_idx on public.reports (created_at desc) where resolved_at is null;

alter table public.reports drop constraint if exists reports_reason_check;
alter table public.reports add constraint reports_reason_check
  check (reason in ('estafa', 'alquilado', 'falso', 'falso_alquilado', 'datos', 'inapropiado', 'otro'));

alter table public.reports drop constraint if exists reports_subject_check;
alter table public.reports add constraint reports_subject_check
  check (
    (listing_id is not null and seek_id is null)
    or (listing_id is null and seek_id is not null)
  );

create or replace function public.reports_before_insert()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  total integer;
begin
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

drop trigger if exists reports_before_insert on public.reports;
create trigger reports_before_insert
  before insert on public.reports
  for each row execute function public.reports_before_insert();

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
  select count(*) into total
  from public.reports
  where listing_id = new.listing_id
    and resolved_at is null;
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

drop policy if exists reports_admin_update on public.reports;
create policy reports_admin_update on public.reports
  for update to authenticated
  using (public.is_admin())
  with check (public.is_admin());

grant select, insert on public.reports to anon, authenticated;
grant update on public.reports to authenticated;

create or replace function private.trg_denuncia()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  titulo text := '';
  link text := 'https://lavallealquila.com.ar/';
  motivo text := coalesce(new.reason, '');
begin
  if new.listing_id is not null then
    select l.title into titulo from public.listings l where l.id = new.listing_id;
    link := 'https://lavallealquila.com.ar/#/aviso/' || new.listing_id::text;
  elsif new.seek_id is not null then
    select left(s.note, 80) into titulo from public.seeks s where s.id = new.seek_id;
    titulo := 'Busco alquiler' || case when titulo is not null and titulo <> '' then ': ' || titulo else '' end;
    link := 'https://lavallealquila.com.ar/#/busco/' || new.seek_id::text;
  end if;
  perform private.avisar_mail(jsonb_build_object(
    'type', 'report_received',
    'report_id', new.id,
    'listing_id', new.listing_id,
    'seek_id', new.seek_id,
    'reason', motivo,
    'details', left(coalesce(new.details, ''), 500),
    'title', coalesce(titulo, ''),
    'link', link
  ));
  return new;
exception when others then
  raise warning 'trg_denuncia falló: %', sqlerrm;
  return new;
end;
$$;

revoke all on function private.trg_denuncia() from public, anon, authenticated;

drop trigger if exists mail_denuncia on public.reports;
create trigger mail_denuncia
  after insert on public.reports
  for each row execute function private.trg_denuncia();
