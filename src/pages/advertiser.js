import { getAdvertiser, isDemo, listAdvertiserListings, listAdvertiserSeeks, trackStat } from "../api.js";
import { listingCard, seekCard } from "../cards.js";
import { demoNoticeHtml } from "../demo-ui.js";
import { isPublicListing } from "../filter.js";
import { activeListingsLabel, advertiserName, esc } from "../format.js";
import { setPageMeta } from "../meta.js";

function ownerIdFrom(route) {
  if (route.name === "advertiser-admin") return route.parts[2];
  return route.parts[1];
}

function canModerate(session) {
  return isDemo() || !!session?.profile?.is_admin;
}

function statusLabel(listing) {
  if (listing.status === "hidden") return "Oculto";
  if (listing.status === "rented") return "Alquilado";
  if (listing.status === "active" && !isPublicListing(listing)) return "Vencido";
  if (listing.status === "active") return "Activo";
  return listing.status || "";
}

export async function renderAdvertiser(view, route, session) {
  const moderate = route.name === "advertiser-admin";
  if (moderate && !canModerate(session)) {
    view.innerHTML = `<section class="page-head"><h1 tabindex="-1">Moderación</h1><p>Esta sección es solo para el equipo de Lavalle Alquila. El email tiene que estar en la tabla <strong>admin_emails</strong>.</p><p><a href="#/cuenta">Volver</a></p></section>`;
    return;
  }

  const id = ownerIdFrom(route);
  const advertiser = await getAdvertiser(id, { isAdmin: moderate && canModerate(session) });
  const listings = await listAdvertiserListings(id, { includePrivate: moderate });
  const seeks = await listAdvertiserSeeks(id);

  const visible = listings.filter((item) => isPublicListing(item));
  const hidden = moderate ? listings.filter((item) => !isPublicListing(item)) : [];

  if (!advertiser && !visible.length && !seeks.length && !hidden.length) {
    view.innerHTML = `<section class="page-head">
      <h1 tabindex="-1">Anunciante no disponible</h1>
      <p>Puede que ya no tenga avisos a la vista.</p>
      <p><a class="btn btn-primary" href="${moderate ? "#/admin" : "#/"}">Volver</a></p>
    </section>`;
    return;
  }

  const name = advertiserName(advertiser?.full_name);
  const count = advertiser?.listing_count ?? visible.length;
  setPageMeta({
    title: `Avisos de ${name}`,
    description: `${name} tiene ${activeListingsLabel(count)} en Lavalle Alquila.`,
  });

  const back = moderate
    ? `<a class="back" href="#/admin">Volver a moderación</a>`
    : `<a class="back" href="#/">Volver al inicio</a>`;

  view.innerHTML = `
    <section class="page-head" data-testid="advertiser">
      ${isDemo() ? demoNoticeHtml() : ""}
      ${back}
      <h1 tabindex="-1">Avisos de ${esc(name)}</h1>
      <p class="lede">${esc(activeListingsLabel(count))}.</p>
    </section>
    <div class="cards" data-testid="advertiser-listings">
      ${visible.length ? visible.map(listingCard).join("") : `<p class="empty">Por ahora no tiene avisos activos.</p>`}
    </div>
    ${seeks.length ? `<h2>Busco alquiler</h2>
    <div class="stack" data-testid="advertiser-seeks">${seeks.map((seek) => seekCard(seek, { hideOwner: true })).join("")}</div>` : ""}
    ${hidden.length ? `<div class="advertiser-mod" data-testid="advertiser-moderation">
      <h2>Avisos que no están a la vista</h2>
      <p class="fine">Solo lo ves vos, en moderación. Pueden estar ocultos, vencidos o alquilados.</p>
      <div class="stack">${hidden.map((listing) => `<div>
        <p class="eyebrow">${esc(statusLabel(listing))}</p>
        ${listingCard(listing)}
      </div>`).join("")}</div>
    </div>` : ""}`;

  view.querySelectorAll("[data-stat=whatsapp]").forEach((link) => {
    link.addEventListener("click", () => trackStat("seek", link.dataset.id, "whatsapp"));
  });
}
