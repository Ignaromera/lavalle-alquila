import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";

const read = (name) => readFileSync(new URL(`../supabase/${name}`, import.meta.url), "utf8");

/** Saca de un .sql un bloque `create or replace function <name>` completo (hasta el `$$;` que lo cierra). */
export function extractFunction(sql, name) {
  const start = sql.indexOf(`create or replace function ${name}(`);
  if (start < 0) throw new Error(`no encontré ${name}`);
  const body = sql.indexOf("$$", start);
  const end = sql.indexOf("$$;", body + 2);
  return sql.slice(start, end + 3);
}

/**
 * Una base Postgres real (PGlite, en memoria) con lo mínimo de Supabase para probar las
 * migraciones: roles, auth.users, auth.uid(), perfiles, avisos, planes y suscripciones.
 * activar_plan y los planes salen del archivo real migration-suscripciones.sql.
 */
export async function makeDb() {
  const db = new PGlite();
  const subs = read("migration-suscripciones.sql");
  const plansInsert = subs.slice(subs.indexOf("insert into public.plans"), subs.indexOf("alter table public.plans enable"));
  await db.exec(`
    create role anon; create role authenticated; create role service_role;
    create schema auth; create schema private;
    create table auth.users (id uuid primary key default gen_random_uuid(), email text, email_confirmed_at timestamptz default now());
    create or replace function auth.uid() returns uuid language sql stable as $$
      select nullif(current_setting('test.uid', true), '')::uuid $$;
    create or replace function public.is_admin() returns boolean language sql stable as $$
      select coalesce(current_setting('test.admin', true), '') = 'on' $$;
    create table public.plans (
      id text primary key, name text not null, max_listings integer not null, featured_slots integer not null default 0,
      stats boolean not null default false, turnero boolean not null default false,
      price_month_ars integer not null default 0, price_year_ars integer not null default 0, sort_order integer not null default 0);
    ${plansInsert}
    create table public.profiles (
      id uuid primary key references auth.users (id) on delete cascade, full_name text, whatsapp text,
      plan text not null default 'free', max_listings integer not null default 1, booking_enabled boolean not null default false);
    create table public.listings (
      id uuid primary key default gen_random_uuid(), owner_id uuid references public.profiles (id),
      type text not null default 'casa', status text not null default 'active', featured boolean not null default false,
      booking_enabled boolean not null default false, expires_at timestamptz not null default now() + interval '60 days',
      created_at timestamptz not null default clock_timestamp());
    create table public.subscriptions (
      id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users (id), plan_id text not null,
      billing_interval text not null default 'month', amount_ars integer not null default 1, status text not null default 'pending',
      access_until timestamptz, ended_at timestamptz, created_at timestamptz not null default now());
    create table private.mails (payload jsonb, at timestamptz default clock_timestamp());
    create or replace function private.avisar_mail(payload jsonb) returns void language sql as $$
      insert into private.mails (payload) values (payload) $$;
    ${extractFunction(subs, "public.activar_plan")}
  `);
  return {
    db,
    read,
    async q(sql, params) { return (await db.query(sql, params)).rows; },
    async one(sql, params) { return (await db.query(sql, params)).rows[0]; },
    async user(email, plan = "free") {
      const { id } = (await db.query("insert into auth.users (email) values ($1) returning id", [email])).rows[0];
      const max = plan === "pro" ? 1000 : plan === "plus" ? 3 : 1;
      await db.query("insert into public.profiles (id, full_name, whatsapp, plan, max_listings) values ($1, 'Ana', '2615555555', $2, $3)", [id, plan, max]);
      return id;
    },
    /** Corre fn como si la llamara esa cuenta desde el navegador (auth.uid()). */
    async as(uid, sql, params) {
      await db.query("select set_config('test.uid', $1, false)", [uid || ""]);
      try { return (await db.query(sql, params)).rows; } finally { await db.query("select set_config('test.uid', '', false)"); }
    },
    async publish(owner, type = "casa") {
      return (await db.query("insert into public.listings (owner_id, type) values ($1, $2) returning id", [owner, type])).rows[0].id;
    },
  };
}
