import { startCheckout, getSession } from "../api.js";
import { esc } from "../format.js";
import { PLANS, PLAN_ORDER, formatArs, planFeatures, planId, yearlySavings } from "../plans.js";
import { legalLinksHtml } from "./auth-ui.js";

const PLAN_EXTRA = {
  free: "Para empezar, sin tarjeta.",
  plus: "Para quien alquila varias propiedades.",
  pro: "Para vivir de alquilar: sin tope y con turnero.",
};

function priceBlock(id, interval) {
  const p = PLANS[id];
  if (id === "free") return `<p class="plan-price"><strong>$0</strong> <span>para siempre</span></p>`;
  const save = yearlySavings(id);
  if (interval === "year") {
    return `<p class="plan-price"><strong>${formatArs(p.yearly)}</strong> <span>por año</span></p>
      <p class="plan-save"><s>${formatArs(save.full)}</s> pagando mes a mes · <b>ahorrás ${formatArs(save.saved)} (${save.pct}%)</b></p>
      <p class="fine">Equivale a ${formatArs(save.perMonth)} por mes.</p>`;
  }
  return `<p class="plan-price"><strong>${formatArs(p.monthly)}</strong> <span>por mes</span></p>
    <p class="fine">O ${formatArs(p.yearly)} por año: ahorrás ${save.pct}%.</p>`;
}

function badges(id, interval) {
  const out = [];
  if (id === "pro") out.push(`<span class="badge badge-gold">${interval === "year" ? "Mejor precio" : "Más completo"}</span>`);
  if (id !== "free" && interval === "year") out.push(`<span class="badge badge-save">Ahorrás ${yearlySavings(id).pct}%</span>`);
  return out.join("");
}

function cardHtml(id, interval, current) {
  const p = PLANS[id];
  const isCurrent = current === id;
  let action;
  if (id === "free") {
    action = isCurrent ? `<button type="button" class="btn btn-block" disabled>Tu plan actual</button>` : `<p class="fine">Volvés acá si cancelás o se vence tu suscripción.</p>`;
  } else if (isCurrent) {
    action = `<a class="btn btn-block" href="#/suscripcion">Tu plan actual · Mi suscripción</a>`;
  } else {
    action = `<button type="button" class="btn btn-block ${id === "pro" ? "btn-primary" : "btn-ghost"}" data-subscribe="${id}">Suscribirme a ${esc(p.name)}</button>`;
  }
  return `<article class="plan-card${id === "pro" ? " plan-card-pro" : ""}${isCurrent ? " is-current" : ""}" data-plan="${id}" data-testid="plan-${id}">
    <div class="plan-top">
      <h2>${esc(p.name)}</h2>
      <div class="plan-badges">${badges(id, interval)}</div>
    </div>
    <p class="plan-tag">${esc(PLAN_EXTRA[id])}</p>
    ${priceBlock(id, interval)}
    <ul class="plan-list">${planFeatures(id).map((item) => `<li>${esc(item)}</li>`).join("")}</ul>
    ${action}
    <p class="plan-msg" data-msg role="status" aria-live="polite" hidden></p>
  </article>`;
}

export async function renderPlans(view, route, session) {
  let interval = route.params?.get("periodo") === "mensual" ? "month" : "year";
  const current = session ? planId(session.profile.plan) : "free";

  view.innerHTML = `
    <section class="page-head">
      <h1 tabindex="-1">Planes</h1>
      <p class="lede">Publicá más avisos y mostrate mejor. Cambiás o cancelás cuando quieras.</p>
    </section>
    <div class="segment plans-toggle" role="tablist" aria-label="Cada cuánto pagás">
      <button type="button" class="seg" data-interval="month">Mensual</button>
      <button type="button" class="seg" data-interval="year">Anual <small class="seg-badge">Ahorrás hasta 44%</small></button>
    </div>
    <div class="plans" data-plans></div>
    <aside class="plan-foot">
      <p><strong>Cómo se paga.</strong> En la página de Mercado Pago, con tarjeta de crédito o débito, y se renueva solo. No pedimos ni guardamos los datos de tu tarjeta. Podés cancelar cuando quieras desde ${session ? `<a href="#/suscripcion">Mi suscripción</a>` : "Mi suscripción"}.</p>
      <p class="fine">Precios en pesos argentinos. ${session ? "" : "Para suscribirte, primero entrá a tu cuenta."}</p>
    </aside>
    ${legalLinksHtml()}`;

  const grid = view.querySelector("[data-plans]");
  const paint = () => {
    grid.innerHTML = PLAN_ORDER.map((id) => cardHtml(id, interval, session ? current : "")).join("");
    view.querySelectorAll("[data-interval]").forEach((button) => {
      const on = button.dataset.interval === interval;
      button.classList.toggle("is-on", on);
      button.setAttribute("aria-selected", on ? "true" : "false");
    });
    bindButtons();
  };

  const bindButtons = () => {
    grid.querySelectorAll("[data-subscribe]").forEach((button) => {
      button.addEventListener("click", async () => {
        const card = button.closest("[data-plan]");
        const msg = card.querySelector("[data-msg]");
        const show = (html) => { msg.innerHTML = html; msg.hidden = !html; };
        show("");
        const live = await getSession().catch(() => null);
        if (!live) {
          show(`Primero entrá a tu cuenta para suscribirte. <a href="#/cuenta">Entrar</a>`);
          return;
        }
        const label = button.textContent;
        button.disabled = true;
        button.textContent = "Abriendo Mercado Pago…";
        try {
          const { init_point: url } = await startCheckout(button.dataset.subscribe, interval);
          location.assign(url);
        } catch (error) {
          button.disabled = false;
          button.textContent = label;
          if (error.code === "proximamente") {
            show(`<strong>Muy pronto.</strong> ${esc(error.message)} Mientras tanto seguís con tu plan actual.`);
          } else {
            show(esc(error.message || "No pudimos abrir el pago. Probá de nuevo en un rato."));
          }
        }
      });
    });
  };

  view.querySelectorAll("[data-interval]").forEach((button) => {
    button.addEventListener("click", () => {
      interval = button.dataset.interval;
      paint();
    });
  });
  paint();
}
