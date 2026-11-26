export function esc(value) {
  return String(value ?? "").replace(/[&<>"']/g, (ch) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  }[ch]));
}

export function formatArs(amount) {
  const n = Number(amount);
  if (!Number.isFinite(n)) return "";
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    maximumFractionDigits: 0,
  }).format(n);
}

const UNIT = { mes: "mes", dia: "día", turno: "turno" };

export function clock(value) {
  const match = String(value ?? "").match(/(\d{1,2}):(\d{2})/);
  if (!match) return "";
  return `${match[1].padStart(2, "0")}:${match[2]}`;
}

export function hoursLabel(start, end) {
  const from = clock(start);
  const to = clock(end);
  if (!from || !to) return "";
  return `${from}–${to}`;
}

export function offerLine(offer) {
  return `${offer.name} · ${hoursLabel(offer.starts_at, offer.ends_at)} · ${formatArs(offer.price_ars)}`;
}

export function priceLabel(listing) {
  const venue = listing.type === "quincho" || listing.type === "salon";
  const offers = listing.offers || [];
  if (venue && offers.length > 1) return `desde ${formatArs(listing.price_ars)}`;
  if (venue && offers.length === 1) return `${formatArs(offers[0].price_ars)} · ${offers[0].name}`;
  if (venue) return formatArs(listing.price_ars);
  const unit = UNIT[listing.price_unit] || "mes";
  return `${formatArs(listing.price_ars)} / ${unit}`;
}

export function parseMoney(raw) {
  const digits = String(raw ?? "").replace(/\D/g, "");
  if (!digits) return null;
  return Number(digits);
}

export function normalizeWhatsapp(raw) {
  let digits = String(raw ?? "").replace(/\D/g, "");
  if (digits.startsWith("00")) digits = digits.slice(2);
  if (digits.startsWith("0")) digits = digits.slice(1);
  if (digits.length === 10) digits = `549${digits}`;
  return digits;
}

export function isWhatsapp(digits) {
  return /^[0-9]{10,15}$/.test(digits);
}

export function waLink(phone, text) {
  const n = String(phone || "").replace(/\D/g, "");
  return `https://wa.me/${n}?text=${encodeURIComponent(text)}`;
}

export function mapsEmbedUrl(lat, lng) {
  return `https://maps.google.com/maps?q=${Number(lat)},${Number(lng)}&z=16&output=embed`;
}

export function mapsDirectionsUrl(lat, lng) {
  return `https://www.google.com/maps/dir/?api=1&destination=${Number(lat)},${Number(lng)}`;
}

export function listingWaText(listing) {
  const who = listing.owner_name ? `, ${listing.owner_name}` : "";
  return `Hola${who}. Vi tu aviso en Lavalle Alquila: "${listing.title}" (${listing.district}). ¿Sigue disponible?`;
}

export function seekWaText(seek) {
  const who = seek.owner_name ? `, ${seek.owner_name}` : "";
  const where = seek.district ? ` en ${seek.district}` : "";
  const kind = seek.type === "cualquiera" ? "un alquiler" : `un ${labelType(seek.type).toLowerCase()}`;
  return `Hola${who}. Vi en Lavalle Alquila que buscás ${kind}${where}. Tengo algo que te puede servir.`;
}

export function confirmWaText({ ownerName, guestName, title, dateLabel, shiftLabel, guests }) {
  const who = guestName ? ` ${guestName}` : "";
  const me = ownerName ? `, soy ${ownerName}` : "";
  return `Hola${who}${me}. Te confirmo la reserva en ${title} para el ${dateLabel} (${shiftLabel}), ${guests} personas. Coordinemos el detalle por acá. — Lavalle Alquila`;
}

function labelType(type) {
  return (
    {
      casa: "Casa",
      departamento: "Departamento",
      local: "Local",
      terreno: "Terreno",
      quincho: "Quincho",
      salon: "Salón",
      cualquiera: "Cualquiera",
    }[type] || "Aviso"
  );
}

export function isoDay(date) {
  const d = date instanceof Date ? date : new Date(date);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function parseDay(iso) {
  const [y, m, d] = String(iso).split("-").map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
}

export function addDays(days, base = new Date()) {
  const d = new Date(base);
  d.setHours(12, 0, 0, 0);
  d.setDate(d.getDate() + days);
  return d;
}

export function plusDaysISO(days) {
  return addDays(days).toISOString();
}

export function formatDay(iso) {
  return new Intl.DateTimeFormat("es-AR", {
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(parseDay(iso));
}

export function daysUntil(iso) {
  const target = new Date(iso).getTime();
  return Math.ceil((target - Date.now()) / 86400000);
}

export function formatWhen(iso) {
  const days = daysUntil(iso);
  if (days < 0) return `Venció hace ${Math.abs(days)} día${Math.abs(days) === 1 ? "" : "s"}`;
  if (days === 0) return "Vence hoy";
  if (days === 1) return "Vence mañana";
  return `Vence en ${days} días`;
}

export function shiftLabel(shift) {
  return (
    {
      dia: "Día completo",
      mediodia: "Turno mediodía",
      noche: "Turno noche",
    }[shift] || shift
  );
}

export function typeLabel(type) {
  return labelType(type);
}

export function amenityLabel(id) {
  return (
    {
      pileta: "Pileta",
      parrilla: "Parrilla",
      cocina: "Cocina",
      banos: "Baños",
      estacionamiento: "Estacionamiento",
    }[id] || id
  );
}
