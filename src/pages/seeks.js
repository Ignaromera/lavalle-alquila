import { createSeek, deleteSeek, ensureDemoProfile, isDemo, listSeeks, renewSeek } from "../api.js";
import { render } from "../bus.js";
import { districtOptions } from "../cards.js";
import { authBoxHtml, bindAuth, demoLoginsHtml } from "./auth-ui.js";
import { DEMO_LOGIN } from "../api.js";
import { esc, formatArs, formatWhen, parseMoney, seekWaText, typeLabel, waLink } from "../format.js";
import { HOUSING_TYPES, VENUE_TYPES } from "../geo.js";
import { toast } from "../toast.js";

export async function renderSeeks(view) {
  const seeks = await listSeeks();
  view.innerHTML = `
    <section class="page-head">
      <h1 tabindex="-1">Busco alquiler</h1>
      <p class="lede">Si estás buscando, dejanos el aviso. Quien tenga algo te escribe por WhatsApp.</p>
    </section>
    <p><a class="btn btn-primary" href="#/busco/nuevo">Publicar lo que busco</a></p>
    <div class="stack" data-testid="seeks">
      ${seeks.length ? seeks.map((seek) => `<article class="seek">
        <p class="eyebrow">${esc(typeLabel(seek.type))}${seek.district ? ` · ${esc(seek.district)}` : " · cualquier distrito"}</p>
        <h2>Hasta ${esc(formatArs(seek.budget_ars))}</h2>
        <p>${esc(seek.note)}</p>
        <p class="fine">${esc(seek.owner_name || "Vecino")}${seek.example ? " · ejemplo" : ""}</p>
        <a class="btn btn-wa" target="_blank" rel="noopener noreferrer" href="${esc(waLink(seek.whatsapp, seekWaText(seek)))}">Escribir por WhatsApp</a>
      </article>`).join("") : `<p class="empty">Todavía no hay búsquedas. Sé la primera.</p>`}
    </div>`;
}

export async function renderSeekNew(view, route, session) {
  const ready = !!(session?.profile.full_name && session?.profile.whatsapp);
  view.innerHTML = `
    <section class="page-head">
      <h1 tabindex="-1">Qué estás buscando</h1>
      <p class="lede">Dura 60 días. Después lo podés renovar desde tu cuenta.</p>
    </section>
    ${authBoxHtml()}
    ${!session ? demoLoginsHtml(DEMO_LOGIN) : ""}
    <form class="stack" data-testid="seek-form">
      ${ready ? "" : `<label class="field">Tu nombre<input name="full_name" required value="${esc(session?.profile.full_name || "")}" /></label>
        <label class="field">WhatsApp<input name="whatsapp" required inputmode="tel" placeholder="2615551234" value="${esc(session?.profile.whatsapp || "")}" /></label>`}
      <label class="field">Busco
        <select name="type">
          <option value="cualquiera">Cualquier cosa</option>
          ${[...HOUSING_TYPES, ...VENUE_TYPES].map((type) => `<option value="${type.id}">${type.label}</option>`).join("")}
        </select>
      </label>
      <label class="field">Distrito
        <select name="district">${districtOptions("", "Cualquier distrito de Lavalle")}</select>
      </label>
      <label class="field">Presupuesto por mes
        <input name="budget" inputmode="numeric" required placeholder="400000" />
      </label>
      <label class="field">Nota
        <textarea name="note" required maxlength="500" placeholder="Familia, mascota, desde cuándo…"></textarea>
      </label>
      <button class="btn btn-primary" type="submit">Publicar búsqueda</button>
    </form>`;
  bindAuth(view, () => render());
  view.querySelectorAll("[data-demo]").forEach((button) => {
    button.addEventListener("click", async () => {
      const { signInDemo } = await import("../api.js");
      await signInDemo(button.dataset.demo);
      render();
    });
  });
  view.querySelector("form").addEventListener("submit", async (event) => {
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
