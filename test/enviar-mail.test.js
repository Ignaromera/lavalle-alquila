import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { pathToFileURL } from "node:url";
import { transformSync } from "esbuild";

// Se carga la Edge Function real (TypeScript) con un Deno, un Supabase y un Resend de mentira.
async function loadFunction() {
  const src = readFileSync(new URL("../supabase/functions/enviar-mail/index.ts", import.meta.url), "utf8")
    .replace('import { createClient } from "npm:@supabase/supabase-js@2";', "const createClient = globalThis.__createClient;");
  const js = transformSync(src, { loader: "ts", format: "esm" }).code;
  const file = path.join(mkdtempSync(path.join(tmpdir(), "la-mail-")), "enviar-mail.mjs");
  writeFileSync(file, js);
  let handler;
  const env = { WEBHOOK_SECRET: "s3", RESEND_API_KEY: "re_test", SUPABASE_URL: "https://x.supabase.co", SUPABASE_SERVICE_ROLE_KEY: "k" };
  globalThis.Deno = { serve: (h) => { handler = h; }, env: { get: (k) => env[k] } };
  globalThis.__createClient = () => ({
    auth: { admin: { getUserById: async () => ({ data: { user: { email: "ana@example.com", user_metadata: {} } }, error: null }) } },
    from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { full_name: "Ana María Pérez" } }) }) }) }),
  });
  await import(`${pathToFileURL(file).href}?t=${Date.now()}`);
  return handler;
}

async function send(handler, payload) {
  const sent = [];
  const realFetch = globalThis.fetch;
  globalThis.fetch = async (url, init) => { sent.push({ url: String(url), body: JSON.parse(init.body) }); return new Response("{}", { status: 200 }); };
  try {
    const res = await handler(new Request("https://x.supabase.co/functions/v1/enviar-mail", {
      method: "POST",
      headers: { "content-type": "application/json", "x-webhook-secret": "s3" },
      body: JSON.stringify({ user_id: "11111111-1111-4111-8111-111111111111", ...payload }),
    }));
    return { res, sent };
  } finally {
    globalThis.fetch = realFetch;
  }
}

test("mails de suscripción: los 4 salen por Resend, con nombre, plan y sin variables sin completar", async () => {
  const handler = await loadFunction();

  let { res, sent } = await send(handler, { type: "subscription_started", plan: "pro", interval: "year", amount: 100000, until: "2027-12-04T12:00:00.000Z" });
  assert.equal(res.status, 200);
  assert.equal(sent[0].body.subject, "Tu plan Pro está activo");
  assert.deepEqual(sent[0].body.to, ["ana@example.com"]);
  assert.match(sent[0].body.html, /¡Hola, Ana!/);
  assert.match(sent[0].body.html, /\$100\.000 por año/);
  assert.match(sent[0].body.html, /La próxima renovación es el 1 de diciembre de 2027\./);
  assert.match(sent[0].body.html, /https:\/\/lavallealquila\.com\.ar\/#\/suscripcion/);
  assert.equal(/\{\{/.test(sent[0].body.html), false);

  ({ res, sent } = await send(handler, { type: "payment_failed", plan: "plus", until: "2027-01-04T03:00:00.000Z" }));
  assert.equal(res.status, 200);
  assert.equal(sent[0].body.subject, "No pudimos cobrar tu suscripción");
  assert.match(sent[0].body.html, /plan <strong>Plus<\/strong>/);
  assert.match(sent[0].body.html, /sigue activo hasta el 4 de enero de 2027/);
  assert.equal(/\{\{/.test(sent[0].body.html), false);

  ({ res, sent } = await send(handler, { type: "subscription_cancelled", plan: "pro", until: "2027-01-04T15:00:00.000Z" }));
  assert.equal(sent[0].body.subject, "Cancelaste tu suscripción");
  assert.match(sent[0].body.html, /no te vamos a cobrar más/);
  assert.equal(/\{\{/.test(sent[0].body.html), false);

  ({ res, sent } = await send(handler, { type: "subscription_ended", plan: "pro" }));
  assert.equal(sent[0].body.subject, "Volviste al plan Gratis");
  assert.match(sent[0].body.html, /#\/planes/);
  assert.equal(/\{\{/.test(sent[0].body.html), false);
});

test("mails de suscripción: sin fecha, la frase queda vacía y el mail no se rompe; tipos viejos siguen andando", async () => {
  const handler = await loadFunction();
  let { res, sent } = await send(handler, { type: "subscription_started", plan: "plus", interval: "month", amount: 6900 });
  assert.equal(res.status, 200);
  assert.match(sent[0].body.html, /\$6\.900 por mes/);
  assert.equal(/próxima renovación/.test(sent[0].body.html), false);
  ({ res, sent } = await send(handler, { type: "welcome" }));
  assert.equal(res.status, 200);
  assert.equal(sent[0].body.subject, "Te damos la bienvenida a Lavalle Alquila");
  ({ res } = await send(handler, { type: "nada" }));
  assert.equal(res.status, 400);
});

test("la denuncia le llega a jirfcarp y no busca un usuario denunciante", async () => {
  const handler = await loadFunction();
  const { res, sent } = await send(handler, {
    type: "report_received",
    reason: "estafa",
    details: "Pide seña por transferencia",
    title: "Casa con patio cerca de la plaza",
    link: "https://lavallealquila.com.ar/#/aviso/d39cd325-0ba5-47d6-a6b8-9b1913cfb4ff",
  });
  assert.equal(res.status, 200);
  assert.deepEqual(sent[0].body.to, ["jirfcarp@gmail.com"]);
  assert.equal(sent[0].body.subject, "Nueva denuncia en Lavalle Alquila");
  assert.match(sent[0].body.html, /Casa con patio cerca de la plaza/);
  assert.match(sent[0].body.html, /estafa/);
  assert.match(sent[0].body.html, /Pide seña por transferencia/);
  assert.match(sent[0].body.html, /#\/aviso\/d39cd325-0ba5-47d6-a6b8-9b1913cfb4ff/);
  assert.equal(/\{\{/.test(sent[0].body.html), false);
});
