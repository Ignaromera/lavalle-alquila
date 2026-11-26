import { isDemo, requestEmailCode, verifyEmailCode } from "../api.js";
import { esc } from "../format.js";
import { toast } from "../toast.js";

export function authBoxHtml() {
  if (isDemo()) return "";
  return `<form class="auth-box" data-auth>
    <h2>Entrá con tu email</h2>
    <p>Te mandamos un código de un solo uso y un enlace. No hace falta contraseña.</p>
    <label class="field">Email
      <input type="email" name="email" required autocomplete="email" inputmode="email" placeholder="tu@email.com" />
    </label>
    <label class="field">Código del correo
      <input name="token" inputmode="numeric" autocomplete="one-time-code" maxlength="12" placeholder="Si te llegó un código, ponelo acá" />
    </label>
    <div class="sheet-actions">
      <button class="btn btn-primary" type="submit">Mandame el código</button>
      <button class="btn btn-ghost" type="button" data-verify>Entrar</button>
    </div>
    <p class="fine">Si el correo trae un enlace, abrilo en este teléfono.</p>
  </form>`;
}

export function bindAuth(root, onReady) {
  const form = root.querySelector("[data-auth]");
  if (!form) return;
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    try {
      await requestEmailCode(String(new FormData(form).get("email") || ""));
      toast("Listo. Revisá tu correo: puede llegar un código o un enlace.");
    } catch (error) {
      toast(error.message);
    }
  });
  form.querySelector("[data-verify]")?.addEventListener("click", async () => {
    const data = new FormData(form);
    try {
      await verifyEmailCode(String(data.get("email") || ""), String(data.get("token") || ""));
      toast("Ya entraste.");
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
