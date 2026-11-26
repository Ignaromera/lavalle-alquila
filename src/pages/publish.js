import {
  createListing,
  ensureDemoProfile,
  getListing,
  isDemo,
  myListings,
  updateListing,
} from "../api.js";
import { render } from "../bus.js";
import { districtOptions, upsellHtml } from "../cards.js";
import { authBoxHtml, bindAuth, demoLoginsHtml } from "./auth-ui.js";
import { DEMO_LOGIN } from "../api.js";
import { esc, parseMoney } from "../format.js";
import { AMENITIES, HOUSING_TYPES, VENUE_TYPES, isVenue, pointInLavalle } from "../geo.js";
import { mountMap } from "../map.js";
import { photoUrl } from "../api.js";
import { toast } from "../toast.js";

export async function renderPublish(view, route, session) {
  const editingId = route.parts[1] || "";
  let existing = null;
  if (editingId) {
    existing = await getListing(editingId);
    if (!session || !existing || existing.owner_id !== session.user.id) {
      view.innerHTML = `<section class="page-head"><h1 tabindex="-1">No podés editar este aviso</h1><p><a class="btn btn-primary" href="#/cuenta">Entrá con tu cuenta</a></p></section>`;
      return;
    }
  }
  const mine = session ? await myListings() : [];
  const used = mine.filter((item) => (item.status === "active" || item.status === "hidden") && new Date(item.expires_at) > new Date() && item.id !== editingId).length;
  const max = session?.profile.max_listings ?? 1;
  const plan = session?.profile.plan === "pro" ? "pro" : "gratis";
  const kind = existing && isVenue(existing.type) ? "venue" : "housing";
  const profileReady = !!(session?.profile.full_name && session?.profile.whatsapp);
  view.innerHTML = `
    <section class="page-head">
      <h1 tabindex="-1">${editingId ? "Editar aviso" : "Publicá tu aviso"}</h1>
      <p class="lede">En el teléfono, en un par de minutos. Sale publicado al toque: no hay aprobación previa.</p>
    </section>
    <p class="plan-note">Plan <strong>${plan}</strong> · hasta ${max} aviso${max === 1 ? "" : "s"} activo${max === 1 ? "" : "s"}. Más adelante vas a poder ampliarlo.</p>
    ${session && used >= max && !editingId ? `<p class="error">Ya tenés ${used} aviso${used === 1 ? "" : "s"} activo${used === 1 ? "" : "s"}. Marcá uno como alquilado o eliminalo para publicar otro. La base también lo frena.</p>` : ""}
    ${authBoxHtml()}
    ${!session ? demoLoginsHtml(DEMO_LOGIN) : ""}
    <form class="stack" data-testid="publish-form" novalidate>
      ${profileReady ? `<p class="note">Publicás como <strong>${esc(session.profile.full_name)}</strong> · ${esc(session.profile.whatsapp)}</p>` : `
        <label class="field">Tu nombre
          <input name="full_name" required maxlength="80" autocomplete="name" value="${esc(session?.profile.full_name || "")}" placeholder="Cómo te ven los vecinos" />
        </label>
        <label class="field">WhatsApp
          <input name="whatsapp" required inputmode="tel" autocomplete="tel" placeholder="2615551234" value="${esc(session?.profile.whatsapp || "")}" />
        </label>
        <p class="fine">Lo usamos para el botón de consulta. Podés escribirlo con o sin el 54.</p>`}
      <div class="segment" role="tablist">
        <button type="button" class="seg${kind === "housing" ? " is-on" : ""}" data-kind="housing">Para vivir o trabajar</button>
        <button type="button" class="seg${kind === "venue" ? " is-on" : ""}" data-kind="venue">Quincho o salón</button>
      </div>
      <label class="field">Tipo
        <select name="type" data-type></select>
      </label>
      <label class="field">Título
        <input name="title" maxlength="80" required placeholder="Casa con patio cerca de la plaza" value="${esc(existing?.title || "")}" />
      </label>
      <label class="field">Descripción
        <textarea name="description" maxlength="2000" required placeholder="Contá cómo es, qué tiene y cuándo se puede ver.">${esc(existing?.description || "")}</textarea>
      </label>
      <div class="split">
        <label class="field">Precio en pesos
          <input name="price" inputmode="numeric" required placeholder="450000" value="${existing ? esc(existing.price_ars) : ""}" />
        </label>
        <label class="field" data-unit ${kind === "housing" ? "hidden" : ""}>Se cobra
          <select name="price_unit">
            <option value="turno"${existing?.price_unit === "turno" ? " selected" : ""}>Por turno</option>
            <option value="dia"${existing?.price_unit === "dia" ? " selected" : ""}>Por día</option>
          </select>
        </label>
      </div>
      <p class="fine" data-month ${kind === "venue" ? "hidden" : ""}>El precio de casas, departamentos, locales y terrenos es por mes.</p>
      <label class="field">Distrito
        <select name="district">${districtOptions(existing?.district || "", "Elegí un distrito")}</select>
      </label>
      <label class="field">Requisitos
        <textarea name="requirements" maxlength="500" placeholder="Garantía, depósito, contrato…">${esc(existing?.requirements || "")}</textarea>
      </label>
      <div data-housing ${kind === "venue" ? "hidden" : ""}>
        <label class="checkline"><input type="checkbox" name="pets" ${existing?.pets_allowed ? "checked" : ""} /> Acepta mascotas</label>
        <label class="checkline"><input type="checkbox" name="guarantee" ${existing ? (existing.guarantee_required ? "checked" : "") : "checked"} /> Pide garantía</label>
      </div>
      <div data-venue ${kind === "housing" ? "hidden" : ""}>
        <label class="field">Capacidad
          <input name="capacity" inputmode="numeric" placeholder="40" value="${existing?.capacity ? esc(existing.capacity) : ""}" />
        </label>
        <fieldset class="checks">
          <legend>Comodidades</legend>
          ${AMENITIES.map((item) => `<label class="checkline"><input type="checkbox" name="amenities" value="${item.id}" ${(existing?.amenities || []).includes(item.id) ? "checked" : ""} /> ${item.label}</label>`).join("")}
        </fieldset>
        <div data-upsell></div>
      </div>
      <label class="field">Fotos <span class="fine">hasta 6, se achican en tu teléfono</span>
        <input name="photos" type="file" accept="image/*" multiple />
      </label>
      <div class="thumbs" data-thumbs></div>
      <div class="field">
        <span>Ubicación en el mapa</span>
        <p class="fine">Tocá donde está la propiedad. Tiene que caer dentro de Lavalle.</p>
        <div class="map-canvas map-short" data-map data-testid="publish-map"></div>
        <p class="fine" data-pin>${existing ? "Ubicación marcada dentro de Lavalle." : "Todavía no marcaste el punto."}</p>
      </div>
      <p class="error" data-form-error hidden></p>
      <button class="btn btn-primary btn-block" type="submit">${editingId ? "Guardar cambios" : "Publicar aviso"}</button>
    </form>`;

  const form = view.querySelector("form");
  const typeSelect = form.querySelector("[data-type]");
  const upsell = form.querySelector("[data-upsell]");
  let currentKind = kind;
  let picked = existing ? { lat: Number(existing.lat), lng: Number(existing.lng) } : null;
  let kept = [...(existing?.photo_urls || [])];
  const files = [];

  const willTurnero = !!(session?.profile.booking_enabled || session?.profile.plan === "pro");
  const paintUpsell = () => {
    upsell.innerHTML = currentKind === "venue" && !willTurnero ? upsellHtml() : "";
  };
  const paintTypes = () => {
    const types = currentKind === "venue" ? VENUE_TYPES : HOUSING_TYPES;
    const current = existing?.type;
    typeSelect.innerHTML = types.map((type) => `<option value="${type.id}"${type.id === current ? " selected" : ""}>${type.label}</option>`).join("");
    if (![...typeSelect.options].some((option) => option.selected)) typeSelect.selectedIndex = 0;
  };
  const paintKind = () => {
    form.querySelector("[data-housing]").hidden = currentKind === "venue";
    form.querySelector("[data-venue]").hidden = currentKind === "housing";
    form.querySelector("[data-unit]").hidden = currentKind === "housing";
    form.querySelector("[data-month]").hidden = currentKind === "venue";
    view.querySelectorAll("[data-kind]").forEach((button) => {
      button.classList.toggle("is-on", button.dataset.kind === currentKind);
    });
    paintTypes();
    paintUpsell();
  };
  paintKind();

  const paintThumbs = () => {
    const box = form.querySelector("[data-thumbs]");
    const previews = [
      ...kept.map((src, index) => `<button type="button" class="thumb" data-drop-kept="${index}"><img src="${esc(photoUrl(src))}" alt="" /><span>Quitar</span></button>`),
      ...files.map((file, index) => `<button type="button" class="thumb" data-drop-file="${index}"><img src="${esc(URL.createObjectURL(file))}" alt="" /><span>Quitar</span></button>`),
    ];
    box.innerHTML = previews.join("");
    box.querySelectorAll("[data-drop-kept]").forEach((button) => {
      button.addEventListener("click", () => {
        kept.splice(Number(button.dataset.dropKept), 1);
        paintThumbs();
      });
    });
    box.querySelectorAll("[data-drop-file]").forEach((button) => {
      button.addEventListener("click", () => {
        files.splice(Number(button.dataset.dropFile), 1);
        paintThumbs();
      });
    });
  };
  paintThumbs();

  form.querySelector("[name=photos]").addEventListener("change", (event) => {
    const pickedFiles = [...event.target.files];
    for (const file of pickedFiles) {
      if (kept.length + files.length >= 6) {
        toast("Máximo 6 fotos.");
        break;
      }
      files.push(file);
    }
    event.target.value = "";
    paintThumbs();
  });

  view.querySelectorAll("[data-kind]").forEach((button) => {
    button.addEventListener("click", () => {
      currentKind = button.dataset.kind;
      existing = existing ? { ...existing, type: "" } : existing;
      paintKind();
    });
  });

  const pinText = form.querySelector("[data-pin]");
  mountMap(form.querySelector("[data-map]"), {
    polygon: true,
    pin: picked,
    pinType: currentKind === "venue" ? "quincho" : "casa",
    onPick(lat, lng) {
      if (!pointInLavalle(lat, lng)) {
        pinText.textContent = "Esa ubicación queda fuera de Lavalle.";
        toast("Esa ubicación queda fuera de Lavalle. Tocá dentro del departamento.");
        return false;
      }
      picked = { lat, lng };
      pinText.textContent = "Ubicación marcada dentro de Lavalle.";
      return true;
    },
  });

  const showError = (message) => {
    const box = form.querySelector("[data-form-error]");
    box.hidden = !message;
    box.textContent = message || "";
  };

  bindAuth(view, () => render());
  view.querySelectorAll("[data-demo]").forEach((button) => {
    button.addEventListener("click", async () => {
      const { signInDemo } = await import("../api.js");
      await signInDemo(button.dataset.demo);
      toast("Entraste con la cuenta de ejemplo.");
      render();
    });
  });

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    showError("");
    const data = new FormData(form);
    const submit = form.querySelector("[type=submit]");
    submit.disabled = true;
    try {
      if (!session) {
        if (!isDemo()) throw new Error("Entrá con tu email para publicar");
        await ensureDemoProfile({
          full_name: data.get("full_name"),
          whatsapp: data.get("whatsapp"),
        });
      } else if (!profileReady) {
        const { saveProfile } = await import("../api.js");
        await saveProfile({ full_name: data.get("full_name"), whatsapp: data.get("whatsapp") });
      }
      const type = String(data.get("type") || "");
      const venue = isVenue(type);
      const fields = {
        type,
        title: String(data.get("title") || ""),
        description: String(data.get("description") || ""),
        price_ars: parseMoney(data.get("price")),
        price_unit: venue ? String(data.get("price_unit") || "turno") : "mes",
        district: String(data.get("district") || ""),
        requirements: String(data.get("requirements") || ""),
        pets_allowed: !venue && data.get("pets") === "on",
        guarantee_required: !venue && data.get("guarantee") === "on",
        capacity: venue ? Number(String(data.get("capacity") || "").replace(/\D/g, "")) : null,
        amenities: venue ? data.getAll("amenities").map(String) : [],
        lat: picked?.lat,
        lng: picked?.lng,
      };
      if (!kept.length && !files.length) throw new Error("Subí al menos una foto");
      let saved;
      if (editingId) saved = await updateListing(editingId, fields, files, kept);
      else saved = await createListing(fields, files);
      toast(isDemo() ? "Listo. En el modo ejemplo queda solo en este navegador." : "Listo, tu aviso ya está publicado.");
      location.hash = `#/aviso/${saved.id}`;
    } catch (error) {
      showError(error.message);
      toast(error.message);
      submit.disabled = false;
    }
  });
}
