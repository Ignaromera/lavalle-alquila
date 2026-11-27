import { createSeek, deleteSeek, ensureDemoProfile, getSeek, isDemo, listSeeks, maybeTrackView, renewSeek, trackStat } from "../api.js";
import { render } from "../bus.js";
import { districtOptions, seekCard } from "../cards.js";
import { demoNoticeHtml } from "../demo-ui.js";
import { authBoxHtml, bindAuth, demoLoginsHtml } from "./auth-ui.js";
import { DEMO_LOGIN } from "../api.js";
import { esc, formatArs, formatWhen, parseMoney, seekWaText, typeLabel, waLink } from "../format.js";
import { DISTRICT_NAMES, HOUSING_TYPES, VENUE_TYPES } from "../geo.js";
import { setPageMeta } from "../meta.js";
import { bindShare, seekUrl, shareFallbackHtml } from "../share.js";
import { toast } from "../toast.js";


const SEEK_TYPE_IDS = new Set([
  "cualquiera",
  ...HOUSING_TYPES.map((type) => type.id),
  ...VENUE_TYPES.map((type) => type.id),
]);

/** Lee tipo, distrito y presupuesto desde la URL de #/busco/nuevo. */
export function seekDefaultsFromParams(params) {
  const rawType = String(params?.get?.("tipo") || "");
  const rawDistrict = String(params?.get?.("distrito") || "");
  const budget = String(params?.get?.("max") || params?.get?.("presupuesto") || "").replace(/\D/g, "");
  return {
    type: SEEK_TYPE_IDS.has(rawType) ? rawType : "cualquiera",
    district: DISTRICT_NAMES.includes(rawDistrict) ? rawDistrict : "",
    budget,
  };
}

/** Arma #/busco/nuevo con los filtros del listado (tipo, distrito, precio máximo). */
export function seekNewHref(filters = {}) {
  const params = new URLSearchParams();
  if (filters.type) params.set("tipo", filters.type);
  if (filters.district) params.set("distrito", filters.district);
  const budget = filters.maxPrice || filters.budget;
  if (budget) params.set("max", String(budget).replace(/\D/g, ""));
  const query = params.toString();
  return query ? `#/busco/nuevo?${query}` : "#/busco/nuevo";
}


export async function renderSeeks(view) {
  const seeks = await listSeeks();
  view.innerHTML = `
    <section class="page-head">
      <h1 tabindex="-1">Busco alquiler</h1>
      <p class="lede">Si estás buscando, dejanos el aviso. Quien tenga algo te escribe por WhatsApp.</p>
    </section>
    ${isDemo() ? demoNoticeHtml() : ""}
    <p><a class="btn btn-primary" href="#/busco/nuevo">Publicar lo que busco</a></p>
    <div class="stack" data-testid="seeks">
      ${seeks.length ? seeks.map((seek) => seekCard(seek)).join("") : `<p class="empty">Todavía no hay búsquedas. Sé la primera.</p>`}
    </div>`;
  view.querySelectorAll("[data-stat=whatsapp]").forEach((link) => {
    link.addEventListener("click", () => trackStat("seek", link.dataset.id, "whatsapp"));
  });
}

export async function renderSeek(view, route) {
  const seek = await getSeek(route.parts[1]);
  const visible = seek && seek.status !== "deleted" && new Date(seek.expires_at) > new Date();
  if (!visible) {
    view.innerHTML = `<section class="page-head"><h1>Búsqueda no disponible</h1><p>Puede haber vencido.</p><p><a class="btn btn-primary" href="#/busco">Ver búsquedas</a></p></section>`;
    return;
  }
  const url = seekUrl(seek.id);
  const title = `Busco ${typeLabel(seek.type).toLowerCase()} en ${seek.district || "Lavalle"}`;
  const text = `${title}. Hasta ${formatArs(seek.budget_ars)}. ${seek.note}`;
  setPageMeta({ title, description: text.slice(0, 180), url });
  view.innerHTML = `
    <article class="detail" data-testid="seek-detail">
      <a class="back" href="#/busco">← Búsquedas</a>
      <p class="eyebrow">${esc(typeLabel(seek.type))}${seek.district ? ` · ${esc(seek.district)}` : " · cualquier distrito"}</p>
      <h1>${esc(title)}</h1>
      <p class="price">${esc(formatArs(seek.budget_ars))}</p>
      <p>${esc(seek.note)}</p>
      <p class="fine">${esc(seek.owner_name || "Vecino")}${seek.example ? " · ejemplo" : ""}</p>
      <button type="button" class="btn btn-ghost" data-share data-testid="share">Compartir</button>
      <p><a class="btn btn-wa" data-stat="whatsapp" target="_blank" rel="noopener noreferrer" href="${esc(waLink(seek.whatsapp, seekWaText(seek)))}">Escribir por WhatsApp</a></p>
      ${shareFallbackHtml({ title, text, url })}
    </article>`;
  bindShare(view, { title, text, url, onShare: () => trackStat("seek", seek.id, "share") });
  view.querySelectorAll("[data-stat=whatsapp]").forEach((link) => {
    link.addEventListener("click", () => trackStat("seek", seek.id, "whatsapp"));
  });
  maybeTrackView("seek", seek.id);
}

export async function renderSeekNew(view, route, session) {
  const ready = !!(session?.profile.full_name && session?.profile.whatsapp);
  const defaults = seekDefaultsFromParams(route?.params);
  view.innerHTML = `
    <section class="page-head">
      <h1 tabindex="-1">Qué estás buscando</h1>
      <p class="lede">Dura 60 días. Después lo podés renovar desde tu cuenta.</p>
    </section>
    ${isDemo() ? demoNoticeHtml() : ""}
    ${session ? "" : authBoxHtml()}
    ${!session ? demoLoginsHtml(DEMO_LOGIN) : ""}
    <form class="stack" data-testid="seek-form">
      ${ready ? "" : `<label class="field">Tu nombre<input name="full_name" required value="${esc(session?.profile.full_name || "")}" /></label>
        <label class="field">WhatsApp<input name="whatsapp" required inputmode="tel" placeholder="2615551234" value="${esc(session?.profile.whatsapp || "")}" /></label>`}
      <label class="field">Busco
        <select name="type">
          <option value="cualquiera"${defaults.type === "cualquiera" ? " selected" : ""}>Cualquier cosa</option>
          ${[...HOUSING_TYPES, ...VENUE_TYPES].map((type) => `<option value="${type.id}"${defaults.type === type.id ? " selected" : ""}>${type.label}</option>`).join("")}
        </select>
      </label>
      <label class="field">Distrito
        <select name="district">${districtOptions(defaults.district, "Cualquier distrito de Lavalle")}</select>
      </label>
      <label class="field">Presupuesto por mes
        <input name="budget" inputmode="numeric" required placeholder="400000" value="${esc(defaults.budget)}" />
      </label>
      <label class="field">Nota
        <textarea name="note" required maxlength="500" placeholder="Familia, mascota, desde cuándo…"></textarea>
      </label>
      <button class="btn btn-primary" type="submit">Publicar búsqueda</button>
    </form>`;
  const form = view.querySelector("[data-testid=seek-form]");
  form.elements.type.value = defaults.type;
  form.elements.district.value = defaults.district;
  if (defaults.budget) form.elements.budget.value = defaults.budget;
  bindAuth(view, () => render());
  view.querySelectorAll("[data-demo]").forEach((button) => {
    button.addEventListener("click", async () => {
      const { signInDemo } = await import("../api.js");
      await signInDemo(button.dataset.demo);
      render();
    });
  });
  view.querySelector("[data-testid=seek-form]").addEventListener("submit", async (event) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    try {
      if (!session) {
        if (!isDemo()) throw new Error("Entrá con tu email para publicar");
        await ensureDemoProfile({ full_name: data.get("full_name"), whatsapp: data.get("whatsapp") });
      } else if (!ready) {
        const { saveProfile } = await import("../api.js");
        await saveProfile({ full_name: data.get("full_name"), whatsapp: data.get("whatsapp") });
      }
      await createSeek({
        type: String(data.get("type")),
        district: String(data.get("district") || ""),
        budget_ars: parseMoney(data.get("budget")),
        note: String(data.get("note") || ""),
      });
      toast(isDemo() ? "Listo. En el modo ejemplo queda solo en este navegador." : "Listo, tu búsqueda ya se ve.");
      location.hash = "#/busco";
    } catch (error) {
      toast(error.message);
    }
  });
}

export function seekOwnerCard(seek) {
  return `<article class="seek">
    <p class="eyebrow">${esc(typeLabel(seek.type))}${seek.district ? ` · ${esc(seek.district)}` : ""}</p>
    <h2>Hasta ${esc(formatArs(seek.budget_ars))}</h2>
    <p>${esc(seek.note)}</p>
    <p class="fine">${esc(formatWhen(seek.expires_at))}</p>
    <div class="row-actions">
      <button type="button" class="btn btn-small" data-renew-seek="${esc(seek.id)}">Renovar 60 días</button>
      <button type="button" class="btn btn-small btn-ghost" data-delete-seek="${esc(seek.id)}">Borrar</button>
    </div>
  </article>`;
}

export function bindSeekActions(root) {
  root.querySelectorAll("[data-renew-seek]").forEach((button) => {
    button.addEventListener("click", async () => {
      try {
        await renewSeek(button.dataset.renewSeek);
        toast("Búsqueda renovada por 60 días.");
        render();
      } catch (error) {
        toast(error.message);
      }
    });
  });
  root.querySelectorAll("[data-delete-seek]").forEach((button) => {
    button.addEventListener("click", async () => {
      if (!confirm("¿Borrar esta búsqueda?")) return;
      try {
        await deleteSeek(button.dataset.deleteSeek);
        render();
      } catch (error) {
        toast(error.message);
      }
    });
  });
}
