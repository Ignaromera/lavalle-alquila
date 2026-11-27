import assert from "node:assert/strict";
import test from "node:test";
import { Window } from "happy-dom";
import { normalizeRegret, regretCode } from "../src/regret.js";
import { canShowCodeBox, normalizeCode, promoStatus, redeemInMemory } from "../src/promo.js";

function installDom() {
  const win = new Window({ url: "https://lavallealquila.com.ar/?demo=1" });
  Object.assign(globalThis, {
    window: win, document: win.document, HTMLElement: win.HTMLElement, Node: win.Node, Element: win.Element,
    localStorage: win.localStorage, sessionStorage: win.sessionStorage, location: win.location, FormData: win.FormData,
  });
  globalThis.confirm = () => true;
  return win;
}
const tick = () => new Promise((resolve) => setTimeout(resolve, 30));

test("arrepentimiento: valida nombre y mails, y la cuenta por defecto es el mismo mail", () => {
  assert.deepEqual(normalizeRegret({ name: " Ana ", email: " ANA@Test.ar " }), { name: "Ana", email: "ana@test.ar", account: "ana@test.ar", reason: "" });
  assert.throws(() => normalizeRegret({ name: "A", email: "a@test.ar" }), /nombre/);
  assert.throws(() => normalizeRegret({ name: "Ana", email: "no" }), /mail/);
  assert.throws(() => normalizeRegret({ name: "Ana", email: "a@test.ar", account: "x" }), /cuenta/);
  assert.equal(regretCode(7, new Date("2026-11-28T02:00:00Z")), "ARR-20261127-0007", "fecha de Mendoza");
});

test("arrepentimiento: el formulario sin cuenta muestra el código de trámite al enviar (modo ejemplo)", async () => {
  const win = installDom();
  const { renderRegret } = await import("../src/pages/regret.js");
  const view = document.createElement("div");
  document.body.append(view);
  await renderRegret(view, { parts: [], params: new URLSearchParams() }, null);
  const form = view.querySelector("[data-testid=regret-form]");
  assert.ok(form);
  form.querySelector("[name=email]").value = "ana@test.ar";
  form.querySelector("[name=name]").value = "A";
  form.dispatchEvent(new win.Event("submit", { cancelable: true }));
  await tick();
  assert.match(view.querySelector("[data-regret-error]").textContent, /nombre/);
  form.querySelector("[name=name]").value = "Ana Pérez";
  form.dispatchEvent(new win.Event("submit", { cancelable: true }));
  await tick();
  const code = view.querySelector("[data-testid=regret-code]");
  assert.ok(code, "tiene que mostrar el código");
  assert.match(code.textContent, /^ARR-\d{8}-\d{4}$/);
  assert.match(view.textContent, /ana@test\.ar/);
  const api = await import("../src/api.js");
  const rows = await api.adminRegrets();
  assert.ok(rows.some((r) => r.code === code.textContent && !r.resolved_at), "aparece en Moderación");
  await api.adminResolveRegret(rows.find((r) => r.code === code.textContent).id);
  assert.ok((await api.adminRegrets()).find((r) => r.code === code.textContent).resolved_at);
  win.happyDOM.close();
});

test("cómo funciona: para quien busca, para quien publica, planes con precios, FAQ y quiénes somos", async () => {
  installDom();
  const { howHtml } = await import("../src/pages/how.js");
  const html = howHtml();
  for (const re of [/Si buscás alquiler/, /Si querés publicar/, /sin cuenta/i, /WhatsApp/, /No transfieras señas/, /Denunciar/,
    /\$6\.900 por mes/, /\$14\.900 por mes o \$100\.000 por año/, /turnero/i, /Preguntas frecuentes/, /Ignacio Romera/, /lavallino/]) {
    assert.match(html, re);
  }
  assert.doesNotMatch(html, /\b(3|tres)\s+denuncias\b/i);
});

test("código de regalo: normaliza, cupo de 5, una vez por cuenta y por mail, 15 días", () => {
  assert.equal(normalizeCode(" lavalle-5 "), "LAVALLE5");
  const codes = { LAVALLE5: { plan_id: "pro", days: 15, max_uses: 5, used: 0, enabled: true } };
  const grants = [];
  const now = new Date("2026-11-27T12:00:00Z");
  for (let i = 1; i <= 5; i++) {
    const g = redeemInMemory({ codes, grants, profile: { id: `u${i}`, plan: "free" }, email: `u${i}@t.ar`, code: "lavalle5", now });
    assert.equal(g.ends_at, "2026-12-12T12:00:00.000Z");
  }
  assert.throws(() => redeemInMemory({ codes, grants, profile: { id: "u6", plan: "free" }, email: "u6@t.ar", code: "LAVALLE5", now }), /ya se usó todas/);
  assert.equal(codes.LAVALLE5.used, 5);
  codes.LAVALLE5.max_uses = 10;
  assert.throws(() => redeemInMemory({ codes, grants, profile: { id: "u1", plan: "free" }, email: "otro@t.ar", code: "LAVALLE5", now }), /Ya usaste/);
  assert.throws(() => redeemInMemory({ codes, grants, profile: { id: "u9", plan: "free" }, email: "U1@t.ar", code: "LAVALLE5", now }), /Ya usaste/);
  assert.throws(() => redeemInMemory({ codes, grants, profile: { id: "u7", plan: "plus" }, email: "u7@t.ar", code: "LAVALLE5", now }), /plan Gratis/);
  assert.throws(() => redeemInMemory({ codes, grants, profile: { id: "u8", plan: "free" }, email: "u8@t.ar", code: "NADA", now }), /no existe/);
  assert.equal(codes.LAVALLE5.used, 5, "los rechazos no gastan usos");
  assert.deepEqual(promoStatus(grants[0], now), { active: true, daysLeft: 15 });
  assert.deepEqual(promoStatus(grants[0], new Date("2026-12-13T00:00:00Z")), { active: false, daysLeft: 0 });
  assert.equal(canShowCodeBox({ plan: "free" }, null), true);
  assert.equal(canShowCodeBox({ plan: "free" }, grants[0]), false);
  assert.equal(canShowCodeBox({ plan: "pro" }, null), false);
});

test("código de regalo en «Yo» (modo ejemplo): LAVALLE5 pasa a Pro y la cajita desaparece", async () => {
  const win = installDom();
  const api = await import("../src/api.js");
  const { renderAccount } = await import("../src/pages/account.js");
  const carlos = api.DEMO_LOGIN.find((d) => /Carlos/.test(d.label)).id;
  const session = await api.signInDemo(carlos);
  const view = document.createElement("div");
  document.body.append(view);
  await renderAccount(view, { parts: [], params: new URLSearchParams() }, session);
  assert.ok(view.querySelector("[data-testid=code-box]"), "Carlos está en Gratis: ve la cajita");
  const result = await api.redeemPromoCode("lavalle5");
  assert.equal(result.days, 15);
  const after = await api.getSession();
  assert.equal(after.profile.plan, "pro");
  view.innerHTML = "";
  await renderAccount(view, { parts: [], params: new URLSearchParams() }, after);
  assert.equal(view.querySelector("[data-testid=code-box]"), null);
  assert.match(view.querySelector("[data-testid=promo-note]").textContent, /Pro de regalo/);
  await assert.rejects(api.redeemPromoCode("LAVALLE5"), /Ya usaste/);
  win.happyDOM.close();
});
