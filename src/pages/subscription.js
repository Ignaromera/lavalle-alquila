import { cancelMySubscription, myPromoGrant, mySubscription, myListings, syncSubscription, isDemo } from "../api.js";
import { promoStatus } from "../promo.js";
import { render } from "../bus.js";
import { esc } from "../format.js";
import {
  PLANS, activeCount, featuredCount, formatArs, isUnlimited, longDate, planOf, renewalDate, subscriptionState, usageLabel,
} from "../plans.js";
import { toast } from "../toast.js";
import { legalLinksHtml, REGRET_HREF } from "./auth-ui.js";

function stateBlock(sub, plan, state, profile, grant) {
  const until = longDate(sub?.access_until);
  const renew = renewalDate(sub);
  const price = sub ? `${formatArs(sub.amount_ars)} por ${sub.billing_interval === "year" ? "año" : "mes"}` : "";
  if (!sub && plan.id === "free") {
    return `<p>Estás en el plan <strong>Gratis</strong>: 1 aviso activo. Si necesitás más, mirá los planes.</p>`;
  }
  const promo = promoStatus(grant);
  if (!sub && promo.active) {
    return `<p data-testid="sub-promo">Tenés el plan <strong>Pro de regalo</strong> con el código ${esc(grant.code || "")} hasta el <strong>${esc(longDate(grant.ends_at))}</strong> (${promo.daysLeft} día${promo.daysLeft === 1 ? "" : "s"}). No se cobra nada. Después volvés solo al plan Gratis, salvo que te suscribas.</p>`;
  }
  if (!sub) {
    return `<p>Tu plan <strong>${esc(plan.name)}</strong> lo activó el equipo de Lavalle Alquila, sin cobro automático.</p>`;
  }
  switch (state.state) {
    case "pending":
      return `<p>Estamos confirmando tu pago con Mercado Pago. Puede tardar unos minutos: cuando se confirme, tu plan se activa solo.</p>`;
    case "past_due":
      return `<p class="error">No pudimos cobrar tu última renovación. Mercado Pago reintenta solo. Tu plan sigue activo hasta el <strong>${esc(until)}</strong>. Revisá el medio de pago en tu cuenta de Mercado Pago.</p>
        <p class="fine">Plan ${esc(plan.name)} · ${esc(price)}</p>`;
    case "cancelling":
      return `<p>Cancelaste la suscripción: no te vamos a cobrar más. Tu plan sigue activo hasta el <strong>${esc(until)}</strong> (${state.daysLeft} día${state.daysLeft === 1 ? "" : "s"}) y después pasás al plan Gratis.</p>
        <p class="fine">Plan ${esc(plan.name)} · ${esc(price)}</p>`;
    case "active":
      return `<p>Pagás <strong>${esc(price)}</strong> con Mercado Pago. Próxima renovación: <strong>${esc(renew)}</strong>.</p>`;
    default:
      return `<p>Tu suscripción terminó. Estás en el plan <strong>${esc(planOf(profile).name)}</strong>.</p>`;
  }
}

export async function renderSubscription(view, route, session) {
  if (!session) {
    view.innerHTML = `
      <section class="page-head">
        <h1 tabindex="-1">Mi suscripción</h1>
        <p class="lede">Entrá a tu cuenta para ver tu plan.</p>
      </section>
      <p><a class="btn btn-primary" href="#/cuenta">Entrar</a> <a class="btn btn-ghost" href="#/planes">Ver los planes</a></p>
      <p><a class="btn btn-ghost" href="${REGRET_HREF}" data-regret>Botón de arrepentimiento</a></p>
      ${legalLinksHtml()}`;
    return;
  }

  const [sub, listings, grant] = await Promise.all([mySubscription().catch(() => null), myListings().catch(() => []), myPromoGrant().catch(() => null)]);
  const profile = session.profile;
  const planFromSub = sub && sub.plan_id && PLANS[sub.plan_id];
  const plan = sub && ["authorized", "paused", "cancelled"].includes(sub.status) && planFromSub ? planFromSub : planOf(profile);
  const state = subscriptionState(sub);
  const used = activeCount(listings);
  const max = profile.max_listings;
  const slots = planOf(profile).featuredSlots;
  const canCancel = !!sub && (state.state === "active" || state.state === "past_due");

  view.innerHTML = `
    <section class="page-head">
      <h1 tabindex="-1">Mi suscripción</h1>
    </section>
    <article class="sub-card" data-testid="sub-card">
      <p class="eyebrow">Tu plan</p>
      <h2>${esc(plan.name)} ${sub && state.state === "active" ? '<span class="badge badge-ok">Activo</span>' : ""}${state.state === "cancelling" ? '<span class="badge">Cancelado</span>' : ""}${state.state === "past_due" ? '<span class="badge badge-warn">Pago pendiente</span>' : ""}${state.state === "pending" ? '<span class="badge">Confirmando pago</span>' : ""}</h2>
      ${stateBlock(sub, plan, state, profile, grant)}
      ${isDemo() ? `<p class="fine">Ejemplo: en esta versión de prueba no hay cobros reales.</p>` : ""}
    </article>
    <article class="sub-card">
      <p class="eyebrow">Lo que usás</p>
      <p data-testid="sub-usage">${esc(usageLabel(used, max))}${isUnlimited(max) ? "" : "."}</p>
      ${slots ? `<p>Destacados: ${featuredCount(listings)} de ${slots}. <a href="#/cuenta">Elegilos en Mis avisos</a>.</p>` : ""}
      ${planOf(profile).turnero ? `<p>Turnero habilitado en tus quinchos y salones.</p>` : ""}
    </article>
    <div class="row-actions sub-actions">
      <a class="btn btn-primary" href="#/planes">${planOf(profile).id === "free" ? "Ver los planes" : "Cambiar de plan"}</a>
      ${canCancel ? `<button type="button" class="btn btn-danger" data-cancel>Cancelar suscripción</button>` : ""}
    </div>
    <aside class="plan-foot">
      <p><strong>Si cancelás o falla un pago.</strong> Tu plan sigue hasta la fecha de arriba. Después pasás al plan Gratis: queda activo el aviso más reciente y los demás vencen. No se borra nada: los renovás cuando vuelvas a suscribirte.</p>
      <p><a class="btn btn-ghost" href="${REGRET_HREF}" data-regret>Botón de arrepentimiento</a></p>
      <p class="fine">Si te suscribiste hace menos de 10 días y te arrepentís, tocá el botón: te damos un código de trámite al instante y te devolvemos todo lo que pagaste.</p>
    </aside>
    ${legalLinksHtml()}`;

  view.querySelector("[data-cancel]")?.addEventListener("click", async (event) => {
    const until = longDate(sub.access_until);
    if (!confirm(`¿Cancelar tu suscripción? No te cobramos más y tu plan sigue hasta el ${until}.`)) return;
    event.currentTarget.disabled = true;
    try {
      await cancelMySubscription();
      toast("Listo, cancelamos tu suscripción.");
      render({ scroll: false });
    } catch (error) {
      event.currentTarget.disabled = false;
      toast(error.message);
    }
  });

  // Por si algún aviso de Mercado Pago no llegó: se consulta una vez y se repinta solo si cambió algo.
  if (sub && !isDemo()) {
    const before = `${sub.status}|${sub.access_until}|${sub.payment_failed_at}|${profile.plan}`;
    void syncSubscription().then(async () => {
      const after = await mySubscription().catch(() => null);
      const now = after ? `${after.status}|${after.access_until}|${after.payment_failed_at}|${profile.plan}` : "";
      if (after && now !== before && view.isConnected) render({ scroll: false });
    });
  }
  void route;
}
