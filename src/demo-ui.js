export const LIVE_SITE_URL = "https://lavallealquila.com.ar/";

export function liveSiteUrl() {
  return LIVE_SITE_URL;
}

export function demoNoticeHtml() {
  return `<aside class="demo-notice" data-testid="demo-notice" role="status">
    <p>Estás en la versión de prueba: lo que publiques no se guarda. Para publicar de verdad entrá a <a href="${LIVE_SITE_URL}">lavallealquila.com.ar</a>.</p>
  </aside>`;
}

export function demoBannerHtml() {
  return `<p class="demo-banner">Modo ejemplo: estos avisos son ficticios y lo que publiques no se guarda. Para publicar de verdad entrá a <a href="${LIVE_SITE_URL}">lavallealquila.com.ar</a>.</p>`;
}
