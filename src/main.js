import "@fontsource/outfit/latin-400.css";
import "@fontsource/outfit/latin-500.css";
import "@fontsource/outfit/latin-600.css";
import "@fontsource/outfit/latin-700.css";
import "@fontsource/fraunces/latin-600.css";
import "@fontsource/fraunces/latin-700.css";
import "./styles.css";
import { getSession, isDemo, watchAuth } from "./api.js";
import { onRender } from "./bus.js";
import { createRenderQueue } from "./render-queue.js";
import { icon } from "./icons.js";
import { renderAccount, renderOwnerTurnero } from "./pages/account.js";
import { renderAdmin } from "./pages/admin.js";
import { renderDetail } from "./pages/detail.js";
import { renderHome, renderVenues } from "./pages/home.js";
import { renderMap } from "./pages/map.js";
import { renderPublish } from "./pages/publish.js";
import { renderSeek, renderSeekNew, renderSeeks } from "./pages/seeks.js";
import { givenName } from "./format.js";
import { resetPageMeta } from "./meta.js";
import { parseRoute } from "./router.js";

const TITLES = {
  home: "Alquileres en Lavalle, Mendoza",
  venues: "Quinchos y salones en Lavalle",
  map: "Mapa de alquileres",
  detail: "Aviso",
  publish: "Publicar aviso",
  seeks: "Busco alquiler",
  seek: "Búsqueda",
  "seek-new": "Publicar búsqueda",
  account: "Mi cuenta",
  admin: "Moderación",
  turnero: "Turnero",
};

const routes = {
  home: renderHome,
  venues: renderVenues,
  map: renderMap,
  detail: renderDetail,
  publish: renderPublish,
  seeks: renderSeeks,
  seek: renderSeek,
  "seek-new": renderSeekNew,
  account: renderAccount,
  admin: renderAdmin,
  turnero: renderOwnerTurnero,
};

const app = document.querySelector("#app");

function shell(route, session) {
  const base = import.meta.env.BASE_URL;
  const name = givenName(session?.profile?.full_name);
  const tab = (id, href, label, glyph) => {
    const on = route.name === id;
    return `<a class="tab${on ? " is-on" : ""}" href="${href}" ${on ? 'aria-current="page"' : ""}>${icon(glyph)}<span>${label}</span></a>`;
  };
  return `
    <header class="topbar">
      <a class="brand" href="#/">
        <img src="${base}favicon.svg" width="36" height="36" alt="" />
        <span><strong>Lavalle Alquila</strong><small>Mendoza</small></span>
      </a>
      <a class="who" href="#/cuenta">${name ? esc(name) : "Entrar"}</a>
    </header>
    ${isDemo() ? `<p class="demo-banner">Modo ejemplo: estos avisos son ficticios, para ver cómo va a quedar.</p>` : ""}
    <main id="view" class="view"><p class="fine">Cargando…</p></main>
    <nav class="tabbar" aria-label="Secciones">
      ${tab("home", "#/", "Inicio", "home")}
      ${tab("map", "#/mapa", "Mapa", "map")}
      ${tab("publish", "#/publicar", "Publicar", "plus")}
      ${tab("venues", "#/quinchos", "Quinchos", "party")}
      ${tab("account", "#/cuenta", "Yo", "user")}
    </nav>`;
}

function esc(value) {
  return String(value ?? "").replace(/[&<>"']/g, (ch) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  }[ch]));
}

async function renderOnce({ scroll = true } = {}) {
  const route = parseRoute();
  resetPageMeta();
  document.title = `${TITLES[route.name] || "Lavalle Alquila"} · Lavalle Alquila`;
  let session = null;
  try {
    session = await getSession();
  } catch (error) {
    session = null;
    console.warn(error);
  }
  app.innerHTML = shell(route, session);
  const view = document.querySelector("#view");
  const page = routes[route.name] || renderHome;
  try {
    await page(view, route, session);
  } catch (error) {
    if (!view?.isConnected) return;
    view.innerHTML = `<p class="error">${esc(error.message || "No se pudo abrir esta pantalla")}</p>`;
  }
  if (scroll) window.scrollTo(0, 0);
}

const renderApp = createRenderQueue(renderOnce);

onRender((options) => {
  void renderApp(options);
});
window.addEventListener("hashchange", () => {
  void renderApp({ scroll: true });
});
watchAuth(() => {
  void renderApp({ scroll: false });
});
void renderApp();
