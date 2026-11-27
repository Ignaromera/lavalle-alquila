/**
 * Código de regalo de Pro (LAVALLE5). La regla de verdad vive en la base
 * (supabase/migration-promo-pro.sql, función canjear_codigo); esto es lo que usa la pantalla.
 */
const DAY = 86400000;

/** «lavalle 5» → «LAVALLE5». Igual que la base: solo letras y números, en mayúsculas. */
export function normalizeCode(value) {
  return String(value || "").replace(/[^A-Za-z0-9]/g, "").toUpperCase();
}

/** Estado de un canje para «Mi suscripción»: vigente con días que quedan, o terminado. */
export function promoStatus(grant, now = new Date()) {
  if (!grant?.ends_at) return { active: false, daysLeft: 0 };
  const end = new Date(grant.ends_at);
  if (grant.ended_at || !(end > now)) return { active: false, daysLeft: 0 };
  return { active: true, daysLeft: Math.max(1, Math.ceil((end - now) / DAY)) };
}

/** ¿Mostramos la cajita «¿Tenés un código?»? Solo en plan Gratis y si nunca canjeó uno. */
export function canShowCodeBox(profile, grant) {
  return String(profile?.plan || "free") === "free" && !grant;
}

/**
 * Misma regla que canjear_codigo, para el modo ejemplo y los tests: toma un uso solo si queda
 * cupo y la cuenta no canjeó antes. Devuelve el canje o tira un Error con el mismo texto que la base.
 */
export function redeemInMemory({ codes, grants, profile, email, code, now = new Date(), paidBefore = false }) {
  const wanted = normalizeCode(code);
  if (!profile) throw new Error("Entrá a tu cuenta para cargar el código.");
  if (!wanted) throw new Error("Escribí el código.");
  const mail = String(email || "").toLowerCase();
  if (grants.some((g) => g.user_id === profile.id || String(g.email).toLowerCase() === mail)) {
    throw new Error("Ya usaste un código de regalo con esta cuenta.");
  }
  if (String(profile.plan || "free") !== "free" || paidBefore) throw new Error("El código es para cuentas nuevas en el plan Gratis.");
  const c = codes[wanted];
  if (!c || !c.enabled || (c.expires_at && new Date(c.expires_at) <= now)) throw new Error("Ese código no existe o ya no está vigente.");
  if (c.used >= c.max_uses) throw new Error("Ese código ya se usó todas las veces que se podía.");
  c.used += 1;
  const grant = {
    user_id: profile.id, email: mail, code: wanted, plan_id: c.plan_id || "pro", days: c.days,
    granted_at: now.toISOString(), ends_at: new Date(now.getTime() + c.days * DAY).toISOString(), ended_at: null,
  };
  grants.push(grant);
  return grant;
}
