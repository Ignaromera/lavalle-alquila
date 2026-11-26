import { listListings } from "../api.js";
import { filtersFromParams, queryFromFilters } from "../filter.js";
import { esc, priceLabel, typeLabel } from "../format.js";
import { mountMap } from "../map.js";
import { navigate } from "../router.js";

export async function renderMap(view, route) {
  const venue = route.params.get("vista") === "quinchos";
  const filters = filtersFromParams(route.params, venue ? "venue" : "housing");
  const listings = await listListings(filters);
  view.innerHTML = `
    <section class="page-head tight">
      <h1 tabindex="-1">Mapa</h1>
      <div class="segment" role="tablist">
        <button type="button" class="seg${!venue ? " is-on" : ""}" data-vista="viviendas">Alquileres</button>
        <button type="button" class="seg${venue ? " is-on" : ""}" data-vista="quinchos">Quinchos</button>
      </div>
    </section>
    <div class="map-wrap">
      <div class="map-canvas" data-testid="map" role="region" aria-label="Mapa de avisos"></div>
      <div class="map-peek" hidden></div>
    </div>
    <p class="fine map-note">${listings.length} aviso${listings.length === 1 ? "" : "s"} en el mapa. La línea naranja marca el límite del departamento de Lavalle.</p>`;

  view.querySelectorAll("[data-vista]").forEach((button) => {
    button.addEventListener("click", () => {
      const next = button.dataset.vista === "quinchos" ? "venue" : "housing";
      const query = queryFromFilters({ ...filters, kind: next }, next === "venue" ? { vista: "quinchos" } : {});
      navigate(`/mapa${query}`);
    });
  });

  const peek = view.querySelector(".map-peek");
  const canvas = view.querySelector(".map-canvas");
  await mountMap(canvas, {
    listings,
    polygon: true,
    onMarker(item) {
      if (!peek) return;
      peek.hidden = false;
      peek.innerHTML = `<div>
        <p class="eyebrow">${esc(typeLabel(item.type))} · ${esc(item.district)}</p>
        <strong>${esc(item.title)}</strong>
        <p class="price">${esc(priceLabel(item))}</p>
      </div>
      <a class="btn btn-primary" href="#/aviso/${esc(item.id)}">Ver aviso</a>`;
    },
  });
}
