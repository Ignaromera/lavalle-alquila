import assert from "node:assert/strict";
import test from "node:test";
import { Window } from "happy-dom";
import { IDS } from "../src/demo-store.js";
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

test("con varias fotos hay flechas, contador y puntitos clicables", async () => {
  await withDom(`https://lavallealquila.com.ar/?demo=1#/aviso/${IDS.quincho}`, async (win) => {
    const { renderDetail } = await import("../src/pages/detail.js");
    const view = document.createElement("div");
    document.body.append(view);
    await renderDetail(view, parseRoute(), null);

    const prev = view.querySelector("[data-testid=gallery-prev]");
    const next = view.querySelector("[data-testid=gallery-next]");
    const count = view.querySelector("[data-testid=gallery-count]");
    const dots = [...view.querySelectorAll("[data-gallery-dot]")];
    assert.ok(view.querySelector(".gallery.has-many"));
    assert.ok(prev);
    assert.ok(next);
    assert.equal(prev.getAttribute("aria-label"), "Foto anterior");
    assert.equal(next.getAttribute("aria-label"), "Foto siguiente");
    assert.equal(count.textContent, "1 / 3");
    assert.equal(dots.length, 3);
    assert.equal(dots[0].getAttribute("aria-current"), "true");

    next.click();
    assert.equal(count.textContent, "2 / 3");
    assert.equal(dots[1].classList.contains("on"), true);
    assert.equal(dots[1].getAttribute("aria-current"), "true");
    assert.equal(dots[0].classList.contains("on"), false);

    dots[2].click();
    assert.equal(count.textContent, "3 / 3");
    assert.equal(dots[2].classList.contains("on"), true);

    next.click();
    assert.equal(count.textContent, "1 / 3", "al final vuelve a la primera");

    prev.click();
    assert.equal(count.textContent, "3 / 3", "antes de la primera va a la última");

    win.document.dispatchEvent(new win.KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true }));
    assert.equal(count.textContent, "1 / 3");
    win.document.dispatchEvent(new win.KeyboardEvent("keydown", { key: "ArrowLeft", bubbles: true }));
    assert.equal(count.textContent, "3 / 3");
  });
});

test("con una sola foto no hay flechas, contador ni puntitos", async () => {
  await withDom(`https://lavallealquila.com.ar/?demo=1#/aviso/${IDS.casaTulumaya}`, async () => {
    const { renderDetail } = await import("../src/pages/detail.js");
    const view = document.createElement("div");
    document.body.append(view);
    await renderDetail(view, parseRoute(), null);
    assert.equal(view.querySelector(".gallery.has-many"), null);
    assert.equal(view.querySelector("[data-testid=gallery-prev]"), null);
    assert.equal(view.querySelector("[data-testid=gallery-next]"), null);
    assert.equal(view.querySelector("[data-testid=gallery-count]"), null);
    assert.equal(view.querySelectorAll("[data-gallery-dot]").length, 0);
    assert.equal(view.querySelectorAll(".gallery-track img").length, 1);
  });
});

test("las flechas del teclado no se comen si estás escribiendo", async () => {
  await withDom(`https://lavallealquila.com.ar/?demo=1#/aviso/${IDS.quincho}`, async (win) => {
    const { renderDetail } = await import("../src/pages/detail.js");
    const view = document.createElement("div");
    document.body.append(view);
    await renderDetail(view, parseRoute(), null);
    const input = document.createElement("input");
    document.body.append(input);
    input.focus();
    input.dispatchEvent(new win.KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true }));
    assert.equal(view.querySelector("[data-testid=gallery-count]").textContent, "1 / 3");
  });
});
