const DEFAULT_TITLE = "Lavalle Alquila — Alquileres en Lavalle, Mendoza";
const DEFAULT_DESCRIPTION = "Alquileres entre vecinos de Lavalle, Mendoza. Publicá tu aviso gratis y consultá por WhatsApp.";

function upsert(attr, key, value) {
  let el = document.head.querySelector(`meta[${attr}="${key}"]`);
  if (!el) {
    el = document.createElement("meta");
    el.setAttribute(attr, key);
    document.head.appendChild(el);
  }
  el.setAttribute("content", value);
}

export function setPageMeta({ title, description, url }) {
  const pageTitle = title || DEFAULT_TITLE;
  const pageDescription = description || DEFAULT_DESCRIPTION;
  document.title = pageTitle.includes("Lavalle Alquila") ? pageTitle : `${pageTitle} · Lavalle Alquila`;
  upsert("name", "description", pageDescription);
  upsert("property", "og:title", document.title);
  upsert("property", "og:description", pageDescription);
  upsert("property", "og:url", url || location.href);
  upsert("name", "twitter:title", document.title);
  upsert("name", "twitter:description", pageDescription);
}

export function resetPageMeta() {
  setPageMeta({ title: DEFAULT_TITLE, description: DEFAULT_DESCRIPTION, url: location.href });
}
