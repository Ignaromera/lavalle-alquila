import "./styles.css";
import { consumeAuthRedirect, getSession, isDemo, watchAuth } from "./api.js";
import { demoBannerHtml } from "./demo-ui.js";
import { onRender } from "./bus.js";
import { createRenderQueue } from "./render-queue.js";
import { icon } from "./icons.js";
import { renderAccount, renderOwnerTurnero } from "./pages/account.js";
import { renderAdmin } from "./pages/admin.js";
import { renderAdvertiser } from "./pages/advertiser.js";
import { renderDetail } from "./pages/detail.js";
import { renderHome, renderVenues } from "./pages/home.js";
import { renderMap } from "./pages/map.js";
import { renderPlans } from "./pages/plans.js";
import { renderHow } from "./pages/how.js";
import { renderRegret } from "./pages/regret.js";
import { renderPublish } from "./pages/publish.js";
import { renderSeek, renderSeekNew, renderSeeks } from "./pages/seeks.js";
import { bindPublishChoice, publishChoiceHtml } from "./publish-choice.js";
import { renderSubscription } from "./pages/subscription.js";
import { appendLegalFooter, headerAccountLabel, sessionEmail } from "./pages/auth-ui.js";
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
  plans: "Planes",
  subscription: "Mi suscripción",
  admin: "Moderación",
  advertiser: "Avisos del anunciante",
  "advertiser-admin": "Avisos del anunciante",
  turnero: "Turnero",
  how: "Cómo funciona",
  regret: "Botón de arrepentimiento",
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
  plans: renderPlans,
  subscription: renderSubscription,
  admin: renderAdmin,
  advertiser: renderAdvertiser,
  "advertiser-admin": renderAdvertiser,
  turnero: renderOwnerTurnero,
  how: renderHow,
  regret: renderRegret,
};

const app = document.querySelector("#app");

function shell(route, session) {
  const base = import.meta.env.BASE_URL;
  const tab = (id, href, label, glyph) => {
    const on = route.name === id
      || (id === "account" && (route.name === "plans" || route.name === "subscription"))
      || (id === "publish" && route.name === "seek-new");
    if (id === "publish") {
      return `<button type="button" class="tab tab-plus${on ? " is-on" : ""}" data-open-publish data-testid="tab-publish" aria-haspopup="dialog" aria-expanded="false" aria-controls="publish-choice">${icon(glyph)}<span>${label}</span></button>`;
    }
    return `<a class="tab${on ? " is-on" : ""}" href="${href}" ${on ? 'aria-current="page"' : ""}>${icon(glyph)}<span>${label}</span></a>`;
  };
  return `
    <header class="topbar">
      <a class="wordmark" href="#/" aria-label="Lavalle Alquila, inicio">
        <img src="${base}brand/lavalle-alquila-marca.svg" width="30" height="24" alt="" />
        <span class="wm-text">Lavalle Alquila <small>Mendoza</small></span>
      </a>
      <nav class="top-nav" aria-label="Información">
        <a class="top-plans top-how" href="#/como-funciona" data-testid="header-como-funciona"${route.name === "how" ? ' aria-current="page"' : ""}>Cómo funciona</a>
        <a class="top-plans" href="#/planes" data-testid="header-planes"${route.name === "plans" ? ' aria-current="page"' : ""}>Planes</a>
      </nav>
      <a class="who" href="#/cuenta" data-testid="header-auth">${esc(headerAccountLabel(session))}</a>
    </header>
    ${isDemo() ? demoBannerHtml() : ""}
    <main id="view" class="view"><p class="fine">Cargando…</p></main>
    <nav class="tabbar" aria-label="Secciones">
      ${tab("home", "#/", "Inicio", "home")}
      ${tab("map", "#/mapa", "Mapa", "map")}
      ${tab("publish", "#/publicar", "Publicar", "plus")}
      ${tab("venues", "#/quinchos", "Quinchos", "grill")}
      ${tab("account", "#/cuenta", "Yo", "user")}
    </nav>
    ${publishChoiceHtml()}`;
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
  bindPublishChoice(app);
  const view = document.querySelector("#view");
  const page = routes[route.name] || renderHome;
  try {
    await page(view, route, session);
  } catch (error) {
    if (!view?.isConnected) return;
    view.innerHTML = `<p class="error">${esc(error.message || "No se pudo abrir esta pantalla")}</p>`;
  }
  if (view?.isConnected) appendLegalFooter(view, sessionEmail(session));
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

async function boot() {
  let redirect = { kind: "none" };
  try {
    redirect = await consumeAuthRedirect();
  } catch (error) {
    console.warn(error);
    redirect = { kind: "error", message: error.message };
  }
  if (redirect.kind === "error" && redirect.message) {
    const { toast } = await import("./toast.js");
    toast(redirect.message);
  }
  if ((redirect.kind === "confirmed" || redirect.kind === "recovery") && location.hash !== "#/cuenta") {
    location.hash = "#/cuenta";
    return;
  }
  void renderApp();
}

void boot();
