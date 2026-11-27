import assert from "node:assert/strict";
import test from "node:test";
import { makeDb } from "./sql-helpers.js";

// Prueba la migración real (supabase/migration-promo-pro.sql) en un Postgres de verdad (PGlite).
async function promoDb() {
  const t = await makeDb();
  await t.db.exec(t.read("migration-promo-pro.sql"));
  t.redeem = async (uid, code = "LAVALLE5") => {
    try {
      const [row] = await t.as(uid, "select public.canjear_codigo($1) as r", [code]);
      return row.r;
    } catch (error) {
      return { error: error.message };
    }
  };
  return t;
}

const planOf = async (t, id) => (await t.one("select plan, max_listings from public.profiles where id = $1", [id]));
const used = async (t, code = "LAVALLE5") => (await t.one("select used from public.promo_codes where code = $1", [code])).used;

test("LAVALLE5 nace con 15 días de Pro y 5 usos; correr la migración de nuevo no lo pisa", async () => {
  const t = await promoDb();
  const c = await t.one("select plan_id, days, max_uses, used, enabled from public.promo_codes where code = 'LAVALLE5'");
  assert.deepEqual(c, { plan_id: "pro", days: 15, max_uses: 5, used: 0, enabled: true });
  await t.db.exec("update public.promo_codes set used = 2, enabled = false");
  await t.db.exec(t.read("migration-promo-pro.sql"));
  const again = await t.one("select used, enabled from public.promo_codes where code = 'LAVALLE5'");
  assert.deepEqual(again, { used: 2, enabled: false });
});

test("canjear da Pro por 15 días, con mail, y acepta minúsculas y espacios", async () => {
  const t = await promoDb();
  const ana = await t.user("ana@test.ar");
  const quincho = await t.publish(ana, "quincho");
  const r = await t.redeem(ana, " lavalle 5 ");
  assert.equal(r.ok, true);
  assert.equal(r.days, 15);
  assert.deepEqual(await planOf(t, ana), { plan: "pro", max_listings: 1000 });
  const g = await t.one("select code, days, round(extract(epoch from ends_at - granted_at) / 86400) as d from public.promo_grants where user_id = $1", [ana]);
  assert.equal(g.code, "LAVALLE5");
  assert.equal(Number(g.d), 15);
  assert.equal((await t.one("select booking_enabled from public.listings where id = $1", [quincho])).booking_enabled, true, "el quincho queda con turnero");
  const mail = await t.one("select payload from private.mails");
  assert.equal(mail.payload.type, "promo_started");
  assert.equal(mail.payload.days, 15);
  assert.equal(await used(t), 1);
});

test("cupo: con 5 usos, la 6.ª cuenta recibe «ya se usó» y used queda en 5", async () => {
  const t = await promoDb();
  const results = [];
  for (let i = 1; i <= 7; i++) results.push(await t.redeem(await t.user(`p${i}@test.ar`)));
  assert.deepEqual(results.map((r) => r.ok === true), [true, true, true, true, true, false, false]);
  assert.match(results[5].error, /ya se usó todas las veces/);
  assert.equal(await used(t), 5);
  assert.equal((await t.one("select count(*)::int as n from public.promo_grants")).n, 5);
  assert.equal((await t.one("select count(*)::int as n from public.profiles where plan = 'pro'")).n, 5);
});

test("cupo: el UPDATE es condicional y bloquea la fila del código (no hay lectura-y-después-escritura)", async () => {
  const t = await promoDb();
  const sql = t.read("migration-promo-pro.sql");
  const fn = sql.slice(sql.indexOf("create or replace function public.canjear_codigo"), sql.indexOf("revoke all on function public.canjear_codigo"));
  assert.match(fn, /update public\.promo_codes\s+set used = used \+ 1\s+where code = wanted and enabled and used < max_uses/);
  assert.match(fn, /returning \* into c;\s+if not found then/);
  // Aunque used ya esté en el tope por otra transacción, la función no lo pasa.
  await t.db.exec("update public.promo_codes set used = 5 where code = 'LAVALLE5'");
  const r = await t.redeem(await t.user("tarde@test.ar"));
  assert.match(r.error, /ya se usó/);
  assert.equal(await used(t), 5);
});

test("una vez por cuenta y por mail; si falla no gasta un uso", async () => {
  const t = await promoDb();
  await t.db.exec("insert into public.promo_codes (code, days, max_uses) values ('OTRO', 15, 5)");
  const ana = await t.user("ana@test.ar");
  assert.equal((await t.redeem(ana)).ok, true);
  assert.match((await t.redeem(ana)).error, /Ya usaste un código/);
  assert.match((await t.redeem(ana, "OTRO")).error, /Ya usaste un código/);
  // Misma persona, cuenta nueva con el mismo mail (en mayúsculas).
  await t.db.exec(`update public.promo_grants set user_id = null where user_id = '${ana}'`);
  const otra = await t.user("ANA@test.ar");
  assert.match((await t.redeem(otra)).error, /Ya usaste un código/);
  assert.equal(await used(t), 1);
  assert.equal(await used(t, "OTRO"), 0);
});

test("rechaza: sin sesión, mail sin confirmar, plan pago, ya pagó, código apagado, vencido o inexistente", async () => {
  const t = await promoDb();
  assert.match((await t.redeem(null)).error, /Entrá a tu cuenta/);
  const sinConfirmar = await t.user("nc@test.ar");
  await t.db.exec(`update auth.users set email_confirmed_at = null where id = '${sinConfirmar}'`);
  assert.match((await t.redeem(sinConfirmar)).error, /Confirmá tu mail/);
  assert.match((await t.redeem(await t.user("plus@test.ar", "plus"))).error, /plan Gratis/);
  const pago = await t.user("pago@test.ar");
  await t.db.exec(`insert into public.subscriptions (user_id, plan_id, status, access_until) values ('${pago}', 'plus', 'expired', now() - interval '1 day')`);
  assert.match((await t.redeem(pago)).error, /plan Gratis/);
  const ana = await t.user("ana@test.ar");
  assert.match((await t.redeem(ana, "NOEXISTE")).error, /no existe o ya no está vigente/);
  await t.db.exec("update public.promo_codes set enabled = false");
  assert.match((await t.redeem(ana)).error, /no existe o ya no está vigente/);
  await t.db.exec("update public.promo_codes set enabled = true, expires_at = now() - interval '1 day'");
  assert.match((await t.redeem(ana)).error, /no existe o ya no está vigente/);
  assert.equal(await used(t), 0);
  assert.equal((await planOf(t, ana)).plan, "free");
});

test("al vencer vuelve a Gratis con las reglas de bajada (queda el aviso más nuevo)", async () => {
  const t = await promoDb();
  const ana = await t.user("ana@test.ar");
  await t.redeem(ana);
  const viejo = await t.publish(ana);
  const nuevo = await t.publish(ana);
  await t.db.exec(`update public.listings set created_at = now() - interval '2 days' where id = '${viejo}'`);
  await t.db.exec("update public.promo_grants set ends_at = now() - interval '1 minute'");
  assert.equal((await t.one("select private.vencer_suscripciones() as n")).n, 1);
  assert.deepEqual(await planOf(t, ana), { plan: "free", max_listings: 1 });
  const live = await t.q("select id from public.listings where expires_at > now()");
  assert.deepEqual(live.map((r) => r.id), [nuevo]);
  assert.notEqual(viejo, nuevo);
  const last = await t.one("select payload from private.mails order by at desc limit 1");
  assert.equal(last.payload.type, "subscription_ended");
  assert.ok((await t.one("select ended_at from public.promo_grants")).ended_at);
  assert.equal((await t.one("select private.vencer_suscripciones() as n")).n, 0, "correrlo de nuevo no hace nada");
});

test("si se suscribió durante la promo, al vencer la promo manda la suscripción", async () => {
  const t = await promoDb();
  const ana = await t.user("ana@test.ar");
  await t.redeem(ana);
  await t.db.exec(`update public.profiles set plan = 'plus', max_listings = 3 where id = '${ana}'`);
  await t.db.exec(`insert into public.subscriptions (user_id, plan_id, status, access_until) values ('${ana}', 'plus', 'authorized', now() + interval '20 days')`);
  await t.db.exec("update public.promo_grants set ends_at = now() - interval '1 minute'");
  await t.one("select private.vencer_suscripciones()");
  assert.equal((await planOf(t, ana)).plan, "plus");
});

test("si se vence una suscripción con la promo vigente, la cuenta vuelve a Pro", async () => {
  const t = await promoDb();
  const ana = await t.user("ana@test.ar");
  await t.redeem(ana);
  await t.db.exec(`insert into public.subscriptions (user_id, plan_id, status, access_until) values ('${ana}', 'plus', 'cancelled', now() - interval '1 minute')`);
  await t.db.exec(`update public.profiles set plan = 'plus', max_listings = 3 where id = '${ana}'`);
  await t.one("select private.vencer_suscripciones()");
  assert.equal((await planOf(t, ana)).plan, "pro");
});
