import assert from "node:assert/strict";
import test from "node:test";
import { Window } from "happy-dom";

async function withDom(url, run) {
  const win = new Window({ url });
  const previous = {
    window: globalThis.window,
    document: globalThis.document,
    HTMLElement: globalThis.HTMLElement,
    Node: globalThis.Node,
    Element: globalThis.Element,
    MutationObserver: globalThis.MutationObserver,
    localStorage: globalThis.localStorage,
    sessionStorage: globalThis.sessionStorage,
    location: globalThis.location,
    fetch: globalThis.fetch,
    requestAnimationFrame: globalThis.requestAnimationFrame,
  };
  globalThis.window = win;
  globalThis.document = win.document;
  globalThis.HTMLElement = win.HTMLElement;
  globalThis.Node = win.Node;
  globalThis.Element = win.Element;
  globalThis.MutationObserver = win.MutationObserver;
  globalThis.localStorage = win.localStorage;
  globalThis.sessionStorage = win.sessionStorage;
  globalThis.location = win.location;
  try {
    globalThis.getComputedStyle = win.getComputedStyle.bind(win);
  } catch {
    /* ignore */
  }
  globalThis.requestAnimationFrame = (callback) => setTimeout(() => callback(Date.now()), 0);
  globalThis.fetch = async () => new Response(JSON.stringify([]), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
  try {
    await run(win);
  } finally {
    await win.happyDOM.abort();
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) delete globalThis[key];
      else globalThis[key] = value;
    }
  }
}

test("el inicio en demo muestra el selector, un aviso Nuevo y el banner que no se guarda", async () => {
  await withDom("https://lavallealquila.com.ar/?demo=1#/", async () => {
    const { renderHome } = await import("../src/pages/home.js");
    const { demoBannerHtml } = await import("../src/demo-ui.js");
    const view = document.createElement("div");
    document.body.innerHTML = demoBannerHtml() + `<main></main>`;
    document.body.querySelector("main").append(view);
    await renderHome(view, { parts: [], params: new URLSearchParams(), name: "home" });
    const select = view.querySelector("[data-testid=sort-select]");
    assert.ok(select);
    assert.equal(select.value, "recientes");
    assert.deepEqual([...select.options].map((option) => option.textContent), [
      "Más recientes",
      "Menor precio",
      "Mayor precio",
    ]);
    assert.ok(view.querySelector(".badge-nuevo"), "tiene que haber un aviso Nuevo");
    assert.match(document.body.textContent, /lo que publiques no se guarda/);
    assert.equal(document.body.querySelector(".demo-banner a").href, "https://lavallealquila.com.ar/");
  });
});

test("publicar y entrar en demo muestran el aviso de que no se guarda", async () => {
  await withDom("https://lavallealquila.com.ar/?demo=1#/publicar", async () => {
    const { renderPublish } = await import("../src/pages/publish.js");
    const { renderSeekNew } = await import("../src/pages/seeks.js");
    const { renderAccount } = await import("../src/pages/account.js");
    const { signInDemo, DEMO_LOGIN } = await import("../src/api.js");

    const publish = document.createElement("div");
    document.body.append(publish);
    await renderPublish(publish, { parts: [], params: new URLSearchParams(), name: "publish" }, null, { mountMap: () => {} });
    const notice = publish.querySelector("[data-testid=demo-notice]");
    assert.ok(notice);
    assert.match(notice.textContent, /versión de prueba/);
    assert.match(notice.textContent, /no se guarda/);
    assert.equal(notice.querySelector("a").getAttribute("href"), "https://lavallealquila.com.ar/");

    const seek = document.createElement("div");
    document.body.append(seek);
    await renderSeekNew(seek, { parts: ["busco", "nuevo"], params: new URLSearchParams(), name: "seek-new" }, null);
    assert.ok(seek.querySelector("[data-testid=demo-notice]"));

    await signInDemo(DEMO_LOGIN[0].id);
    const { getSession } = await import("../src/api.js");
    const session = await getSession();
    const account = document.createElement("div");
    document.body.append(account);
    await renderAccount(account, { parts: ["cuenta"], params: new URLSearchParams(), name: "account" }, session);
    assert.ok(account.querySelector("[data-testid=demo-notice]"));
    assert.match(account.textContent, /lavallealquila.com.ar/);
  });
});
