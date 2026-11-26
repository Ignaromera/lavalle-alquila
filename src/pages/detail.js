import { getListing, isDemo, listSlots, photoUrl, reportListing, requestBooking } from "../api.js";
import { render } from "../bus.js";
import { upsellHtml } from "../cards.js";
import { isPublicListing } from "../filter.js";
import { amenityLabel, esc, listingWaText, mapsDirectionsUrl, mapsEmbedUrl, offerLine, priceLabel, typeLabel, waLink } from "../format.js";
import { isVenue } from "../geo.js";
import { setPageMeta } from "../meta.js";
import { bindShare, listingUrl, shareFallbackHtml } from "../share.js";
import { bindTurnero, calFor, turneroHtml } from "../turnero-ui.js";
import { toast } from "../toast.js";

const REASONS = [
  ["estafa", "Parece una estafa"],
  ["alquilado", "Ya está alquilado"],
  ["falso", "Datos o fotos falsas"],
  ["otro", "Otro"],
];

export async function renderDetail(view, route, session) {
  const listing = await getListing(route.parts[1]);
  const mine = session?.user?.id && listing?.owner_id === session.user.id;
  const visible = listing && (isPublicListing(listing) || mine || session?.profile?.is_admin || (isDemo() && listing.status === "hidden"));
  if (!visible) {
    view.innerHTML = `<section class="page-head"><h1 tabindex="-1">Aviso no disponible</h1><p>Puede haber vencido, estar alquilado o haber sido ocultado.</p><p><a class="btn btn-primary" href="#/">Volver al inicio</a></p></section>`;
    return;
  }
  const venue = isVenue(listing.type);
  const slots = venue && listing.booking_enabled ? await listSlots(listing.id) : [];
  const photos = listing.photo_urls || [];
  const shareUrl = listingUrl(listing.id);
  const shareText = `${listing.title} · ${listing.district} · ${priceLabel(listing)}`;
  setPageMeta({
    title: `${listing.title} en ${listing.district}`,
    description: `${listing.title}. ${listing.address || listing.district}. ${priceLabel(listing)}. ${listing.requirements || ""}`.slice(0, 180),
    url: shareUrl,
  });
  view.innerHTML = `
    <article class="detail" data-testid="detail">
      ${listing.status === "hidden" ? `<p class="error">Este aviso está oculto por las denuncias. En el sitio real no aparece en el listado hasta que moderación lo restaure.</p>` : ""}
      <a class="back" href="${venue ? "#/quinchos" : "#/"}">← Volver</a>
      <div class="gallery" tabindex="0" aria-label="Fotos del aviso">
        <div class="gallery-track">
          ${photos.length ? photos.map((src, index) => `<img src="${esc(photoUrl(src))}" alt="${esc((listing.example ? "Foto de ejemplo" : "Foto") + ` ${index + 1}: ${listing.title}`)}" />`).join("") : `<div class="photo-fallback big">${esc(typeLabel(listing.type))}</div>`}
        </div>
      </div>
      <div class="chips head-chips">
        ${listing.featured ? '<span class="badge badge-gold">Destacado</span>' : ""}
        <span class="badge">${esc(typeLabel(listing.type))}</span>
        ${listing.example ? '<span class="badge badge-ejemplo">Ejemplo</span>' : ""}
      </div>
      <p class="eyebrow">${esc(listing.district)}</p>
      <h1 tabindex="-1">${esc(listing.title)}</h1>
      <p class="price price-lg">${esc(priceLabel(listing))}</p>
      <button type="button" class="btn btn-ghost" data-share data-testid="share">Compartir</button>
      <p class="owner">Publica ${esc(listing.owner_name || "un vecino")}</p>
      <div class="chips">
        ${venue && listing.capacity ? `<span class="chip">Hasta ${esc(listing.capacity)} personas</span>` : ""}
        ${(listing.amenities || []).map((id) => `<span class="chip">${esc(amenityLabel(id))}</span>`).join("")}
        ${venue ? "" : `<span class="chip">${listing.pets_allowed ? "Acepta mascotas" : "Sin mascotas"}</span>`}
        ${venue ? "" : `<span class="chip">${listing.guarantee_required ? "Pide garantía" : "Sin garantía"}</span>`}
      </div>
      ${venue && (listing.offers || []).length ? `<ul class="offer-menu" data-testid="offers">${listing.offers.map((offer) => `<li>${esc(offerLine(offer))}</li>`).join("")}</ul>` : ""}
      ${venue && listing.booking_enabled ? turneroHtml({ listing, slots, mode: "visitor" }) : ""}
      ${venue && !listing.booking_enabled ? upsellHtml() : ""}
      <h2>Descripción</h2>
      <p class="prose">${esc(listing.description)}</p>
      ${listing.requirements ? `<h2>Requisitos</h2><p class="prose">${esc(listing.requirements)}</p>` : ""}
      <h2>Dónde queda</h2>
      <p class="address" data-testid="address">${esc(listing.address || "Sin dirección cargada")}</p>
      <div class="map-actions">
        <a class="btn btn-primary" data-testid="directions" target="_blank" rel="noopener noreferrer" href="${esc(mapsDirectionsUrl(listing.lat, listing.lng))}">Cómo llegar en Google Maps</a>
      </div>
      <iframe class="gmap" data-testid="gmap" title="Mapa de ${esc(listing.title)}" loading="lazy" referrerpolicy="no-referrer-when-downgrade" src="${esc(mapsEmbedUrl(listing.lat, listing.lng))}"></iframe>
      <aside class="safety">
        <h2>Antes de pagar, mirá</h2>
        <ul>
          <li>Nunca pagues una seña sin ver la propiedad.</li>
          <li>Encontrate en el lugar y pedí un documento.</li>
          <li>Desconfiá si te apuran a transferir o si el precio está muy por debajo de lo normal.</li>
          <li>Lavalle Alquila no cobra señas ni intermedia el pago.</li>
        </ul>
      </aside>
      <button type="button" class="btn btn-ghost btn-block" data-report>Denunciar aviso</button>
      <div class="sticky-cta">
        <a class="btn btn-wa" target="_blank" rel="noopener noreferrer" href="${esc(waLink(listing.whatsapp, listingWaText(listing)))}">Consultar por WhatsApp</a>
      </div>
      <div class="sheet-back" data-close-report hidden></div>
      <form class="sheet" data-report-form hidden>
        <div class="sheet-grab"></div>
        <h2>Denunciar aviso</h2>
        <p class="fine">Con 3 denuncias el aviso se oculta solo, hasta que alguien del equipo lo revise. No hace falta crear una cuenta.</p>
        <label class="field">Motivo
          <select name="reason">${REASONS.map(([id, label]) => `<option value="${id}">${label}</option>`).join("")}</select>
        </label>
        <label class="field">Detalle (opcional)<textarea name="details" maxlength="500" placeholder="Qué viste"></textarea></label>
        <button class="btn btn-danger" type="submit">Enviar denuncia</button>
      </form>
      ${shareFallbackHtml({ title: listing.title, text: shareText, url: shareUrl })}
    </article>`;

  bindShare(view, { title: listing.title, text: shareText, url: shareUrl });

  if (venue && listing.booking_enabled) {
    bindTurnero(view.querySelector("[data-testid=turnero]"), {
      move(dir) {
        const cal = calFor(listing.id);
        cal.cursor = new Date(cal.cursor.getFullYear(), cal.cursor.getMonth() + (dir === "next" ? 1 : -1), 1);
        render({ scroll: false });
      },
      pick(day) {
        const cal = calFor(listing.id);
        cal.selected = day;
        cal.asking = "";
        render({ scroll: false });
      },
      ask(slotId) {
        calFor(listing.id).asking = slotId;
        render({ scroll: false });
      },
      async request(input) {
        try {
          await requestBooking(input);
          calFor(listing.id).asking = "";
          toast("Pedido enviado. El dueño te confirma por WhatsApp si hay lugar.");
          render({ scroll: false });
        } catch (error) {
          toast(error.message);
        }
      },
    });
  }

  const sheet = view.querySelector("[data-report-form]");
  const backSheet = view.querySelector("[data-close-report]");
  view.querySelector("[data-report]").addEventListener("click", () => {
    sheet.hidden = false;
    backSheet.hidden = false;
  });
  backSheet.addEventListener("click", () => {
    sheet.hidden = true;
    backSheet.hidden = true;
  });
  sheet.addEventListener("submit", async (event) => {
    event.preventDefault();
    const data = new FormData(sheet);
    try {
      await reportListing(listing.id, { reason: String(data.get("reason")), details: String(data.get("details") || "") });
      toast("Recibimos tu denuncia. Gracias.");
      sheet.hidden = true;
      backSheet.hidden = true;
      render({ scroll: false });
    } catch (error) {
      toast(error.message);
    }
  });
}
