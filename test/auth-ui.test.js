import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { Window } from "happy-dom";
import { parseAuthLinkParams, validatePasswords } from "../src/api.js";
import { authBoxHtml, bindAuth, headerAccountLabel, recoveryPasswordHtml } from "../src/pages/auth-ui.js";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

function installDom(url = "https://lavallealquila.com.ar/?demo=1#/cuenta") {
  const win = new Window({ url });
  globalThis.window = win;
  globalThis.document = win.document;
  globalThis.HTMLElement = win.HTMLElement;
  globalThis.Node = win.Node;
  globalThis.Element = win.Element;
  globalThis.MutationObserver = win.MutationObserver;
  globalThis.localStorage = win.localStorage;
  globalThis.sessionStorage = win.sessionStorage;
  globalThis.location = win.location;
  globalThis.history = win.history;
  try { globalThis.getComputedStyle = win.getComputedStyle.bind(win); } catch { /* node ya trae uno */ }
  return win;
}

test("shouldCreateUser no aparece en false: el alta es con mail y contraseña", () => {
  const src = readFileSync(join(root, "src/api.js"), "utf8");
  assert.equal(/shouldCreateUser\s*:\s*false/.test(src), false);
  assert.match(src, /signUpWithPassword/);
  assert.equal(/requestEmailCode/.test(src), false);
});

test("la contraseña pide 8 caracteres y que coincidan", () => {
  assert.throws(() => validatePasswords("corta", "corta"), /al menos 8/);
  assert.throws(() => validatePasswords("suficiente", "distinta1"), /no coinciden/);
  assert.doesNotThrow(() => validatePasswords("suficiente", "suficiente"));
});

test("el link de confirmación y el de contraseña se leen desde la URL", () => {
  const signup = parseAuthLinkParams("https://lavallealquila.com.ar/?token_hash=abc123&type=signup#/cuenta");
  assert.equal(signup.tokenHash, "abc123");
  assert.equal(signup.type, "signup");
  const recovery = parseAuthLinkParams("https://lavallealquila.com.ar/#/cuenta?token_hash=xyz&type=recovery");
  assert.equal(recovery.tokenHash, "xyz");
  assert.equal(recovery.type, "recovery");
  const broken = parseAuthLinkParams("https://lavallealquila.com.ar/#error=access_denied&error_description=otp_expired");
  assert.match(broken.error, /otp_expired|access_denied/);
});

test("las plantillas de confirmación y de contraseña usan token_hash y el botón pedido", () => {
  const confirm = readFileSync(join(root, "supabase/emails/01-confirmar-mail.html"), "utf8");
  assert.match(confirm, /Confirmar mi cuenta/);
  assert.match(confirm, /token_hash=\{\{ \.TokenHash \}\}/);
  assert.match(confirm, /type=signup/);
  assert.match(confirm, /#\/cuenta/);
  const reset = readFileSync(join(root, "supabase/emails/02-recuperar-contrasena.html"), "utf8");
  assert.match(reset, /token_hash=\{\{ \.TokenHash \}\}/);
  assert.match(reset, /type=recovery/);
  assert.match(reset, /#\/cuenta/);
});

test("la pantalla de ingreso muestra Entrar, Creá tu cuenta y el destacado de primera vez", async () => {
  const win = installDom();
  const { renderAccount } = await import("../src/pages/account.js");
  const view = document.createElement("div");
  document.body.append(view);
  await renderAccount(view, { parts: ["cuenta"], params: new URLSearchParams(), name: "account" }, null);
  assert.match(view.textContent, /Entrá o creá tu cuenta/);
  assert.match(view.querySelector("[data-testid=auth-first]").textContent, /Primera vez/);
  assert.match(view.querySelector("[data-testid=auth-first]").textContent, /contraseña/);
  assert.match(view.textContent, /Tu mail no se muestra en el sitio/);
  assert.equal(view.querySelector("[data-testid=auth-tab-signup]").textContent, "Creá tu cuenta");
  assert.equal(view.querySelector("[data-testid=google-login]").textContent, "Continuar con Google");
  assert.match(view.textContent, /Olvidé mi contraseña/);
  assert.match(view.textContent, /Creá tu contraseña/);
  assert.equal(view.querySelector("[data-auth-panel=login]").hidden, false);
  assert.equal(view.querySelector("[data-auth-panel=signup]").hidden, true);
  view.querySelector("[data-testid=auth-tab-signup]").click();
  assert.equal(view.querySelector("[data-auth-panel=signup]").hidden, false);
  assert.equal(view.querySelector("[data-auth-panel=login]").hidden, true);
  assert.ok(view.querySelector("[data-auth-panel=signup] input[name=repeat]"));
  assert.equal(view.querySelector("[data-auth-panel=signup] button[type=submit]").textContent, "Creá tu cuenta");
  view.querySelector("[data-testid=auth-forgot-link]").click();
  assert.equal(view.querySelector("[data-auth-panel=forgot]").hidden, false);
  assert.match(view.querySelector("[data-auth-panel=forgot]").textContent, /crear o cambiar la contraseña/);
  win.happyDOM.close();
});

test("después de registrarse se muestra el aviso de confirmar el mail, con reenvío", () => {
  const win = installDom();
  document.body.innerHTML = authBoxHtml({ mode: "check-email", email: "juan@ejemplo.test" });
  const notice = document.querySelector("[data-testid=auth-check-email]");
  assert.equal(notice.hidden, false);
  assert.match(notice.textContent, /Te mandamos un mail a juan@ejemplo\.test para confirmar tu cuenta/);
  assert.match(notice.textContent, /Promociones\/Spam/);
  assert.match(notice.textContent, /Confirmar mi cuenta/);
  assert.ok(document.querySelector("[data-auth-resend]"));
  document.body.innerHTML = authBoxHtml({ mode: "unconfirmed", email: "juan@ejemplo.test" });
  const blocked = document.querySelector("[data-testid=auth-unconfirmed]");
  assert.equal(blocked.hidden, false);
  assert.match(blocked.textContent, /Primero tenés que confirmar tu mail/);
  assert.match(blocked.textContent, /Reenviar el mail de confirmación/);
  win.happyDOM.close();
});

test("el encabezado sin sesión dice Entrar / Crear cuenta", () => {
  assert.equal(headerAccountLabel(""), "Entrar / Crear cuenta");
  assert.equal(headerAccountLabel(null), "Entrar / Crear cuenta");
  assert.equal(headerAccountLabel("Ignacio"), "Ignacio");
});

test("el formulario de contraseña nueva aparece en la cuenta cuando hay que crearla", () => {
  const win = installDom();
  document.body.innerHTML = recoveryPasswordHtml();
  const form = document.querySelector("[data-testid=password-form]");
  assert.ok(form);
  assert.ok(form.querySelector("input[name=repeat]"));
  win.happyDOM.close();
});

// Evita que bindAuth quede sin usar en el árbol de tests.
test("bindAuth conecta las pestañas de Entrar y Creá tu cuenta", () => {
  const win = installDom();
  document.body.innerHTML = authBoxHtml({ mode: "login" });
  bindAuth(document.body, async () => {});
  document.querySelector("[data-testid=auth-tab-signup]").click();
  assert.equal(document.querySelector("[data-auth-panel=signup]").hidden, false);
  win.happyDOM.close();
});
