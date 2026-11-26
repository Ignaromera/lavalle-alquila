import { adminListings, adminRemove, adminRestore, adminSetFlags, isDemo } from "../api.js";
import { render } from "../bus.js";
import { esc, typeLabel } from "../format.js";
import { isVenue } from "../geo.js";
import { toast } from "../toast.js";

const REASON = {
  estafa: "Parece una estafa",
  alquilado: "Ya está alquilado",
  falso: "Datos o fotos falsas",
  otro: "Otro",
};

export async function renderAdmin(view, route, session) {
  if (!isDemo() && !session?.profile?.is_admin) {
    view.innerHTML = `<section class="page-head"><h1 tabindex="-1">Moderación</h1><p>Esta sección es solo para el equipo de Lavalle Alquila. El email tiene que estar en la tabla <strong>admin_emails</strong>.</p><p><a href="#/cuenta">Volver</a></p></section>`;
    return;
  }
  let listings = [];
  try {
    listings = await adminListings();
  } catch (error) {
    view.innerHTML = `<section class="page-head"><h1 tabindex="-1">Moderación</h1><p class="error">${esc(error.message)}</p></section>`;
    return;
  }
  const review = listings.filter((item) => item.status === "hidden" || item.report_count > 0);
  const venues = listings.filter((item) => isVenue(item.type));
  view.innerHTML = `
    <section class="page-head">
      <h1 tabindex="-1">Moderación</h1>
      <p class="lede">${isDemo() ? "Estás viendo datos de ejemplo. En producción esto solo lo abre quien esté en admin_emails." : "Avisos ocultos, denuncias, destacados y turnero."}</p>
    </section>
    <h2>Ocultos y denunciados</h2>
    <div class="stack">${review.length ? review.map(adminCard).join("") : `<p class="empty">No hay avisos en revisión.</p>`}</div>
    <h2>Quinchos y salones</h2>
    <div class="stack">${venues.length ? venues.map(adminCard).join("") : `<p class="muted">No hay quinchos ni salones.</p>`}</div>`;

  view.querySelectorAll("[data-restore]").forEach((button) => {
    button.addEventListener("click", () => run(() => adminRestore(button.dataset.restore), "Aviso restaurado."));
  });
  view.querySelectorAll("[data-remove]").forEach((button) => {
    button.addEventListener("click", () => {
      if (!confirm("¿Quitar este aviso?")) return;
      run(() => adminRemove(button.dataset.remove), "Aviso quitado.");
    });
  });
  view.querySelectorAll("[data-feature]").forEach((button) => {
    button.addEventListener("click", () => run(() => adminSetFlags(button.dataset.feature, { featured: button.dataset.on !== "1" }), "Listo."));
  });
  view.querySelectorAll("[data-booking]").forEach((button) => {
    button.addEventListener("click", () => run(() => adminSetFlags(button.dataset.booking, { booking_enabled: button.dataset.on !== "1" }), "Turnero actualizado."));
  });
  void route;
}

function adminCard(listing) {
  const reports = (listing.reports || []).map((report) => `<li>${esc(REASON[report.reason] || report.reason)}${report.details ? `: ${esc(report.details)}` : ""}</li>`).join("");
  return `<article class="owner-card">
    <p class="eyebrow">${esc(typeLabel(listing.type))} · ${esc(listing.status)}${listing.report_count ? ` · ${listing.report_count} denuncia${listing.report_count === 1 ? "" : "s"}` : ""}</p>
    <h3><a href="#/aviso/${esc(listing.id)}">${esc(listing.title)}</a></h3>
    <p class="fine">${esc(listing.owner_name || "")} · ${esc(listing.district)}</p>
    ${reports ? `<ul class="fine">${reports}</ul>` : ""}
    <div class="row-actions">
      ${listing.status === "hidden" ? `<button type="button" class="btn btn-small" data-restore="${esc(listing.id)}">Restaurar</button>` : ""}
      <button type="button" class="btn btn-small btn-danger" data-remove="${esc(listing.id)}">Quitar</button>
      <button type="button" class="btn btn-small btn-ghost" data-feature="${esc(listing.id)}" data-on="${listing.featured ? "1" : "0"}">${listing.featured ? "Quitar destacado" : "Destacar"}</button>
      ${isVenue(listing.type) ? `<button type="button" class="btn btn-small btn-ghost" data-booking="${esc(listing.id)}" data-on="${listing.booking_enabled ? "1" : "0"}">${listing.booking_enabled ? "Apagar turnero" : "Activar turnero"}</button>` : ""}
    </div>
  </article>`;
}

async function run(fn, ok) {
  try {
    await fn();
    toast(ok);
    render();
  } catch (error) {
    toast(error.message);
  }
}
