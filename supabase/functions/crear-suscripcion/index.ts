// @ts-nocheck
// Edge Function «crear-suscripcion» de Lavalle Alquila.
// La llama la página (con la sesión del usuario) para:
//   {action:"create", plan:"plus"|"pro", interval:"month"|"year"}  → devuelve {init_point} de Mercado Pago
//   {action:"cancel"}                                              → cancela la suscripción vigente
// Secrets necesarios: MP_ACCESS_TOKEN (Mercado Pago, credencial de producción).
// Opcional, solo para probar en sandbox: MP_TEST_PAYER_EMAIL (email del comprador de prueba,
// test_user_<n>@testuser.com). En sandbox Mercado Pago exige que pagador y vendedor sean ambos
// usuarios de prueba («Both payer and collector must be real or test users»), así que si el
// vendedor del token es de prueba se manda ese email en vez del de la cuenta real del usuario.
// SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY los inyecta Supabase solo.
// Desplegar SIN verificación de JWT: la función valida la sesión por su cuenta.
//
// Sin MP_ACCESS_TOKEN responde 503 con code "proximamente" y la página muestra un
// mensaje amable. No usa librerías: solo fetch, así el mismo archivo se prueba con node.

const YEARLY_PLANS = ["pro"]; // los únicos planes con precio anual
const SITE = "https://lavallealquila.com.ar";
const MP = "https://api.mercadopago.com";
const ORIGINS = [SITE, "http://localhost:5173", "http://localhost:4173", "http://127.0.0.1:4173"];
const PLAN_NAMES = { plus: "Plus", pro: "Pro" };
// Comprador de prueba de Mercado Pago (TESTUSER2612355665340004312). No es un dato sensible:
// solo sirve en sandbox y se puede pisar con el secret MP_TEST_PAYER_EMAIL.
const DEFAULT_TEST_PAYER = "test_user_2612355665340004312@testuser.com";

// ¿El token es de un vendedor de prueba? Las credenciales de un usuario de prueba empiezan con
// APP_USR- igual que las reales, así que se pregunta a /users/me (una vez por instancia).
const sandboxCache = new Map();
async function isSandbox(deps, token) {
  if (/^TEST-/.test(token)) return true;
  if (String(deps.env("MP_SANDBOX") || "").toLowerCase() === "true") return true;
  if (sandboxCache.has(token)) return sandboxCache.get(token);
  let test = false;
  try {
    const me = await mp(deps, token, "GET", "/users/me");
    const d = (me.ok && me.data) || {};
    test = /^TESTUSER/i.test(String(d.nickname || "")) || /@testuser\.com$/i.test(String(d.email || ""));
    if (me.ok) sandboxCache.set(token, test);
  } catch (e) {
    console.error("No se pudo consultar /users/me de Mercado Pago", e && e.message ? e.message : e);
  }
  return test;
}

async function payerEmailFor(deps, token, userEmail) {
  if (!(await isSandbox(deps, token))) return userEmail;
  const testEmail = String(deps.env("MP_TEST_PAYER_EMAIL") || "").trim() || DEFAULT_TEST_PAYER;
  console.log("Mercado Pago en modo prueba: payer_email =", testEmail);
  return testEmail;
}

function corsHeaders(req) {
  const origin = req.headers.get("origin") || "";
  return {
    "access-control-allow-origin": ORIGINS.includes(origin) ? origin : SITE,
    "access-control-allow-headers": "authorization, x-client-info, apikey, content-type",
    "access-control-allow-methods": "POST, OPTIONS",
    vary: "origin",
  };
}

function reply(req, body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", ...corsHeaders(req) },
  });
}

function rest(deps) {
  const base = `${deps.env("SUPABASE_URL")}/rest/v1`;
  const key = deps.env("SUPABASE_SERVICE_ROLE_KEY") || "";
  const headers = { apikey: key, authorization: `Bearer ${key}`, "content-type": "application/json" };
  async function call(method, path, body, prefer) {
    const res = await deps.fetch(`${base}/${path}`, {
      method,
      headers: prefer ? { ...headers, prefer } : headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const text = await res.text();
    if (!res.ok) throw new Error(`PostgREST ${method} ${path.split("?")[0]} ${res.status}: ${text.slice(0, 300)}`);
    return text ? JSON.parse(text) : null;
  }
  return {
    get: (path) => call("GET", path),
    insert: (table, row) => call("POST", table, row, "return=representation"),
    patch: (path, row) => call("PATCH", path, row, "return=representation"),
    remove: (path) => call("DELETE", path),
  };
}

// Quién llama: se valida el token de sesión contra Supabase Auth.
async function currentUser(deps, req) {
  const auth = req.headers.get("authorization") || "";
  const token = auth.replace(/^Bearer\s+/i, "");
  if (!token) return null;
  const key = deps.env("SUPABASE_SERVICE_ROLE_KEY") || "";
  const res = await deps.fetch(`${deps.env("SUPABASE_URL")}/auth/v1/user`, {
    headers: { apikey: key, authorization: `Bearer ${token}` },
  });
  if (!res.ok) return null;
  const user = await res.json();
  return user && user.id ? { id: user.id, email: user.email || "" } : null;
}

async function mp(deps, token, method, path, body, idempotencyKey) {
  const headers = { authorization: `Bearer ${token}`, "content-type": "application/json" };
  if (idempotencyKey) headers["x-idempotency-key"] = idempotencyKey;
  const res = await deps.fetch(`${MP}${path}`, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
  const text = await res.text();
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch { data = { raw: text.slice(0, 300) }; }
  return { ok: res.ok, status: res.status, data };
}

const COMING_SOON = {
  code: "proximamente",
  message: "Los pagos se habilitan muy pronto. Todavía no se cobra nada.",
};

export function buildPreapproval({ sub, plan, interval, amount, email, supabaseUrl }) {
  const label = interval === "year" ? "anual" : "mensual";
  return {
    reason: `Lavalle Alquila · Plan ${PLAN_NAMES[plan] || plan} (${label})`,
    external_reference: sub.id,
    payer_email: email,
    auto_recurring: {
      frequency: interval === "year" ? 12 : 1,
      frequency_type: "months",
      transaction_amount: amount,
      currency_id: "ARS",
    },
    back_url: `${SITE}/#/suscripcion`,
    notification_url: `${supabaseUrl}/functions/v1/mp-webhook`,
    status: "pending",
  };
}

async function createSubscription(deps, req, user, input, token) {
  const plan = String(input.plan || "");
  const interval = String(input.interval || "");
  if (!["plus", "pro"].includes(plan) || !["month", "year"].includes(interval)) {
    return reply(req, { code: "datos", message: "Elegí un plan y si lo pagás por mes o por año." }, 400);
  }
  // Solo el Pro tiene pago anual (decisión de Ignacio). Se rechaza acá aunque la tabla plans diga otra cosa.
  if (interval === "year" && !YEARLY_PLANS.includes(plan)) {
    return reply(req, { code: "sin_anual", message: "Este plan se paga solo por mes. El pago anual es del plan Pro." }, 400);
  }
  const db = rest(deps);
  const plans = await db.get(`plans?id=eq.${plan}&select=id,name,price_month_ars,price_year_ars`);
  const row = plans && plans[0];
  const amount = row ? (interval === "year" ? row.price_year_ars : row.price_month_ars) : 0;
  if (interval === "year" && !(Number(row && row.price_year_ars) > 0)) {
    return reply(req, { code: "sin_anual", message: "Este plan se paga solo por mes. El pago anual es del plan Pro." }, 400);
  }
  if (!amount) return reply(req, { code: "sin_plan", message: "Ese plan todavía no está disponible." }, 500);

  const now = deps.now();
  const mine = await db.get(`subscriptions?user_id=eq.${user.id}&status=in.(pending,authorized,paused,cancelled)&select=*&order=created_at.desc`);
  const same = (mine || []).find((s) => s.plan_id === plan && s.billing_interval === interval);
  if (same && same.status === "authorized" && same.access_until && new Date(same.access_until) > now) {
    return reply(req, { code: "ya_suscripto", message: "Ya tenés ese plan activo." }, 409);
  }
  // Un intento reciente sin terminar de pagar: se reusa el mismo link.
  if (same && same.status === "pending" && same.init_point && now - new Date(same.created_at) < 3600000) {
    return reply(req, { init_point: same.init_point, subscription_id: same.id, reused: true });
  }

  const inserted = await db.insert("subscriptions", {
    user_id: user.id,
    plan_id: plan,
    billing_interval: interval,
    amount_ars: amount,
    status: "pending",
  });
  const sub = inserted[0];
  const email = await payerEmailFor(deps, token, user.email);
  const body = buildPreapproval({ sub, plan, interval, amount, email, supabaseUrl: deps.env("SUPABASE_URL") });
  const made = await mp(deps, token, "POST", "/preapproval", body, sub.id);
  if (!made.ok || !made.data || !made.data.init_point) {
    console.error("Mercado Pago no creó la suscripción", made.status, JSON.stringify(made.data).slice(0, 1000), "body enviado:", JSON.stringify(body));
    await db.remove(`subscriptions?id=eq.${sub.id}`).catch(() => {});
    return reply(req, { code: "mp_error", message: "No pudimos abrir el pago. Probá de nuevo en un rato." }, 502);
  }
  await db.patch(`subscriptions?id=eq.${sub.id}`, {
    mp_preapproval_id: made.data.id,
    mp_status: made.data.status || "pending",
    init_point: made.data.init_point,
  });
  return reply(req, { init_point: made.data.init_point, subscription_id: sub.id });
}

async function cancelSubscription(deps, req, user, token) {
  const db = rest(deps);
  const mine = await db.get(`subscriptions?user_id=eq.${user.id}&status=in.(authorized,paused)&select=*&order=created_at.desc&limit=1`);
  const sub = mine && mine[0];
  if (!sub || !sub.mp_preapproval_id) {
    return reply(req, { code: "sin_suscripcion", message: "No tenés una suscripción para cancelar." }, 404);
  }
  const res = await mp(deps, token, "PUT", `/preapproval/${encodeURIComponent(sub.mp_preapproval_id)}`, { status: "cancelled" });
  const already = res.data && /cancel/i.test(JSON.stringify(res.data));
  if (!res.ok && !already) {
    console.error("Mercado Pago no canceló", res.status, JSON.stringify(res.data).slice(0, 500));
    return reply(req, { code: "mp_error", message: "No pudimos cancelar ahora. Probá de nuevo en un rato." }, 502);
  }
  await db.patch(`subscriptions?id=eq.${sub.id}`, {
    status: "cancelled",
    mp_status: "cancelled",
    cancelled_at: deps.now().toISOString(),
  });
  return reply(req, { ok: true, access_until: sub.access_until });
}

export function createHandler(deps) {
  return async (req) => {
    if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders(req) });
    if (req.method !== "POST") return reply(req, { code: "metodo", message: "Método no permitido" }, 405);
    try {
      const user = await currentUser(deps, req);
      if (!user) return reply(req, { code: "sin_sesion", message: "Entrá a tu cuenta para suscribirte." }, 401);
      let input = {};
      try { input = await req.json(); } catch { /* cuerpo vacío */ }
      const token = deps.env("MP_ACCESS_TOKEN");
      if (!token) return reply(req, COMING_SOON, 503);
      const action = String(input.action || "create");
      if (action === "create") return await createSubscription(deps, req, user, input, token);
      if (action === "cancel") return await cancelSubscription(deps, req, user, token);
      return reply(req, { code: "accion", message: "Acción desconocida" }, 400);
    } catch (error) {
      console.error("crear-suscripcion", error && error.message ? error.message : error);
      return reply(req, { code: "error", message: "Algo salió mal de nuestro lado. Probá de nuevo en un rato." }, 500);
    }
  };
}

// En Supabase existe Deno; en las pruebas con node no.
if (typeof Deno !== "undefined" && Deno.serve) {
  Deno.serve(createHandler({ env: (k) => Deno.env.get(k), fetch: (...a) => fetch(...a), now: () => new Date() }));
}
