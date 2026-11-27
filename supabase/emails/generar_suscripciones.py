#!/usr/bin/env python3
"""Genera los 4 mails de suscripción (07 a 10) a partir del diseño 04 (mismo estilo y marca).
Variables que completa la Edge Function enviar-mail: {{NOMBRE}} {{PLAN}} {{PERIODO}} {{IMPORTE}} {{FRASE}} {{LINK}}."""
import pathlib, re
here = pathlib.Path(__file__).parent
base = (here / "04-aviso-publicado.html").read_text()

P = ('<p style="margin:0 0 14px 0;font-family:\'Instrument Sans\',Arial,Helvetica,sans-serif;font-size:16px;'
     'line-height:25px;color:#323232;">%s</p>')

MAILS = {
  "07-suscripcion-activa.html": dict(
    title="¡Tu plan {{PLAN}} está activo!", pre="Ya tenés tu plan. Gracias por sumarte.",
    eyebrow="Suscripción activa", h1="¡Tu plan {{PLAN}} está activo!",
    body=["¡Hola, {{NOMBRE}}! Recibimos tu pago y ya tenés el plan <strong>{{PLAN}}</strong>: {{IMPORTE}} {{PERIODO}}.",
          "Mercado Pago te cobra solo en cada renovación. {{FRASE}} Podés cancelar cuando quieras desde Mi suscripción."],
    button="Ver mi suscripción",
    note="Tus datos de tarjeta los guarda Mercado Pago. Lavalle Alquila nunca los ve."),
  "08-pago-fallido.html": dict(
    title="No pudimos cobrar tu suscripción", pre="Revisá tu medio de pago en Mercado Pago.",
    eyebrow="Pago pendiente", h1="No pudimos cobrar tu suscripción",
    body=["¡Hola, {{NOMBRE}}! Mercado Pago no pudo cobrar tu plan <strong>{{PLAN}}</strong>. Suele pasar por falta de saldo o por una tarjeta vencida.",
          "Mercado Pago va a reintentar solo. {{FRASE}} Si hace falta, cambiá el medio de pago desde tu cuenta de Mercado Pago."],
    button="Revisar mi suscripción",
    note="Si ya lo arreglaste, no tenés que hacer nada más."),
  "09-suscripcion-cancelada.html": dict(
    title="Cancelaste tu suscripción", pre="No te vamos a cobrar más.",
    eyebrow="Suscripción cancelada", h1="Cancelaste tu suscripción",
    body=["¡Hola, {{NOMBRE}}! Cancelamos tu suscripción al plan <strong>{{PLAN}}</strong> y no te vamos a cobrar más. {{FRASE}}",
          "Después vas a volver al plan Gratis: queda 1 aviso activo (el más reciente) y los demás vencen, pero no se borra nada. Si cambiás de idea, podés volver a suscribirte cuando quieras."],
    button="Ver mi suscripción",
    note="Gracias por haber usado el plan {{PLAN}}."),
  "10-plan-terminado.html": dict(
    title="Volviste al plan Gratis", pre="Tu plan terminó. Tus avisos siguen guardados.",
    eyebrow="Plan terminado", h1="Volviste al plan Gratis",
    body=["¡Hola, {{NOMBRE}}! Tu plan <strong>{{PLAN}}</strong> terminó y ahora tenés el plan Gratis: queda 1 aviso activo, el más reciente.",
          "Los demás avisos vencieron, pero no se borraron: los podés renovar cuando vuelvas a suscribirte. Cuando quieras, mirá los planes."],
    button="Ver los planes",
    note="Gracias por haber estado con nosotros."),
}

def swap(text, old, new, count=1):
    assert old in text, old[:60]
    return text.replace(old, new, count)

for name, m in MAILS.items():
    h = base
    h = swap(h, "<title>¡Tu aviso ya está online!</title>", "<title>%s</title>" % m["title"])
    h = swap(h, "Ya lo pueden ver los vecinos. Compartilo.", m["pre"])
    h = swap(h, ">Aviso publicado</div>", ">%s</div>" % m["eyebrow"])
    h = swap(h, ">¡Tu aviso ya está online!</h1>", ">%s</h1>" % m["h1"])
    body_re = re.compile(r'(<td style="padding:24px 32px 0 32px;" align="left">).*?(</td>)', re.S)
    h, n = body_re.subn(lambda mo: mo.group(1) + "".join(P % t for t in m["body"]) + mo.group(2), h, count=1)
    assert n == 1
    h = swap(h, ">Ver mi aviso</a>", ">%s</a>" % m["button"])
    h = h.replace("{{LINK_AVISO}}", "{{LINK}}")
    h = swap(h, "Recordá: nunca pidas ni pagues una seña sin que el inquilino vea la propiedad.", m["note"])
    (here / name).write_text(h)
    print("escrito", name)
