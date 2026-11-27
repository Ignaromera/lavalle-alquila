/**
 * Botón de arrepentimiento: validación del formulario (la misma que hace la base).
 * Ley 24.240 art. 34 y Res. SCI 424/2020: 10 días corridos, sin cuenta, código de trámite.
 */
export const REGRET_DAYS = 10;
const MAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

export function isEmail(value) {
  const v = String(value || "").trim();
  return v.length <= 200 && MAIL.test(v);
}

/** Limpia y valida lo que carga la persona. Tira un Error con un texto para mostrar. */
export function normalizeRegret(fields = {}) {
  const name = String(fields.name || "").trim();
  const email = String(fields.email || "").trim().toLowerCase();
  const account = String(fields.account || "").trim().toLowerCase() || email;
  const reason = String(fields.reason || "").trim().slice(0, 1000);
  if (name.length < 2) throw new Error("Escribí tu nombre.");
  if (name.length > 120) throw new Error("El nombre es muy largo.");
  if (!isEmail(email)) throw new Error("Revisá tu mail: lo necesitamos para mandarte el código de trámite.");
  if (!isEmail(account)) throw new Error("Revisá el mail de la cuenta.");
  return { name, email, account, reason };
}

/** Código de trámite con el mismo formato que la base: ARR-AAAAMMDD-0001 (fecha de Mendoza). */
export function regretCode(seq, date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Argentina/Mendoza", year: "numeric", month: "2-digit", day: "2-digit" })
    .format(date).replaceAll("-", "");
  return `ARR-${parts}-${String(seq).padStart(4, "0")}`;
}
