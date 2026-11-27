// @ts-nocheck
// Edge Function «mp-webhook» de Lavalle Alquila.
//  1) Mercado Pago le avisa acá de cada cambio de una suscripción o de un cobro
//     (el aviso trae solo un id; el estado real se vuelve a pedir a la API de Mercado Pago).
//  2) La página la llama con la sesión del usuario ({action:"sync"}) al abrir
//     «Mi suscripción», por si algún aviso no llegó.
// Efectos: actualiza public.subscriptions y llama a public.activar_plan. Los mails los
// mandan los triggers de la base (enviar-mail).
// Secrets: MP_ACCESS_TOKEN. Opcional: MP_WEBHOOK_SECRET (firma x-signature de Mercado Pago).
// SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY los inyecta Supabase solo.
// Desplegar SIN verificación de JWT (Mercado Pago no manda JWT).
//
// Seguridad: solo se actúa sobre ids que ya existen en nuestra tabla, y el estado se lee
// de la API de Mercado Pago con nuestro token; lo que traiga el aviso no se usa.

const MP = "https://api.mercadopago.com";
const GRACE_DAYS = 3; // mismo número que supabase/migration-suscripciones.sql y src/plans.js
const DAY = 86400000;

function json(body, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
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
    patch: (path, row) => call("PATCH", path, row, "return=representation"),
    rpc: (name, args) => call("POST", `rpc/${name}`, args || {}),
  };
}

async function mpGet(deps, token, path) {
  const res = await deps.fetch(`${MP}${path}`, { headers: { authorization: `Bearer ${token}` } });
  const text = await res.text();
  if (!res.ok) throw new Error(`Mercado Pago GET ${path} ${res.status}: ${text.slice(0, 300)}`);
  return text ? JSON.parse(text) : null;
}

async function mpCancel(deps, token, id) {
  const res = await deps.fetch(`${MP}/preapproval/${encodeURIComponent(id)}`, {
    method: "PUT",
    headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
    body: JSON.stringify({ status: "cancelled" }),
  });
  if (!res.ok) console.error("No se pudo cancelar la suscripción anterior", id, res.status);
}

// ---- pura: qué trae el aviso de Mercado Pago (webhook JSON o IPN por query)
export function parseNotification(url, body) {
  const q = new URL(url).searchParams;
  const raw = String(body?.type || body?.topic || q.get("type") || q.get("topic") || "");
  const id = String(body?.data?.id || q.get("data.id") || q.get("id") || "");
  let topic = "";
  if (/preapproval/i.test(raw) && !/plan/i.test(raw)) topic = "preapproval";
  else if (/authorized_payment/i.test(raw)) topic = "authorized_payment";
  return { topic, id };
}

// ---- pura: fecha hasta la que el plan sigue vigente (próximo cobro + gracia)
export function accessUntilFrom(pre, sub, now) {
  const next = pre?.next_payment_date ? new Date(pre.next_payment_date).getTime() : NaN;
  let base = next;
  if (!Number.isFinite(base)) {
    // Sin fecha de próximo cobro: un período desde ahora.
    const d = new Date(now);
    if (sub.billing_interval === "year") d.setUTCFullYear(d.getUTCFullYear() + 1);
    else d.setUTCMonth(d.getUTCMonth() + 1);
    base = d.getTime();
  }
  let until = base + GRACE_DAYS * DAY;
  const current = sub.access_until ? new Date(sub.access_until).getTime() : 0;
  if (current > until) until = current; // nunca se achica por un aviso viejo
  return new Date(until).toISOString();
}

// ---- pura: de un preapproval de Mercado Pago a los cambios en nuestra fila
export function planChanges(sub, pre, now) {
  const patch = {};
  const nowIso = new Date(now).toISOString();
  const mpStatus = String(pre?.status || "");
  patch.mp_status = mpStatus;
  if (pre?.next_payment_date) patch.next_payment_at = new Date(pre.next_payment_date).toISOString();
  const charged = pre?.summarized?.last_charged_date;
  if (charged) patch.last_paid_at = new Date(charged).toISOString();
  let activate = false;
  if (sub.status === "expired") return { patch: {}, activate: false };
  if (mpStatus === "authorized") {
    patch.status = "authorized";
    patch.access_until = accessUntilFrom(pre, sub, now);
    if (!charged && !sub.last_paid_at) patch.last_paid_at = nowIso;
    activate = true;
  } else if (mpStatus === "paused") {
    patch.status = "paused";
  } else if (mpStatus === "cancelled") {
    if (sub.status === "pending") {
      patch.status = "expired"; // abandonó el pago: no hay nada que avisar
      patch.ended_at = nowIso;
    } else if (sub.status !== "cancelled") {
      patch.status = "cancelled";
      patch.cancelled_at = nowIso;
    }
  }
  return { patch, activate };
}

// ---- pura: qué pasó con un cobro (authorized_payment)
export function paymentOutcome(ap) {
  const status = String(ap?.status || "");
  const payStatus = String(ap?.payment?.status || "");
  if (payStatus === "approved" || (status === "processed" && payStatus !== "rejected")) return "paid";
  if (status === "recycling" || payStatus === "rejected" || payStatus === "cancelled") return "failed";
  return "other";
}

export function verifySignatureInput(url, headers) {
  const sig = headers.get("x-signature") || "";
  const requestId = headers.get("x-request-id") || "";
  const parts = Object.fromEntries(sig.split(",").map((p) => p.trim().split("=", 2)));
  let dataId = new URL(url).searchParams.get("data.id") || "";
  if (/^[a-z0-9]+$/i.test(dataId)) dataId = dataId.toLowerCase();
  return { ts: parts.ts || "", v1: parts.v1 || "", manifest: `id:${dataId};request-id:${requestId};ts:${parts.ts || ""};` };
}

async function hmacHex(secret, text) {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const bytes = new Uint8Array(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(text)));
  return [...bytes].map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function currentUser(deps, req) {
  const token = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
  if (!token) return null;
  const res = await deps.fetch(`${deps.env("SUPABASE_URL")}/auth/v1/user`, {
    headers: { apikey: deps.env("SUPABASE_SERVICE_ROLE_KEY") || "", authorization: `Bearer ${token}` },
  });
  if (!res.ok) return null;
  const user = await res.json();
  return user && user.id ? { id: user.id } : null;
}

// Aplica lo que dice Mercado Pago sobre una suscripción nuestra.
async function reconcile(deps, db, token, sub, now, extra = {}) {
  const pre = await mpGet(deps, token, `/preapproval/${encodeURIComponent(sub.mp_preapproval_id)}`);
  const { patch, activate } = planChanges(sub, pre, now);
  Object.assign(patch, extra);
  let updated = sub;
  if (Object.keys(patch).length) {
    const rows = await db.patch(`subscriptions?id=eq.${sub.id}`, patch);
    updated = (rows && rows[0]) || { ...sub, ...patch };
  }
  if (activate) {
    // Si había otra suscripción vigente del mismo usuario, se da de baja (cambio de plan).
    const others = await db.get(`subscriptions?user_id=eq.${sub.user_id}&id=neq.${sub.id}&status=in.(authorized,paused,pending)&mp_preapproval_id=not.is.null&select=id,mp_preapproval_id,status`);
    for (const other of others || []) {
      if (other.status !== "pending") await mpCancel(deps, token, other.mp_preapproval_id);
      await db.patch(`subscriptions?id=eq.${other.id}`, { status: "expired", ended_at: new Date(now).toISOString() });
    }
    await db.rpc("activar_plan", { p_user: sub.user_id, p_plan: sub.plan_id });
  }
  return { status: updated.status, activated: activate };
}

async function handleNotification(deps, req, token, now) {
  let body = null;
  try { body = await req.json(); } catch { /* IPN sin cuerpo */ }
  const secret = deps.env("MP_WEBHOOK_SECRET");
  if (secret) {
    const { ts, v1, manifest } = verifySignatureInput(req.url, req.headers);
    if (!ts || !v1 || (await hmacHex(secret, manifest)) !== v1) return json({ error: "firma inválida" }, 401);
  }
  const { topic, id } = parseNotification(req.url, body);
  if (!topic || !id) return json({ ignored: true });
  const db = rest(deps);

  let preapprovalId = id;
  let extra = {};
  let paymentSub = null;
  if (topic === "authorized_payment") {
    const ap = await mpGet(deps, token, `/authorized_payments/${encodeURIComponent(id)}`);
    preapprovalId = String(ap?.preapproval_id || "");
    if (!preapprovalId) return json({ ignored: true });
    const found = await db.get(`subscriptions?mp_preapproval_id=eq.${encodeURIComponent(preapprovalId)}&select=*`);
    paymentSub = found && found[0];
    if (!paymentSub) return json({ ignored: true });
    const outcome = paymentOutcome(ap);
    if (outcome === "paid") extra = { last_paid_at: new Date(now).toISOString() };
    if (outcome === "failed" && String(paymentSub.last_failed_payment_id || "") !== String(ap.id)) {
      extra = { payment_failed_at: new Date(now).toISOString(), last_failed_payment_id: String(ap.id) };
    }
  }

  const found = paymentSub ? [paymentSub] : await db.get(`subscriptions?mp_preapproval_id=eq.${encodeURIComponent(preapprovalId)}&select=*`);
  const sub = found && found[0];
  if (!sub) return json({ ignored: true });
  const result = await reconcile(deps, db, token, sub, now, extra);
  await db.rpc("vencer_suscripciones").catch((e) => console.error("vencer", e.message));
  return json({ ok: true, ...result });
}

async function handleSync(deps, req, token, now) {
  const user = await currentUser(deps, req);
  if (!user) return json({ code: "sin_sesion" }, 401);
  const db = rest(deps);
  const mine = await db.get(`subscriptions?user_id=eq.${user.id}&status=in.(pending,authorized,paused,cancelled)&mp_preapproval_id=not.is.null&select=*&order=created_at.desc&limit=1`);
  const sub = mine && mine[0];
  let result = { ok: true, none: true };
  if (sub) result = { ok: true, ...(await reconcile(deps, db, token, sub, now)) };
  await db.rpc("vencer_suscripciones").catch((e) => console.error("vencer", e.message));
  return json(result);
}

export function createHandler(deps) {
  return async (req) => {
    if (req.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: {
        "access-control-allow-origin": "https://lavallealquila.com.ar",
        "access-control-allow-headers": "authorization, x-client-info, apikey, content-type",
        "access-control-allow-methods": "POST, OPTIONS",
      } });
    }
    const cors = { "access-control-allow-origin": "https://lavallealquila.com.ar" };
    const withCors = (res) => { for (const [k, v] of Object.entries(cors)) res.headers.set(k, v); return res; };
    if (req.method !== "POST" && req.method !== "GET") return json({ error: "método" }, 405);
    const token = deps.env("MP_ACCESS_TOKEN");
    if (!token) return withCors(json({ code: "proximamente", message: "Los pagos todavía no están habilitados." }, 503));
    try {
      const now = deps.now();
      let isSync = false;
      if (req.method === "POST") {
        const peek = await req.clone().json().catch(() => null);
        isSync = peek && peek.action === "sync";
      }
      return withCors(isSync ? await handleSync(deps, req, token, now) : await handleNotification(deps, req, token, now));
    } catch (error) {
      console.error("mp-webhook", error && error.message ? error.message : error);
      return withCors(json({ error: "error interno" }, 500)); // Mercado Pago reintenta
    }
  };
}

if (typeof Deno !== "undefined" && Deno.serve) {
  Deno.serve(createHandler({ env: (k) => Deno.env.get(k), fetch: (...a) => fetch(...a), now: () => new Date() }));
}
