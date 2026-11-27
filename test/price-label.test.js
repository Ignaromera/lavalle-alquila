import assert from "node:assert/strict";
import test from "node:test";
import { formatArs, priceLabel } from "../src/format.js";

test("en quinchos y salones el listado muestra desde el horario más barato", () => {
  const cheap = 180000;
  const dear = 220000;
  const listing = {
    type: "quincho",
    price_ars: dear,
    offers: [
      { name: "Noche", price_ars: dear },
      { name: "Mediodía", price_ars: cheap },
    ],
  };
  assert.equal(priceLabel(listing), `desde ${formatArs(cheap)}`);
  assert.equal(priceLabel({ ...listing, type: "salon" }), `desde ${formatArs(cheap)}`);
});

test("un quincho con un solo horario también se muestra como desde", () => {
  const listing = {
    type: "quincho",
    price_ars: 50000,
    price_unit: "dia",
    offers: [{ name: "Día completo", price_ars: 50000 }],
  };
  assert.equal(priceLabel(listing), `desde ${formatArs(50000)}`);
  assert.doesNotMatch(priceLabel(listing), /Día completo/);
  assert.doesNotMatch(priceLabel(listing), /mes/);
});

test("una vivienda sigue mostrando el precio por mes", () => {
  const listing = { type: "casa", price_ars: 450000, price_unit: "mes", offers: [] };
  assert.equal(priceLabel(listing), `${formatArs(450000)} / mes`);
});
