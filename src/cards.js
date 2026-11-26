import { photoUrl } from "./api.js";
import { amenityLabel, esc, priceLabel, typeLabel } from "./format.js";
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
    <h2>Activá el turnero (próximamente, servicio pago)</h2>
    <p>Publicar el quincho o el salón es gratis. El calendario para que te reserven el día o el turno es un extra que vamos a habilitar más adelante. Mientras tanto, la consulta es por WhatsApp.</p>
  </aside>`;
}
