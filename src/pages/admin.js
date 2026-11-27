import { adminHideListing, adminListings, adminRemove, adminRemoveSeek, adminReports, adminResolveReport, adminRestore, adminSetFlags, isDemo } from "../api.js";
import { render } from "../bus.js";
import { esc, typeLabel } from "../format.js";
import { isVenue } from "../geo.js";
import { reportReasonLabel } from "../reports.js";

function reportDay(iso) {
  const date = new Date(iso);
  if (Number.isNaN(+date)) return "";
  return new Intl.DateTimeFormat("es-AR", { day: "numeric", month: "long" }).format(date);
}
import { toast } from "../toast.js";

export async function renderAdmin(view, route, session) {
  if (!isDemo() && !session?.profile?.is_admin) {
    view.innerHTML = `<section class="page-head"><h1 tabindex="-1">Moderación</h1><p>Esta sección es solo para el equipo de Lavalle Alquila. El email tiene que estar en la tabla <strong>admin_emails</strong>.</p><p><a href="#/cuenta">Volver</a></p></section>`;
    return;
  }
  let listings = [];
  let reports = [];
  try {
    [listings, reports] = await Promise.all([adminListings(), adminReports()]);
  } catch (error) {
    view.innerHTML = `<section class="page-head"><h1 tabindex="-1">Moderación</h1><p class="error">${esc(error.message)}</p></section>`;
    return;
  }
  const openReports = reports.filter((item) => !item.resolved_at);
  const resolvedReports = reports.filter((item) => item.resolved_at);
  const review = listings.filter((item) => item.status === "hidden" || item.report_count > 0);
  const venues = listings.filter((item) => isVenue(item.type));
  view.innerHTML = `
    <section class="page-head">
      <h1 tabindex="-1">Moderación</h1>
      <p class="lede">${isDemo() ? "Estás viendo datos de ejemplo. En producción esto solo lo abre quien esté en admin_emails." : "Denuncias, avisos ocultos, destacados y turnero."}</p>
    </section>
    <h2 data-testid="reports-heading">Denuncias</h2>
    <div class="stack" data-testid="admin-reports">
      ${openReports.length ? openReports.map(reportCard).join("") : `<p class="empty">No hay denuncias pendientes.</p>`}
    </div>
    ${resolvedReports.length ? `<h2>Resueltas</h2><div class="stack" data-testid="admin-reports-resolved">${resolvedReports.map(reportCard).join("")}</div>` : ""}
    <h2>Ocultos y denunciados</h2>
    <div class="stack">${review.length ? review.map(adminCard).join("") : `<p class="empty">No hay avisos en revisión.</p>`}</div>
    <h2>Quinchos y salones</h2>
    <div class="stack">${venues.length ? venues.map(adminCard).join("") : `<p class="muted">No hay quinchos ni salones.</p>`}</div>`;

  view.querySelectorAll("[data-resolve]").forEach((button) => {
    button.addEventListener("click", () => run(() => adminResolveReport(button.dataset.resolve), "Denuncia marcada como resuelta."));
  });
  view.querySelectorAll("[data-hide]").forEach((button) => {
    button.addEventListener("click", () => {
      if (!confirm("¿Ocultar este aviso?")) return;
      run(() => adminHideListing(button.dataset.hide), "Aviso oculto.");
    });
  });
  view.querySelectorAll("[data-remove-seek]").forEach((button) => {
    button.addEventListener("click", () => {
      if (!confirm("¿Quitar esta búsqueda?")) return;
      run(() => adminRemoveSeek(button.dataset.removeSeek), "Búsqueda quitada.");
    });
  });
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

function reportCard(report) {
  const done = !!report.resolved_at;
  const listing = report.subject_type === "listing";
  return `<article class="owner-card" data-testid="admin-report" data-resolved="${done ? "1" : "0"}">
    <p class="eyebrow">${esc(reportReasonLabel(report.reason))}${report.subject_status ? ` · ${esc(report.subject_status)}` : ""} · <span data-testid="report-origin">${report.reporter_id ? "Con cuenta" : "Anónima"}</span> · ${esc(reportDay(report.created_at))}</p>
    <h3><a href="${esc(report.subject_href)}">${esc(report.subject_title || "Publicación")}</a></h3>
    ${report.details ? `<p class="fine">${esc(report.details)}</p>` : ""}
    ${done ? `<p class="fine">Resuelta el ${esc(reportDay(report.resolved_at))}</p>` : `<div class="row-actions">
      <button type="button" class="btn btn-small" data-resolve="${esc(report.id)}" data-testid="resolve-report">Marcar resuelta</button>
      ${listing && report.listing_id && report.subject_status !== "hidden" && report.subject_status !== "deleted" ? `<button type="button" class="btn btn-small btn-danger" data-hide="${esc(report.listing_id)}" data-testid="hide-listing">Ocultar aviso</button>` : ""}
      ${!listing && report.seek_id && report.subject_status !== "deleted" ? `<button type="button" class="btn btn-small btn-danger" data-remove-seek="${esc(report.seek_id)}">Quitar búsqueda</button>` : ""}
    </div>`}
  </article>`;
}

function adminCard(listing) {
  const reports = (listing.reports || []).map((report) => `<li>${esc(reportReasonLabel(report.reason))}${report.details ? `: ${esc(report.details)}` : ""}</li>`).join("");
  return `<article class="owner-card">
    <p class="eyebrow">${esc(typeLabel(listing.type))} · ${esc(listing.status)}${listing.report_count ? ` · ${listing.report_count} denuncia${listing.report_count === 1 ? "" : "s"}` : ""}</p>
    <h3><a href="#/aviso/${esc(listing.id)}">${esc(listing.title)}</a></h3>
    <p class="fine">${ownerLink(listing)} · ${esc(listing.district)}</p>
    ${reports ? `<ul class="fine">${reports}</ul>` : ""}
    <div class="row-actions">
      ${listing.status === "hidden" ? `<button type="button" class="btn btn-small" data-restore="${esc(listing.id)}">Restaurar</button>` : `<button type="button" class="btn btn-small btn-danger" data-hide="${esc(listing.id)}">Ocultar</button>`}
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

function ownerLink(listing) {
  const name = listing.owner_name || "Un vecino de Lavalle";
  if (!listing.owner_id) return esc(name);
  return `<a class="admin-owner" href="#/admin/anunciante/${esc(listing.owner_id)}" data-testid="admin-advertiser">${esc(name)}</a>`;
}
