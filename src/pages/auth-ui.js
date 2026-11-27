import {
  AuthNeedConfirmError,
  isDemo,
  isPasswordRecovery,
  requestPasswordReset,
  resendSignupEmail,
  signInWithGoogle,
  signInWithPassword,
  signUpWithPassword,
  updatePassword,
} from "../api.js";
import { esc } from "../format.js";
import { toast } from "../toast.js";

export const REGRET_MAIL = "jirfcarp@gmail.com";

export function sessionEmail(session) {
  return String(session?.user?.email || session?.profile?.email || "").trim();
}

export function headerAccountLabel(session) {
  return session ? "Mi cuenta" : "Entrar / Crear cuenta";
}

export function regretMailto(email = "") {
  const subject = "Arrepentimiento de suscripción";
  const lines = ["Quiero ejercer el derecho de arrepentimiento de mi suscripción."];
  if (email) lines.push("", `Email de la cuenta: ${email}`);
  return `mailto:${REGRET_MAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(lines.join("\n"))}`;
}

export function legalLinksHtml(email = "") {
  const base = import.meta.env?.BASE_URL || "./";
  return `<nav class="legal" aria-label="Información legal">
    <a href="${base}privacidad.html">Política de privacidad</a>
    <a href="${base}terminos.html">Términos y condiciones</a>
    <a href="${regretMailto(email)}" data-regret data-testid="boton-arrepentimiento">Botón de arrepentimiento</a>
  </nav>`;
}

export function appendLegalFooter(view, email = "") {
  if (!view || view.querySelector("nav.legal")) return;
  view.insertAdjacentHTML("beforeend", legalLinksHtml(email));
}

function emailField(value = "") {
  return `<label class="field">Email
    <input type="email" name="email" required autocomplete="email" inputmode="email" placeholder="tu@email.com" value="${esc(value)}" />
  </label>`;
}

export function authBoxHtml(options = {}) {
  const mode = options.mode || "login";
  const email = options.email || "";
  const tabMode = mode === "signup" ? "signup" : "login";
  const showTabs = mode === "login" || mode === "signup" || mode === "forgot";
  return `<div class="auth-box" data-auth-box data-mode="${esc(mode)}">
    <h2>Entrá o creá tu cuenta</h2>
    <p class="auth-first" data-testid="auth-first">¿Primera vez? Es gratis: creá tu cuenta con tu mail y una contraseña, o entrá con Google. Te mandamos un mail para confirmar. Tu mail no se muestra en el sitio.</p>
    <button type="button" class="btn btn-google" data-google data-testid="google-login"${isDemo() ? " disabled" : ""}>Continuar con Google</button>
    ${isDemo() ? `<p class="fine">Entrar con Google se habilita cuando conectás Supabase. Mientras tanto usá una cuenta de ejemplo.</p>` : ""}
    <p class="or">o con tu email</p>
    <div class="segment" data-auth-tabs ${showTabs && (mode === "login" || mode === "signup") ? "" : "hidden"}>
      <button type="button" class="seg${tabMode === "login" ? " is-on" : ""}" data-auth-mode="login" data-testid="auth-tab-login">Entrar</button>
      <button type="button" class="seg${tabMode === "signup" ? " is-on" : ""}" data-auth-mode="signup" data-testid="auth-tab-signup">Creá tu cuenta</button>
    </div>
    <form data-auth-panel="login" data-testid="auth-login" ${mode === "login" ? "" : "hidden"}>
      ${emailField(email)}
      <label class="field">Contraseña
        <input type="password" name="password" required autocomplete="current-password" minlength="8" />
      </label>
      <div class="sheet-actions">
        <button class="btn btn-primary btn-block" type="submit">Entrar</button>
      </div>
      <p class="auth-links">
        <button type="button" class="linkish" data-auth-mode="forgot" data-testid="auth-forgot-link">Olvidé mi contraseña</button>
        <button type="button" class="linkish" data-auth-mode="forgot" data-testid="auth-create-password">Creá tu contraseña</button>
      </p>
    </form>
    <form data-auth-panel="signup" data-testid="auth-signup" ${mode === "signup" ? "" : "hidden"}>
      ${emailField(email)}
      <label class="field">Contraseña
        <input type="password" name="password" required autocomplete="new-password" minlength="8" placeholder="Mínimo 8 caracteres" />
      </label>
      <label class="field">Repetir contraseña
        <input type="password" name="repeat" required autocomplete="new-password" minlength="8" />
      </label>
      <div class="sheet-actions">
        <button class="btn btn-primary btn-block" type="submit">Creá tu cuenta</button>
      </div>
      <p class="fine">Al crearla te mandamos un mail para confirmarla. Hasta que no lo confirmes, no vas a poder entrar.</p>
    </form>
    <form data-auth-panel="forgot" data-testid="auth-forgot" ${mode === "forgot" ? "" : "hidden"}>
      <p>Poné tu mail y te mandamos un link para crear o cambiar la contraseña. Sirve también si tu cuenta todavía no tiene.</p>
      ${emailField(email)}
      <div class="sheet-actions">
        <button class="btn btn-primary btn-block" type="submit">Mandame el link</button>
      </div>
      <p class="auth-links"><button type="button" class="linkish" data-auth-mode="login">Volver a entrar</button></p>
    </form>
    <div data-auth-panel="check-email" data-testid="auth-check-email" ${mode === "check-email" ? "" : "hidden"}>
      <p class="auth-notice">Te mandamos un mail a <strong data-auth-email>${esc(email)}</strong> para confirmar tu cuenta (revisá también Promociones/Spam).</p>
      <p>En el mail hay un botón «Confirmar mi cuenta». Tocálo y volvés acá con la sesión iniciada, para completar tu nombre y WhatsApp.</p>
      <div class="sheet-actions">
        <button type="button" class="btn btn-primary btn-block" data-auth-resend>Reenviar el mail</button>
      </div>
      <p class="auth-links"><button type="button" class="linkish" data-auth-mode="login">Ya confirmé, quiero entrar</button></p>
    </div>
    <div data-auth-panel="unconfirmed" data-testid="auth-unconfirmed" ${mode === "unconfirmed" ? "" : "hidden"}>
      <p class="auth-notice">Primero tenés que confirmar tu mail. Te lo mandamos a <strong data-auth-email>${esc(email)}</strong>. Revisá la bandeja de entrada, Promociones y Spam.</p>
      <div class="sheet-actions">
        <button type="button" class="btn btn-primary btn-block" data-auth-resend>Reenviar el mail de confirmación</button>
      </div>
      <p class="auth-links"><button type="button" class="linkish" data-auth-mode="login">Volver a entrar</button></p>
    </div>
    <div data-auth-panel="forgot-sent" data-testid="auth-forgot-sent" ${mode === "forgot-sent" ? "" : "hidden"}>
      <p class="auth-notice">Si <strong data-auth-email>${esc(email)}</strong> tiene una cuenta, te mandamos un link para crear o cambiar la contraseña. Revisá también Promociones y Spam.</p>
      <p class="auth-links"><button type="button" class="linkish" data-auth-mode="login">Volver a entrar</button></p>
    </div>
  </div>`;
}

function currentEmail(root, fallback = "") {
  const visible = root.querySelector("[data-auth-panel]:not([hidden]) input[name=email]");
  const any = root.querySelector("input[name=email]");
  const labeled = root.querySelector("[data-auth-email]");
  return String(visible?.value || labeled?.textContent || any?.value || fallback || "").trim();
}

function setAuthMode(root, mode, email) {
  const box = root.matches?.("[data-auth-box]") ? root : root.querySelector("[data-auth-box]");
  if (!box) return;
  box.setAttribute("data-mode", mode);
  const mail = email || currentEmail(root);
  box.querySelectorAll("[data-auth-panel]").forEach((panel) => {
    const on = panel.getAttribute("data-auth-panel") === mode;
    panel.toggleAttribute("hidden", !on);
  });
  const tabs = box.querySelector("[data-auth-tabs]");
  if (tabs) tabs.toggleAttribute("hidden", mode !== "login" && mode !== "signup");
  box.querySelectorAll("[data-auth-mode].seg").forEach((button) => {
    button.classList.toggle("is-on", button.getAttribute("data-auth-mode") === mode);
  });
  if (mail) {
    box.querySelectorAll("input[name=email]").forEach((input) => {
      input.value = mail;
    });
    box.querySelectorAll("[data-auth-email]").forEach((node) => {
      node.textContent = mail;
    });
  }
}

export function bindAuth(root, onReady) {
  const box = root.querySelector("[data-auth-box]");
  if (!box) return;

  box.querySelector("[data-google]")?.addEventListener("click", async () => {
    try {
      await signInWithGoogle();
    } catch (error) {
      toast(error.message);
    }
  });

  box.querySelectorAll("[data-auth-mode]").forEach((button) => {
    button.addEventListener("click", () => setAuthMode(box, button.getAttribute("data-auth-mode"), currentEmail(box)));
  });

  const login = box.querySelector("[data-auth-panel=login]");
  login?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const data = new FormData(login);
    const email = String(data.get("email") || "");
    try {
      await signInWithPassword(email, String(data.get("password") || ""));
      toast("Ya entraste. Si falta, completá tu nombre y WhatsApp.");
      await onReady();
    } catch (error) {
      if (error instanceof AuthNeedConfirmError) {
        setAuthMode(box, "unconfirmed", error.email || email);
        return;
      }
      toast(error.message);
    }
  });

  const signup = box.querySelector("[data-auth-panel=signup]");
  signup?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const data = new FormData(signup);
    const email = String(data.get("email") || "");
    try {
      const result = await signUpWithPassword(email, String(data.get("password") || ""), String(data.get("repeat") || ""));
      if (result.status === "session") {
        toast("Tu cuenta está lista. Completá tu nombre y WhatsApp.");
        await onReady();
        return;
      }
      setAuthMode(box, "check-email", result.email || email);
    } catch (error) {
      toast(error.message);
    }
  });

  const forgot = box.querySelector("[data-auth-panel=forgot]");
  forgot?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const data = new FormData(forgot);
    const email = String(data.get("email") || "");
    try {
      await requestPasswordReset(email);
      setAuthMode(box, "forgot-sent", email);
    } catch (error) {
      toast(error.message);
    }
  });

  box.querySelectorAll("[data-auth-resend]").forEach((button) => {
    button.addEventListener("click", async () => {
      try {
        await resendSignupEmail(currentEmail(box));
        toast("Listo, te reenviamos el mail. Revisá también Promociones y Spam.");
      } catch (error) {
        toast(error.message);
      }
    });
  });
}

export function recoveryPasswordHtml() {
  const title = isPasswordRecovery() ? "Elegí tu contraseña nueva" : "Creá o cambiá tu contraseña";
  const help = isPasswordRecovery()
    ? "Poné una contraseña nueva (mínimo 8 caracteres) para entrar las próximas veces."
    : "Si entraste con Google o tu cuenta todavía no tiene contraseña, podés crearla acá.";
  return `<form class="auth-box" data-password-form data-testid="password-form">
    <h2>${title}</h2>
    <p>${help}</p>
    <label class="field">Contraseña nueva
      <input type="password" name="password" required autocomplete="new-password" minlength="8" placeholder="Mínimo 8 caracteres" />
    </label>
    <label class="field">Repetir contraseña
      <input type="password" name="repeat" required autocomplete="new-password" minlength="8" />
    </label>
    <div class="sheet-actions">
      <button class="btn btn-primary btn-block" type="submit">Guardar contraseña</button>
    </div>
  </form>`;
}

export function bindPasswordForm(root, onReady) {
  const form = root.querySelector("[data-password-form]");
  if (!form) return;
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const data = new FormData(form);
    try {
      await updatePassword(String(data.get("password") || ""), String(data.get("repeat") || ""));
      toast("Contraseña guardada. Las próximas veces podés entrar con tu mail y esa contraseña.");
      await onReady();
    } catch (error) {
      toast(error.message);
    }
  });
}

export function demoLoginsHtml(accounts) {
  if (!isDemo()) return "";
  return `<details class="demo-logins">
    <summary>Probar con una cuenta de ejemplo</summary>
    <div class="stack">
      ${accounts.map((account) => `<button type="button" class="btn btn-ghost" data-demo="${esc(account.id)}"><strong>${esc(account.label)}</strong><small>${esc(account.detail)}</small></button>`).join("")}
    </div>
  </details>`;
}
