import { isDemo, requestRegret } from "../api.js";
import { esc } from "../format.js";
import { REGRET_DAYS } from "../regret.js";
import { sessionEmail } from "./auth-ui.js";

export function regretFormHtml(email = "") {
  return `<form class="stack regret-form" data-regret-form data-testid="regret-form" novalidate>
    <label class="field">Tu nombre y apellido
      <input name="name" required autocomplete="name" maxlength="120" />
    </label>
    <label class="field">Tu mail (te mandamos el código de trámite)
      <input type="email" name="email" required autocomplete="email" inputmode="email" maxlength="200" value="${esc(email)}" />
    </label>
    <label class="field">Mail de la cuenta de Lavalle Alquila <span class="muted">(si es otro)</span>
      <input type="email" name="account" autocomplete="off" inputmode="email" maxlength="200" placeholder="El mismo de arriba" />
    </label>
    <label class="field">Motivo <span class="muted">(opcional)</span>
      <textarea name="reason" rows="3" maxlength="1000"></textarea>
    </label>
    <p class="form-error error" data-regret-error role="alert" hidden></p>
    <button class="btn btn-primary btn-block" type="submit" data-testid="regret-submit">Enviar pedido de arrepentimiento</button>
  </form>`;
}

export function regretDoneHtml(code, email) {
  return `<div class="sub-card regret-done" data-testid="regret-done" tabindex="-1">
    <p class="eyebrow">Pedido recibido</p>
    <h2>Tu código de trámite es <span class="regret-code" data-testid="regret-code">${esc(code)}</span></h2>
    <p>Guardalo: sirve para cualquier consulta sobre este pedido.${email ? ` También te lo mandamos a <strong>${esc(email)}</strong>.` : ""}</p>
    <p>Si estás dentro de los ${REGRET_DAYS} días corridos desde que contrataste, cancelamos la suscripción y te devolvemos el total que pagaste, por el mismo medio de pago. Te escribimos cuando esté hecho.</p>
    ${isDemo() ? `<p class="fine">Ejemplo: en esta versión de prueba no se guarda ni se manda nada.</p>` : ""}
  </div>`;
}

export async function renderRegret(view, route, session) {
  view.innerHTML = `
    <section class="page-head">
      <h1 tabindex="-1">Botón de arrepentimiento</h1>
      <p class="lede">Si contrataste un plan pago (Plus o Pro), tenés ${REGRET_DAYS} días corridos desde la contratación para arrepentirte, sin dar explicaciones y sin costo. Te devolvemos el total que pagaste.</p>
    </section>
    <div data-regret-slot>${regretFormHtml(sessionEmail(session))}</div>
    <aside class="plan-foot">
      <p>No hace falta tener la cuenta abierta. Te mandamos el código de trámite al instante, por pantalla y por mail.</p>
      <p>Si preferís cancelar la renovación automática sin pedir reintegro, lo hacés desde <a href="#/suscripcion">Mi suscripción</a>.</p>
      <p class="fine">Derecho previsto en el artículo 34 de la Ley 24.240 y el artículo 1110 del Código Civil y Comercial. Botón según la Resolución 424/2020 de la Secretaría de Comercio Interior. Más detalle en los <a href="${import.meta.env?.BASE_URL || "./"}terminos.html#arrepentimiento">Términos y condiciones</a>.</p>
    </aside>`;
  bindRegretForm(view);
  void route;
}

export function bindRegretForm(view, submit = requestRegret) {
  const form = view.querySelector("[data-regret-form]");
  if (!form) return;
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const data = new FormData(form);
    const errorBox = form.querySelector("[data-regret-error]");
    const button = form.querySelector("button[type=submit]");
    errorBox.hidden = true;
    button.disabled = true;
    try {
      const fields = { name: data.get("name"), email: data.get("email"), account: data.get("account"), reason: data.get("reason") };
      const code = await submit(fields);
      const slot = view.querySelector("[data-regret-slot]");
      slot.innerHTML = regretDoneHtml(code, String(fields.email || "").trim().toLowerCase());
      slot.querySelector("[data-testid=regret-done]")?.focus?.();
    } catch (error) {
      errorBox.textContent = error.message || "No pudimos guardar el pedido. Probá de nuevo.";
      errorBox.hidden = false;
      button.disabled = false;
    }
  });
}
