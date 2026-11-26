// Edge Function «enviar-mail» de Lavalle Alquila.
// La llaman los triggers de la base (pg_net) con el header x-webhook-secret.
// Manda por Resend (API HTTP) el mail de bienvenida y el de «aviso publicado».
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
};

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

Deno.serve(async (req) => {
  const secret = Deno.env.get("WEBHOOK_SECRET") ?? "";
  const got = req.headers.get("x-webhook-secret") ?? "";
  if (req.method !== "POST" || !secret || !same(got, secret)) return json({ error: "no autorizado" }, 401);

  let payload: { type?: string; user_id?: string; listing_id?: string };
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
    const { data: l, error } = await sb.from("listings").select("id, owner_id, title, status").eq("id", payload.listing_id).single();
    if (error || !l) return json({ error: "aviso no encontrado" }, 404);
    if (l.status !== "active") return json({ skipped: "el aviso no está activo" });
    userId = l.owner_id;
    title = l.title;
    link = `${SITE}/#/aviso/${l.id}`;
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
  const html = fill(tpl.html, { NOMBRE: esc(name), TITULO_AVISO: esc(title), LINK_AVISO: link }, name);

  const r = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "content-type": "application/json" },
    body: JSON.stringify({ from: FROM, to: [email], subject: tpl.subject, html }),
  });
  if (!r.ok) {
    console.error("Resend", r.status, await r.text());
    return json({ error: "Resend rechazó el envío", status: r.status }, 502);
  }
  return json({ ok: true, type: kind });
});
