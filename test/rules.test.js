import assert from "node:assert/strict";
import test from "node:test";
import { createDemoStore, IDS, addListing, addProfile, addReport, emptyStore, publicListings, renewListing, requestBooking, setBookingStatus, toggleSlot } from "../src/demo-store.js";
import { pointInLavalle } from "../src/geo.js";
import { normalizeWhatsapp } from "../src/format.js";

test("el polígono deja Lavalle adentro y la capital afuera", () => {
  assert.equal(pointInLavalle(-32.7215, -68.5958), true);
  assert.equal(pointInLavalle(-32.70825, -68.67405), true);
  assert.equal(pointInLavalle(-32.8895, -68.8458), false);
  assert.equal(pointInLavalle(-31.537, -68.536), false);
});

test("los avisos de ejemplo caen dentro de Lavalle", () => {
  const store = createDemoStore();
  for (const listing of store.listings) {
    assert.equal(pointInLavalle(listing.lat, listing.lng), true, listing.title);
  }
});

test("el inicio muestra 6 alquileres y el destacado primero", () => {
  const rows = publicListings(createDemoStore(), { kind: "housing" });
  assert.equal(rows.length, 6);
  assert.equal(rows[0].id, IDS.casaTulumaya);
  assert.equal(rows.every((row) => row.example), true);
});

test("los quinchos salen en su sección y uno tiene turnero", () => {
  const rows = publicListings(createDemoStore(), { kind: "venue" });
  assert.equal(rows.length, 2);
  assert.equal(rows[0].id, IDS.quincho);
  assert.equal(rows.find((row) => row.id === IDS.quincho).booking_enabled, true);
  assert.equal(rows.find((row) => row.id === IDS.salon).booking_enabled, false);
});

test("normaliza el WhatsApp de Mendoza", () => {
  assert.equal(normalizeWhatsapp("261 555-1234"), "5492615551234");
  assert.equal(normalizeWhatsapp("+54 9 261 555 1234"), "5492615551234");
});

test("el plan gratis frena el segundo aviso", () => {
  const store = createDemoStore();
  assert.throws(
    () => addListing(store, IDS.carlos, listingInput()),
    /aviso/,
  );
});

test("un aviso vencido no se ve y renovarlo lo devuelve", () => {
  const store = emptyStore();
  const person = addProfile(store, { full_name: "Eva Ríos", whatsapp: "2615550000" });
  const created = addListing(store, person.id, listingInput());
  created.expires_at = new Date(Date.now() - 86400000).toISOString();
  const raw = store.listings.find((item) => item.id === created.id);
  raw.expires_at = created.expires_at;
  assert.equal(publicListings(store, { kind: "housing" }).length, 0);
  renewListing(store, person.id, created.id);
  assert.equal(publicListings(store, { kind: "housing" }).length, 1);
});

test("la tercera denuncia oculta el aviso", () => {
  const store = emptyStore();
  const person = addProfile(store, { full_name: "Eva Ríos", whatsapp: "2615550000" });
  const created = addListing(store, person.id, listingInput());
  addReport(store, created.id, "v1", "estafa", "seña");
  addReport(store, created.id, "v2", "falso", "");
  assert.equal(publicListings(store, { kind: "housing" }).length, 1);
  addReport(store, created.id, "v3", "otro", "");
  assert.equal(publicListings(store, { kind: "housing" }).length, 0);
  assert.throws(() => addReport(store, created.id, "v1", "otro", ""), /Ya denunciaste/);
});

test("no se puede reservar dos veces el mismo turno", () => {
  const store = createDemoStore();
  const open = store.slots.find((slot) => slot.listing_id === IDS.quincho && slot.status === "open");
  requestBooking(store, { slotId: open.id, name: "Lila", whatsapp: "2614440000", guests: 10, note: "Asado" });
  assert.equal(store.slots.find((slot) => slot.id === open.id).status, "held");
  assert.throws(
    () => requestBooking(store, { slotId: open.id, name: "Otra", whatsapp: "2614440001", guests: 8, note: "" }),
    /tomado|consulta/,
  );
});

test("confirmar deja el turno tomado y no acepta otro confirmado", () => {
  const store = createDemoStore();
  const open = store.slots.find((slot) => slot.listing_id === IDS.quincho && slot.status === "open");
  const request = requestBooking(store, { slotId: open.id, name: "Lila", whatsapp: "2614440000", guests: 10, note: "" });
  setBookingStatus(store, IDS.marina, request.id, "confirmed");
  assert.equal(store.slots.find((slot) => slot.id === open.id).status, "confirmed");
  assert.throws(
    () => requestBooking(store, { slotId: open.id, name: "Otra", whatsapp: "2614440001", guests: 4, note: "" }),
    /tomado|consulta/,
  );
});

test("sin el flag no se abre el turnero", () => {
  const store = createDemoStore();
  const day = new Date();
  day.setDate(day.getDate() + 3);
  const iso = day.toISOString().slice(0, 10);
  assert.throws(() => toggleSlot(store, IDS.rosa, IDS.salon, iso, "dia", true), /turnero/);
});

test("rechaza un punto fuera del departamento", () => {
  const store = emptyStore();
  const person = addProfile(store, { full_name: "Eva Ríos", whatsapp: "2615550000" });
  assert.throws(
    () => addListing(store, person.id, { ...listingInput(), lat: -32.8895, lng: -68.8458 }),
    /Lavalle/,
  );
});

function listingInput() {
  return {
    type: "casa",
    title: "Casa de prueba con patio",
    description: "Una casa de prueba con patio, agua y una parra en el fondo.",
    price_ars: 300000,
    price_unit: "mes",
    district: "Villa Tulumaya",
    address: "San Martín 100",
    requirements: "Garantía o depósito.",
    pets_allowed: true,
    guarantee_required: true,
    lat: -32.7215,
    lng: -68.5958,
    photo_urls: ["demo/casa-tulumaya.svg"],
  };
}
