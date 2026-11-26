import assert from "node:assert/strict";
import test from "node:test";
import { Window } from "happy-dom";

const session = {
  user: { id: "user-1", email: "jirfcarp@gmail.com" },
  profile: {
    id: "user-1",
    email: "jirfcarp@gmail.com",
    full_name: "Ignacio Romera",
    whatsapp: "5492615550101",
    plan: "free",
    max_listings: 1,
    booking_enabled: false,
    is_admin: true,
  },
};

function installDom() {
  const win = new Window({ url: "https://lavallealquila.com.ar/" });
  globalThis.window = win;
  globalThis.document = win.document;
  globalThis.HTMLElement = win.HTMLElement;
  globalThis.Node = win.Node;
  globalThis.Element = win.Element;
  globalThis.MutationObserver = win.MutationObserver;
  globalThis.localStorage = win.localStorage;
  globalThis.sessionStorage = win.sessionStorage;
  try {
    globalThis.getComputedStyle = win.getComputedStyle.bind(win);
  } catch {
    /* node already has a getter */
  }
  globalThis.requestAnimationFrame = (callback) => setTimeout(() => callback(Date.now()), 0);
  globalThis.fetch = async (input) => {
    const url = String(input);
    const body = url.includes("/rpc/") ? false : [];
    return new Response(JSON.stringify(body), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  };
  return win;
}

async function closeDom(win) {
  await win.happyDOM.abort();
}

test("publicar muestra el formulario con Supabase y un perfil cargado", async () => {
  const win = installDom();
  const { renderPublish } = await import("../src/pages/publish.js");
  const view = document.createElement("div");
  document.body.append(view);
  await renderPublish(view, { parts: [] }, session, {
    loadListings: async () => [],
    mountMap: () => {},
  });
  const form = view.querySelector("[data-testid=publish-form]");
  assert.ok(form, "el formulario de publicar tiene que estar");
  assert.equal(view.textContent.includes("Cannot set properties of null"), false);
  assert.ok(view.querySelector("[data-testid=address-input]"));
  assert.match(view.textContent, /Publicás como/);
  assert.match(view.textContent, /Ignacio Romera/);
  assert.equal(view.querySelector("[data-testid=google-login]"), null);
  assert.equal(form.querySelector("[data-venue]").hidden, true);
  assert.equal(form.querySelector("[data-housing]").hidden, false);
  await closeDom(win);
});

test("publicar también arma el formulario si hay caja de login (sin sesión)", async () => {
  const win = installDom();
  const { renderPublish } = await import("../src/pages/publish.js");
  const view = document.createElement("div");
  document.body.append(view);
  await renderPublish(view, { parts: [] }, null, { mountMap: () => {} });
  assert.ok(view.querySelector("[data-testid=google-login]"));
  assert.ok(view.querySelector("[data-testid=publish-form]"));
  assert.equal(view.textContent.includes("Cannot set properties of null"), false);
  await closeDom(win);
});

test("el resto de las rutas no pisan un elemento null en modo configurado", async () => {
  const win = installDom();
  const { renderHome, renderVenues } = await import("../src/pages/home.js");
  const { renderDetail } = await import("../src/pages/detail.js");
  const { renderSeeks, renderSeek, renderSeekNew } = await import("../src/pages/seeks.js");
  const { renderAccount, renderOwnerTurnero } = await import("../src/pages/account.js");
  const { renderAdmin } = await import("../src/pages/admin.js");
  const route = { parts: ["x", "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1"], params: new URLSearchParams(), name: "home" };
  const pages = [
    ["inicio", (view) => renderHome(view, route, session)],
    ["quinchos", (view) => renderVenues(view, route, session)],
    ["aviso", (view) => renderDetail(view, route, session)],
    ["busco", (view) => renderSeeks(view, route, session)],
    ["busco detalle", (view) => renderSeek(view, route, session)],
    ["busco nuevo", (view) => renderSeekNew(view, route, session)],
    ["yo", (view) => renderAccount(view, route, session)],
    ["admin", (view) => renderAdmin(view, route, session)],
    ["turnero", (view) => renderOwnerTurnero(view, route, session)],
  ];
  for (const [name, render] of pages) {
    const view = document.createElement("div");
    document.body.append(view);
    try {
      await render(view);
    } catch (error) {
      assert.fail(`${name}: ${error.message}`);
    }
    assert.equal(view.textContent.includes("Cannot set properties of null"), false, name);
  }
  const account = document.body.querySelector("h1");
  assert.match(document.body.textContent, /Hola, Ignacio/);
  assert.ok(account);
  await closeDom(win);
});
