import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { Window } from "happy-dom";
import { appendLegalFooter, legalLinksHtml, REGRET_HREF } from "../src/pages/auth-ui.js";
import { parseRoute } from "../src/router.js";

test("el pie trae Cómo funciona, Planes, Términos, Privacidad y el Botón de arrepentimiento", () => {
  const win = new Window({ url: "https://lavallealquila.com.ar/" });
  win.document.body.innerHTML = legalLinksHtml();
  const link = win.document.querySelector("[data-testid=boton-arrepentimiento]");
  assert.ok(link, "el pie tiene que mostrar el botón");
  assert.equal(link.textContent, "Botón de arrepentimiento");
  assert.equal(link.getAttribute("href"), "#/arrepentimiento");
  assert.equal(REGRET_HREF, "#/arrepentimiento");
  assert.equal(win.document.querySelector("[data-testid=footer-como-funciona]").getAttribute("href"), "#/como-funciona");
  assert.equal(win.document.querySelector("[data-testid=footer-planes]").getAttribute("href"), "#/planes");
  assert.match(win.document.querySelector("[data-testid=footer-terminos]").getAttribute("href"), /terminos\.html$/);
  assert.match(win.document.querySelector("[data-testid=footer-privacidad]").getAttribute("href"), /privacidad\.html$/);
  win.happyDOM.close();
});

test("appendLegalFooter agrega el pie una sola vez", () => {
  const win = new Window({ url: "https://lavallealquila.com.ar/" });
  const view = win.document.createElement("div");
  win.document.body.append(view);
  appendLegalFooter(view);
  appendLegalFooter(view);
  assert.equal(view.querySelectorAll("nav.legal").length, 1);
  assert.equal(view.querySelectorAll("[data-testid=boton-arrepentimiento]").length, 1);
  win.happyDOM.close();
});

test("las rutas nuevas: #/como-funciona y #/arrepentimiento", () => {
  globalThis.location = { hash: "#/como-funciona" };
  assert.equal(parseRoute().name, "how");
  globalThis.location = { hash: "#/arrepentimiento" };
  assert.equal(parseRoute().name, "regret");
  delete globalThis.location;
});

for (const page of ["terminos", "privacidad"]) {
  test(`${page}.html tiene el Botón de arrepentimiento y los links del pie`, () => {
    const html = readFileSync(new URL(`../public/${page}.html`, import.meta.url), "utf8");
    assert.match(html, /<a class="regret" href="\.\/#\/arrepentimiento"[^>]*>Botón de arrepentimiento<\/a>/);
    for (const href of ["./#/como-funciona", "./#/planes", "./terminos.html", "./privacidad.html"]) {
      assert.ok(html.includes(`href="${href}"`), `falta ${href}`);
    }
    assert.doesNotMatch(html, /borrador|pendiente de revisión/i, "la nota de borrador no va en el sitio público");
    assert.doesNotMatch(html, /\b(3|tres)\s+denuncias\b/i, "nunca se publica el umbral de ocultamiento");
  });
}

test("términos: arrepentimiento de 10 días, renovación, cancelar, jurisdicción Mendoza y Defensa del Consumidor", () => {
  const html = readFileSync(new URL("../public/terminos.html", import.meta.url), "utf8");
  for (const re of [/id="arrepentimiento"/, /10 días corridos/, /artículo 34 de la Ley 24\.240/, /Resolución 424\/2020/,
    /renuevan solos/, /«Mi suscripción»/, /Monotributo/, /CUIT 20-44438000-5/, /Barrio Epi Equen casa 8, Tulumaya, Lavalle, Mendoza/, /Provincia de Mendoza/, /No es una inmobiliaria ni un intermediario/i,
    /https:\/\/www\.argentina\.gob\.ar\/produccion\/defensadelconsumidor\/formulario/, /Vigentes desde el 27 de noviembre de 2026/,
    /\$6\.900/, /\$14\.900/, /\$100\.000/, /no verifica la identidad/i]) {
    assert.match(html, re);
  }
});

test("privacidad: Ley 25.326, proveedores y la leyenda de la AAIP", () => {
  const html = readFileSync(new URL("../public/privacidad.html", import.meta.url), "utf8");
  for (const re of [/Ley 25\.326/, /CUIT 20-44438000-5/, /Barrio Epi Equen casa 8, Tulumaya, Lavalle, Mendoza/, /Supabase/, /Mercado Pago/, /nunca los ve ni los guarda/, /Google/, /Resend/,
    /La AGENCIA DE ACCESO A LA INFORMACIÓN PÚBLICA, en su carácter de Órgano de Control de la Ley N° 25\.326, tiene la atribución de atender las denuncias y reclamos/,
    /artículo 14, inciso 3/, /borrar tu cuenta entera/]) {
    assert.match(html, re);
  }
});
