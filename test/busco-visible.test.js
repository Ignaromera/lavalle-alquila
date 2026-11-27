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

test("el inicio muestra la tarjeta de busco alquiler y ya no el link chico", async () => {
  await withDom("https://lavallealquila.com.ar/?demo=1#/", async () => {
    const { renderHome } = await import("../src/pages/home.js");
    const view = document.createElement("div");
    document.body.append(view);
    await renderHome(view, { parts: [], params: new URLSearchParams(), name: "home" });
    const card = view.querySelector("[data-testid=seek-cta]");
    assert.ok(card, "tiene que estar la tarjeta");
    assert.match(card.textContent, /¿No encontrás lo que buscás\?/);
    assert.match(card.textContent, /dueños te escriban/);
    const button = card.querySelector(".btn-primary");
    assert.equal(button.getAttribute("href"), "#/busco/nuevo");
    assert.match(button.textContent, /Publicar lo que busco/);
    const link = card.querySelector(".seek-cta-link");
    assert.equal(link.getAttribute("href"), "#/busco");
    assert.match(link.textContent, /Ver búsquedas/);
    const quick = view.querySelector(".quick");
    assert.match(quick.textContent, /Quinchos y salones/);
    assert.equal(quick.textContent.includes("Busco alquiler"), false);
  });
});

test("si un filtro no da avisos, ofrece publicar lo que se busca con los datos precargados", async () => {
  await withDom("https://lavallealquila.com.ar/?demo=1#/?tipo=casa&distrito=Costa%20de%20Araujo&max=1000", async () => {
    const { renderHome } = await import("../src/pages/home.js");
    const params = new URLSearchParams("tipo=casa&distrito=Costa de Araujo&max=1000");
    const view = document.createElement("div");
    document.body.append(view);
    await renderHome(view, { parts: [], params, name: "home" });
    const empty = view.querySelector("[data-testid=empty-results]");
    assert.ok(empty, "tiene que aparecer el estado vacío");
    assert.match(empty.textContent, /Ningún aviso coincide/);
    const cta = empty.querySelector(".btn-primary");
    assert.equal(cta.textContent.trim(), "Publicá lo que buscás");
    assert.equal(cta.getAttribute("href"), "#/busco/nuevo?tipo=casa&distrito=Costa+de+Araujo&max=1000");
  });
});

test("seekDefaultsFromParams lee tipo, distrito y presupuesto, y descarta valores inválidos", async () => {
  const { seekDefaultsFromParams, seekNewHref } = await import("../src/pages/seeks.js");
  assert.deepEqual(
    seekDefaultsFromParams(new URLSearchParams("tipo=casa&distrito=Costa de Araujo&max=400.000")),
    { type: "casa", district: "Costa de Araujo", budget: "400000" },
  );
  assert.deepEqual(
    seekDefaultsFromParams(new URLSearchParams("tipo=ovni&distrito=Madrid&presupuesto=250000")),
    { type: "cualquiera", district: "", budget: "250000" },
  );
  assert.equal(seekNewHref({}), "#/busco/nuevo");
  assert.equal(
    seekNewHref({ type: "quincho", district: "Jocolí", maxPrice: "180000" }),
    "#/busco/nuevo?tipo=quincho&distrito=Jocol%C3%AD&max=180000",
  );
});

test("el formulario de búsqueda arranca con los filtros de la URL", async () => {
  await withDom("https://lavallealquila.com.ar/?demo=1#/busco/nuevo?tipo=departamento&distrito=Villa%20Tulumaya&max=350000", async () => {
    const { renderSeekNew } = await import("../src/pages/seeks.js");
    const params = new URLSearchParams("tipo=departamento&distrito=Villa Tulumaya&max=350000");
    const view = document.createElement("div");
    document.body.append(view);
    await renderSeekNew(view, { parts: ["busco", "nuevo"], params, name: "seek-new" }, null);
    const form = view.querySelector("[data-testid=seek-form]");
    assert.equal(form.querySelector("[name=type]").value, "departamento");
    assert.equal(form.querySelector("[name=district]").value, "Villa Tulumaya");
    assert.equal(form.querySelector("[name=budget]").value, "350000");
  });
});

test("la hoja de Publicar pregunta qué se quiere publicar y los links directos siguen", async () => {
  await withDom("https://lavallealquila.com.ar/?demo=1#/", async () => {
    const { bindPublishChoice, publishChoiceHtml } = await import("../src/publish-choice.js");
    document.body.innerHTML = `
      <button type="button" data-open-publish aria-expanded="false">Publicar</button>
      ${publishChoiceHtml()}
    `;
    bindPublishChoice(document.body);
    const sheet = document.querySelector("[data-testid=publish-choice]");
    assert.equal(sheet.hidden, true);
    document.querySelector("[data-open-publish]").click();
    assert.equal(sheet.hidden, false);
    assert.match(sheet.textContent, /¿Qué querés publicar\?/);
    const listing = sheet.querySelector("[data-testid=choice-listing]");
    const seek = sheet.querySelector("[data-testid=choice-seek]");
    assert.equal(listing.getAttribute("href"), "#/publicar");
    assert.match(listing.textContent, /Tengo algo para alquilar/);
    assert.equal(seek.getAttribute("href"), "#/busco/nuevo");
    assert.match(seek.textContent, /Busco alquiler/);
    listing.click();
    assert.equal(sheet.hidden, true);
  });
});
