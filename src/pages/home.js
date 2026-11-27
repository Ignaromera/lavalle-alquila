import { listListings } from "../api.js";
import { render } from "../bus.js";
import { districtOptions, listingCard } from "../cards.js";
import { activeFilterCount, filtersFromParams, queryFromFilters, SORT_OPTIONS, storeSort } from "../filter.js";
import { esc } from "../format.js";
import { icon } from "../icons.js";
import { HOUSING_TYPES, VENUE_TYPES } from "../geo.js";
import { navigate } from "../router.js";
import { seekNewHref } from "./seeks.js";

export async function renderHome(view, route) {
  await renderCatalog(view, route, {
    kind: "housing",
    title: "Alquileres en Lavalle",
    lede: "Casas, departamentos, locales y terrenos. Directo con el dueño, por WhatsApp.",
    base: "#/",
    testid: "home-list",
  });
}

export async function renderVenues(view, route) {
  await renderCatalog(view, route, {
    kind: "venue",
    title: "Quinchos y salones",
    lede: "Para un asado, un cumpleaños o una fiesta. Precio por día o por turno.",
    base: "#/quinchos",
    testid: "venue-list",
  });
}

async function renderCatalog(view, route, config) {
  const filters = filtersFromParams(route.params, config.kind);
  const listings = await listListings(filters);
  const count = activeFilterCount(filters);
  const query = queryFromFilters(filters, config.kind === "venue" ? { vista: "quinchos" } : {});
  const types = config.kind === "venue" ? VENUE_TYPES : HOUSING_TYPES;
  view.innerHTML = `
    <section class="page-head">
      <h1>${esc(config.title)}</h1>
      <p class="lede">${esc(config.lede)}</p>
    </section>
    <div class="toolbar">
      <button type="button" class="btn btn-dark" data-open-filters>
        ${icon("filter")} Filtrar ${count ? `<span class="count">${count}</span>` : ""}
      </button>
      <a class="btn btn-ghost" href="#/mapa${esc(query)}">${icon("map")} Ver mapa</a>
      <label class="sort-field">
        <span class="sr-only">Ordenar</span>
        <select data-sort data-testid="sort-select" aria-label="Ordenar avisos">
          ${SORT_OPTIONS.map((option) => `<option value="${option.id}"${filters.sort === option.id ? " selected" : ""}>${option.label}</option>`).join("")}
        </select>
      </label>
    </div>
    ${config.kind === "housing" ? `<div class="quick">
      <a href="#/quinchos">Quinchos y salones</a>
    </div>` : `<div class="quick"><a href="#/">Volver a alquileres</a></div>`}
    ${listings.length ? `<aside class="seek-cta" data-testid="seek-cta">
      <h2>¿No encontrás lo que buscás?</h2>
      <p>Contanos qué necesitás y que los dueños te escriban.</p>
      <p class="seek-cta-actions">
        <a class="btn btn-primary" href="#/busco/nuevo">Publicar lo que busco</a>
        <a class="seek-cta-link" href="#/busco">Ver búsquedas</a>
      </p>
    </aside>` : ""}
    <p class="result-count">${listings.length} aviso${listings.length === 1 ? "" : "s"}</p>
    <div class="cards" data-testid="${config.testid}">
      ${listings.length ? listings.map(listingCard).join("") : `<div class="empty" data-testid="empty-results">
        <p>Ningún aviso coincide con esos filtros. Probá ampliar la búsqueda.</p>
        <p class="empty-actions"><a class="btn btn-primary" href="${esc(seekNewHref(filters))}">Publicá lo que buscás</a></p>
      </div>`}
    </div>
    <p class="safety-inline">Nunca pagues una seña sin ver la propiedad.</p>
    <div class="sheet-back" data-close-filters hidden></div>
    <form class="sheet" data-testid="filter-sheet" hidden>
      <div class="sheet-grab"></div>
      <h2>Filtrá la búsqueda</h2>
      <label class="field">Tipo
        <select name="tipo">
          <option value="">Todos</option>
          ${types.map((type) => `<option value="${type.id}"${filters.type === type.id ? " selected" : ""}>${type.label}</option>`).join("")}
        </select>
      </label>
      <label class="field">Distrito
        <select name="distrito">${districtOptions(filters.district)}</select>
      </label>
      <label class="field">Precio máximo
        <input name="max" inputmode="numeric" placeholder="Ej. 400000" value="${esc(filters.maxPrice)}" />
      </label>
      ${config.kind === "housing" ? `
        <label class="field">Mascotas
          <select name="mascotas">
            <option value="">Cualquiera</option>
            <option value="si"${filters.pets === "si" ? " selected" : ""}>Acepta mascotas</option>
            <option value="no"${filters.pets === "no" ? " selected" : ""}>No acepta</option>
          </select>
        </label>
        <label class="field">Garantía
          <select name="garantia">
            <option value="">Cualquiera</option>
            <option value="si"${filters.guarantee === "si" ? " selected" : ""}>Pide garantía</option>
            <option value="no"${filters.guarantee === "no" ? " selected" : ""}>Sin garantía</option>
          </select>
        </label>` : `
        <label class="field">Capacidad mínima
          <input name="capacidad" inputmode="numeric" placeholder="Ej. 30" value="${esc(filters.minCapacity)}" />
        </label>
        <label class="field">Precio
          <select name="unidad">
            <option value="">Día o turno</option>
            <option value="dia"${filters.priceUnit === "dia" ? " selected" : ""}>Por día</option>
            <option value="turno"${filters.priceUnit === "turno" ? " selected" : ""}>Por turno</option>
          </select>
        </label>
        <fieldset class="checks">
          <legend>Comodidades</legend>
          ${["pileta", "parrilla", "cocina", "banos", "estacionamiento"].map((id) => {
            const label = { pileta: "Pileta", parrilla: "Parrilla", cocina: "Cocina", banos: "Baños", estacionamiento: "Estacionamiento" }[id];
            const on = filters.amenities.includes(id);
            return `<label class="checkline"><input type="checkbox" name="comodidades" value="${id}"${on ? " checked" : ""} /> ${label}</label>`;
          }).join("")}
        </fieldset>`}
      <div class="sheet-actions">
        <button type="button" class="btn btn-ghost" data-clear-filters>Limpiar</button>
        <button type="submit" class="btn btn-primary">Ver avisos</button>
      </div>
    </form>`;

  const sheet = view.querySelector(".sheet");
  const back = view.querySelector(".sheet-back");
  const open = () => {
    sheet.hidden = false;
    back.hidden = false;
    document.body.classList.add("sheet-open");
  };
  const close = () => {
    sheet.hidden = true;
    back.hidden = true;
    document.body.classList.remove("sheet-open");
  };
  view.querySelector("[data-open-filters]").addEventListener("click", open);
  back.addEventListener("click", close);
  view.querySelector("[data-clear-filters]").addEventListener("click", () => {
    navigate(`${config.base}${queryFromFilters({ kind: config.kind, sort: filters.sort })}`);
  });
  view.querySelector("[data-sort]").addEventListener("change", (event) => {
    const sort = storeSort(event.target.value);
    navigate(`${config.base}${queryFromFilters({ ...filters, sort })}`);
  });
  sheet.addEventListener("submit", (event) => {
    event.preventDefault();
    const data = new FormData(sheet);
    const next = {
      kind: config.kind,
      type: String(data.get("tipo") || ""),
      district: String(data.get("distrito") || ""),
      maxPrice: String(data.get("max") || "").replace(/\D/g, ""),
      pets: String(data.get("mascotas") || ""),
      guarantee: String(data.get("garantia") || ""),
      minCapacity: String(data.get("capacidad") || "").replace(/\D/g, ""),
      priceUnit: String(data.get("unidad") || ""),
      amenities: data.getAll("comodidades").map(String),
      sort: filters.sort,
    };
    close();
    navigate(`${config.base}${queryFromFilters(next)}`);
  });
  if (route.params.get("filtros") === "1") open();
  void render;
}
