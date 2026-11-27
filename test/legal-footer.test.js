import assert from "node:assert/strict";
import test from "node:test";
import { Window } from "happy-dom";
import { appendLegalFooter, legalLinksHtml, REGRET_MAIL, regretMailto } from "../src/pages/auth-ui.js";

function decoded(url) {
  return decodeURIComponent(String(url));
}

test("el pie trae el Botón de arrepentimiento con mailto y el asunto pedido", () => {
  const win = new Window({ url: "https://lavallealquila.com.ar/" });
  win.document.body.innerHTML = legalLinksHtml();
  const link = win.document.querySelector("[data-testid=boton-arrepentimiento]");
  assert.ok(link, "el pie tiene que mostrar el botón");
  assert.equal(link.textContent, "Botón de arrepentimiento");
  const href = link.getAttribute("href") || "";
  assert.equal(href, regretMailto());
  assert.equal(href.startsWith(`mailto:${REGRET_MAIL}?`), true);
  assert.match(decoded(href), /subject=Arrepentimiento de suscripción/);
  assert.match(decoded(href), /Quiero ejercer el derecho de arrepentimiento de mi suscripción/);
  assert.equal(decoded(href).includes("Email de la cuenta"), false);
  assert.ok(win.document.querySelector('a[href$="privacidad.html"]'));
  assert.ok(win.document.querySelector('a[href$="terminos.html"]'));
  const planes = win.document.querySelector("[data-testid=footer-planes]");
  assert.ok(planes);
  assert.equal(planes.getAttribute("href"), "#/planes");
  assert.equal(planes.textContent, "Planes");
  win.happyDOM.close();
});

test("si hay sesión, el mailto del pie lleva el email de la cuenta en el cuerpo", () => {
  const email = "ana@ejemplo.test";
  const win = new Window({ url: "https://lavallealquila.com.ar/" });
  win.document.body.innerHTML = legalLinksHtml(email);
  const link = win.document.querySelector("[data-testid=boton-arrepentimiento]");
  assert.ok(link);
  assert.equal(link.getAttribute("href"), regretMailto(email));
  assert.match(decoded(link.getAttribute("href") || ""), /Email de la cuenta: ana@ejemplo.test/);
  win.happyDOM.close();
});

test("appendLegalFooter agrega el link una sola vez y no pisa un pie que ya estaba", () => {
  const win = new Window({ url: "https://lavallealquila.com.ar/" });
  const view = win.document.createElement("div");
  win.document.body.append(view);

  appendLegalFooter(view);
  assert.equal(view.querySelectorAll("nav.legal").length, 1);
  const link = view.querySelector("[data-testid=boton-arrepentimiento]");
  assert.ok(link);
  assert.equal(link.textContent, "Botón de arrepentimiento");
  assert.match(link.getAttribute("href") || "", new RegExp(`^mailto:${REGRET_MAIL}`));

  appendLegalFooter(view, "ana@ejemplo.test");
  assert.equal(view.querySelectorAll("nav.legal").length, 1, "no tiene que duplicar el pie");
  assert.equal(view.querySelectorAll("[data-testid=boton-arrepentimiento]").length, 1);
  assert.equal(
    decoded(view.querySelector("[data-testid=boton-arrepentimiento]").getAttribute("href") || "").includes("ana@ejemplo.test"),
    false,
    "si ya había pie, no lo reescribe",
  );

  const other = win.document.createElement("div");
  win.document.body.append(other);
  appendLegalFooter(other, "ana@ejemplo.test");
  assert.match(
    decoded(other.querySelector("[data-testid=boton-arrepentimiento]").getAttribute("href") || ""),
    /Email de la cuenta: ana@ejemplo.test/,
  );
  win.happyDOM.close();
});
