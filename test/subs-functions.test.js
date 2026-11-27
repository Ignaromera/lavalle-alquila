import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { pathToFileURL } from "node:url";

// Las Edge Functions son JavaScript puro con extensión .ts: se copian como .mjs y se importan.
const tmp = mkdtempSync(path.join(tmpdir(), "la-fn-"));
async function load(name) {
  const src = readFileSync(new URL(`../supabase/functions/${name}/index.ts`, import.meta.url), "utf8");
  const file = path.join(tmp, `${name}.mjs`);
  writeFileSync(file, src);
  return import(pathToFileURL(file).href);
}

const SUPA = "https://proj.supabase.co";
const USER = "11111111-1111-4111-8111-111111111111";
const NOW = new Date("2026-12-01T12:00:00.000Z");

/** Un Supabase y un Mercado Pago de mentira, en memoria. */
function makeWorld({ token = "APP_USR-test", env = {} } = {}) {
  const w = {
    subs: [],
    plans: {
      plus: { id: "plus", name: "Plus", price_month_ars: 6900, price_year_ars: 0 },
      pro: { id: "pro", name: "Pro", price_month_ars: 14900, price_year_ars: 100000 },
    },
    rpcs: [],
    mpCalls: [],
    mpPre: {},
    mpPayments: {},
    nextMp: 1,
    mpFail: false,
    tokens: { "tok-user": { id: USER, email: "ana@example.com" } },
    n: 0,
  };
  const values = { SUPABASE_URL: SUPA, SUPABASE_SERVICE_ROLE_KEY: "service-key", ...(token ? { MP_ACCESS_TOKEN: token } : {}), ...env };
  w.env = (k) => values[k];
  w.now = () => NOW;
  const match = (row, query) => {
    for (const [key, cond] of query) {
      if (["select", "order", "limit"].includes(key)) continue;
      const v = row[key];
      if (cond.startsWith("eq.")) { if (String(v) !== cond.slice(3)) return false; }
      else if (cond.startsWith("neq.")) { if (String(v) === cond.slice(4)) return false; }
      else if (cond.startsWith("in.(")) { if (!cond.slice(4, -1).split(",").includes(String(v))) return false; }
      else if (cond === "not.is.null") { if (v == null) return false; }
      else throw new Error(`filtro no soportado: ${key}=${cond}`);
    }
    return true;
  };
  const ok = (data, status = 200) => new Response(data === null ? "" : JSON.stringify(data), { status, headers: { "content-type": "application/json" } });
  w.fetch = async (url, init = {}) => {
    const u = new URL(url);
    const method = (init.method || "GET").toUpperCase();
    const body = init.body ? JSON.parse(init.body) : undefined;
    if (u.origin === SUPA) {
      if (u.pathname === "/auth/v1/user") {
        const t = (init.headers?.authorization || "").replace("Bearer ", "");
        return w.tokens[t] ? ok(w.tokens[t]) : ok({ message: "bad" }, 401);
      }
      const m = u.pathname.match(/^\/rest\/v1\/(.+)$/);
      if (!m) throw new Error(`ruta desconocida ${u.pathname}`);
      const table = m[1];
      const q = [...u.searchParams.entries()];
      if (table.startsWith("rpc/")) { w.rpcs.push({ name: table.slice(4), args: body }); return ok(null); }
      if (table === "plans") return ok(Object.values(w.plans).filter((r) => match(r, q)));
      if (table === "subscriptions") {
        if (method === "GET") {
          let rows = w.subs.filter((r) => match(r, q)).sort((a, b) => b.created_at.localeCompare(a.created_at) || b.n - a.n);
          const lim = u.searchParams.get("limit");
          if (lim) rows = rows.slice(0, Number(lim));
          return ok(rows.map((r) => ({ ...r })));
        }
        if (method === "POST") {
          const row = { id: `sub-${++w.n}`, n: w.n, created_at: NOW.toISOString(), status: "pending", mp_preapproval_id: null, init_point: null, access_until: null, last_paid_at: null, last_failed_payment_id: null, ...body };
          w.subs.push(row);
          return ok([{ ...row }], 201);
        }
        if (method === "PATCH") {
          const rows = w.subs.filter((r) => match(r, q));
          rows.forEach((r) => Object.assign(r, body));
          return ok(rows.map((r) => ({ ...r })));
        }
        if (method === "DELETE") { w.subs = w.subs.filter((r) => !match(r, q)); return ok(null, 204); }
      }
      throw new Error(`tabla no soportada ${table} ${method}`);
    }
    if (u.origin === "https://api.mercadopago.com") {
      w.mpCalls.push({ method, path: u.pathname, body, headers: init.headers });
      if (method === "POST" && u.pathname === "/preapproval") {
        if (w.mpFail) return ok({ message: "invalid" }, 400);
        const id = `mp-${w.nextMp++}`;
        w.mpPre[id] = { id, status: "pending" };
        return ok({ id, status: "pending", init_point: `https://www.mercadopago.com.ar/subscriptions/checkout?preapproval_id=${id}` }, 201);
      }
      let m = u.pathname.match(/^\/preapproval\/(.+)$/);
      if (m && method === "GET") return w.mpPre[m[1]] ? ok(w.mpPre[m[1]]) : ok({ message: "not found" }, 404);
      if (m && method === "PUT") { if (w.mpPre[m[1]]) w.mpPre[m[1]].status = body.status; return ok({ id: m[1], status: body.status }); }
      m = u.pathname.match(/^\/authorized_payments\/(.+)$/);
      if (m && method === "GET") return w.mpPayments[m[1]] ? ok(w.mpPayments[m[1]]) : ok({ message: "not found" }, 404);
    }
    throw new Error(`fetch inesperado ${method} ${url}`);
  };
  w.deps = { env: w.env, fetch: w.fetch, now: w.now };
  return w;
}

const post = (url, body, headers = {}) => new Request(url, { method: "POST", headers: { "content-type": "application/json", ...headers }, body: body === undefined ? undefined : JSON.stringify(body) });
const asUser = (body) => post(`${SUPA}/functions/v1/crear-suscripcion`, body, { authorization: "Bearer tok-user", origin: "https://lavallealquila.com.ar" });

// --------------------------------------------------------------- crear-suscripcion

test("crear-suscripcion: sin MP_ACCESS_TOKEN responde «próximamente» y no rompe", async () => {
  const { createHandler } = await load("crear-suscripcion");
  const w = makeWorld({ token: "" });
  const res = await createHandler(w.deps)(asUser({ action: "create", plan: "pro", interval: "year" }));
  assert.equal(res.status, 503);
  const body = await res.json();
  assert.equal(body.code, "proximamente");
  assert.match(body.message, /muy pronto/);
  assert.equal(w.subs.length, 0);
  assert.equal(res.headers.get("access-control-allow-origin"), "https://lavallealquila.com.ar");
});

test("crear-suscripcion: sin sesión devuelve 401 y responde el preflight CORS", async () => {
  const { createHandler } = await load("crear-suscripcion");
  const w = makeWorld();
  const handler = createHandler(w.deps);
  const res = await handler(post(`${SUPA}/functions/v1/crear-suscripcion`, { plan: "pro", interval: "month" }));
  assert.equal(res.status, 401);
  const pre = await handler(new Request(`${SUPA}/functions/v1/crear-suscripcion`, { method: "OPTIONS", headers: { origin: "https://lavallealquila.com.ar" } }));
  assert.equal(pre.status, 204);
  assert.match(pre.headers.get("access-control-allow-headers"), /authorization/);
});

test("crear-suscripcion: anual Pro = frequency 12 months, $100.000, el monto sale de la tabla de planes", async () => {
  const { createHandler } = await load("crear-suscripcion");
  const w = makeWorld();
  // El navegador intenta colar un monto: se ignora.
  const res = await createHandler(w.deps)(asUser({ action: "create", plan: "pro", interval: "year", amount: 1, transaction_amount: 1 }));
  assert.equal(res.status, 200);
  const out = await res.json();
  assert.match(out.init_point, /mercadopago/);
  const call = w.mpCalls.find((c) => c.method === "POST" && c.path === "/preapproval");
  assert.equal(call.body.auto_recurring.frequency, 12);
  assert.equal(call.body.auto_recurring.frequency_type, "months");
  assert.equal(call.body.auto_recurring.transaction_amount, 100000);
  assert.equal(call.body.auto_recurring.currency_id, "ARS");
  assert.equal(call.body.status, "pending");
  assert.equal(call.body.payer_email, "ana@example.com");
  assert.equal(call.body.notification_url, `${SUPA}/functions/v1/mp-webhook`);
  assert.equal(call.body.back_url, "https://lavallealquila.com.ar/#/suscripcion");
  assert.equal(call.body.external_reference, w.subs[0].id);
  assert.equal(call.headers["x-idempotency-key"], w.subs[0].id);
  assert.equal(call.headers.authorization, "Bearer APP_USR-test");
  assert.equal(w.subs[0].mp_preapproval_id, "mp-1");
  assert.equal(w.subs[0].amount_ars, 100000);
  assert.equal(w.subs[0].status, "pending");
});

test("crear-suscripcion: mensual Plus = frequency 1, $6.900; reusa el link si vuelve a tocar", async () => {
  const { createHandler } = await load("crear-suscripcion");
  const w = makeWorld();
  const handler = createHandler(w.deps);
  const a = await (await handler(asUser({ plan: "plus", interval: "month" }))).json();
  const call = w.mpCalls.find((c) => c.path === "/preapproval");
  assert.equal(call.body.auto_recurring.frequency, 1);
  assert.equal(call.body.auto_recurring.transaction_amount, 6900);
  const b = await (await handler(asUser({ plan: "plus", interval: "month" }))).json();
  assert.equal(b.init_point, a.init_point);
  assert.equal(b.reused, true);
  assert.equal(w.mpCalls.filter((c) => c.path === "/preapproval").length, 1);
});

test("crear-suscripcion: rechaza planes o períodos raros y el plan Gratis", async () => {
  const { createHandler } = await load("crear-suscripcion");
  const w = makeWorld();
  const handler = createHandler(w.deps);
  for (const bad of [{ plan: "free", interval: "month" }, { plan: "pro", interval: "week" }, { plan: "gold", interval: "year" }, {}]) {
    const res = await handler(asUser({ action: "create", ...bad }));
    assert.equal(res.status, 400, JSON.stringify(bad));
  }
  assert.equal(w.mpCalls.length, 0);
});

test("crear-suscripcion: rechaza Plus anual (solo el Pro tiene anual), también si la tabla trae un precio anual", async () => {
  const { createHandler } = await load("crear-suscripcion");
  for (const yearPrice of [0, 49000]) {
    const w = makeWorld();
    w.plans.plus.price_year_ars = yearPrice;
    const res = await createHandler(w.deps)(asUser({ action: "create", plan: "plus", interval: "year" }));
    assert.equal(res.status, 400, `price_year=${yearPrice}`);
    assert.equal((await res.json()).code, "sin_anual");
    assert.equal(w.mpCalls.length, 0);
    assert.equal(w.subs.length, 0);
  }
  const w = makeWorld();
  const ok = await createHandler(w.deps)(asUser({ action: "create", plan: "plus", interval: "month" }));
  assert.equal(ok.status, 200);
});

test("crear-suscripcion: si Mercado Pago falla, no deja una fila colgada y el mensaje es amable", async () => {
  const { createHandler } = await load("crear-suscripcion");
  const w = makeWorld();
  w.mpFail = true;
  const res = await createHandler(w.deps)(asUser({ plan: "pro", interval: "month" }));
  assert.equal(res.status, 502);
  const body = await res.json();
  assert.equal(body.code, "mp_error");
  assert.equal(w.subs.length, 0);
});

test("crear-suscripcion: ya tiene ese plan activo → 409", async () => {
  const { createHandler } = await load("crear-suscripcion");
  const w = makeWorld();
  w.subs.push({ id: "s0", n: 0, user_id: USER, plan_id: "pro", billing_interval: "month", status: "authorized", access_until: "2027-01-01T00:00:00Z", created_at: "2026-11-01T00:00:00Z", mp_preapproval_id: "mp-0" });
  const res = await createHandler(w.deps)(asUser({ plan: "pro", interval: "month" }));
  assert.equal(res.status, 409);
});

test("crear-suscripcion: cancelar pone cancelled en Mercado Pago y en la tabla, y el plan sigue hasta access_until", async () => {
  const { createHandler } = await load("crear-suscripcion");
  const w = makeWorld();
  w.mpPre["mp-0"] = { id: "mp-0", status: "authorized" };
  w.subs.push({ id: "s0", n: 0, user_id: USER, plan_id: "pro", billing_interval: "month", status: "authorized", access_until: "2027-01-01T00:00:00Z", created_at: "2026-11-01T00:00:00Z", mp_preapproval_id: "mp-0" });
  const res = await createHandler(w.deps)(asUser({ action: "cancel" }));
  assert.equal(res.status, 200);
  assert.equal(w.mpPre["mp-0"].status, "cancelled");
  assert.equal(w.subs[0].status, "cancelled");
  assert.ok(w.subs[0].cancelled_at);
  assert.equal(w.subs[0].access_until, "2027-01-01T00:00:00Z");
  assert.equal(w.rpcs.length, 0, "cancelar no baja el plan: eso lo hace el vencimiento");
  const again = await createHandler(w.deps)(asUser({ action: "cancel" }));
  assert.equal(again.status, 404);
});

// ------------------------------------------------------------------ mp-webhook

const hook = (body, query = "") => post(`${SUPA}/functions/v1/mp-webhook${query}`, body);

function pendingSub(w, extra = {}) {
  w.mpPre["mp-1"] = { id: "mp-1", status: "pending" };
  w.subs.push({ id: "s1", n: 1, user_id: USER, plan_id: "pro", billing_interval: "year", amount_ars: 100000, status: "pending", access_until: null, created_at: "2026-12-01T11:00:00Z", mp_preapproval_id: "mp-1", ...extra });
}

test("mp-webhook: sin token responde «próximamente» (no rompe)", async () => {
  const { createHandler } = await load("mp-webhook");
  const w = makeWorld({ token: "" });
  const res = await createHandler(w.deps)(hook({ type: "subscription_preapproval", data: { id: "mp-1" } }));
  assert.equal(res.status, 503);
});

test("mp-webhook: al autorizarse, activa el plan una sola vez por cambio y fija el acceso (+3 días de gracia)", async () => {
  const { createHandler } = await load("mp-webhook");
  const w = makeWorld();
  pendingSub(w);
  w.mpPre["mp-1"] = { id: "mp-1", status: "authorized", next_payment_date: "2027-12-01T12:00:00.000Z", summarized: { last_charged_date: "2026-12-01T12:00:00.000Z" } };
  const res = await createHandler(w.deps)(hook({ type: "subscription_preapproval", action: "updated", data: { id: "mp-1" } }));
  assert.equal(res.status, 200);
  assert.equal(w.subs[0].status, "authorized");
  assert.equal(w.subs[0].access_until, "2027-12-04T12:00:00.000Z");
  assert.equal(w.subs[0].mp_status, "authorized");
  const act = w.rpcs.filter((r) => r.name === "activar_plan");
  assert.equal(act.length, 1);
  assert.deepEqual(act[0].args, { p_user: USER, p_plan: "pro" });
  assert.ok(w.rpcs.some((r) => r.name === "vencer_suscripciones"));
});

test("mp-webhook: el aviso viejo no puede achicar el acceso ya ganado", async () => {
  const { accessUntilFrom } = await load("mp-webhook");
  const sub = { billing_interval: "month", access_until: "2027-03-10T00:00:00.000Z" };
  assert.equal(accessUntilFrom({ next_payment_date: "2027-01-01T00:00:00.000Z" }, sub, NOW), "2027-03-10T00:00:00.000Z");
  assert.equal(accessUntilFrom({ next_payment_date: "2027-05-01T00:00:00.000Z" }, sub, NOW), "2027-05-04T00:00:00.000Z");
  const noNext = accessUntilFrom({}, { billing_interval: "year", access_until: null }, NOW);
  assert.equal(noNext, "2027-12-04T12:00:00.000Z");
});

test("mp-webhook: ids que no son nuestros se ignoran (200) y no se toca nada", async () => {
  const { createHandler } = await load("mp-webhook");
  const w = makeWorld();
  pendingSub(w);
  const res = await createHandler(w.deps)(hook({ type: "subscription_preapproval", data: { id: "mp-999" } }));
  assert.equal(res.status, 200);
  assert.equal((await res.json()).ignored, true);
  assert.equal(w.rpcs.length, 0);
  const junk = await createHandler(w.deps)(hook({ type: "payment", data: { id: "123" } }));
  assert.equal((await junk.json()).ignored, true);
});

test("mp-webhook: el estado sale de Mercado Pago, no de lo que diga el aviso", async () => {
  const { createHandler } = await load("mp-webhook");
  const w = makeWorld();
  pendingSub(w); // en Mercado Pago sigue pendiente
  const res = await createHandler(w.deps)(hook({ type: "subscription_preapproval", status: "authorized", data: { id: "mp-1", status: "authorized" } }));
  assert.equal(res.status, 200);
  assert.equal(w.subs[0].status, "pending");
  assert.equal(w.rpcs.filter((r) => r.name === "activar_plan").length, 0);
});

test("mp-webhook: al cambiar de plan se cancela la suscripción anterior sin avisar como si fuera una baja", async () => {
  const { createHandler } = await load("mp-webhook");
  const w = makeWorld();
  w.mpPre["mp-old"] = { id: "mp-old", status: "authorized" };
  w.subs.push({ id: "s0", n: 0, user_id: USER, plan_id: "plus", billing_interval: "month", status: "authorized", access_until: "2027-01-01T00:00:00Z", created_at: "2026-11-01T00:00:00Z", mp_preapproval_id: "mp-old" });
  pendingSub(w);
  w.mpPre["mp-1"] = { id: "mp-1", status: "authorized", next_payment_date: "2027-12-01T12:00:00.000Z" };
  await createHandler(w.deps)(hook({ type: "subscription_preapproval", data: { id: "mp-1" } }));
  assert.equal(w.mpPre["mp-old"].status, "cancelled");
  assert.equal(w.subs.find((s) => s.id === "s0").status, "expired");
  assert.equal(w.subs.find((s) => s.id === "s1").status, "authorized");
});

test("mp-webhook: un cobro rechazado marca payment_failed_at una sola vez por cobro", async () => {
  const { createHandler } = await load("mp-webhook");
  const w = makeWorld();
  pendingSub(w, { status: "authorized", access_until: "2027-01-04T00:00:00.000Z" });
  w.mpPre["mp-1"] = { id: "mp-1", status: "authorized", next_payment_date: "2027-01-01T00:00:00.000Z" };
  w.mpPayments["900"] = { id: 900, preapproval_id: "mp-1", status: "recycling", payment: { id: 1, status: "rejected" } };
  const send = () => createHandler(w.deps)(hook({ type: "subscription_authorized_payment", data: { id: "900" } }));
  assert.equal((await send()).status, 200);
  assert.ok(w.subs[0].payment_failed_at);
  assert.equal(w.subs[0].last_failed_payment_id, "900");
  const first = w.subs[0].payment_failed_at;
  w.subs[0].payment_failed_at = "marca";
  await send();
  assert.equal(w.subs[0].payment_failed_at, "marca", "el mismo cobro no vuelve a disparar el mail");
  assert.notEqual(first, "marca");
});

test("mp-webhook: un cobro aprobado actualiza last_paid_at y extiende el acceso", async () => {
  const { createHandler } = await load("mp-webhook");
  const w = makeWorld();
  pendingSub(w, { status: "authorized", access_until: "2027-01-04T00:00:00.000Z", payment_failed_at: "2026-12-20T00:00:00.000Z" });
  w.mpPre["mp-1"] = { id: "mp-1", status: "authorized", next_payment_date: "2027-02-01T00:00:00.000Z" };
  w.mpPayments["901"] = { id: 901, preapproval_id: "mp-1", status: "processed", payment: { id: 2, status: "approved" } };
  await createHandler(w.deps)(hook({ type: "subscription_authorized_payment", data: { id: "901" } }));
  assert.equal(w.subs[0].access_until, "2027-02-04T00:00:00.000Z");
  assert.equal(w.subs[0].last_paid_at, NOW.toISOString());
});

test("mp-webhook: si Mercado Pago cancela, queda cancelled (el plan sigue hasta el vencimiento) y no se baja de golpe", async () => {
  const { createHandler } = await load("mp-webhook");
  const w = makeWorld();
  pendingSub(w, { status: "authorized", access_until: "2027-01-04T00:00:00.000Z" });
  w.mpPre["mp-1"] = { id: "mp-1", status: "cancelled" };
  await createHandler(w.deps)(hook({ type: "subscription_preapproval", data: { id: "mp-1" } }));
  assert.equal(w.subs[0].status, "cancelled");
  assert.ok(w.subs[0].cancelled_at);
  assert.equal(w.rpcs.filter((r) => r.name === "activar_plan").length, 0);
});

test("mp-webhook: un pago abandonado (cancelado antes de pagar) pasa a expired", async () => {
  const { createHandler } = await load("mp-webhook");
  const w = makeWorld();
  pendingSub(w);
  w.mpPre["mp-1"] = { id: "mp-1", status: "cancelled" };
  await createHandler(w.deps)(hook({ type: "subscription_preapproval", data: { id: "mp-1" } }));
  assert.equal(w.subs[0].status, "expired");
});

test("mp-webhook: sync con sesión del usuario ajusta su suscripción; sin sesión da 401", async () => {
  const { createHandler } = await load("mp-webhook");
  const w = makeWorld();
  pendingSub(w);
  w.mpPre["mp-1"] = { id: "mp-1", status: "authorized", next_payment_date: "2027-12-01T12:00:00.000Z" };
  const handler = createHandler(w.deps);
  const denied = await handler(hook({ action: "sync" }));
  assert.equal(denied.status, 401);
  const res = await handler(post(`${SUPA}/functions/v1/mp-webhook`, { action: "sync" }, { authorization: "Bearer tok-user" }));
  assert.equal(res.status, 200);
  assert.equal(w.subs[0].status, "authorized");
  assert.equal(w.rpcs.filter((r) => r.name === "activar_plan").length, 1);
});

test("mp-webhook: lee avisos tipo IPN por query y valida la firma opcional", async () => {
  const { parseNotification, verifySignatureInput, createHandler } = await load("mp-webhook");
  assert.deepEqual(parseNotification(`${SUPA}/x?topic=preapproval&id=abc`, null), { topic: "preapproval", id: "abc" });
  assert.deepEqual(parseNotification(`${SUPA}/x?data.id=zz`, { type: "subscription_authorized_payment" }), { topic: "authorized_payment", id: "zz" });
  assert.equal(parseNotification(`${SUPA}/x`, { type: "subscription_preapproval_plan", data: { id: "1" } }).topic, "");
  const headers = new Headers({ "x-signature": "ts=111,v1=abc", "x-request-id": "req-1" });
  assert.equal(verifySignatureInput(`${SUPA}/x?data.id=ABC123`, headers).manifest, "id:abc123;request-id:req-1;ts:111;");

  const w = makeWorld({ env: { MP_WEBHOOK_SECRET: "shh" } });
  pendingSub(w);
  w.mpPre["mp-1"] = { id: "mp-1", status: "authorized", next_payment_date: "2027-12-01T12:00:00.000Z" };
  const bad = await createHandler(w.deps)(hook({ type: "subscription_preapproval", data: { id: "mp-1" } }, "?data.id=mp-1"));
  assert.equal(bad.status, 401);
  const crypto = await import("node:crypto");
  const manifest = "id:mp-1;request-id:r1;ts:123;";
  const v1 = crypto.createHmac("sha256", "shh").update(manifest).digest("hex");
  const good = await createHandler(w.deps)(post(`${SUPA}/functions/v1/mp-webhook?data.id=mp-1`, { type: "subscription_preapproval", data: { id: "mp-1" } }, { "x-signature": `ts=123,v1=${v1}`, "x-request-id": "r1" }));
  assert.equal(good.status, 200);
  assert.equal(w.subs[0].status, "authorized");
});

test("mp-webhook: si Mercado Pago o la base fallan responde 500 para que Mercado Pago reintente", async () => {
  const { createHandler } = await load("mp-webhook");
  const w = makeWorld();
  pendingSub(w);
  delete w.mpPre["mp-1"]; // GET /preapproval/mp-1 → 404
  const res = await createHandler(w.deps)(hook({ type: "subscription_preapproval", data: { id: "mp-1" } }));
  assert.equal(res.status, 500);
});
