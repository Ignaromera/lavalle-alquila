import { photoUrl } from "./api.js";
import { isNewListing } from "./filter.js";
import { amenityLabel, esc, formatArs, priceLabel, seekWaText, typeLabel, waLink } from "./format.js";
import { DISTRICTS, isVenue } from "./geo.js";

export function districtOptions(selected, anyLabel = "Todos los distritos") {
  const options = [`<option value="">${esc(anyLabel)}</option>`];
  for (const district of DISTRICTS) {
    options.push(`<option value="${esc(district.name)}"${district.name === selected ? " selected" : ""}>${esc(district.name)}</option>`);
  }
  return options.join("");
}

export function listingCard(listing) {
  const src = listing.photo_urls?.[0] ? photoUrl(listing.photo_urls[0]) : "";
  const alt = listing.example ? `Foto de ejemplo: ${listing.title}` : `Foto: ${listing.title}`;
  const chips = [];
  if (isVenue(listing.type)) {
    if (listing.capacity) chips.push(`Hasta ${listing.capacity} personas`);
    for (const amenity of (listing.amenities || []).slice(0, 3)) chips.push(amenityLabel(amenity));
    if (listing.booking_enabled) chips.push("Con turnero");
  } else {
    chips.push(listing.pets_allowed ? "Acepta mascotas" : "Sin mascotas");
    chips.push(listing.guarantee_required ? "Pide garantía" : "Sin garantía");
  }
  return `<a class="card" href="#/aviso/${esc(listing.id)}" data-testid="listing-card">
    <div class="card-photo">
      ${src ? `<img src="${esc(src)}" alt="${esc(alt)}" />` : `<div class="photo-fallback">${esc(typeLabel(listing.type))}</div>`}
      <div class="badges card-badges">
        ${listing.featured ? '<span class="badge badge-gold">Destacado</span>' : ""}
        ${isNewListing(listing) ? '<span class="badge badge-nuevo">Nuevo</span>' : ""}
        <span class="badge">${esc(typeLabel(listing.type))}</span>
        ${listing.example ? '<span class="badge badge-ejemplo">Ejemplo</span>' : ""}
      </div>
      <div class="card-over">
        <p class="eyebrow">${esc(listing.district)}</p>
        <h2>${esc(listing.title)}</h2>
        <p class="price">${esc(priceLabel(listing))}</p>
      </div>
    </div>
    <div class="card-body">
      <p class="reqs">${esc(listing.requirements || "")}</p>
      <div class="chips">${chips.map((chip) => `<span class="chip">${esc(chip)}</span>`).join("")}</div>
    </div>
  </a>`;
}

export function upsellHtml() {
  return `<aside class="upsell" data-testid="turnero-upsell">
    <h2>El turnero viene con el plan Pro</h2>
    <p>Publicar el quincho o el salón es gratis. Con el plan Pro sumás el calendario para que te reserven el día o el turno, avisos ilimitados y destacados. Mientras tanto, la consulta es por WhatsApp.</p>
    <p><a class="btn btn-small btn-primary" href="#/planes">Ver el plan Pro</a></p>
  </aside>`;
}

export function seekCard(seek, { hideOwner = false } = {}) {
  return `<article class="seek" data-testid="seek-card">
    <p class="eyebrow">${esc(typeLabel(seek.type))}${seek.district ? ` · ${esc(seek.district)}` : " · cualquier distrito"}</p>
    <h2><a href="#/busco/${esc(seek.id)}">Hasta ${esc(formatArs(seek.budget_ars))}</a></h2>
    <p>${esc(seek.note)}</p>
    ${hideOwner ? "" : `<p class="fine">${esc(seek.owner_name || "Vecino")}${seek.example ? " · ejemplo" : ""}</p>`}
    <div class="row-actions">
      <a class="btn btn-wa" data-stat="whatsapp" data-id="${esc(seek.id)}" target="_blank" rel="noopener noreferrer" href="${esc(waLink(seek.whatsapp, seekWaText(seek)))}">Escribir por WhatsApp</a>
      <a class="btn btn-ghost" href="#/busco/${esc(seek.id)}">Compartir</a>
    </div>
  </article>`;
}
