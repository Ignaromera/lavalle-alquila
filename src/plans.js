/**
 * Planes de Lavalle Alquila: precios, límites y cuentas simples.
 *
 * Los precios son los mismos que carga supabase/migration-suscripciones.sql
 * en la tabla `plans` (un test los compara). La Edge Function `crear-suscripcion`
 * lee el monto de esa tabla, nunca del navegador.
 *
 * Una cuenta "ilimitada" guarda UNLIMITED en profiles.max_listings.
 */
export const UNLIMITED = 1000;
export const PLAN_ORDER = ["free", "plus", "pro"];
export const INTERVALS = ["month", "year"];

export const PLANS = {
  free: {
    id: "free",
    name: "Gratis",
    tagline: "Para empezar",
    maxListings: 1,
    featuredSlots: 0,
    stats: false,
    turnero: false,
    monthly: 0,
    yearly: 0,
  },
  plus: {
    id: "plus",
    name: "Plus",
    tagline: "Para tener varios avisos",
    maxListings: 3,
    featuredSlots: 0,
    stats: true,
    turnero: false,
    monthly: 6900,
    yearly: 0, // sin plan anual: solo el Pro lo tiene (decisión de Ignacio)
  },
  pro: {
    id: "pro",
    name: "Pro",
    tagline: "Para vivir de alquilar",
    maxListings: UNLIMITED,
    featuredSlots: 2,
    stats: true,
    turnero: true,
    monthly: 14900,
    yearly: 100000,
  },
};

export function planId(value) {
  const id = String(value || "").toLowerCase();
  return PLANS[id] ? id : "free";
}

export function planOf(profile) {
  return PLANS[planId(profile?.plan)];
}

export function isUnlimited(max) {
  return Number(max) >= UNLIMITED;
}

/** «1 aviso activo», «3 avisos activos», «avisos ilimitados». */
export function limitLabel(max) {
  if (isUnlimited(max)) return "avisos ilimitados";
  const n = Number(max) || 1;
  return `${n} aviso${n === 1 ? "" : "s"} activo${n === 1 ? "" : "s"}`;
}

/** Cuántos avisos cuentan para el tope: activos u ocultos que todavía no vencieron. */
export function activeCount(listings, { now = new Date(), exceptId = "" } = {}) {
  return (listings || []).filter((item) => (
    (item.status === "active" || item.status === "hidden")
    && new Date(item.expires_at) > now
    && item.id !== exceptId
  )).length;
}

export function canPublishMore(used, max) {
  return isUnlimited(max) || Number(used) < Number(max);
}

/** «Usás 1 de 3 avisos» o «Usás 4 avisos (sin tope)». */
export function usageLabel(used, max) {
  const n = Number(used) || 0;
  if (isUnlimited(max)) return `Tenés ${n} aviso${n === 1 ? "" : "s"} activo${n === 1 ? "" : "s"}, sin tope`;
  return `Usás ${n} de ${Number(max)} aviso${Number(max) === 1 ? "" : "s"} activo${Number(max) === 1 ? "" : "s"}`;
}

/** Cantidad de destacados que puede tener según la cuenta (el tope real viene del plan). */
export function featuredSlots(profile) {
  return planOf(profile).featuredSlots;
}

export function featuredCount(listings, { now = new Date() } = {}) {
  return (listings || []).filter((item) => item.featured && item.status === "active" && new Date(item.expires_at) > now).length;
}

export function canFeature(profile, listings, listing, { now = new Date() } = {}) {
  const slots = featuredSlots(profile);
  if (!slots) return { ok: false, reason: "plan" };
  if (!listing || listing.status !== "active" || new Date(listing.expires_at) <= now) return { ok: false, reason: "inactive" };
  if (listing.featured) return { ok: true, reason: "already" };
  if (featuredCount(listings, { now }) >= slots) return { ok: false, reason: "full" };
  return { ok: true, reason: "free" };
}

/** ¿Este plan se puede pagar por año? Solo si tiene precio anual. */
export function hasYearly(plan) {
  return PLANS[planId(plan)].yearly > 0;
}

/** El período que realmente se cobra: lo anual solo existe donde hay precio anual. */
export function intervalFor(plan, interval) {
  return interval === "year" && hasYearly(plan) ? "year" : "month";
}

export function priceFor(plan, interval) {
  const p = PLANS[planId(plan)];
  return intervalFor(plan, interval) === "year" ? p.yearly : p.monthly;
}

/** Ahorro de pagar un año de una vez frente a doce meses sueltos. */
export function yearlySavings(plan) {
  const p = PLANS[planId(plan)];
  const full = p.monthly * 12;
  if (!full || !p.yearly) return { full, yearly: p.yearly, saved: 0, pct: 0, perMonth: 0 };
  const saved = Math.max(0, full - p.yearly);
  return { full, yearly: p.yearly, saved, pct: Math.round((saved / full) * 100), perMonth: Math.round(p.yearly / 12) };
}

export function formatArs(value) {
  const n = Math.round(Number(value) || 0);
  return `$${String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ".")}`;
}

/** Texto de precio de una tarjeta: «$14.900 por mes», «$100.000 por año», «Gratis». */
export function priceLine(plan, interval) {
  const amount = priceFor(plan, interval);
  if (!amount) return "Gratis";
  return `${formatArs(amount)} por ${intervalFor(plan, interval) === "year" ? "año" : "mes"}`;
}

const DAY = 86400000;

/**
 * Estado de la suscripción para «Mi suscripción».
 *  none       nunca pagó (o no hay datos)
 *  active     paga al día
 *  cancelling canceló, pero el plan sigue hasta access_until
 *  past_due   falló un pago; sigue el plan hasta access_until mientras reintenta
 *  ended      terminó
 */
export function subscriptionState(sub, now = new Date()) {
  if (!sub) return { state: "none", daysLeft: 0 };
  const until = sub.access_until ? new Date(sub.access_until) : null;
  const daysLeft = until ? Math.max(0, Math.ceil((until - now) / DAY)) : 0;
  const alive = until ? until > now : false;
  if (sub.status === "pending") return { state: "pending", daysLeft: 0 };
  if (sub.status === "authorized") {
    if (sub.payment_failed_at && (!sub.last_paid_at || new Date(sub.payment_failed_at) > new Date(sub.last_paid_at))) {
      return { state: "past_due", daysLeft };
    }
    return { state: "active", daysLeft };
  }
  if ((sub.status === "cancelled" || sub.status === "paused") && alive) {
    return { state: sub.status === "paused" ? "past_due" : "cancelling", daysLeft };
  }
  return { state: "ended", daysLeft: 0 };
}

/** Fecha de acceso: próximo cobro más 3 días de gracia (mismo número que en el SQL). */
export const GRACE_DAYS = 3;
export function accessUntil(nextPaymentDate, graceDays = GRACE_DAYS) {
  const t = new Date(nextPaymentDate).getTime();
  if (!Number.isFinite(t)) return null;
  return new Date(t + graceDays * DAY).toISOString();
}

/**
 * Cuenta qué pasa con los avisos al bajar de plan: se quedan activos los más
 * nuevos hasta el tope y los demás vencen. Devuelve los ids que vencen.
 */
export function listingsToExpire(listings, newMax, { now = new Date() } = {}) {
  if (isUnlimited(newMax)) return [];
  const live = (listings || [])
    .filter((item) => (item.status === "active" || item.status === "hidden") && new Date(item.expires_at) > now)
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  return live.slice(Number(newMax)).map((item) => item.id);
}

export function listingsToUnfeature(listings, newSlots) {
  const featured = (listings || []).filter((item) => item.featured).sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  return featured.slice(Number(newSlots) || 0).map((item) => item.id);
}

/**
 * De todas las filas de suscripción de una persona, la que hay que mostrar:
 * primero una con acceso vigente, después un pago en curso reciente (menos de 2 días).
 */
export function pickSubscription(rows, now = new Date()) {
  const list = (rows || []).filter((row) => row && row.status !== "expired");
  const byNewest = (a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0);
  const live = list
    .filter((row) => ["authorized", "paused", "cancelled"].includes(row.status) && row.access_until && new Date(row.access_until) > now)
    .sort(byNewest);
  if (live.length) return live[0];
  const pending = list
    .filter((row) => row.status === "pending" && now - new Date(row.created_at || 0) < 2 * DAY)
    .sort(byNewest);
  return pending[0] || null;
}

/** «12 de diciembre de 2026», en hora de Argentina. */
export function longDate(value) {
  const t = new Date(value).getTime();
  if (!Number.isFinite(t)) return "";
  return new Intl.DateTimeFormat("es-AR", { day: "numeric", month: "long", year: "numeric", timeZone: "America/Argentina/Mendoza" }).format(new Date(t));
}

/** Próxima renovación = acceso menos los días de gracia. */
export function renewalDate(sub) {
  if (!sub?.access_until) return "";
  return longDate(new Date(sub.access_until).getTime() - GRACE_DAYS * DAY);
}

/** Lista de beneficios para la pantalla de planes. */
export function planFeatures(id) {
  const p = PLANS[planId(id)];
  const list = [limitLabelCap(p.maxListings)];
  if (p.id === "free") list.push("Contacto directo por WhatsApp");
  if (p.stats) list.push("Estadísticas: visitas, compartidos y WhatsApp");
  if (p.turnero) list.push("Turnero para quinchos y salones");
  if (p.featuredSlots) list.push(`${p.featuredSlots} avisos destacados: salen primero en las listas`);
  return list;
}

function limitLabelCap(max) {
  const text = limitLabel(max);
  return text.charAt(0).toUpperCase() + text.slice(1).replace(/^(\d+)/, "$1");
}

/** Nota de plan para Publicar y Mi cuenta (HTML ya escapado: solo usa datos propios). */
export function planNote(profile, used) {
  const p = planOf(profile);
  const max = profile?.max_listings ?? p.maxListings;
  const n = Number(used) || 0;
  if (p.id === "pro" || isUnlimited(max)) {
    return { plan: p, text: `avisos ilimitados${p.id === "pro" ? ", turnero y destacados" : ""}.`, cta: "" };
  }
  const usage = used == null ? limitLabel(max) : `usás ${n} de ${Number(max)} aviso${Number(max) === 1 ? "" : "s"} activo${Number(max) === 1 ? "" : "s"}`;
  return { plan: p, text: `${usage}.`, cta: p.id === "free" ? "Con Plus o Pro publicás más." : "Con Pro publicás todos los que quieras." };
}
