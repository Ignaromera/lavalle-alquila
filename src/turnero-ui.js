import { esc, formatArs, formatDay, hoursLabel, isoDay } from "./format.js";

const state = { id: "", cursor: new Date(), selected: "", asking: "" };

export function calFor(listingId) {
  if (state.id !== listingId) {
    state.id = listingId;
    state.cursor = new Date();
    state.selected = "";
    state.asking = "";
  }
  return state;
}

function cells(year, month) {
  const first = new Date(year, month, 1);
  const lead = (first.getDay() + 6) % 7;
  const count = new Date(year, month + 1, 0).getDate();
  const out = Array(lead).fill(null);
  for (let day = 1; day <= count; day += 1) out.push(new Date(year, month, day));
  while (out.length % 7) out.push(null);
  return out;
}

function tone(daySlots) {
  if (!daySlots.length) return "";
  if (daySlots.some((slot) => slot.status === "open")) return "is-open";
  if (daySlots.some((slot) => slot.status === "held")) return "is-held";
  return "is-taken";
}

function statusText(status) {
  if (status === "open") return "Libre";
  if (status === "held") return "En consulta";
  if (status === "confirmed") return "Tomado";
  return "Sin ofrecer";
}

function slotSummary(offer) {
  return `${offer.name} · ${hoursLabel(offer.starts_at, offer.ends_at)} · ${formatArs(offer.price_ars)}`;
}

export function turneroHtml({ listing, slots, mode }) {
  const cal = calFor(listing.id);
  const year = cal.cursor.getFullYear();
  const month = cal.cursor.getMonth();
  const today = isoDay(new Date());
  const formatted = new Intl.DateTimeFormat("es-AR", { month: "long", year: "numeric" }).format(cal.cursor);
  const title = formatted.charAt(0).toUpperCase() + formatted.slice(1);
  const offers = listing.offers || [];
  const grid = cells(year, month).map((date) => {
    if (!date) return '<span class="cal-day is-empty"></span>';
    const iso = isoDay(date);
    const daySlots = slots.filter((slot) => slot.slot_date === iso);
    const classes = ["cal-day", tone(daySlots)];
    if (iso === cal.selected) classes.push("is-selected");
    if (iso === today) classes.push("is-today");
    return `<button type="button" class="${classes.filter(Boolean).join(" ")}" data-day="${iso}">${date.getDate()}</button>`;
  }).join("");

  const selectedSlots = slots.filter((slot) => slot.slot_date === cal.selected);
  let panel = "";
  if (cal.selected) {
    const past = cal.selected < today;
    const rows = offers.map((offer) => {
      const slot = selectedSlots.find((item) => item.offer_id === offer.id);
      const label = slotSummary(offer);
      if (mode === "owner") {
        if (!slot) {
          return `<div class="shift-row"><span><strong>${esc(offer.name)}</strong><small>${esc(hoursLabel(offer.starts_at, offer.ends_at))} · ${esc(formatArs(offer.price_ars))} · Sin ofrecer</small></span>${past ? "" : `<button type="button" class="btn btn-small" data-toggle="1" data-offer="${esc(offer.id)}">Ofrecer</button>`}</div>`;
        }
        const canClose = slot.status === "open" && !past;
        return `<div class="shift-row"><span><strong>${esc(offer.name)}</strong><small>${esc(hoursLabel(offer.starts_at, offer.ends_at))} · ${esc(formatArs(offer.price_ars))} · ${esc(statusText(slot.status))}</small></span>${canClose ? `<button type="button" class="btn btn-small btn-ghost" data-toggle="0" data-offer="${esc(offer.id)}">Cerrar</button>` : ""}</div>`;
      }
      if (!slot) return "";
      const ask = cal.asking === slot.id;
      return `<div class="shift-row">
        <span><strong>${esc(offer.name)}</strong><small>${esc(hoursLabel(offer.starts_at, offer.ends_at))} · ${esc(formatArs(offer.price_ars))} · ${esc(statusText(slot.status))}</small></span>
        ${slot.status === "open" ? `<button type="button" class="btn btn-small" data-ask="${esc(slot.id)}">Pedir este turno</button>` : ""}
      </div>
      ${ask ? bookingForm(slot.id, listing.capacity) : ""}`;
    }).join("");
    panel = `<div class="day-panel" data-testid="day-panel">
      <h3>${esc(formatDay(cal.selected))}</h3>
      ${rows || "<p class='muted'>Ese día no está ofrecido.</p>"}
    </div>`;
  }

  return `<section class="turnero" data-testid="turnero" data-listing="${esc(listing.id)}">
    <header class="turnero-head">
      <div>
        <h2>${mode === "owner" ? "Administrar turnero" : "Reservar un turno"}</h2>
        <p>Cada horario tiene su precio. Capacidad: ${esc(listing.capacity)} personas.</p>
      </div>
    </header>
    <ul class="offer-menu">
      ${offers.map((offer) => `<li>${esc(slotSummary(offer))}</li>`).join("")}
    </ul>
    <div class="cal-head">
      <button type="button" class="btn btn-small btn-ghost" data-cal="prev" aria-label="Mes anterior">←</button>
      <strong>${esc(title)}</strong>
      <button type="button" class="btn btn-small btn-ghost" data-cal="next" aria-label="Mes siguiente">→</button>
    </div>
    <div class="cal" role="grid" aria-label="Calendario de turnos">
      ${["lun", "mar", "mié", "jue", "vie", "sáb", "dom"].map((day) => `<span class="cal-dow">${day}</span>`).join("")}
      ${grid}
    </div>
    <ul class="legend">
      <li><i class="dot is-open"></i> Libre</li>
      <li><i class="dot is-held"></i> En consulta</li>
      <li><i class="dot is-taken"></i> Tomado</li>
    </ul>
    ${panel}
  </section>`;
}

function bookingForm(slotId, capacity) {
  return `<form class="book-form" data-book="${esc(slotId)}">
    <label class="field">Tu nombre<input name="name" required maxlength="80" autocomplete="name" /></label>
    <label class="field">WhatsApp<input name="whatsapp" required inputmode="tel" placeholder="2615551234" autocomplete="tel" /></label>
    <label class="field">Cuántas personas<input name="guests" type="number" min="1" max="${esc(capacity)}" required inputmode="numeric" /></label>
    <label class="field">Nota<input name="note" maxlength="400" placeholder="Cumpleaños, hora de llegada…" /></label>
    <button class="btn btn-primary" type="submit">Enviar pedido de reserva</button>
    <p class="fine">El dueño confirma o rechaza el pedido. El día queda tomado recién cuando lo confirma.</p>
  </form>`;
}

export function bindTurnero(root, handlers) {
  root.querySelectorAll("[data-cal]").forEach((button) => {
    button.addEventListener("click", () => handlers.move(button.dataset.cal));
  });
  root.querySelectorAll("[data-day]").forEach((button) => {
    button.addEventListener("click", () => handlers.pick(button.dataset.day));
  });
  root.querySelectorAll("[data-toggle]").forEach((button) => {
    button.addEventListener("click", () => handlers.toggle(button.dataset.offer, button.dataset.toggle === "1"));
  });
  root.querySelectorAll("[data-ask]").forEach((button) => {
    button.addEventListener("click", () => handlers.ask(button.dataset.ask));
  });
  root.querySelectorAll("[data-book]").forEach((form) => {
    form.addEventListener("submit", (event) => {
      event.preventDefault();
      const data = new FormData(form);
      handlers.request({
        slotId: form.dataset.book,
        name: data.get("name"),
        whatsapp: data.get("whatsapp"),
        guests: data.get("guests"),
        note: data.get("note"),
      });
    });
  });
}
