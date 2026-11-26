import assert from "node:assert/strict";
import test from "node:test";
import { createDemoStore, IDS, publicListings } from "../src/demo-store.js";
import {
  applyFilters,
  filtersFromParams,
  isNewListing,
  normalizeSort,
  queryFromFilters,
  SORT_PRECIO_ASC,
  SORT_PRECIO_DESC,
  SORT_RECIENTES,
  SORT_STORAGE_KEY,
  storeSort,
} from "../src/filter.js";
import { listingCard } from "../src/cards.js";

function memoryStorage() {
  const store = new Map();
  return {
    getItem(key) {
      return store.has(key) ? store.get(key) : null;
    },
    setItem(key, value) {
      store.set(key, String(value));
    },
    removeItem(key) {
      store.delete(key);
    },
  };
}

function withStorage(run) {
  const previous = globalThis.sessionStorage;
  globalThis.sessionStorage = memoryStorage();
  try {
    return run();
  } finally {
    globalThis.sessionStorage = previous;
  }
}

test("por defecto los destacados van primero y después los más recientes", () => {
  const rows = publicListings(createDemoStore(), { kind: "housing" });
  assert.equal(rows[0].id, IDS.casaTulumaya);
  const rest = rows.slice(1).map((row) => row.created_at);
  const sorted = [...rest].sort((a, b) => new Date(b) - new Date(a));
  assert.deepEqual(rest, sorted);
});

test("en menor y mayor precio el destacado no se pincha arriba", () => {
  const cheap = publicListings(createDemoStore(), { kind: "housing", sort: SORT_PRECIO_ASC });
  // deptoJocoli es más barato pero está oculto por denuncias; el más barato visible es el terreno.
  assert.equal(cheap[0].id, IDS.terreno);
  assert.equal(cheap[0].price_ars, 150000);
  assert.ok(cheap.at(-1).featured);
  const prices = cheap.map((row) => row.price_ars);
  assert.deepEqual(prices, [...prices].sort((a, b) => a - b));

  const dear = publicListings(createDemoStore(), { kind: "housing", sort: SORT_PRECIO_DESC });
  assert.equal(dear[0].id, IDS.casaTulumaya);
  assert.deepEqual(dear.map((row) => row.price_ars), [...prices].reverse());
});

test("el orden también aplica a quinchos", () => {
  const cheap = publicListings(createDemoStore(), { kind: "venue", sort: SORT_PRECIO_ASC });
  assert.equal(cheap[0].price_ars, 180000);
  assert.equal(cheap[0].id, IDS.quincho);
  assert.equal(cheap[1].id, IDS.salon);
});

test("Nuevo cubre avisos de los últimos 7 días, inclusive", () => {
  const now = new Date("2026-11-26T15:00:00-03:00");
  assert.equal(isNewListing({ created_at: "2026-11-26T12:00:00-03:00" }, now), true);
  assert.equal(isNewListing({ created_at: "2026-11-19T15:00:00-03:00" }, now), true);
  assert.equal(isNewListing({ created_at: "2026-11-19T14:59:59-03:00" }, now), false);
  assert.equal(isNewListing({ created_at: "2026-11-27T15:00:00-03:00" }, now), false);
  assert.equal(isNewListing({ created_at: "" }, now), false);
  assert.equal(isNewListing({}, now), false);
});

test("la tarjeta y applyFilters respetan Nuevo según created_at", () => {
  const store = createDemoStore();
  const rows = publicListings(store, { kind: "housing" });
  const fresh = rows.find((row) => row.id === IDS.terreno);
  const old = rows.find((row) => row.id === IDS.casaTulumaya);
  assert.equal(isNewListing(fresh), true);
  assert.equal(isNewListing(old), false);
  assert.match(listingCard(fresh), /badge-nuevo">Nuevo/);
  assert.doesNotMatch(listingCard(old), /badge-nuevo/);
  // El destacado no lleva Nuevo (tiene más de 7 días), para no chocar las dos pastillas.
  assert.match(listingCard(old), /badge-gold">Destacado/);
});

test("el parámetro orden se lee, se guarda y no cuenta como filtro", () => {
  withStorage(() => {
    const params = new URLSearchParams("orden=precio-asc&max=400000");
    const filters = filtersFromParams(params, "housing");
    assert.equal(filters.sort, SORT_PRECIO_ASC);
    assert.equal(sessionStorage.getItem(SORT_STORAGE_KEY), SORT_PRECIO_ASC);
    const query = queryFromFilters(filters);
    assert.match(query, /orden=precio-asc/);
    assert.match(query, /max=400000/);
    const defaults = queryFromFilters({ ...filters, sort: SORT_RECIENTES, maxPrice: "" });
    assert.equal(defaults, "");
    storeSort(SORT_RECIENTES);
    assert.equal(sessionStorage.getItem(SORT_STORAGE_KEY), null);
    const remembered = filtersFromParams(new URLSearchParams(), "housing");
    // acabamos de limpiar el storage
    assert.equal(remembered.sort, SORT_RECIENTES);
  });
});

test("si la URL no trae orden, se usa el de sessionStorage", () => {
  withStorage(() => {
    storeSort(SORT_PRECIO_DESC);
    const filters = filtersFromParams(new URLSearchParams(), "housing");
    assert.equal(filters.sort, SORT_PRECIO_DESC);
    assert.equal(normalizeSort("sarasa"), SORT_RECIENTES);
  });
});

test("applyFilters combina filtros y orden por precio", () => {
  const listings = [
    { status: "active", expires_at: "2099-01-01", type: "casa", featured: true, created_at: "2026-01-01", price_ars: 500, district: "A" },
    { status: "active", expires_at: "2099-01-01", type: "casa", featured: false, created_at: "2026-06-01", price_ars: 100, district: "A" },
    { status: "active", expires_at: "2099-01-01", type: "casa", featured: false, created_at: "2026-03-01", price_ars: 200, district: "A" },
  ];
  const recent = applyFilters(listings, { kind: "housing" });
  assert.equal(recent[0].price_ars, 500);
  const cheap = applyFilters(listings, { kind: "housing", sort: SORT_PRECIO_ASC });
  assert.deepEqual(cheap.map((row) => row.price_ars), [100, 200, 500]);
});
