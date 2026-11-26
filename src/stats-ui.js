import { esc } from "./format.js";
import { totalsFor, weekdayShort, weekSeries } from "./stats.js";

export function statsPanelHtml(listings, seeks, rows, days) {
  const series = weekSeries(rows, days);
  const max = Math.max(1, ...series.flatMap((day) => [day.view, day.share, day.whatsapp]));
  const items = [
    ...listings.map((item) => ({ type: "listing", id: item.id, title: item.title, kind: item.type === "quincho" || item.type === "salon" ? "Quincho o salón" : "Aviso" })),
    ...seeks.map((item) => ({ type: "seek", id: item.id, title: item.note, kind: "Busco alquiler" })),
  ];
  return `<section class="stats" data-testid="stats-panel">
    <h2>Tus números</h2>
    <p class="fine">Visitas, veces que tocaron Compartir y clics a WhatsApp. Cada visita cuenta una sola vez por persona y por día. No guardamos quién miró.</p>
    <div class="week-chart" role="img" aria-label="Actividad de los últimos 7 días">
      ${series.map((day) => `<div class="week-col">
        <div class="week-bars">
          <span class="bar bar-view" style="height:${Math.round((day.view / max) * 100)}%" title="${day.view} visitas"></span>
          <span class="bar bar-share" style="height:${Math.round((day.share / max) * 100)}%" title="${day.share} compartidos"></span>
          <span class="bar bar-wa" style="height:${Math.round((day.whatsapp / max) * 100)}%" title="${day.whatsapp} WhatsApp"></span>
        </div>
        <small>${esc(weekdayShort(day.day))}</small>
      </div>`).join("")}
    </div>
    <ul class="legend">
      <li><i class="dot bar-view"></i> Visitas</li>
      <li><i class="dot bar-share"></i> Compartidos</li>
      <li><i class="dot bar-wa"></i> WhatsApp</li>
    </ul>
    <div class="stack">
      ${items.length ? items.map((item) => {
        const totals = totalsFor(rows, item.type, item.id);
        return `<article class="stat-card">
          <p class="eyebrow">${esc(item.kind)}</p>
          <h3>${esc(item.title)}</h3>
          <p class="stat-nums"><span>${totals.view} visitas</span><span>${totals.share} compartidos</span><span>${totals.whatsapp} WhatsApp</span></p>
        </article>`;
      }).join("") : `<p class="muted">Cuando publiques, vas a ver las visitas acá.</p>`}
    </div>
  </section>`;
}
