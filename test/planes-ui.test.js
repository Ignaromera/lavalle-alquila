import assert from "node:assert/strict";
import test from "node:test";
import { Window } from "happy-dom";

// Modo ejemplo (?demo=1): sin red, con las cuentas de ejemplo.
function installDom() {
  const win = new Window({ url: "https://lavallealquila.com.ar/?demo=1" });
  globalThis.window = win;
  globalThis.document = win.document;
  globalThis.HTMLElement = win.HTMLElement;
  globalThis.Node = win.Node;
  globalThis.Element = win.Element;
  globalThis.MutationObserver = win.MutationObserver;
  globalThis.localStorage = win.localStorage;
  globalThis.sessionStorage = win.sessionStorage;
  globalThis.location = win.location;
  globalThis.confirm = () => true;
  try { globalThis.getComputedStyle = win.getComputedStyle.bind(win); } catch { /* node ya trae uno */ }
  globalThis.requestAnimationFrame = (cb) => setTimeout(() => cb(Date.now()), 0);
  return win;
}

async function loginAs(id) {
  const api = await import("../src/api.js");
  if (!id) {
    await api.signOut();
    return null;
  }
  return api.signInDemo(id);
}

const route = (query = "") => ({ parts: [], params: new URLSearchParams(query) });
const tick = () => new Promise((resolve) => setTimeout(resolve, 20));

test("planes: Pro anual muestra $100.000, el ahorro contra $178.800 y la insignia «Mejor precio»", async () => {
  const win = installDom();
  const { renderPlans } = await import("../src/pages/plans.js");
  const view = document.createElement("div");
  document.body.append(view);
  await renderPlans(view, route(), await loginAs(null));
  assert.equal(view.querySelectorAll("[data-plan]").length, 3);
  const pro = view.querySelector("[data-testid=plan-pro]").textContent;
  assert.match(pro, /\$100\.000/);
  assert.match(pro, /por año/);
  assert.match(pro, /\$178\.800/);
  assert.match(pro, /ahorrás \$78\.800 \(44%\)/);
  assert.match(pro, /Mejor precio/);
  assert.match(pro, /Ahorrás 44%/);
  assert.match(pro, /Avisos ilimitados/);
  assert.match(pro, /Turnero/);
  assert.match(pro, /destacados/);
  const plus = view.querySelector("[data-testid=plan-plus]").textContent;
  assert.match(plus, /\$6\.900/);
  assert.match(plus, /por mes/);
  assert.match(plus, /Solo mensual/);
  assert.doesNotMatch(plus, /Ahorrás|\$49\.000|por año|\$82\.800/);
  assert.match(view.querySelector("[data-testid=plan-free]").textContent, /\$0/);
  await win.happyDOM.abort();
});

test("planes: el selector mensual muestra $14.900 y $6.900", async () => {
  const win = installDom();
  const { renderPlans } = await import("../src/pages/plans.js");
  const view = document.createElement("div");
  document.body.append(view);
  await renderPlans(view, route(), await loginAs(null));
  view.querySelector('[data-interval="month"]').click();
  assert.match(view.querySelector("[data-testid=plan-pro]").textContent, /\$14\.900/);
  assert.match(view.querySelector("[data-testid=plan-pro]").textContent, /por mes/);
  assert.match(view.querySelector("[data-testid=plan-plus]").textContent, /\$6\.900/);
  assert.equal(/Ahorrás 44%\s*<\/span>/.test(view.querySelector("[data-testid=plan-pro]").innerHTML), false);
  await renderPlans(view, route("periodo=mensual"), null);
  assert.match(view.querySelector("[data-testid=plan-pro]").textContent, /\$14\.900/);
  await win.happyDOM.abort();
});

test("planes: sin sesión, «Suscribirme» pide entrar; con sesión y sin pagos habilitados avisa «muy pronto» sin romper", async () => {
  const win = installDom();
  const { renderPlans } = await import("../src/pages/plans.js");
  const view = document.createElement("div");
  document.body.append(view);

  await renderPlans(view, route(), await loginAs(null));
  view.querySelector('[data-subscribe="pro"]').click();
  await tick();
  const msg = view.querySelector('[data-plan="pro"] [data-msg]');
  assert.equal(msg.hidden, false);
  assert.match(msg.textContent, /Primero entrá a tu cuenta/);

  const { IDS } = await import("../src/demo-store.js");
  const session = await loginAs(IDS.carlos);
  await renderPlans(view, route(), session);
  const button = view.querySelector('[data-subscribe="pro"]');
  button.click();
  await tick();
  const soon = view.querySelector('[data-plan="pro"] [data-msg]');
  assert.equal(soon.hidden, false);
  assert.match(soon.textContent, /Muy pronto/);
  assert.match(soon.textContent, /no se cobra nada/);
  assert.equal(view.querySelector('[data-subscribe="pro"]').disabled, false, "el botón vuelve a quedar usable");
  assert.match(view.querySelector('[data-subscribe="pro"]').textContent, /Suscribirme a Pro/);
  await win.happyDOM.abort();
});

test("planes: la persona con plan Pro ve «Tu plan actual» en Pro", async () => {
  const win = installDom();
  const { renderPlans } = await import("../src/pages/plans.js");
  const { IDS } = await import("../src/demo-store.js");
  const view = document.createElement("div");
  document.body.append(view);
  await renderPlans(view, route(), await loginAs(IDS.marina));
  assert.match(view.querySelector("[data-testid=plan-pro]").textContent, /Tu plan actual/);
  assert.equal(view.querySelector('[data-subscribe="pro"]'), null);
  assert.ok(view.querySelector('[data-subscribe="plus"]'));
  await win.happyDOM.abort();
});

test("mi suscripción: Pro anual activa muestra renovación, uso sin tope, destacados y cancelar", async () => {
  const win = installDom();
  const { renderSubscription } = await import("../src/pages/subscription.js");
  const { IDS } = await import("../src/demo-store.js");
  const view = document.createElement("div");
  document.body.append(view);
  await renderSubscription(view, route(), await loginAs(IDS.marina));
  const text = view.textContent;
  assert.match(text, /Pro/);
  assert.match(text, /Activo/);
  assert.match(text, /\$100\.000 por año/);
  assert.match(text, /Próxima renovación/);
  assert.match(view.querySelector("[data-testid=sub-usage]").textContent, /sin tope/);
  assert.match(text, /Destacados: 2 de 2/);
  assert.match(text, /Turnero habilitado/);
  assert.ok(view.querySelector("[data-cancel]"));
  assert.match(text, /Si cancelás o falla un pago/);

  view.querySelector("[data-cancel]").click();
  await tick();
  await renderSubscription(view, route(), await loginAs(IDS.marina));
  assert.match(view.textContent, /Cancelaste la suscripción/);
  assert.match(view.textContent, /no te vamos a cobrar más/);
  assert.equal(view.querySelector("[data-cancel]"), null);
  await win.happyDOM.abort();
});

test("mi suscripción: el plan Gratis ofrece ver los planes y no tiene cancelar; sin sesión pide entrar", async () => {
  const win = installDom();
  const { renderSubscription } = await import("../src/pages/subscription.js");
  const { IDS } = await import("../src/demo-store.js");
  const view = document.createElement("div");
  document.body.append(view);
  await renderSubscription(view, route(), await loginAs(IDS.carlos));
  assert.match(view.textContent, /plan\s*Gratis/);
  assert.match(view.querySelector("[data-testid=sub-usage]").textContent, /Usás 1 de 1 aviso activo/);
  assert.equal(view.querySelector("[data-cancel]"), null);
  assert.ok(view.querySelector('a[href="#/planes"]'));
  await renderSubscription(view, route(), null);
  assert.match(view.textContent, /Entrá a tu cuenta/);
  await win.happyDOM.abort();
});

test("publicar: con el tope alcanzado se ve el aviso con «Ver planes» y el botón queda frenado", async () => {
  const win = installDom();
  const { renderPublish } = await import("../src/pages/publish.js");
  const { IDS } = await import("../src/demo-store.js");
  const view = document.createElement("div");
  document.body.append(view);
  await renderPublish(view, { parts: [] }, await loginAs(IDS.carlos), { mountMap: () => {} });
  const box = view.querySelector("[data-testid=limit-reached]");
  assert.ok(box, "debe verse el aviso de tope");
  assert.match(box.textContent, /Ya tenés 1 aviso activo/);
  assert.match(box.textContent, /Plus publicás hasta 3 avisos/);
  assert.ok(box.querySelector('a[href="#/planes"]'));
  const submit = view.querySelector("[type=submit]");
  assert.equal(submit.disabled, true);
  assert.match(submit.textContent, /Llegaste al tope/);
  assert.equal(view.textContent.includes("Más adelante vas a poder ampliarlo"), false);
  assert.match(view.querySelector("[data-testid=plan-note]").textContent, /Plan\s*Gratis/);
  assert.match(view.querySelector("[data-testid=plan-note]").textContent, /usás 1 de 1 aviso activo/);
  await win.happyDOM.abort();
});

test("publicar: Pro no tiene tope ni aviso de límite; editar un aviso propio tampoco se frena", async () => {
  const win = installDom();
  const { renderPublish } = await import("../src/pages/publish.js");
  const { IDS } = await import("../src/demo-store.js");
  const view = document.createElement("div");
  document.body.append(view);
  await renderPublish(view, { parts: [] }, await loginAs(IDS.marina), { mountMap: () => {} });
  assert.equal(view.querySelector("[data-testid=limit-reached]"), null);
  assert.equal(view.querySelector("[type=submit]").disabled, false);
  assert.match(view.querySelector("[data-testid=plan-note]").textContent, /avisos ilimitados/);

  const carlos = await loginAs(IDS.carlos);
  const { myListings } = await import("../src/api.js");
  const mine = (await myListings()).find((item) => item.status === "active");
  const edit = document.createElement("div");
  document.body.append(edit);
  await renderPublish(edit, { parts: ["publicar", mine.id] }, carlos, { mountMap: () => {} });
  assert.equal(edit.querySelector("[data-testid=limit-reached]"), null);
  assert.equal(edit.querySelector("[type=submit]").disabled, false);
  await win.happyDOM.abort();
});

test("mi cuenta: Pro ve destacados y puede quitar uno; Gratis ve la invitación al plan Pro", async () => {
  const win = installDom();
  const { renderAccount } = await import("../src/pages/account.js");
  const { IDS } = await import("../src/demo-store.js");
  const view = document.createElement("div");
  document.body.append(view);
  await renderAccount(view, route(), await loginAs(IDS.marina));
  assert.match(view.querySelector("[data-testid=plan-note]").textContent, /Plan\s*Pro/);
  assert.match(view.querySelector("[data-testid=featured-count]").textContent, /Destacados: 2 de 2/);
  assert.equal(view.querySelectorAll('[data-feature][data-on="0"]').length, 2);
  view.querySelector('[data-feature][data-on="0"]').click();
  await tick();
  await renderAccount(view, route(), await loginAs(IDS.marina));
  assert.match(view.querySelector("[data-testid=featured-count]").textContent, /Destacados: 1 de 2/);
  assert.ok(view.querySelector('[data-feature][data-on="1"]'), "ahora se puede destacar otro");

  const free = document.createElement("div");
  document.body.append(free);
  await renderAccount(free, route(), await loginAs(IDS.carlos));
  assert.match(free.querySelector("[data-testid=plan-note]").textContent, /Plan\s*Gratis/);
  assert.equal(free.querySelector("[data-feature]"), null);
  assert.match(free.textContent, /Vienen con el plan Pro/);
  await win.happyDOM.abort();
});

test("mi cuenta: las estadísticas quedan para Plus y Pro solo cuando se enciende el cobro", async () => {
  const win = installDom();
  const { renderAccount } = await import("../src/pages/account.js");
  const { config } = await import("../src/config.js");
  const { IDS } = await import("../src/demo-store.js");
  const view = document.createElement("div");
  document.body.append(view);
  assert.equal(config.billingLive, false);
  await renderAccount(view, route(), await loginAs(IDS.carlos));
  assert.ok(view.querySelector("[data-testid=stats-panel]"), "con el cobro apagado, nadie pierde lo que ya tenía");
  config.billingLive = true;
  try {
    const gated = document.createElement("div");
    document.body.append(gated);
    await renderAccount(gated, route(), await loginAs(IDS.carlos));
    assert.equal(gated.querySelector("[data-testid=stats-panel]"), null);
    assert.ok(gated.querySelector("[data-testid=stats-locked]"));
    const pro = document.createElement("div");
    document.body.append(pro);
    await renderAccount(pro, route(), await loginAs(IDS.marina));
    assert.ok(pro.querySelector("[data-testid=stats-panel]"));
  } finally {
    config.billingLive = false;
  }
  await win.happyDOM.abort();
});
