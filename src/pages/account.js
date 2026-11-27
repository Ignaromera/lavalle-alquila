import {
  DEMO_LOGIN,
  getListing,
  isDemo,
  isPasswordRecovery,
  listSlots,
  myBookingRequests,
  myListings,
  mySeeks,
  myStats,
  renewListing,
  setBookingStatus,
  setFeatured,
  setListingStatus,
  signInDemo,
  signOut,
  toggleSlot,
} from "../api.js";
import { config } from "../config.js";
import { render } from "../bus.js";
import { upsellHtml } from "../cards.js";
import { demoNoticeHtml } from "../demo-ui.js";
import { authBoxHtml, bindAuth, bindPasswordForm, demoLoginsHtml, legalLinksHtml, recoveryPasswordHtml, sessionEmail } from "./auth-ui.js";
import { bindSeekActions, seekOwnerCard } from "./seeks.js";
import { confirmWaText, esc, formatDay, formatWhen, givenName, priceLabel, shiftLabel, typeLabel, waLink } from "../format.js";
import { isVenue } from "../geo.js";
import { bindTurnero, calFor, turneroHtml } from "../turnero-ui.js";
import { activeCount, canFeature, featuredCount, featuredSlots, planNote, planOf } from "../plans.js";
import { recentDays } from "../stats.js";
import { statsPanelHtml } from "../stats-ui.js";
import { toast } from "../toast.js";

function canModerate(session) {
  if (isDemo()) return true;
  if (session?.profile?.is_admin) return true;
  const email = (session?.user?.email || "").toLowerCase();
  return config.adminEmails.some((item) => String(item).toLowerCase() === email);
}

export async function renderAccount(view, route, session) {
  if (!session) {
    view.innerHTML = `
      <section class="page-head">
        <h1 tabindex="-1">Tu cuenta</h1>
        <p class="lede">Creá tu cuenta con tu mail y una contraseña, o entrá con Google, para publicar, renovar o ver los pedidos del turnero. Después te pedimos nombre y WhatsApp. Tu mail no se muestra en el sitio.</p>
      </section>
      ${authBoxHtml()}
      ${demoLoginsHtml(DEMO_LOGIN)}
      ${isDemo() ? `<p><a href="#/admin">Ver moderación de ejemplo</a></p>` : ""}
      ${legalLinksHtml(sessionEmail(session))}`;
    bindAuth(view, () => render());
    view.querySelectorAll("[data-demo]").forEach((button) => {
      button.addEventListener("click", async () => {
        await signInDemo(button.dataset.demo);
        toast(`Entraste como ${button.innerText.split("\n")[0]}.`);
        render();
      });
    });
    return;
  }

  const [listings, seeks, requests, stats] = await Promise.all([myListings(), mySeeks(), myBookingRequests(), myStats()]);
  const plan = planOf(session.profile);
  const turnero = session.profile.booking_enabled || plan.turnero;
  const note = planNote(session.profile, activeCount(listings));
  const slots = featuredSlots(session.profile);
  const ctx = { slots, profile: session.profile, listings };
  const showStats = plan.stats || !config.billingLive;
  view.innerHTML = `
    <section class="page-head">
      <div class="account-welcome">
        <div>
          <h1 tabindex="-1">Hola, ${esc(givenName(session.profile.full_name) || "vecino")}</h1>
          <p class="lede">${esc(session.profile.email || "")}</p>
        </div>
        <button type="button" class="btn btn-ghost btn-small" data-logout data-testid="logout-top">Cerrar sesión</button>
      </div>
    </section>
    ${isDemo() ? demoNoticeHtml() : ""}
    <p class="plan-note" data-testid="plan-note">Plan <strong>${esc(plan.name)}</strong> · ${esc(note.text)} ${note.cta ? `${esc(note.cta)} ` : ""}${turnero ? "El turnero está habilitado en tus quinchos y salones. " : ""}<a href="#/${plan.id === "free" ? "planes" : "suscripcion"}">${plan.id === "free" ? "Ver planes" : "Mi suscripción"}</a></p>
    ${showStats ? statsPanelHtml(listings, seeks, stats, recentDays(7)) : statsLockedHtml()}
    ${isPasswordRecovery() ? recoveryPasswordHtml() : ""}
    ${!session.profile.whatsapp ? `<p class="note">Para publicar, completá tu nombre y tu WhatsApp. Si entraste con Google, el nombre puede venir solo.</p>` : ""}
    <form class="stack profile-form" data-profile>
      <label class="field">Nombre<input name="full_name" required value="${esc(session.profile.full_name)}" /></label>
      <label class="field">WhatsApp<input name="whatsapp" required inputmode="tel" value="${esc(session.profile.whatsapp)}" /></label>
      <button class="btn btn-ghost" type="submit">Guardar perfil</button>
    </form>
    ${isPasswordRecovery() ? "" : recoveryPasswordHtml()}
    <h2>Mis avisos</h2>
    ${slots ? `<p class="fine" data-testid="featured-count">Destacados: ${featuredCount(listings)} de ${slots}. Un aviso destacado sale primero en las listas.</p>` : `<p class="fine">Los avisos destacados salen primero en las listas. Vienen con el plan Pro. <a href="#/planes">Ver planes</a></p>`}
    <div class="stack">
      ${listings.length ? listings.map((item) => ownerCard(item, ctx)).join("") : `<p class="empty">Todavía no publicaste. <a href="#/publicar">Publicá un aviso</a>.</p>`}
    </div>
    <h2>Pedidos del turnero</h2>
    <div class="stack" data-testid="booking-requests">
      ${requests.length ? requests.map(requestCard).join("") : `<p class="muted">Cuando alguien pida un turno, lo vas a ver acá.</p>`}
    </div>
    <h2>Mis búsquedas</h2>
    <p><a href="#/busco/nuevo">Publicar un busco alquiler</a></p>
    <div class="stack">${seeks.length ? seeks.map(seekOwnerCard).join("") : `<p class="muted">No tenés búsquedas publicadas.</p>`}</div>
    <div class="stack footer-links">
      ${canModerate(session) ? `<a class="btn btn-ghost" href="#/admin">${isDemo() ? "Moderación de ejemplo" : "Moderación"}</a>` : ""}
      <button type="button" class="btn btn-ghost" data-logout data-testid="logout-bottom">Cerrar sesión</button>
    </div>
    ${legalLinksHtml(sessionEmail(session))}`;

  bindPasswordForm(view, () => render());
  view.querySelector("[data-profile]").addEventListener("submit", async (event) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    try {
      const { saveProfile } = await import("../api.js");
      await saveProfile({ full_name: data.get("full_name"), whatsapp: data.get("whatsapp") });
      toast("Perfil guardado.");
      render();
    } catch (error) {
      toast(error.message);
    }
  });
  bindListingActions(view);
  bindSeekActions(view);
  bindRequestActions(view, session);
  view.querySelectorAll("[data-logout]").forEach((button) => {
    button.addEventListener("click", async () => {
      await signOut();
      toast("Cerraste la sesión.");
      render();
    });
  });
  void route;
}

function statsLockedHtml() {
  return `<aside class="upsell" data-testid="stats-locked">
    <h2>Tus números, con Plus o Pro</h2>
    <p>Mirá cuántas visitas tiene cada aviso, cuántas veces lo compartieron y cuántos tocaron WhatsApp.</p>
    <p><a class="btn btn-small btn-primary" href="#/planes">Ver planes</a></p>
  </aside>`;
}

function ownerCard(listing, ctx = { slots: 0, profile: null, listings: [] }) {
  const venue = isVenue(listing.type);
  const expired = listing.status === "active" && new Date(listing.expires_at) <= new Date();
  return `<article class="owner-card">
    <p class="eyebrow">${esc(typeLabel(listing.type))} · ${esc(listing.district)}${listing.featured ? ' · <span class="badge badge-gold">Destacado</span>' : ""}</p>
    <h3>${esc(listing.title)}</h3>
    <p class="price">${esc(priceLabel(listing))}</p>
    <p class="fine">${esc(listing.status === "rented" ? (venue ? "No disponible" : "Alquilado") : listing.status === "hidden" ? "Oculto, en revisión" : expired ? "Vencido" : formatWhen(listing.expires_at))}</p>
    ${venue && !listing.booking_enabled ? upsellHtml() : ""}
    <div class="row-actions">
      <a class="btn btn-small" href="#/publicar/${esc(listing.id)}">Editar</a>
      ${listing.status === "active" ? `<button type="button" class="btn btn-small" data-renew="${esc(listing.id)}">Renovar 60 días</button>` : ""}
      ${listing.status === "active" ? `<button type="button" class="btn btn-small btn-ghost" data-status="rented" data-id="${esc(listing.id)}">${venue ? "Marcar no disponible" : "Marcar como alquilado"}</button>` : ""}
      ${listing.status === "rented" ? `<button type="button" class="btn btn-small" data-status="active" data-id="${esc(listing.id)}">Volver a publicar</button>` : ""}
      ${venue && listing.booking_enabled ? `<a class="btn btn-small" href="#/turnero/${esc(listing.id)}">Turnero</a>` : ""}
      ${featureButton(listing, ctx)}
      <button type="button" class="btn btn-small btn-danger" data-status="deleted" data-id="${esc(listing.id)}">Eliminar</button>
    </div>
  </article>`;
}

function featureButton(listing, ctx) {
  if (!ctx.slots && !listing.featured) return "";
  if (listing.featured) return `<button type="button" class="btn btn-small btn-ghost" data-feature="${esc(listing.id)}" data-on="0">Quitar destacado</button>`;
  const check = canFeature(ctx.profile, ctx.listings, listing);
  if (check.reason === "inactive" || check.reason === "plan") return "";
  return `<button type="button" class="btn btn-small" data-feature="${esc(listing.id)}" data-on="1"${check.ok ? "" : " disabled"}>${check.ok ? "Destacar" : "Destacados completos"}</button>`;
}

function requestCard(request) {
  const when = request.slot_date ? `${formatDay(request.slot_date)} · ${shiftLabel(request.shift)}` : "";
  return `<article class="owner-card">
    <p class="eyebrow">${esc(request.listing_title || "Reserva")} · ${esc(request.status === "pending" ? "Pendiente" : request.status === "confirmed" ? "Confirmado" : "Rechazado")}</p>
    <h3>${esc(request.requester_name)} · ${esc(request.guests)} personas</h3>
    <p>${esc(when)}</p>
    ${request.note ? `<p class="fine">${esc(request.note)}</p>` : ""}
    ${request.status === "pending" ? `<div class="row-actions">
      <button type="button" class="btn btn-small btn-wa" data-confirm="${esc(request.id)}" data-phone="${esc(request.requester_whatsapp)}" data-name="${esc(request.requester_name)}" data-title="${esc(request.listing_title)}" data-date="${esc(request.slot_date)}" data-shift="${esc(request.shift)}" data-guests="${esc(request.guests)}">Confirmar y abrir WhatsApp</button>
      <button type="button" class="btn btn-small btn-ghost" data-reject="${esc(request.id)}">Rechazar</button>
    </div>` : ""}
  </article>`;
}

function bindListingActions(root) {
  root.querySelectorAll("[data-renew]").forEach((button) => {
    button.addEventListener("click", async () => {
      try {
        await renewListing(button.dataset.renew);
        toast("Aviso renovado por 60 días.");
        render();
      } catch (error) {
        toast(error.message);
      }
    });
  });
  root.querySelectorAll("[data-feature]").forEach((button) => {
    button.addEventListener("click", async () => {
      const on = button.dataset.on === "1";
      button.disabled = true;
      try {
        await setFeatured(button.dataset.feature, on);
        toast(on ? "Listo, tu aviso sale destacado." : "Aviso sin destacar.");
        render({ scroll: false });
      } catch (error) {
        button.disabled = false;
        toast(error.message);
      }
    });
  });
  root.querySelectorAll("[data-status]").forEach((button) => {
    button.addEventListener("click", async () => {
      const status = button.dataset.status;
      if (status === "deleted" && !confirm("¿Eliminar este aviso?")) return;
      try {
        await setListingStatus(button.dataset.id, status);
        toast(status === "deleted" ? "Aviso eliminado." : "Listo.");
        render();
      } catch (error) {
        toast(error.message);
      }
    });
  });
}

function bindRequestActions(root, session) {
  root.querySelectorAll("[data-confirm]").forEach((button) => {
    button.addEventListener("click", async () => {
      const popup = window.open("about:blank", "_blank");
      try {
        await setBookingStatus(button.dataset.confirm, "confirmed");
        const url = waLink(button.dataset.phone, confirmWaText({
          ownerName: session.profile.full_name,
          guestName: button.dataset.name,
          title: button.dataset.title,
          dateLabel: formatDay(button.dataset.date),
          shiftLabel: shiftLabel(button.dataset.shift),
          guests: button.dataset.guests,
        }));
        if (popup) popup.location = url;
        else location.href = url;
        toast("Reserva confirmada. El turno quedó tomado.");
        render();
      } catch (error) {
        popup?.close();
        toast(error.message);
      }
    });
  });
  root.querySelectorAll("[data-reject]").forEach((button) => {
    button.addEventListener("click", async () => {
      try {
        await setBookingStatus(button.dataset.reject, "rejected");
        toast("Pedido rechazado. El turno volvió a quedar libre.");
        render();
      } catch (error) {
        toast(error.message);
      }
    });
  });
}

export async function renderOwnerTurnero(view, route, session) {
  const listing = await getListing(route.parts[1]);
  if (!session || !listing || listing.owner_id !== session.user.id) {
    view.innerHTML = `<section class="page-head"><h1 tabindex="-1">Turnero</h1><p>Entrá con la cuenta que publicó el lugar.</p><p><a class="btn btn-primary" href="#/cuenta">Ir a mi cuenta</a></p></section>`;
    return;
  }
  if (!listing.booking_enabled) {
    view.innerHTML = `<section class="page-head"><h1 tabindex="-1">${esc(listing.title)}</h1>${upsellHtml()}<p><a href="#/cuenta">Volver a mi cuenta</a></p></section>`;
    return;
  }
  const slots = await listSlots(listing.id);
  view.innerHTML = `<a class="back" href="#/cuenta">← Mi cuenta</a>${turneroHtml({ listing, slots, mode: "owner" })}`;
  bindTurnero(view.querySelector("[data-testid=turnero]"), {
    move(dir) {
      const cal = calFor(listing.id);
      cal.cursor = new Date(cal.cursor.getFullYear(), cal.cursor.getMonth() + (dir === "next" ? 1 : -1), 1);
      render({ scroll: false });
    },
    pick(day) {
      const cal = calFor(listing.id);
      cal.selected = day;
      render({ scroll: false });
    },
    async toggle(shift, open) {
      try {
        await toggleSlot(listing.id, calFor(listing.id).selected, shift, open);
        render({ scroll: false });
      } catch (error) {
        toast(error.message);
      }
    },
  });
}
