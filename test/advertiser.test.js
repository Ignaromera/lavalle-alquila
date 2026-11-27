import assert from "node:assert/strict";
import test from "node:test";
import { Window } from "happy-dom";
import { advertiserListings, advertiserSeeks, createDemoStore, getAdvertiser, IDS } from "../src/demo-store.js";
import { activeListingsLabel, advertiserName } from "../src/format.js";
import { parseRoute } from "../src/router.js";

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

test("el nombre del anunciante no cae en el email y tiene un respaldo", () => {
  assert.equal(advertiserName("Marina López"), "Marina López");
  assert.equal(advertiserName("  "), "Un vecino de Lavalle");
  assert.equal(advertiserName(""), "Un vecino de Lavalle");
  assert.equal(activeListingsLabel(1), "1 aviso activo");
  assert.equal(activeListingsLabel(2), "2 avisos activos");
  assert.equal(activeListingsLabel(0), "0 avisos activos");
});

test("el demo-store arma la ficha del anunciante sin el email", () => {
  const store = createDemoStore();
  const marina = getAdvertiser(store, IDS.marina);
  assert.equal(marina.full_name, "Marina López");
  assert.equal(marina.listing_count, 2);
  assert.equal(marina.seek_count, 0);
  assert.equal("email" in marina, false);
  assert.equal(JSON.stringify(marina).includes("marina@ejemplo.test"), false);

  const listings = advertiserListings(store, IDS.marina);
  assert.equal(listings.length, 2);
  assert.ok(listings.some((item) => item.id === IDS.casaTulumaya));
  assert.ok(listings.some((item) => item.id === IDS.quincho));
  assert.equal(listings.some((item) => item.status === "hidden"), false);

  const pedro = getAdvertiser(store, IDS.pedro);
  assert.equal(pedro.full_name, "Pedro Álvarez");
  assert.equal(pedro.listing_count, 0);
  assert.equal(pedro.seek_count, 1);
  const seeks = advertiserSeeks(store, IDS.pedro);
  assert.equal(seeks.length, 1);
  assert.equal(JSON.stringify(seeks).includes("pedro@ejemplo.test"), false);

  assert.equal(getAdvertiser(store, IDS.nico), null);
  const asAdmin = getAdvertiser(store, IDS.nico, { isAdmin: true });
  assert.equal(asAdmin.full_name, "Nicolás Díaz");
  assert.equal(asAdmin.listing_count, 0);
  const hidden = advertiserListings(store, IDS.nico, { includePrivate: true });
  assert.equal(hidden.length, 1);
  assert.equal(hidden[0].status, "hidden");
  assert.equal(advertiserListings(store, IDS.nico).length, 0);
});

test("la ruta #/anunciante/:id y la de moderación se reconocen", async () => {
  await withDom(`https://lavallealquila.com.ar/?demo=1#/anunciante/${IDS.marina}`, async () => {
    const route = parseRoute();
    assert.equal(route.name, "advertiser");
    assert.equal(route.parts[1], IDS.marina);
  });
  await withDom(`https://lavallealquila.com.ar/?demo=1#/admin/anunciante/${IDS.nico}`, async () => {
    const route = parseRoute();
    assert.equal(route.name, "advertiser-admin");
    assert.equal(route.parts[2], IDS.nico);
  });
});

test("la página pública muestra los avisos activos de Marina y no el mail", async () => {
  await withDom(`https://lavallealquila.com.ar/?demo=1#/anunciante/${IDS.marina}`, async () => {
    const { renderAdvertiser } = await import("../src/pages/advertiser.js");
    const view = document.createElement("div");
    document.body.append(view);
    await renderAdvertiser(view, parseRoute(), null);
    const page = view.querySelector("[data-testid=advertiser]");
    assert.ok(page);
    assert.match(page.textContent, /Avisos de Marina López/);
    assert.match(page.textContent, /2 avisos activos/);
    const cards = view.querySelectorAll("[data-testid=listing-card]");
    assert.equal(cards.length, 2);
    const html = view.innerHTML;
    assert.equal(html.includes("marina@ejemplo.test"), false);
    assert.equal(html.includes("@ejemplo.test"), false);
    assert.equal(view.querySelector("[data-testid=advertiser-moderation]"), null);
    assert.ok([...cards].some((card) => card.getAttribute("href") === `#/aviso/${IDS.casaTulumaya}`));
    assert.ok([...cards].some((card) => card.getAttribute("href") === `#/aviso/${IDS.quincho}`));
  });
});

test("si el anunciante solo tiene un pedido de Busco alquiler, se muestra", async () => {
  await withDom(`https://lavallealquila.com.ar/?demo=1#/anunciante/${IDS.pedro}`, async () => {
    const { renderAdvertiser } = await import("../src/pages/advertiser.js");
    const view = document.createElement("div");
    document.body.append(view);
    await renderAdvertiser(view, parseRoute(), null);
    assert.match(view.textContent, /Avisos de Pedro Álvarez/);
    assert.match(view.textContent, /0 avisos activos/);
    assert.equal(view.querySelectorAll("[data-testid=listing-card]").length, 0);
    const seeks = view.querySelector("[data-testid=advertiser-seeks]");
    assert.ok(seeks);
    assert.match(seeks.textContent, /Familia con una perra mediana/);
    assert.equal(view.innerHTML.includes("pedro@ejemplo.test"), false);
  });
});

test("en la ficha, Ver todos sus avisos (N) aparece solo si hay más de uno", async () => {
  await withDom(`https://lavallealquila.com.ar/?demo=1#/aviso/${IDS.casaTulumaya}`, async () => {
    const { renderDetail } = await import("../src/pages/detail.js");
    const view = document.createElement("div");
    document.body.append(view);
    await renderDetail(view, parseRoute(), null);
    const more = view.querySelector("[data-testid=advertiser-more]");
    assert.ok(more, "Marina tiene 2 avisos, tiene que aparecer el link");
    assert.equal(more.getAttribute("href"), `#/anunciante/${IDS.marina}`);
    assert.match(more.textContent, /Ver todos sus avisos \(2\)/);
    const name = view.querySelector("[data-testid=advertiser-link]");
    assert.ok(name);
    assert.match(name.textContent, /Marina López/);
    assert.equal(view.innerHTML.includes("marina@ejemplo.test"), false);
  });

  await withDom(`https://lavallealquila.com.ar/?demo=1#/aviso/${IDS.deptoPlumero}`, async () => {
    const { renderDetail } = await import("../src/pages/detail.js");
    const view = document.createElement("div");
    document.body.append(view);
    await renderDetail(view, parseRoute(), null);
    assert.equal(view.querySelector("[data-testid=advertiser-more]"), null, "Carlos tiene un solo aviso");
    const name = view.querySelector("[data-testid=advertiser-link]");
    assert.ok(name);
    assert.equal(name.getAttribute("href"), `#/anunciante/${IDS.carlos}`);
    assert.match(name.textContent, /Carlos Pereyra/);
  });
});

test("en moderación el nombre del dueño lleva a todos sus avisos, también los ocultos", async () => {
  await withDom(`https://lavallealquila.com.ar/?demo=1#/admin`, async () => {
    const { renderAdmin } = await import("../src/pages/admin.js");
    const view = document.createElement("div");
    document.body.append(view);
    await renderAdmin(view, parseRoute(), null);
    const links = [...view.querySelectorAll("[data-testid=admin-advertiser]")];
    assert.ok(links.length > 0);
    const nico = links.find((link) => link.getAttribute("href") === `#/admin/anunciante/${IDS.nico}`);
    assert.ok(nico, "el aviso oculto de Nico tiene que linkear a su ficha de moderación");
    assert.match(nico.textContent, /Nicolás Díaz/);
  });

  await withDom(`https://lavallealquila.com.ar/?demo=1#/admin/anunciante/${IDS.nico}`, async () => {
    const { renderAdvertiser } = await import("../src/pages/advertiser.js");
    const view = document.createElement("div");
    document.body.append(view);
    await renderAdvertiser(view, parseRoute(), null);
    assert.match(view.textContent, /Avisos de Nicolás Díaz/);
    const hidden = view.querySelector("[data-testid=advertiser-moderation]");
    assert.ok(hidden, "el aviso oculto tiene que verse en moderación");
    assert.match(hidden.textContent, /Oculto/);
    assert.match(hidden.textContent, /Departamento casi regalado/);
    assert.equal(view.querySelectorAll("[data-testid=listing-card]").length, 1);
    assert.equal(view.innerHTML.includes("nico@ejemplo.test"), false);
  });
});

test("un id desconocido no inventa anunciante ni filtra el email", async () => {
  const missing = "00000000-0000-4000-8000-000000000000";
  await withDom(`https://lavallealquila.com.ar/?demo=1#/anunciante/${missing}`, async () => {
    const { renderAdvertiser } = await import("../src/pages/advertiser.js");
    const view = document.createElement("div");
    document.body.append(view);
    await renderAdvertiser(view, parseRoute(), null);
    assert.match(view.textContent, /Anunciante no disponible/);
    assert.equal(view.innerHTML.includes("@"), false);
  });
});
