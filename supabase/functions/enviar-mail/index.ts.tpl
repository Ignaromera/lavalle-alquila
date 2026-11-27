// Edge Function «enviar-mail» de Lavalle Alquila.
// La llaman los triggers de la base (pg_net) con el header x-webhook-secret.
// Manda por Resend (API HTTP) los mails de bienvenida, «aviso publicado» y los 4 de suscripción
// (subscription_started, payment_failed, subscription_cancelled, subscription_ended),
// la denuncia al equipo, el botón de arrepentimiento (equipo + quien lo pide) y el código de regalo.
// Secrets necesarios: RESEND_API_KEY, WEBHOOK_SECRET.
// SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY ya los inyecta Supabase solo.
// Desplegar SIN verificación de JWT (la autenticación es el secreto compartido).
import { createClient } from "npm:@supabase/supabase-js@2";

const FROM = "Lavalle Alquila <no-responder@lavallealquila.com.ar>";
const SITE = "https://lavallealquila.com.ar";

const TEMPLATES: Record<string, { subject: string; html: string }> = {
  welcome: {
    subject: "Te damos la bienvenida a Lavalle Alquila",
    html: __HTML_WELCOME__,
  },
  listing_published: {
    subject: "Tu aviso ya está publicado",
    html: __HTML_PUBLISHED__,
  },
  subscription_started: {
    subject: "Tu plan {{PLAN}} está activo",
    html: __HTML_SUB_STARTED__,
  },
  payment_failed: {
    subject: "No pudimos cobrar tu suscripción",
    html: __HTML_SUB_FAILED__,
  },
  subscription_cancelled: {
    subject: "Cancelaste tu suscripción",
    html: __HTML_SUB_CANCELLED__,
  },
  subscription_ended: {
    subject: "Volviste al plan Gratis",
    html: __HTML_SUB_ENDED__,
  },
  report_received: {
    subject: "Nueva denuncia en Lavalle Alquila",
    html: __HTML_REPORT__,
  },
  regret_team: {
    subject: "Pedido de arrepentimiento {{CODIGO}}",
    html: __HTML_REGRET_TEAM__,
  },
  regret_requester: {
    subject: "Recibimos tu pedido de arrepentimiento ({{CODIGO}})",
    html: __HTML_REGRET_REQUESTER__,
  },
  promo_started: {
    subject: "Tenés Pro de regalo por {{DIAS}} días",
    html: __HTML_PROMO__,
  },
};

const TEAM = "jirfcarp@gmail.com";
const MAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

async function resend(apiKey: string, to: string, subject: string, html: string) {
  const r = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "content-type": "application/json" },
    body: JSON.stringify({ from: FROM, to: [to], subject, html }),
  });
  if (!r.ok) {
    console.error("Resend", r.status, await r.text());
    return { ok: false, status: r.status, id: null };
  }
  const sent = await r.json().catch(() => ({}));
  return { ok: true, status: r.status, id: sent?.id ?? null };
}

const SUB_KINDS = new Set(["subscription_started", "payment_failed", "subscription_cancelled", "subscription_ended"]);
const PLAN_NAMES: Record<string, string> = { free: "Gratis", plus: "Plus", pro: "Pro" };
const GRACE_DAYS = 3; // mismo número que supabase/migration-suscripciones.sql y src/plans.js

function ars(n: unknown): string {
  const v = Math.round(Number(n));
  return Number.isFinite(v) && v > 0 ? "$" + String(v).replace(/\B(?=(\d{3})+(?!\d))/g, ".") : "";
}

// «12 de diciembre de 2026» en hora de Argentina; vacío si la fecha no sirve.
function longDate(iso: unknown, minusDays = 0): string {
  const t = new Date(String(iso ?? "")).getTime();
  if (!Number.isFinite(t)) return "";
  return new Intl.DateTimeFormat("es-AR", { day: "numeric", month: "long", year: "numeric", timeZone: "America/Argentina/Mendoza" })
    .format(new Date(t - minusDays * 86400000));
}

function subscriptionVars(kind: string, p: Record<string, unknown>): Record<string, string> {
  const plan = PLAN_NAMES[String(p.plan ?? "")] ?? "";
  let frase = "";
  if (kind === "subscription_started") {
    const d = longDate(p.until, GRACE_DAYS);
    frase = d ? `La próxima renovación es el ${d}.` : "";
  } else if (kind === "payment_failed") {
    const d = longDate(p.until);
    frase = d ? `Mientras tanto, tu plan sigue activo hasta el ${d}.` : "";
  } else if (kind === "subscription_cancelled") {
    const d = longDate(p.until);
    frase = d ? `Tu plan sigue activo hasta el ${d}.` : "";
  }
  return {
    PLAN: plan,
    PERIODO: p.interval === "year" ? "por año" : "por mes",
    IMPORTE: ars(p.amount),
    FRASE: frase,
    LINK: kind === "subscription_ended" ? `${SITE}/#/planes` : `${SITE}/#/suscripcion`,
  };
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function firstName(full: unknown): string {
  const s = typeof full === "string" ? full.trim() : "";
  return s ? s.split(/\s+/)[0].slice(0, 40) : "";
}

// Si no hay nombre, el saludo queda «¡Hola!» en vez de «¡Hola, !».
function fill(html: string, vars: Record<string, string>, name: string): string {
  let out = html;
  if (!name) out = out.replace(", {{NOMBRE}}", "");
  for (const [k, v] of Object.entries(vars)) out = out.split(`{{${k}}}`).join(v);
  return out;
}

function same(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let r = 0;
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}


type ListingRow = { id?: string; owner_id?: string; title?: string; status?: string };

async function loadListing(sb: ReturnType<typeof createClient>, id: string): Promise<ListingRow | null> {
  for (const table of ["listings", "listings_public"] as const) {
    const { data, error } = await sb.from(table).select("id, owner_id, title, status").eq("id", id).maybeSingle();
    if (data) return data as ListingRow;
    if (error) console.error("lookup", table, error.message);
  }
  // Si el cliente de Supabase no puede leer la tabla, intentamos PostgREST a mano.
  const url = Deno.env.get("SUPABASE_URL") ?? "";
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  if (!url || !key) return null;
  for (const table of ["listings", "listings_public"]) {
    try {
      const r = await fetch(`${url}/rest/v1/${table}?id=eq.${id}&select=id,owner_id,title,status`, {
        headers: { apikey: key, Authorization: `Bearer ${key}`, accept: "application/json" },
      });
      if (!r.ok) {
        console.error("lookup fetch", table, r.status, await r.text());
        continue;
      }
      const rows = await r.json();
      if (Array.isArray(rows) && rows[0]) return rows[0] as ListingRow;
    } catch (err) {
      console.error("lookup fetch", table, err);
    }
  }
  return null;
}

Deno.serve(async (req) => {
  const secret = Deno.env.get("WEBHOOK_SECRET") ?? "";
  const got = req.headers.get("x-webhook-secret") ?? "";
  if (req.method !== "POST" || !secret || !same(got, secret)) return json({ error: "no autorizado" }, 401);

  let payload: { type?: string; user_id?: string; listing_id?: string; owner_id?: string; title?: string; plan?: string; interval?: string; amount?: number; until?: string; reason?: string; details?: string; link?: string; seek_id?: string; report_id?: string };
  try { payload = await req.json(); } catch { return json({ error: "json inválido" }, 400); }

  const apiKey = Deno.env.get("RESEND_API_KEY");
  if (!apiKey) return json({ error: "falta RESEND_API_KEY" }, 500);

  const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
    auth: { persistSession: false },
  });

  let userId = "";
  let title = "";
  let link = "";
  const kind = payload.type;

  if (kind === "welcome") {
    if (!payload.user_id || !UUID.test(payload.user_id)) return json({ error: "user_id inválido" }, 400);
    userId = payload.user_id;
  } else if (kind === "listing_published") {
    if (!payload.listing_id || !UUID.test(payload.listing_id)) return json({ error: "listing_id inválido" }, 400);
    // El trigger manda owner_id y title para no depender de un SELECT
    // (si el rol de la función no puede leer listings, el mail no salía).
    title = typeof payload.title === "string" ? payload.title : "";
    if (payload.owner_id && UUID.test(payload.owner_id)) userId = payload.owner_id;
    link = `${SITE}/#/aviso/${payload.listing_id}`;
    const listing = await loadListing(sb, payload.listing_id);
    if (listing) {
      if (listing.status && listing.status !== "active") return json({ skipped: "el aviso no está activo" });
      userId = listing.owner_id || userId;
      title = listing.title || title;
      link = `${SITE}/#/aviso/${listing.id || payload.listing_id}`;
    } else if (!userId) {
      return json({ error: "aviso no encontrado" }, 404);
    }
  } else if (kind && SUB_KINDS.has(kind)) {
    if (!payload.user_id || !UUID.test(payload.user_id)) return json({ error: "user_id inválido" }, 400);
    userId = payload.user_id;
  } else if (kind === "regret_requested") {
    const p = payload as Record<string, unknown>;
    const code = String(p.code ?? "").slice(0, 40);
    const contact = String(p.contact_email ?? "").trim();
    const account = String(p.account_email ?? "").trim();
    if (!/^ARR-\d{8}-\d{4,}$/.test(code) || !MAIL_RE.test(contact)) return json({ error: "pedido inválido" }, 400);
    const who = String(p.name ?? "").trim().slice(0, 120);
    const vars = {
      CODIGO: esc(code),
      NOMBRE_PEDIDO: esc(who || "sin nombre"),
      MAIL_CONTACTO: esc(contact),
      MAIL_CUENTA: esc(account || contact),
      MOTIVO: esc(String(p.reason ?? "").trim().slice(0, 1000) || "sin motivo"),
    };
    const team = TEMPLATES.regret_team;
    const mine = TEMPLATES.regret_requester;
    const name = firstName(who);
    const a = await resend(apiKey, TEAM, team.subject.split("{{CODIGO}}").join(code), fill(team.html, vars, ""));
    const b = await resend(apiKey, contact, mine.subject.split("{{CODIGO}}").join(code), fill(mine.html, { ...vars, NOMBRE: esc(name) }, name));
    console.log("enviado", kind, code, a.id ?? "sin id", b.id ?? "sin id");
    if (!a.ok || !b.ok) return json({ error: "Resend rechazó el envío", team: a.status, requester: b.status }, 502);
    return json({ ok: true, type: kind, ids: [a.id, b.id] });
  } else if (kind === "promo_started") {
    if (!payload.user_id || !UUID.test(payload.user_id)) return json({ error: "user_id inválido" }, 400);
    userId = payload.user_id;
  } else if (kind === "report_received") {
    const tpl = TEMPLATES.report_received;
    const motivo = String(payload.reason ?? "");
    const detalle = String(payload.details ?? "").trim();
    const titulo = String(payload.title ?? "una publicación");
    const href = String(payload.link ?? `${SITE}/#/admin`);
    const html = fill(tpl.html, {
      TITULO: esc(titulo || "una publicación"),
      MOTIVO: esc(motivo || "sin motivo"),
      DETALLE: detalle ? esc(detalle) : "Sin comentario.",
      LINK: href,
    }, "");
    const r = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "content-type": "application/json" },
      body: JSON.stringify({ from: FROM, to: ["jirfcarp@gmail.com"], subject: tpl.subject, html }),
    });
    if (!r.ok) {
      console.error("Resend", r.status, await r.text());
      return json({ error: "Resend rechazó el envío", status: r.status }, 502);
    }
    const sent = await r.json().catch(() => ({}));
    console.log("enviado", kind, "jirfcarp@gmail.com", sent?.id ?? "sin id");
    return json({ ok: true, type: kind, id: sent?.id ?? null });
  } else {
    return json({ error: "tipo desconocido" }, 400);
  }

  const { data: u, error: uerr } = await sb.auth.admin.getUserById(userId);
  const email = u?.user?.email;
  if (uerr || !email) return json({ error: "usuario sin mail" }, 404);

  const meta = (u.user.user_metadata ?? {}) as Record<string, unknown>;
  let name = firstName(meta.full_name ?? meta.name);
  const { data: p } = await sb.from("profiles").select("full_name").eq("id", userId).maybeSingle();
  if (p?.full_name) name = firstName(p.full_name);

  const tpl = TEMPLATES[kind!];
  const extra: Record<string, string> = SUB_KINDS.has(kind!) ? subscriptionVars(kind!, payload as Record<string, unknown>) : {};
  if (kind === "promo_started") {
    const days = Math.max(1, Math.round(Number((payload as Record<string, unknown>).days) || 15));
    extra.DIAS = String(days);
    extra.HASTA = longDate(payload.until) || `dentro de ${days} días`;
  }
  const html = fill(tpl.html, { NOMBRE: esc(name), TITULO_AVISO: esc(title), LINK_AVISO: link, ...extra }, name);
  const subject = tpl.subject.split("{{PLAN}}").join(extra.PLAN ?? "").split("{{DIAS}}").join(extra.DIAS ?? "");

  const r = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "content-type": "application/json" },
    body: JSON.stringify({ from: FROM, to: [email], subject, html }),
  });
  if (!r.ok) {
    console.error("Resend", r.status, await r.text());
    return json({ error: "Resend rechazó el envío", status: r.status }, 502);
  }
  // Guardamos el id de Resend: queda en net._http_response y en los logs,
  // así se puede rastrear si el mail se entregó, rebotó o fue a spam.
  const sent = await r.json().catch(() => ({}));
  console.log("enviado", kind, userId, sent?.id ?? "sin id");
  return json({ ok: true, type: kind, id: sent?.id ?? null });
});
