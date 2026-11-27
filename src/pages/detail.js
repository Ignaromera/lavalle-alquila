import { getAdvertiser, getListing, isDemo, listSlots, maybeTrackView, photoUrl, reportListing, requestBooking, trackStat } from "../api.js";
import { render } from "../bus.js";
import { upsellHtml } from "../cards.js";
import { demoNoticeHtml } from "../demo-ui.js";
import { isNewListing, isPublicListing } from "../filter.js";
import { amenityLabel, esc, formatArs, hoursLabel, listingWaText, mapsDirectionsUrl, mapsEmbedUrl, priceLabel, typeLabel, waLink } from "../format.js";
import { isVenue } from "../geo.js";
import { setPageMeta } from "../meta.js";
import { icon } from "../icons.js";
import { bindShare, listingUrl, shareFallbackHtml } from "../share.js";
import { bindTurnero, calFor, turneroHtml } from "../turnero-ui.js";
import { bindReportSheet, reportSheetHtml } from "../reports.js";
import { toast } from "../toast.js";

export async function renderDetail(view, route, session) {
  const listing = await getListing(route.parts[1]);
  const mine = session?.user?.id && listing?.owner_id === session.user.id;
  const visible = listing && (isPublicListing(listing) || mine || session?.profile?.is_admin || (isDemo() && listing.status === "hidden"));
  if (!visible) {
    view.innerHTML = `<section class="page-head"><h1 tabindex="-1">Aviso no disponible</h1><p>Puede haber vencido, estar alquilado o haber sido ocultado.</p><p><a class="btn btn-primary" href="#/">Volver al inicio</a></p></section>`;
    return;
  }
  let listingCount = 0;
  if (listing.owner_id) {
    try {
      const advertiser = await getAdvertiser(listing.owner_id);
      listingCount = advertiser?.listing_count || 0;
    } catch {
      listingCount = 0;
    }
  }
  if (isPublicListing(listing)) listingCount = Math.max(listingCount, 1);
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
      ${isDemo() && mine ? demoNoticeHtml() : ""}
      ${listing.status === "hidden" ? `<p class="error">Este aviso está oculto por las denuncias. En el sitio real no aparece en el listado hasta que moderación lo restaure.</p>` : ""}
      <a class="back" href="${venue ? "#/quinchos" : "#/"}">${icon("arrow")} Volver</a>
      <div class="gallery${photos.length > 1 ? " has-many" : ""}" tabindex="0" aria-label="Fotos del aviso">
        <div class="gallery-track">
          ${photos.length ? photos.map((src, index) => `<img src="${esc(photoUrl(src))}" alt="${esc((listing.example ? "Foto de ejemplo" : "Foto") + ` ${index + 1}: ${listing.title}`)}" />`).join("") : `<div class="photo-fallback big">${esc(typeLabel(listing.type))}</div>`}
        </div>
        ${photos.length > 1 ? `
          <button type="button" class="gallery-btn gallery-btn-prev" data-testid="gallery-prev" aria-label="Foto anterior">${icon("arrow")}</button>
          <button type="button" class="gallery-btn gallery-btn-next" data-testid="gallery-next" aria-label="Foto siguiente">${icon("arrow")}</button>
          <div class="gallery-count" data-testid="gallery-count" aria-live="polite">1 / ${photos.length}</div>
        ` : ""}
      </div>
      ${photos.length > 1 ? `<div class="dots" role="tablist" aria-label="Elegir foto">${photos.map((_, index) => `<button type="button" class="dot${index === 0 ? " on" : ""}" data-gallery-dot="${index}" aria-label="Foto ${index + 1} de ${photos.length}" aria-current="${index === 0 ? "true" : "false"}"></button>`).join("")}</div>` : ""}
      <div class="head-chips">
        ${listing.featured ? '<span class="badge badge-gold">Destacado</span>' : ""}
        ${isNewListing(listing) ? '<span class="badge badge-nuevo">Nuevo</span>' : ""}
        <span class="badge">${esc(typeLabel(listing.type))}</span>
        ${listing.example ? '<span class="badge badge-ejemplo">Ejemplo</span>' : ""}
      </div>
      <p class="eyebrow">${esc(listing.district)}</p>
      <h1 tabindex="-1">${esc(listing.title)}</h1>
      <p class="price price-lg">${priceHtml(listing)}</p>
      <p class="owner">${ownerLine(listing, listingCount)}</p>
      <div class="row"><button type="button" class="btn btn-ghost" data-share data-testid="share">${icon("share")} Compartir</button></div>
      <div class="chips">
        ${venue && listing.capacity ? `<span class="chip">Hasta ${esc(listing.capacity)} personas</span>` : ""}
        ${(listing.amenities || []).map((id) => `<span class="chip">${esc(amenityLabel(id))}</span>`).join("")}
        ${venue ? "" : `<span class="chip">${listing.pets_allowed ? "Acepta mascotas" : "Sin mascotas"}</span>`}
        ${venue ? "" : `<span class="chip">${listing.guarantee_required ? "Pide garantía" : "Sin garantía"}</span>`}
      </div>
      ${venue && (listing.offers || []).length ? `<ul class="offer-menu" data-testid="offers">${listing.offers.map((offer) => `<li><div><b>${esc(offer.name)}</b><span>${esc(hoursLabel(offer.starts_at, offer.ends_at))}</span></div><em>${esc(formatArs(offer.price_ars))}</em></li>`).join("")}</ul>` : ""}
      ${venue && listing.booking_enabled ? turneroHtml({ listing, slots, mode: "visitor" }) : ""}
      ${venue && !listing.booking_enabled ? upsellHtml() : ""}
      <h2>Descripción</h2>
      <p class="prose">${esc(listing.description)}</p>
      ${listing.requirements ? `<h2>Requisitos</h2><p class="prose">${esc(listing.requirements)}</p>` : ""}
      <h2>Dónde queda</h2>
      <p class="address" data-testid="address">${esc(listing.address || "Sin dirección cargada")}</p>
      <div class="map-card">
        <iframe class="gmap" data-testid="gmap" title="Mapa de ${esc(listing.title)}" loading="lazy" referrerpolicy="no-referrer-when-downgrade" src="${esc(mapsEmbedUrl(listing.lat, listing.lng))}"></iframe>
      </div>
      <div class="row map-actions">
        <a class="btn btn-primary btn-block" data-testid="directions" target="_blank" rel="noopener noreferrer" href="${esc(mapsDirectionsUrl(listing.lat, listing.lng))}">${icon("nav")} Cómo llegar en Google Maps</a>
      </div>
      <aside class="safety">
        <h2>Antes de pagar, mirá</h2>
        <ul>
          <li>Nunca pagues una seña sin ver la propiedad.</li>
          <li>Encontrate en el lugar y pedí un documento.</li>
          <li>Desconfiá si te apuran a transferir o si el precio está muy por debajo de lo normal.</li>
          <li>Lavalle Alquila no cobra señas ni intermedia el pago.</li>
        </ul>
      </aside>
      ${mine ? "" : `<div class="row"><button type="button" class="btn btn-danger btn-block" data-report data-testid="report">Denunciar aviso</button></div>`}
      <div class="sticky-cta">
        <a class="btn btn-wa" data-stat="whatsapp" target="_blank" rel="noopener noreferrer" href="${esc(waLink(listing.whatsapp, listingWaText(listing)))}">${icon("wa")} Consultar por WhatsApp</a>
      </div>
      ${mine ? "" : reportSheetHtml({ kind: "listing" })}
      ${shareFallbackHtml({ title: listing.title, text: shareText, url: shareUrl })}
    </article>`;

  bindGallery(view, photos.length);
  bindShare(view, {
    title: listing.title,
    text: shareText,
    url: shareUrl,
    onShare: () => trackStat("listing", listing.id, "share"),
  });
  view.querySelectorAll("[data-stat=whatsapp]").forEach((link) => {
    link.addEventListener("click", () => trackStat("listing", listing.id, "whatsapp"));
  });
  if (isPublicListing(listing)) maybeTrackView("listing", listing.id);

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

  if (!mine) {
    bindReportSheet(view, async ({ reason, details, close }) => {
      try {
        await reportListing(listing.id, { reason, details });
        toast("Recibimos tu denuncia. Gracias.");
        close();
        render({ scroll: false });
      } catch (error) {
        toast(error.message);
      }
    });
  }
}


function bindGallery(view, total) {
  const track = view.querySelector(".gallery-track");
  if (!track || total < 2) return;

  const dots = [...view.querySelectorAll("[data-gallery-dot]")];
  const countEl = view.querySelector("[data-testid=gallery-count]");
  const items = () => [...track.children];
  let current = 0;

  function currentFromScroll() {
    const list = items();
    if (!list.length) return 0;
    const origin = list[0].offsetLeft;
    let index = 0;
    list.forEach((item, i) => {
      if (item.offsetLeft - origin - 20 <= track.scrollLeft + 10) index = i;
    });
    return index;
  }

  function sync(index) {
    current = index;
    dots.forEach((dot, i) => {
      const on = i === current;
      dot.classList.toggle("on", on);
      dot.setAttribute("aria-current", on ? "true" : "false");
    });
    if (countEl) countEl.textContent = `${current + 1} / ${total}`;
  }

  function goTo(index) {
    const list = items();
    if (!list.length) return;
    const next = ((index % list.length) + list.length) % list.length;
    const left = Math.max(0, list[next].offsetLeft - list[0].offsetLeft);
    if (typeof track.scrollTo === "function") track.scrollTo({ left, behavior: "smooth" });
    else track.scrollLeft = left;
    sync(next);
  }

  track.addEventListener("scroll", () => sync(currentFromScroll()), { passive: true });
  view.querySelector("[data-testid=gallery-prev]")?.addEventListener("click", () => goTo(current - 1));
  view.querySelector("[data-testid=gallery-next]")?.addEventListener("click", () => goTo(current + 1));
  dots.forEach((dot) => {
    dot.addEventListener("click", () => goTo(Number(dot.dataset.galleryDot)));
  });

  if (view._galleryKeys) view._galleryKeys.abort();
  const keys = new AbortController();
  view._galleryKeys = keys;
  document.addEventListener("keydown", (event) => {
    if (!view.isConnected || !view.querySelector(".gallery.has-many")) {
      keys.abort();
      return;
    }
    if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
    if (event.altKey || event.ctrlKey || event.metaKey) return;
    if (event.target?.closest?.("input, textarea, select, [contenteditable=true]")) return;
    if (document.body.classList.contains("sheet-open")) return;
    event.preventDefault();
    goTo(current + (event.key === "ArrowRight" ? 1 : -1));
  }, { signal: keys.signal });
}

function priceHtml(listing) {
  const label = priceLabel(listing);
  const venue = isVenue(listing.type);
  const offers = listing.offers || [];
  if (venue && offers.length > 1) {
    const unit = offers.every((offer) => /d[ií]a/i.test(offer.name)) ? "por día" : "por turno";
    return `${esc(label)} <small>${unit}</small>`;
  }
  const match = /^(.*) \/ (.+)$/.exec(label);
  return match ? `${esc(match[1])} <small>por ${esc(match[2])}</small>` : esc(label);
}

function ownerLine(listing, listingCount) {
  const name = listing.owner_name || "un vecino";
  if (!listing.owner_id) return `Publica ${esc(name)}`;
  const href = `#/anunciante/${esc(listing.owner_id)}`;
  const who = `Publica <a href="${href}" data-testid="advertiser-link">${esc(name)}</a>`;
  if (listingCount > 1) {
    return `${who} · <a href="${href}" data-testid="advertiser-more">Ver todos sus avisos (${listingCount})</a>`;
  }
  return who;
}
