# Activar las suscripciones (Mercado Pago)

La página ya sale con la pantalla **Planes** y **Mi suscripción**. Hasta completar estos pasos, «Suscribirme» muestra «Muy pronto…» y nada se rompe.

Archivos (en este repo, `supabase/`):
- `migration-suscripciones.sql` (idempotente, sin secretos)
- `functions/crear-suscripcion/index.ts` (nueva)
- `functions/mp-webhook/index.ts` (nueva)
- `functions/enviar-mail/index.ts` (reemplaza a la actual: agrega 4 mails)

## A. Base de datos (sin credenciales de Mercado Pago)
Requisito: ya corrió `migration-mails-automaticos.sql` (existe `private.avisar_mail`).
1. Supabase (proyecto `tfiggzureidsozbzkyif`) > **SQL Editor** > New query.
2. Pegar todo `migration-suscripciones.sql` > **Run**. Debe terminar en «Success». Se puede repetir sin problema.
3. Si sale el aviso «pg_cron no quedó activo»: **Database > Extensions**, activar `pg_cron` y volver a correr solo el último bloque `do $$ ... end $$;`.
4. Controlar: `select id, name, max_listings, price_month, price_year from public.plans;` devuelve free, plus y pro.

## B. Edge Functions
**Edge Functions > Deploy a new function > Via Editor**, pegar el código y desplegar:
1. `crear-suscripcion`: **Verify JWT: OFF** (valida la sesión ella misma).
2. `mp-webhook`: **Verify JWT: OFF** (Mercado Pago no manda JWT).
3. `enviar-mail`: abrir la existente, reemplazar todo por el nuevo `index.ts`, desplegar con **Verify JWT: OFF** (como estaba). Ya tiene los secrets `RESEND_API_KEY` y `WEBHOOK_SECRET`.
`SUPABASE_URL` y `SUPABASE_SERVICE_ROLE_KEY` los inyecta Supabase solo.

Con A y B hechos, los destacados y los límites por plan ya funcionan; los pagos siguen en «Muy pronto…» por falta del token.

## C. Con las credenciales de Mercado Pago (las carga Ignacio, nunca en el chat)
1. https://www.mercadopago.com.ar/developers > **Tus integraciones** > Crear aplicación (Suscripciones / pagos online).
2. Probar primero con **credenciales de prueba** y usuarios de prueba (vendedor y comprador).
3. **Edge Functions > Secrets**: `MP_ACCESS_TOKEN` = Access Token (de prueba primero, producción después).
4. Opcional: `MP_WEBHOOK_SECRET` = clave secreta de la sección Webhooks, para validar la firma `x-signature`.
5. La `notification_url` se manda al crear cada suscripción (`.../functions/v1/mp-webhook`). Si Mercado Pago pide una URL en Webhooks, usar la misma, con los eventos «Planes y suscripciones» y «Pagos».
6. Probar en sandbox: Planes > Suscribirme > pagar en la página de Mercado Pago > volver a **Mi suscripción**: debe decir «Activo». Mirar `select * from public.subscriptions;` y los logs de `mp-webhook`.
7. Para cobrar de verdad: pasar el secret a la credencial de producción, poner `billingLive: true` en `src/config.js` y pushear (con eso el plan gratis deja de ver estadísticas).

## Qué pasa al vencer o fallar un pago
- Cada cambio de Mercado Pago actualiza `subscriptions` y llama a `activar_plan`.
- Pago fallido: mail «No pudimos cobrar…», sigue el plan hasta `access_until` (próximo cobro + 3 días de gracia).
- Cancelación o vencimiento: se vuelve a Gratis. Queda activo el aviso más nuevo; los demás vencen (no se borra nada, se renuevan al volver a suscribirse).
- Corre solo todos los días 03:17 (Argentina) con pg_cron y también cuando llega un webhook.

## Pendientes antes de cobrar
Términos y privacidad con las condiciones de pago, derecho de arrepentimiento (10 días), monotributo, plazo de acreditación en Mercado Pago.
