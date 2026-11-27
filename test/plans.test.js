import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  GRACE_DAYS, PLANS, UNLIMITED, accessUntil, activeCount, canFeature, canPublishMore, featuredCount, formatArs, isUnlimited, limitLabel,
  listingsToExpire, listingsToUnfeature, pickSubscription, planFeatures, planId, planNote, priceFor, priceLine, renewalDate, subscriptionState,
  usageLabel, yearlySavings, hasYearly, intervalFor,
} from "../src/plans.js";
import { addListing, createDemoStore, IDS, setFeatured, subscriptionFor, cancelSubscription } from "../src/demo-store.js";

const NOW = new Date("2026-12-01T12:00:00Z");
const iso = (days) => new Date(NOW.getTime() + days * 86400000).toISOString();

test("planes: Gratis 1, Plus 3, Pro ilimitado con turnero y destacados", () => {
  assert.equal(PLANS.free.maxListings, 1);
  assert.equal(PLANS.plus.maxListings, 3);
  assert.equal(PLANS.pro.maxListings, UNLIMITED);
  assert.equal(isUnlimited(PLANS.pro.maxListings), true);
  assert.equal(isUnlimited(3), false);
  assert.equal(PLANS.pro.turnero, true);
  assert.equal(PLANS.plus.turnero, false);
  assert.equal(PLANS.pro.featuredSlots, 2);
  assert.equal(PLANS.plus.featuredSlots, 0);
  assert.equal(PLANS.plus.stats && PLANS.pro.stats && !PLANS.free.stats, true);
  assert.equal(planId("PRO"), "pro");
  assert.equal(planId("oro"), "free");
  assert.equal(planId(undefined), "free");
});

test("precios: Plus 6.900 sin anual, Pro 14.900 / 100.000", () => {
  assert.equal(priceFor("plus", "month"), 6900);
  assert.equal(priceFor("plus", "year"), 6900, "Plus no tiene anual: cae al mensual");
  assert.equal(hasYearly("plus"), false);
  assert.equal(hasYearly("pro"), true);
  assert.equal(intervalFor("plus", "year"), "month");
  assert.equal(intervalFor("pro", "year"), "year");
  assert.equal(priceLine("plus", "year"), "$6.900 por mes");
  assert.equal(priceFor("pro", "month"), 14900);
  assert.equal(priceFor("pro", "year"), 100000);
  assert.equal(priceFor("free", "year"), 0);
  assert.equal(priceLine("pro", "year"), "$100.000 por año");
  assert.equal(priceLine("plus", "month"), "$6.900 por mes");
  assert.equal(priceLine("free", "month"), "Gratis");
  assert.equal(formatArs(178800), "$178.800");
  assert.equal(formatArs(999), "$999");
});

test("ahorro anual: Pro $178.800 contra $100.000 es 44%; Plus no tiene", () => {
  const pro = yearlySavings("pro");
  assert.deepEqual(pro, { full: 178800, yearly: 100000, saved: 78800, pct: 44, perMonth: 8333 });
  const plus = yearlySavings("plus");
  assert.equal(plus.saved, 0);
  assert.equal(plus.pct, 0);
  assert.equal(yearlySavings("free").pct, 0);
});

test("límite de avisos: cuenta activos y ocultos vigentes, no vencidos ni alquilados", () => {
  const listings = [
    { id: "a", status: "active", expires_at: iso(10) },
    { id: "b", status: "hidden", expires_at: iso(10) },
    { id: "c", status: "active", expires_at: iso(-1) },
    { id: "d", status: "rented", expires_at: iso(10) },
    { id: "e", status: "deleted", expires_at: iso(10) },
  ];
  assert.equal(activeCount(listings, { now: NOW }), 2);
  assert.equal(activeCount(listings, { now: NOW, exceptId: "a" }), 1);
  assert.equal(canPublishMore(0, 1), true);
  assert.equal(canPublishMore(1, 1), false);
  assert.equal(canPublishMore(2, 3), true);
  assert.equal(canPublishMore(3, 3), false);
  assert.equal(canPublishMore(500, UNLIMITED), true);
  assert.equal(canPublishMore(5000, UNLIMITED), true);
});

test("textos de límite: singular, plural e ilimitado", () => {
  assert.equal(limitLabel(1), "1 aviso activo");
  assert.equal(limitLabel(3), "3 avisos activos");
  assert.equal(limitLabel(UNLIMITED), "avisos ilimitados");
  assert.equal(usageLabel(1, 3), "Usás 1 de 3 avisos activos");
  assert.equal(usageLabel(1, 1), "Usás 1 de 1 aviso activo");
  assert.equal(usageLabel(7, UNLIMITED), "Tenés 7 avisos activos, sin tope");
  assert.deepEqual(planNote({ plan: "free", max_listings: 1 }, 1).text, "usás 1 de 1 aviso activo.");
  assert.match(planNote({ plan: "free", max_listings: 1 }, 0).cta, /Plus o Pro/);
  assert.match(planNote({ plan: "plus", max_listings: 3 }, 2).cta, /Pro/);
  assert.equal(planNote({ plan: "pro", max_listings: UNLIMITED }, 9).text, "avisos ilimitados, turnero y destacados.");
  assert.equal(planNote({ plan: "pro", max_listings: UNLIMITED }, 9).cta, "");
});

test("beneficios por plan", () => {
  assert.deepEqual(planFeatures("free"), ["1 aviso activo", "Contacto directo por WhatsApp"]);
  assert.match(planFeatures("plus").join("|"), /3 avisos activos.*Estadísticas/);
  const pro = planFeatures("pro").join("|");
  assert.match(pro, /Avisos ilimitados/);
  assert.match(pro, /Turnero/);
  assert.match(pro, /2 avisos destacados/);
});

test("destacados: según el plan, activos y con lugar", () => {
  const profilePro = { plan: "pro" };
  const listings = [
    { id: "a", status: "active", expires_at: iso(5), featured: true },
    { id: "b", status: "active", expires_at: iso(5), featured: true },
    { id: "c", status: "active", expires_at: iso(5), featured: false },
    { id: "d", status: "rented", expires_at: iso(5), featured: false },
    { id: "e", status: "active", expires_at: iso(-2), featured: true },
  ];
  assert.equal(featuredCount(listings, { now: NOW }), 2, "el vencido no cuenta");
  assert.deepEqual(canFeature(profilePro, listings, listings[2], { now: NOW }), { ok: false, reason: "full" });
  assert.deepEqual(canFeature(profilePro, listings, listings[0], { now: NOW }), { ok: true, reason: "already" });
  assert.deepEqual(canFeature(profilePro, listings, listings[3], { now: NOW }), { ok: false, reason: "inactive" });
  assert.deepEqual(canFeature({ plan: "plus" }, listings, listings[2], { now: NOW }), { ok: false, reason: "plan" });
  assert.deepEqual(canFeature({ plan: "free" }, listings, listings[2], { now: NOW }), { ok: false, reason: "plan" });
  assert.deepEqual(canFeature(profilePro, listings.slice(2), listings[2], { now: NOW }), { ok: true, reason: "free" });
});

test("al bajar de plan vencen los de más (quedan los más nuevos) y se sacan destacados", () => {
  const listings = [
    { id: "v1", status: "active", expires_at: iso(9), created_at: iso(-30), featured: true },
    { id: "v2", status: "active", expires_at: iso(9), created_at: iso(-20), featured: true },
    { id: "v3", status: "active", expires_at: iso(9), created_at: iso(-10), featured: false },
    { id: "v4", status: "active", expires_at: iso(9), created_at: iso(-2), featured: false },
    { id: "old", status: "active", expires_at: iso(-3), created_at: iso(-90), featured: false },
  ];
  assert.deepEqual(listingsToExpire(listings, 1, { now: NOW }), ["v3", "v2", "v1"]);
  assert.deepEqual(listingsToExpire(listings, 3, { now: NOW }), ["v1"]);
  assert.deepEqual(listingsToExpire(listings, UNLIMITED, { now: NOW }), []);
  assert.deepEqual(listingsToUnfeature(listings, 0), ["v2", "v1"]);
  assert.deepEqual(listingsToUnfeature(listings, 1), ["v1"]);
});

test("estado de la suscripción: activa, pago pendiente, cancelada con acceso, terminada", () => {
  const base = { status: "authorized", access_until: iso(20), last_paid_at: iso(-10), payment_failed_at: null };
  assert.deepEqual(subscriptionState(base, NOW), { state: "active", daysLeft: 20 });
  assert.equal(subscriptionState({ ...base, payment_failed_at: iso(-1) }, NOW).state, "past_due");
  assert.equal(subscriptionState({ ...base, payment_failed_at: iso(-20) }, NOW).state, "active", "pagó después de fallar");
  assert.equal(subscriptionState({ ...base, status: "cancelled" }, NOW).state, "cancelling");
  assert.equal(subscriptionState({ ...base, status: "cancelled", access_until: iso(-1) }, NOW).state, "ended");
  assert.equal(subscriptionState({ ...base, status: "paused" }, NOW).state, "past_due");
  assert.equal(subscriptionState({ status: "pending" }, NOW).state, "pending");
  assert.equal(subscriptionState({ status: "expired" }, NOW).state, "ended");
  assert.equal(subscriptionState(null, NOW).state, "none");
});

test("acceso: próximo cobro + 3 días de gracia, y la renovación mostrada es el próximo cobro", () => {
  assert.equal(GRACE_DAYS, 3);
  assert.equal(accessUntil("2027-01-01T00:00:00Z"), "2027-01-04T00:00:00.000Z");
  assert.equal(accessUntil("basura"), null);
  assert.equal(renewalDate({ access_until: "2027-01-04T15:00:00Z" }), "1 de enero de 2027");
});

test("qué suscripción se muestra: la vigente, si no un pago en curso reciente", () => {
  const rows = [
    { id: "x", status: "expired", created_at: iso(-100), access_until: iso(-50) },
    { id: "p", status: "pending", created_at: iso(-0.5) },
    { id: "pOld", status: "pending", created_at: iso(-9) },
    { id: "a", status: "authorized", created_at: iso(-30), access_until: iso(30) },
  ];
  assert.equal(pickSubscription(rows, NOW).id, "a");
  assert.equal(pickSubscription(rows.filter((r) => r.id !== "a"), NOW).id, "p");
  assert.equal(pickSubscription(rows.filter((r) => r.id === "pOld" || r.id === "x"), NOW), null);
  assert.equal(pickSubscription([], NOW), null);
});

test("los precios y límites de plans.js son los mismos que carga la migración SQL", () => {
  const sql = readFileSync(new URL("../supabase/migration-suscripciones.sql", import.meta.url), "utf8");
  const rows = [...sql.matchAll(/\('(free|plus|pro)',\s*'([^']+)',\s*(\d+),\s*(\d+),\s*(true|false),\s*(true|false),\s*(\d+),\s*(\d+),\s*(\d+)\)/g)];
  assert.equal(rows.length, 3, "tres planes en el insert");
  for (const [, id, name, max, slots, stats, turnero, month, year] of rows) {
    const p = PLANS[id];
    assert.equal(name, p.name, id);
    assert.equal(Number(max), p.maxListings, `${id} max`);
    assert.equal(Number(slots), p.featuredSlots, `${id} destacados`);
    assert.equal(stats === "true", p.stats, `${id} stats`);
    assert.equal(turnero === "true", p.turnero, `${id} turnero`);
    assert.equal(Number(month), p.monthly, `${id} mensual`);
    assert.equal(Number(year), p.yearly, `${id} anual`);
  }
  assert.match(sql, /interval '3 days'|access_until > now\(\)/);
});

test("demo: la cuenta Pro de ejemplo es ilimitada y publica más de 5; la gratis frena al segundo", () => {
  const store = createDemoStore();
  const input = (n) => ({
    type: "casa", title: `Casa de prueba número ${n}`, description: "Descripción de prueba con más de veinte letras.", price_ars: 150000,
    district: "Villa Tulumaya", address: "Calle falsa 123", lat: -32.7215, lng: -68.5958, pets_allowed: false, guarantee_required: true,
  });
  for (let i = 0; i < 8; i += 1) addListing(store, IDS.marina, input(i));
  assert.throws(() => addListing(store, IDS.carlos, input(1)), /Tu plan permite 1 aviso/);
});

test("demo: destacar respeta el tope del plan Pro y no existe para el gratis", () => {
  const store = createDemoStore();
  // Marina ya tiene 2 destacados: publica un tercer aviso y no lo puede destacar.
  addListing(store, IDS.marina, {
    type: "casa", title: "Casa nueva para destacar", description: "Descripción de prueba con más de veinte letras.", price_ars: 150000,
    district: "Villa Tulumaya", address: "Calle falsa 123", lat: -32.7215, lng: -68.5958, pets_allowed: false, guarantee_required: true,
  });
  const mine = store.listings.filter((item) => item.owner_id === IDS.marina && item.status === "active" && !item.featured);
  assert.ok(mine.length > 0);
  assert.throws(() => setFeatured(store, IDS.marina, mine[0].id, true), /Ya usaste tus 2 destacados/);
  const featured = store.listings.find((item) => item.owner_id === IDS.marina && item.featured);
  setFeatured(store, IDS.marina, featured.id, false);
  setFeatured(store, IDS.marina, mine[0].id, true);
  assert.equal(store.listings.find((item) => item.id === mine[0].id).featured, true);
  const carlos = store.listings.find((item) => item.owner_id === IDS.carlos && item.status === "active");
  assert.throws(() => setFeatured(store, IDS.carlos, carlos.id, true), /plan Pro/);
  assert.throws(() => setFeatured(store, IDS.carlos, featured.id, false), /No autorizado/);
});

test("demo: la suscripción de ejemplo de Marina se puede cancelar y sigue vigente hasta el vencimiento", () => {
  const store = createDemoStore();
  const sub = subscriptionFor(store, IDS.marina);
  assert.equal(sub.plan_id, "pro");
  assert.equal(subscriptionState(sub).state, "active");
  cancelSubscription(store, IDS.marina);
  assert.equal(subscriptionState(subscriptionFor(store, IDS.marina)).state, "cancelling");
  assert.equal(subscriptionFor(store, IDS.carlos), null);
});
