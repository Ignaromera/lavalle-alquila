# Mails transaccionales

Se mandan por Resend (dominio lavallealquila.com.ar verificado, SMTP de Supabase apuntando a Resend).

- `emails/*.html`: los 6 diseños. 01, 02, 05 y 06 son las plantillas de Auth de Supabase
  (Confirm signup, Reset password, Magic link, Change email). 03 y 04 los manda la Edge Function.
  Las plantillas 01 y 02 usan `token_hash` y vuelven a `https://lavallealquila.com.ar/?token_hash=...#/cuenta`, para dejar la sesión iniciada al confirmar o al elegir una contraseña nueva. Hay que pegarlas en **Authentication → Email templates** del proyecto.
- `functions/enviar-mail/`: Edge Function que manda bienvenida y «aviso publicado» con la API de Resend.
  `index.ts` se genera con `python3 build_function.py` a partir de `index.ts.tpl` y los HTML.
  Secrets: `RESEND_API_KEY`, `WEBHOOK_SECRET`. Se despliega sin verificación de JWT: la llaman los triggers con el header `x-webhook-secret`.
- `migration-mails-automaticos.sql`: triggers con pg_net. Reemplazar `__WEBHOOK_SECRET__` antes de correrlo; no commitear el valor.
  - Bienvenida: una vez, cuando `auth.users.email_confirmed_at` pasa a tener fecha (Google ya nace confirmado). Evita el doble saludo con «Confirmá tu mail».
  - Aviso publicado: AFTER INSERT en `listings` con status `active`. El payload incluye `listing_id`, `owner_id` y `title` (la función no depende de poder leer la tabla).
- El modo demo (`?demo=1`) nunca toca la base, así que no manda mails.

Asuntos: confirmación «Confirmá tu cuenta en Lavalle Alquila»; contraseña «Recuperá tu contraseña de Lavalle Alquila»;
magic link «Tu link para entrar a Lavalle Alquila»; cambio de mail «Confirmá tu nuevo mail en Lavalle Alquila»;
bienvenida «Te damos la bienvenida a Lavalle Alquila»; aviso «Tu aviso ya está publicado».

## Mails de suscripción

- `emails/07-suscripcion-activa.html`, `08-pago-fallido.html`, `09-suscripcion-cancelada.html` y `10-plan-terminado.html`: los cuatro mails nuevos. Se generan con `python3 emails/generar_suscripciones.py` a partir del 04.
- Los manda `enviar-mail` (se regenera con `build_function.py`) cuando `migration-suscripciones.sql` dispara el trigger sobre `subscriptions`. Tipos: `subscription_active`, `payment_failed`, `subscription_cancelled`, `plan_ended`.
- Asuntos: «Tu plan {Plus|Pro} está activo», «No pudimos cobrar tu suscripción», «Cancelaste tu suscripción», «Volviste al plan Gratis».

## Rastrear un mail

Desde la versión 7 de `enviar-mail`, la respuesta trae el id de Resend (`{"ok":true,"type":"welcome","id":"..."}`).
Queda unas horas en `net._http_response` (y en los logs de la función como `enviado <tipo> <user_id> <id>`).
Con ese id se busca el mail en el panel de Resend (Emails) para ver si se entregó, rebotó o fue a spam.
La API key de la función es solo de envío, así que el estado no se puede consultar desde la función.

Reenviar la bienvenida a mano (SQL Editor): `select private.avisar_mail(jsonb_build_object('type','welcome','user_id','<uuid>'::uuid));`

## Denuncia

- `emails/11-denuncia.html`: aviso al equipo cuando alguien denuncia un aviso o una búsqueda.
- Lo manda `enviar-mail` con el tipo `report_received`, siempre a `jirfcarp@gmail.com`.
- El trigger `mail_denuncia` (en `migration-reports-moderacion.sql`) llama a `private.avisar_mail` después de un INSERT en `reports`. Si el envío falla, la denuncia igual se guarda.

## Botón de arrepentimiento

- `migration-arrepentimiento.sql`: tabla `regret_requests` (insert anónimo, lectura y resolución solo admin), código de trámite `ARR-AAAAMMDD-0001` y `public.pedir_arrepentimiento(...)`, que devuelve el código al instante.
- El trigger `mail_arrepentimiento` manda el tipo `regret_requested` a `enviar-mail`, que envía dos mails:
  `emails/12-arrepentimiento-equipo.html` a jirfcarp@gmail.com («Pedido de arrepentimiento ARR-…») y
  `emails/13-arrepentimiento-recibido.html` a quien lo pidió («Recibimos tu pedido de arrepentimiento (ARR-…)»).
- En Moderación aparece la sección «Arrepentimientos» con «Marcar resuelto». La devolución se hace a mano en Mercado Pago.

## Código de regalo (LAVALLE5)

- `migration-promo-pro.sql`: tablas `promo_codes` y `promo_grants`, `public.canjear_codigo(code)` y el vencimiento en `private.vencer_promos()` (corre dentro de `vencer_suscripciones`).
- Al canjear se manda `promo_started` → `emails/14-pro-de-regalo.html` («Tenés Pro de regalo por 15 días»). Al vencer se reusa `subscription_ended` («Volviste al plan Gratis»).
