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
    html: "<!DOCTYPE html>\n<html lang=\"es\"><head><meta charset=\"utf-8\"><meta name=\"viewport\" content=\"width=device-width,initial-scale=1\">\n<meta name=\"color-scheme\" content=\"light only\"><title>¡Te damos la bienvenida!</title></head>\n<body style=\"margin:0;padding:0;background:#FEE8D0;\">\n<div style=\"display:none;max-height:0;overflow:hidden;opacity:0;color:#FEE8D0;font-size:1px;line-height:1px;\">Así se alquila en Lavalle: directo con el dueño.&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;</div>\n<table role=\"presentation\" width=\"100%\" cellpadding=\"0\" cellspacing=\"0\" border=\"0\" style=\"background:#FEE8D0;\"><tr><td align=\"center\" style=\"padding:24px 12px;\">\n<table role=\"presentation\" width=\"600\" cellpadding=\"0\" cellspacing=\"0\" border=\"0\" style=\"width:100%;max-width:600px;background:#FFF8F0;border:1px solid #EBD4B8;border-radius:20px;\">\n<tr><td style=\"padding:28px 32px 8px 32px;\" align=\"left\"><a href=\"https://lavallealquila.com.ar\" style=\"text-decoration:none;\"><img src=\"https://lavallealquila.com.ar/brand/lavalle-alquila-horizontal.png\" width=\"150\" height=\"50\" alt=\"Lavalle Alquila\" style=\"display:block;border:0;width:150px;height:auto;\"></a></td></tr>\n<tr><td style=\"padding:16px 32px 0 32px;\">\n  <table role=\"presentation\" width=\"100%\" cellpadding=\"0\" cellspacing=\"0\" border=\"0\" style=\"background:#FEE8D0;border-radius:16px;\"><tr><td style=\"padding:28px 24px;\" align=\"center\">\n    <img src=\"https://lavallealquila.com.ar/brand/lavalle-alquila-marca-512.png\" width=\"96\" alt=\"\" style=\"display:block;border:0;width:96px;height:auto;margin:0 auto 16px auto;\">\n    <table role=\"presentation\" cellpadding=\"0\" cellspacing=\"0\" border=\"0\" style=\"margin:0 auto 14px auto;\"><tr><td width=\"22\" height=\"5\" style=\"background:#FC6F20;font-size:0;line-height:0;\">&nbsp;</td><td width=\"4\"></td><td width=\"22\" height=\"5\" style=\"background:#D9A51E;font-size:0;line-height:0;\">&nbsp;</td><td width=\"4\"></td><td width=\"22\" height=\"5\" style=\"background:#9E2B25;font-size:0;line-height:0;\">&nbsp;</td></tr></table>\n    <div style=\"font-family:'Instrument Sans',Arial,Helvetica,sans-serif;font-size:12px;line-height:16px;letter-spacing:1.5px;font-weight:700;color:#C34B0B;text-transform:uppercase;\">Ya sos parte</div>\n    <h1 style=\"margin:8px 0 0 0;font-family:'Bricolage Grotesque','Arial Black',Arial,Helvetica,sans-serif;font-size:32px;line-height:38px;font-weight:800;color:#323232;\">¡Te damos la bienvenida!</h1>\n  </td></tr></table>\n</td></tr>\n<tr><td style=\"padding:24px 32px 0 32px;\" align=\"left\"><p style=\"margin:0 0 14px 0;font-family:'Instrument Sans',Arial,Helvetica,sans-serif;font-size:16px;line-height:25px;color:#323232;\">¡Hola, {{NOMBRE}}! Tu cuenta ya está lista.</p><p style=\"margin:0 0 14px 0;font-family:'Instrument Sans',Arial,Helvetica,sans-serif;font-size:16px;line-height:25px;color:#323232;\">Acá se alquila entre vecinos: casas, departamentos, quinchos y salones de Lavalle, <strong>directo con el dueño</strong>, hablando por WhatsApp. Sin comisiones ni intermediarios.</p><p style=\"margin:0 0 14px 0;font-family:'Instrument Sans',Arial,Helvetica,sans-serif;font-size:16px;line-height:25px;color:#323232;\"><strong>Un consejo:</strong> nunca pagues una seña sin ver la propiedad. Lavalle Alquila no cobra señas ni intermedia el pago.</p></td></tr>\n<tr><td style=\"padding:8px 32px 8px 32px;\" align=\"center\">\n  <table role=\"presentation\" cellpadding=\"0\" cellspacing=\"0\" border=\"0\" style=\"width:100%;\"><tr><td align=\"center\" bgcolor=\"#FC6F20\" style=\"border-radius:999px;\">\n    <a href=\"https://lavallealquila.com.ar/\" target=\"_blank\" style=\"display:block;padding:15px 24px;font-family:'Instrument Sans',Arial,Helvetica,sans-serif;font-size:17px;line-height:20px;font-weight:700;color:#323232;text-decoration:none;border-radius:999px;\">Ver los alquileres</a>\n  </td></tr></table>\n</td></tr>\n<tr><td style=\"padding:14px 32px 0 32px;\" align=\"left\">\n  <p style=\"margin:0;font-family:'Instrument Sans',Arial,Helvetica,sans-serif;font-size:13px;line-height:20px;color:#6b5a4a;\">Si el botón no funciona, copiá y pegá este link en tu navegador:<br><a href=\"https://lavallealquila.com.ar/\" style=\"color:#C34B0B;word-break:break-all;\">https://lavallealquila.com.ar/</a></p>\n</td></tr>\n\n<tr><td style=\"padding:20px 32px 28px 32px;\" align=\"left\"><p style=\"margin:0;font-family:'Instrument Sans',Arial,Helvetica,sans-serif;font-size:13px;line-height:20px;color:#6b5a4a;\">¿Tenés algo para alquilar? Publicarlo es gratis y lleva un par de minutos.</p></td></tr>\n<tr><td style=\"background:#323232;border-radius:0 0 19px 19px;padding:22px 32px;\" align=\"left\">\n  <p style=\"margin:0 0 4px 0;font-family:'Bricolage Grotesque','Arial Black',Arial,Helvetica,sans-serif;font-size:16px;line-height:20px;font-weight:800;color:#FFF8F0;\">Lavalle <span style=\"color:#FC6F20;\">Alquila</span></p>\n  <p style=\"margin:0 0 10px 0;font-family:'Instrument Sans',Arial,Helvetica,sans-serif;font-size:13px;line-height:19px;color:#EBD4B8;\">Alquileres en Lavalle, Mendoza. Directo con el dueño, por WhatsApp.</p>\n  <p style=\"margin:0;font-family:'Instrument Sans',Arial,Helvetica,sans-serif;font-size:12px;line-height:18px;color:#EBD4B8;\"><a href=\"https://lavallealquila.com.ar\" style=\"color:#FFF8F0;text-decoration:underline;\">lavallealquila.com.ar</a> &nbsp;·&nbsp; <a href=\"https://lavallealquila.com.ar/privacidad.html\" style=\"color:#EBD4B8;\">Privacidad</a> &nbsp;·&nbsp; <a href=\"https://lavallealquila.com.ar/terminos.html\" style=\"color:#EBD4B8;\">Términos</a><br>Este mail es automático, no hace falta que lo respondas.</p>\n</td></tr>\n</table></td></tr></table></body></html>",
  },
  listing_published: {
    subject: "Tu aviso ya está publicado",
    html: "<!DOCTYPE html>\n<html lang=\"es\"><head><meta charset=\"utf-8\"><meta name=\"viewport\" content=\"width=device-width,initial-scale=1\">\n<meta name=\"color-scheme\" content=\"light only\"><title>¡Tu aviso ya está online!</title></head>\n<body style=\"margin:0;padding:0;background:#FEE8D0;\">\n<div style=\"display:none;max-height:0;overflow:hidden;opacity:0;color:#FEE8D0;font-size:1px;line-height:1px;\">Ya lo pueden ver los vecinos. Compartilo.&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;</div>\n<table role=\"presentation\" width=\"100%\" cellpadding=\"0\" cellspacing=\"0\" border=\"0\" style=\"background:#FEE8D0;\"><tr><td align=\"center\" style=\"padding:24px 12px;\">\n<table role=\"presentation\" width=\"600\" cellpadding=\"0\" cellspacing=\"0\" border=\"0\" style=\"width:100%;max-width:600px;background:#FFF8F0;border:1px solid #EBD4B8;border-radius:20px;\">\n<tr><td style=\"padding:28px 32px 8px 32px;\" align=\"left\"><a href=\"https://lavallealquila.com.ar\" style=\"text-decoration:none;\"><img src=\"https://lavallealquila.com.ar/brand/lavalle-alquila-horizontal.png\" width=\"150\" height=\"50\" alt=\"Lavalle Alquila\" style=\"display:block;border:0;width:150px;height:auto;\"></a></td></tr>\n<tr><td style=\"padding:16px 32px 0 32px;\">\n  <table role=\"presentation\" width=\"100%\" cellpadding=\"0\" cellspacing=\"0\" border=\"0\" style=\"background:#FEE8D0;border-radius:16px;\"><tr><td style=\"padding:28px 24px;\" align=\"center\">\n    <img src=\"https://lavallealquila.com.ar/brand/lavalle-alquila-marca-512.png\" width=\"96\" alt=\"\" style=\"display:block;border:0;width:96px;height:auto;margin:0 auto 16px auto;\">\n    <table role=\"presentation\" cellpadding=\"0\" cellspacing=\"0\" border=\"0\" style=\"margin:0 auto 14px auto;\"><tr><td width=\"22\" height=\"5\" style=\"background:#FC6F20;font-size:0;line-height:0;\">&nbsp;</td><td width=\"4\"></td><td width=\"22\" height=\"5\" style=\"background:#D9A51E;font-size:0;line-height:0;\">&nbsp;</td><td width=\"4\"></td><td width=\"22\" height=\"5\" style=\"background:#9E2B25;font-size:0;line-height:0;\">&nbsp;</td></tr></table>\n    <div style=\"font-family:'Instrument Sans',Arial,Helvetica,sans-serif;font-size:12px;line-height:16px;letter-spacing:1.5px;font-weight:700;color:#C34B0B;text-transform:uppercase;\">Aviso publicado</div>\n    <h1 style=\"margin:8px 0 0 0;font-family:'Bricolage Grotesque','Arial Black',Arial,Helvetica,sans-serif;font-size:32px;line-height:38px;font-weight:800;color:#323232;\">¡Tu aviso ya está online!</h1>\n  </td></tr></table>\n</td></tr>\n<tr><td style=\"padding:24px 32px 0 32px;\" align=\"left\"><p style=\"margin:0 0 14px 0;font-family:'Instrument Sans',Arial,Helvetica,sans-serif;font-size:16px;line-height:25px;color:#323232;\">¡Hola, {{NOMBRE}}! Publicamos <strong>{{TITULO_AVISO}}</strong> y ya lo puede ver cualquiera en Lavalle Alquila.</p><p style=\"margin:0 0 14px 0;font-family:'Instrument Sans',Arial,Helvetica,sans-serif;font-size:16px;line-height:25px;color:#323232;\">Compartí el link por WhatsApp o redes para que llegue a más gente. Cuando se alquile, entrá a Mis avisos y marcalo como alquilado para que nadie te escriba de más.</p></td></tr>\n<tr><td style=\"padding:8px 32px 8px 32px;\" align=\"center\">\n  <table role=\"presentation\" cellpadding=\"0\" cellspacing=\"0\" border=\"0\" style=\"width:100%;\"><tr><td align=\"center\" bgcolor=\"#FC6F20\" style=\"border-radius:999px;\">\n    <a href=\"{{LINK_AVISO}}\" target=\"_blank\" style=\"display:block;padding:15px 24px;font-family:'Instrument Sans',Arial,Helvetica,sans-serif;font-size:17px;line-height:20px;font-weight:700;color:#323232;text-decoration:none;border-radius:999px;\">Ver mi aviso</a>\n  </td></tr></table>\n</td></tr>\n<tr><td style=\"padding:14px 32px 0 32px;\" align=\"left\">\n  <p style=\"margin:0;font-family:'Instrument Sans',Arial,Helvetica,sans-serif;font-size:13px;line-height:20px;color:#6b5a4a;\">Si el botón no funciona, copiá y pegá este link en tu navegador:<br><a href=\"{{LINK_AVISO}}\" style=\"color:#C34B0B;word-break:break-all;\">{{LINK_AVISO}}</a></p>\n</td></tr>\n\n<tr><td style=\"padding:20px 32px 28px 32px;\" align=\"left\"><p style=\"margin:0;font-family:'Instrument Sans',Arial,Helvetica,sans-serif;font-size:13px;line-height:20px;color:#6b5a4a;\">Recordá: nunca pidas ni pagues una seña sin que el inquilino vea la propiedad.</p></td></tr>\n<tr><td style=\"background:#323232;border-radius:0 0 19px 19px;padding:22px 32px;\" align=\"left\">\n  <p style=\"margin:0 0 4px 0;font-family:'Bricolage Grotesque','Arial Black',Arial,Helvetica,sans-serif;font-size:16px;line-height:20px;font-weight:800;color:#FFF8F0;\">Lavalle <span style=\"color:#FC6F20;\">Alquila</span></p>\n  <p style=\"margin:0 0 10px 0;font-family:'Instrument Sans',Arial,Helvetica,sans-serif;font-size:13px;line-height:19px;color:#EBD4B8;\">Alquileres en Lavalle, Mendoza. Directo con el dueño, por WhatsApp.</p>\n  <p style=\"margin:0;font-family:'Instrument Sans',Arial,Helvetica,sans-serif;font-size:12px;line-height:18px;color:#EBD4B8;\"><a href=\"https://lavallealquila.com.ar\" style=\"color:#FFF8F0;text-decoration:underline;\">lavallealquila.com.ar</a> &nbsp;·&nbsp; <a href=\"https://lavallealquila.com.ar/privacidad.html\" style=\"color:#EBD4B8;\">Privacidad</a> &nbsp;·&nbsp; <a href=\"https://lavallealquila.com.ar/terminos.html\" style=\"color:#EBD4B8;\">Términos</a><br>Este mail es automático, no hace falta que lo respondas.</p>\n</td></tr>\n</table></td></tr></table></body></html>",
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
