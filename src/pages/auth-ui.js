import { isDemo, requestEmailCode, signInWithGoogle, verifyEmailCode } from "../api.js";
import { esc } from "../format.js";
import { toast } from "../toast.js";

export function legalLinksHtml() {
  const base = import.meta.env.BASE_URL;
  return `<nav class="legal" aria-label="Información legal">
    <a href="${base}privacidad.html">Política de privacidad</a>
    <a href="${base}terminos.html">Términos y condiciones</a>
  </nav>`;
}

export function authBoxHtml() {
  if (isDemo()) {
    return `<div class="auth-box">
      <p class="fine">Entrar con Google se habilita cuando conectás Supabase. Mientras tanto usá una cuenta de ejemplo.</p>
    </div>`;
  }
  return `<div class="auth-box">
    <h2>Entrá</h2>
    <button type="button" class="btn btn-google" data-google data-testid="google-login">Entrar con Google</button>
    <p class="or">o con tu email</p>
    <form data-auth>
      <p>El correo puede traer un enlace o un código. El código suele tener 8 números y puede tener entre 6 y 10. No hace falta contraseña.</p>
      <label class="field">Email
        <input type="email" name="email" required autocomplete="email" inputmode="email" placeholder="tu@email.com" />
      </label>
      <label class="field">Código del correo
        <input name="token" inputmode="numeric" autocomplete="one-time-code" minlength="6" maxlength="10" pattern="[0-9]{6,10}" placeholder="Si te llegó un código, ponelo acá" />
      </label>
      <div class="sheet-actions">
        <button class="btn btn-primary" type="submit">Mandame el correo</button>
        <button class="btn btn-ghost" type="button" data-verify>Entrar con el código</button>
      </div>
      <p class="fine">Si el mensaje trae un enlace, abrilo en este teléfono. Si trae un código, escribilo arriba.</p>
    </form>
  </div>`;
}

export function bindAuth(root, onReady) {
  root.querySelector("[data-google]")?.addEventListener("click", async () => {
    try {
      await signInWithGoogle();
    } catch (error) {
      toast(error.message);
    }
  });
  const form = root.querySelector("[data-auth]");
  if (!form) return;
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    try {
      await requestEmailCode(String(new FormData(form).get("email") || ""));
      toast("Listo. Revisá el correo: puede llegar un enlace o un código.");
    } catch (error) {
      toast(error.message);
    }
  });
  form.querySelector("[data-verify]")?.addEventListener("click", async () => {
    const data = new FormData(form);
    try {
      await verifyEmailCode(String(data.get("email") || ""), String(data.get("token") || ""));
      toast("Ya entraste. Si falta, completá tu nombre y WhatsApp.");
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
