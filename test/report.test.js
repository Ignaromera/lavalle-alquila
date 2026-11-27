import assert from "node:assert/strict";
import test from "node:test";
import { Window } from "happy-dom";
import { reportListing, requestBooking, trackStat } from "../src/api.js";
import { renderDetail } from "../src/pages/detail.js";

const OWNER = "11111111-1111-4111-8111-111111111111";
const OTHER = "22222222-2222-4222-8222-222222222222";
const LISTING_ID = "33333333-3333-4333-8333-333333333333";

function listing() {
  return {
    id: LISTING_ID,
    owner_id: OWNER,
    type: "casa",
    title: "Casa con patio",
    description: "Una casa cerca de la plaza",
    price_ars: 400000,
    price_unit: "mes",
    district: "Lavalle",
    address: "San Martín 100",
    requirements: "",
    pets_allowed: false,
    guarantee_required: true,
    capacity: null,
    amenities: [],
    lat: -32.72,
    lng: -68.58,
    photo_urls: [],
    status: "active",
    featured: false,
    booking_enabled: false,
    expires_at: "2099-01-01T00:00:00.000Z",
    created_at: "2026-01-01T00:00:00.000Z",
    owner_name: "Ignacio Romera",
    whatsapp: "5492615550101",
    offers: [],
  };
}

function session(id, { admin = false } = {}) {
  return {
    user: { id, email: "vecino@example.com" },
    profile: {
      id,
      email: "vecino@example.com",
      full_name: id === OWNER ? "Ignacio Romera" : "Ana Pérez",
      whatsapp: "5492615550101",
      plan: "free",
      max_listings: 1,
      booking_enabled: false,
      is_admin: admin,
    },
  };
}

function headerValue(headers, name) {
  if (!headers) return "";
  if (typeof headers.get === "function") return headers.get(name) || "";
  const key = Object.keys(headers).find((item) => item.toLowerCase() === name.toLowerCase());
  return key ? String(headers[key]) : "";
}

function installDom() {
  const win = new Window({ url: "https://lavallealquila.com.ar/#/aviso/" + LISTING_ID });
  globalThis.window = win;
  globalThis.document = win.document;
  globalThis.location = win.location;
  globalThis.HTMLElement = win.HTMLElement;
  globalThis.Node = win.Node;
  globalThis.Element = win.Element;
  globalThis.MutationObserver = win.MutationObserver;
  globalThis.localStorage = win.localStorage;
  globalThis.sessionStorage = win.sessionStorage;
  globalThis.FormData = win.FormData;
  globalThis.Headers = win.Headers;
  globalThis.Request = win.Request;
  globalThis.Response = win.Response;
  try {
    globalThis.getComputedStyle = win.getComputedStyle.bind(win);
  } catch {
    /* node already has a getter */
  }
  return win;
}

test("el dueño no ve Denunciar; un vecino, un admin y un anónimo sí", async () => {
  const win = installDom();
  const calls = [];
  globalThis.fetch = async (input, init) => {
    const url = String(input?.url || input);
    calls.push(url);
    if (url.includes("listings_public")) {
      return new Response(JSON.stringify(listing()), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    }
    return new Response("null", { status: 200, headers: { "content-type": "application/json" } });
  };
  const route = { parts: ["aviso", LISTING_ID], params: new URLSearchParams() };
  for (const [name, current, expectButton] of [
    ["dueño", session(OWNER), false],
    ["vecino", session(OTHER), true],
    ["admin", session(OTHER, { admin: true }), true],
    ["anónimo", null, true],
  ]) {
    const view = document.createElement("div");
    document.body.append(view);
    await renderDetail(view, route, current);
    assert.equal(view.textContent.includes("Casa con patio"), true, name);
    assert.equal(Boolean(view.querySelector("[data-report]")), expectButton, name);
    assert.equal(Boolean(view.querySelector("[data-report-form]")), expectButton, name);
    assert.equal(view.textContent.includes("Cannot set properties of null"), false, name);
  }
  assert.ok(calls.some((url) => url.includes("listings_public")));
  await win.happyDOM.abort();
});

test("denunciar no pide la fila de vuelta y un error de RLS sale en español", async () => {
  const win = installDom();
  const calls = [];
  globalThis.fetch = async (input, init) => {
    const url = String(input?.url || input);
    calls.push({
      url,
      method: init?.method || "GET",
      prefer: headerValue(init?.headers, "prefer"),
      body: init?.body ? String(init.body) : "",
    });
    if (url.includes("/reports")) {
      return new Response(JSON.stringify({
        code: "42501",
        message: 'new row violates row-level security policy for table "reports"',
      }), { status: 403, headers: { "content-type": "application/json" } });
    }
    if (url.includes("listings_public")) {
      return new Response(JSON.stringify(listing()), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    }
    return new Response("null", { status: 200, headers: { "content-type": "application/json" } });
  };

  const view = document.createElement("div");
  document.body.append(view);
  await renderDetail(view, { parts: ["aviso", LISTING_ID], params: new URLSearchParams() }, session(OTHER));
  view.querySelector("[data-report]").click();
  const form = view.querySelector("[data-report-form]");
  assert.equal(form.hidden, false);
  form.querySelector("[name=reason]").value = "estafa";
  form.querySelector("[name=details]").value = "El teléfono no existe";
  form.dispatchEvent(new win.Event("submit", { bubbles: true, cancelable: true }));
  await new Promise((resolve) => setTimeout(resolve, 30));

  const report = calls.find((call) => call.url.includes("/reports"));
  assert.ok(report, "tiene que insertar en reports");
  assert.equal(report.method, "POST");
  assert.equal(report.url.includes("select="), false);
  assert.match(report.prefer, /return=minimal/);
  assert.equal(report.body.includes("estafa"), true);
  const toast = document.getElementById("toast");
  assert.match(toast.textContent, /Si es tuyo, no hace falta denunciarlo/);
  assert.equal(/row-level security|violates/i.test(toast.textContent), false);
  await win.happyDOM.abort();
});

test("un insert de denuncia sin devolver la fila no falla", async () => {
  const calls = [];
  globalThis.fetch = async (input, init) => {
    calls.push({
      url: String(input?.url || input),
      prefer: headerValue(init?.headers, "prefer"),
    });
    return new Response("", { status: 201, headers: { "content-type": "application/json" } });
  };
  await reportListing(LISTING_ID, { reason: "falso", details: "" });
  const report = calls.find((call) => call.url.includes("/reports"));
  assert.ok(report);
  assert.match(report.prefer, /return=minimal/);
  assert.equal(report.url.includes("select="), false);
});

test("la denuncia duplicada avisa en español", async () => {
  globalThis.fetch = async () => new Response(JSON.stringify({
    code: "23505",
    message: 'duplicate key value violates unique constraint "reports_listing_id_visitor_id_key"',
  }), { status: 409, headers: { "content-type": "application/json" } });
  await assert.rejects(
    () => reportListing(LISTING_ID, { reason: "otro", details: "" }),
    /Ya denunciaste este aviso/,
  );
});

test("el pedido de turno y la estadística van por RPC, sin insert que devuelva la fila", async () => {
  const calls = [];
  globalThis.fetch = async (input, init) => {
    calls.push({
      url: String(input?.url || input),
      method: init?.method || "GET",
      prefer: headerValue(init?.headers, "prefer"),
    });
    return new Response("null", { status: 200, headers: { "content-type": "application/json" } });
  };
  await requestBooking({
    slotId: "44444444-4444-4444-8444-444444444444",
    name: "Ana Pérez",
    whatsapp: "2615550101",
    guests: 10,
    note: "Cumpleaños",
  });
  await trackStat("listing", LISTING_ID, "share");
  const booking = calls.find((call) => call.url.includes("create_booking_request"));
  const stat = calls.find((call) => call.url.includes("track_stat"));
  assert.ok(booking, "create_booking_request");
  assert.equal(booking.url.includes("/booking_requests"), false);
  assert.equal(booking.prefer.includes("return=representation"), false);
  assert.ok(stat, "track_stat");
  assert.equal(stat.url.includes("/stat_daily"), false);
  assert.equal(stat.prefer.includes("return=representation"), false);
  assert.equal(calls.some((call) => /\/booking_requests/.test(call.url) && call.method === "POST"), false);
  assert.equal(calls.some((call) => /\/stat_daily/.test(call.url)), false);
});

test("el formulario de denuncia trae los motivos pedidos", async () => {
  const win = installDom();
  globalThis.fetch = async (input) => {
    const url = String(input?.url || input);
    if (url.includes("listings_public")) {
      return new Response(JSON.stringify(listing()), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    }
    return new Response("null", { status: 200, headers: { "content-type": "application/json" } });
  };
  const view = document.createElement("div");
  document.body.append(view);
  await renderDetail(view, { parts: ["aviso", LISTING_ID], params: new URLSearchParams() }, null);
  const options = [...view.querySelectorAll("[name=reason] option")].map((item) => [item.value, item.textContent]);
  assert.deepEqual(options, [
    ["estafa", "Estafa o fraude"],
    ["falso_alquilado", "Aviso falso o ya alquilado"],
    ["datos", "Datos o fotos incorrectas"],
    ["inapropiado", "Contenido inapropiado"],
    ["otro", "Otro"],
  ]);
  assert.match(view.textContent, /No hace falta crear una cuenta\. El equipo revisa cada denuncia/);
  assert.doesNotMatch(view.textContent, /3 denuncias|tres denuncias|oculta solo/i);
  await win.happyDOM.abort();
});

test("una búsqueda también se puede denunciar, menos si es propia", async () => {
  const { Window } = await import("happy-dom");
  const { renderSeek } = await import("../src/pages/seeks.js");
  const seek = {
    id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa7",
    owner_id: OWNER,
    type: "casa",
    district: "Villa Tulumaya",
    budget_ars: 400000,
    note: "Familia con una perra mediana. Buscamos patio.",
    status: "active",
    expires_at: "2099-01-01T00:00:00.000Z",
    created_at: "2026-01-01T00:00:00.000Z",
    owner_name: "Pedro",
    whatsapp: "5492615550105",
  };
  const win = new Window({ url: "https://lavallealquila.com.ar/#/busco/" + seek.id });
  globalThis.window = win;
  globalThis.document = win.document;
  globalThis.location = win.location;
  globalThis.HTMLElement = win.HTMLElement;
  globalThis.localStorage = win.localStorage;
  globalThis.sessionStorage = win.sessionStorage;
  globalThis.FormData = win.FormData;
  globalThis.fetch = async () => new Response(JSON.stringify(seek), { status: 200, headers: { "content-type": "application/json" } });
  const route = { parts: ["busco", seek.id], params: new URLSearchParams() };
  const view = document.createElement("div");
  document.body.append(view);
  await renderSeek(view, route, null);
  assert.ok(view.querySelector("[data-report]"));
  assert.match(view.textContent, /Denunciar búsqueda/);
  assert.match(view.querySelector("[name=reason]").textContent, /Estafa o fraude/);
  view.innerHTML = "";
  await renderSeek(view, route, session(OWNER));
  assert.equal(view.querySelector("[data-report]"), null);
  await win.happyDOM.abort();
});

test("en demo, el panel lista denuncias y se pueden marcar resueltas u ocultar el aviso", async () => {
  const { Window } = await import("happy-dom");
  const { renderAdmin } = await import("../src/pages/admin.js");
  const { IDS } = await import("../src/demo-store.js");
  const win = new Window({ url: "https://lavallealquila.com.ar/?demo=1#/admin" });
  globalThis.window = win;
  globalThis.document = win.document;
  globalThis.location = win.location;
  globalThis.HTMLElement = win.HTMLElement;
  globalThis.Node = win.Node;
  globalThis.localStorage = win.localStorage;
  globalThis.sessionStorage = win.sessionStorage;
  const view = document.createElement("div");
  document.body.append(view);
  await renderAdmin(view, { name: "admin", parts: ["admin"], params: new URLSearchParams() }, null);
  const list = view.querySelector("[data-testid=admin-reports]");
  assert.ok(list);
  assert.ok(view.querySelectorAll("[data-testid=admin-report]").length >= 3);
  assert.match(list.textContent, /Departamento casi regalado/);
  const origins = [...view.querySelectorAll("[data-testid=report-origin]")].map((item) => item.textContent);
  assert.ok(origins.includes("Anónima"));
  assert.ok(origins.includes("Con cuenta"));
  const resolve = view.querySelector("[data-testid=resolve-report]");
  assert.ok(resolve);
  assert.ok(view.querySelector("[data-testid=hide-listing], [data-hide]"));
  assert.match(view.querySelector("[data-testid=reports-heading]").textContent, /Denuncias/);
  await win.happyDOM.abort();
  void IDS;
});

test("el store acepta denuncias de avisos y de búsquedas, con tope diario, y se pueden resolver", async () => {
  const { createDemoStore, addReport, adminReports, adminResolveReport, adminHideListing, IDS } = await import("../src/demo-store.js");
  const store = createDemoStore();
  const visitor = "visitante-prueba-abc";
  addReport(store, IDS.casaTulumaya, visitor, "inapropiado", "Comentario de prueba");
  const open = adminReports(store).filter((item) => item.listing_id === IDS.casaTulumaya && !item.resolved_at);
  assert.equal(open.length, 1);
  assert.equal(open[0].reason, "inapropiado");
  assert.match(open[0].subject_title, /Casa con patio/);
  adminResolveReport(store, open[0].id, "admin");
  assert.ok(store.reports.find((item) => item.id === open[0].id).resolved_at);
  adminHideListing(store, IDS.casaTulumaya);
  assert.equal(store.listings.find((item) => item.id === IDS.casaTulumaya).status, "hidden");

  addReport(store, null, visitor, "datos", "El presupuesto no cierra", { seekId: "ffffffff-ffff-4fff-8fff-000000000001" });
  const seeks = adminReports(store).filter((item) => item.seek_id === "ffffffff-ffff-4fff-8fff-000000000001");
  assert.equal(seeks.length, 1);
  assert.match(seeks[0].subject_title, /Busco alquiler/);

  const more = [IDS.deptoPlumero, IDS.local, IDS.terreno, IDS.casaVioletas, IDS.casaAndre, IDS.quincho];
  for (const id of more) addReport(store, id, visitor, "otro", "");
  assert.throws(
    () => addReport(store, IDS.salon, visitor, "otro", ""),
    /límite de denuncias por hoy/,
  );
});
