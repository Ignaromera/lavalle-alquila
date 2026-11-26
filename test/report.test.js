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
  const win = new Window({ url: "https://ignaromera.github.io/lavalle-alquila/#/aviso/" + LISTING_ID });
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
