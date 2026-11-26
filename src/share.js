import { esc } from "./format.js";
import { toast } from "./toast.js";

export function appUrl(hash) {
  const url = new URL(location.href);
  url.hash = hash.startsWith("#") ? hash : `#${hash}`;
  return url.href;
}

export function listingUrl(id) {
  return appUrl(`#/aviso/${id}`);
}

export function seekUrl(id) {
  return appUrl(`#/busco/${id}`);
}

export async function shareItem({ title, text, url }) {
  if (typeof navigator.share === "function") {
    try {
      await navigator.share({ title, text, url });
      return "shared";
    } catch (error) {
      if (error?.name === "AbortError") return "abort";
    }
  }
  return "fallback";
}

export function shareFallbackHtml({ title, text, url }) {
  const wa = `https://wa.me/?text=${encodeURIComponent(`${text}\n${url}`)}`;
  return `<div class="sheet-back" data-close-share hidden></div>
    <div class="sheet" data-share-sheet hidden data-testid="share-sheet">
      <div class="sheet-grab"></div>
      <h2>Compartir</h2>
      <p>${esc(title)}</p>
      <p class="fine">${esc(url)}</p>
      <div class="stack">
        <button type="button" class="btn btn-primary" data-copy-link>Copiar enlace</button>
        <a class="btn btn-wa" target="_blank" rel="noopener noreferrer" href="${esc(wa)}">Compartir por WhatsApp</a>
      </div>
    </div>`;
}

export function bindShare(root, payload) {
  const button = root.querySelector("[data-share]");
  const sheet = root.querySelector("[data-share-sheet]");
  const back = root.querySelector("[data-close-share]");
  if (!button || !sheet) return;
  const open = () => {
    sheet.hidden = false;
    back.hidden = false;
  };
  const close = () => {
    sheet.hidden = true;
    back.hidden = true;
  };
  button.addEventListener("click", async () => {
    const result = await shareItem(payload);
    if (result === "fallback") open();
  });
  back?.addEventListener("click", close);
  root.querySelector("[data-copy-link]")?.addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(payload.url);
      toast("Enlace copiado.");
      close();
    } catch {
      toast("No se pudo copiar. Seleccioná el enlace y copialo a mano.");
    }
  });
}
