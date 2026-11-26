# Mails transaccionales

Se mandan por Resend (dominio lavallealquila.com.ar verificado, SMTP de Supabase apuntando a Resend).

- `emails/*.html`: los 6 diseños. 01, 02, 05 y 06 son las plantillas de Auth de Supabase
  (Confirm signup, Reset password, Magic link, Change email). 03 y 04 los manda la Edge Function.
- `functions/enviar-mail/`: Edge Function que manda bienvenida y «aviso publicado» con la API de Resend.
  `index.ts` se genera con `python3 build_function.py` a partir de `index.ts.tpl` y los HTML.
  Secrets: `RESEND_API_KEY`, `WEBHOOK_SECRET`. Se despliega sin verificación de JWT: la llaman los triggers con el header `x-webhook-secret`.
- `migration-mails-automaticos.sql`: triggers con pg_net. Reemplazar `__WEBHOOK_SECRET__` antes de correrlo; no commitear el valor.
  - Bienvenida: una vez, cuando `auth.users.email_confirmed_at` pasa a tener fecha (Google ya nace confirmado). Evita el doble saludo con «Confirmá tu mail».
  - Aviso publicado: AFTER INSERT en `listings` con status `active`.
- El modo demo (`?demo=1`) nunca toca la base, así que no manda mails.

Asuntos: confirmación «Confirmá tu mail en Lavalle Alquila»; contraseña «Recuperá tu contraseña de Lavalle Alquila»;
magic link «Tu link para entrar a Lavalle Alquila»; cambio de mail «Confirmá tu nuevo mail en Lavalle Alquila»;
bienvenida «Te damos la bienvenida a Lavalle Alquila»; aviso «Tu aviso ya está publicado».
