# Cómo poner Lavalle Alquila en línea, gratis

Todo corre en el plan gratuito: GitHub Pages para la página y Supabase para las cuentas, la base y las fotos. No hace falta tarjeta.

El repositorio es `Ignaromera/lavalle-alquila`. Cuando Pages esté activo, el sitio va a quedar en:

`https://lavallealquila.com.ar/`

Hasta que pegues las claves, quien abra el sitio ve el **modo ejemplo** (avisos ficticios, marcados como ejemplo).

## 1. Crear el proyecto de Supabase

1. Entrá a [https://supabase.com](https://supabase.com) y creá una cuenta.
2. **New project**. Elegí el plan **Free**.
3. Nombre: `lavalle-alquila`. Contraseña de la base: guardala, no va en la página.
4. Región: la más cercana (por ejemplo South America, si aparece).
5. Esperá a que el proyecto termine de crearse.

## 2. Correr el SQL

1. En el proyecto, abrí **SQL Editor** → **New query**.
2. Copiá todo el archivo [`supabase/schema.sql`](supabase/schema.sql) y pegalo.
3. **Run**. Tiene que terminar sin errores.
4. Si más adelante lo volvés a correr entero, va a fallar porque las tablas ya existen. Es un script de instalación, de una sola vez.

Eso crea:

- perfiles, avisos, denuncias, búsquedas y el turnero
- el límite de **1 aviso activo** por cuenta gratis (un trigger, no solo la pantalla)
- el ocultado automático a la **tercera denuncia**
- el vencimiento a los **60 días** (los vencidos no salen en el listado; no hace falta un cron)
- la regla de **un solo turno confirmado** por día y turno
- el bucket público `listing-photos` (fotos de hasta 2 MB; la página las achica antes)

Si el bucket no aparece en **Storage**, crealo a mano: nombre `listing-photos`, público, límite 2 MB, tipos `image/jpeg`, `image/png`, `image/webp`. Las políticas del SQL igual tienen que estar.

## 3. Anotarte como admin

En el SQL Editor:

```sql
insert into public.admin_emails (email) values ('tu@email.com');
```

Usá el mismo email con el que vas a entrar a la página. Sin esa fila, la moderación no te deja pasar aunque pongas el email en el código.

## 4. Login con Google y con email

La página pide primero **Entrar con Google** y, debajo, el email. El correo de Supabase puede traer un enlace o un código. La plantilla puede quedar la de fábrica (solo el enlace, sin `{{ .Token }}`). Si el código está activado, en este proyecto tiene 8 dígitos: el campo acepta de 6 a 10. El texto de la pantalla lo dice.

1. **Authentication** → **Providers** → **Email**: prendido. **Confirm email** activado.
2. **Authentication** → **Providers** → **Google**: prendido, con el Client ID y el Client Secret de Google Cloud.
3. En Google Cloud, la pantalla de consentimiento tiene que apuntar a:
   - `https://lavallealquila.com.ar/privacidad.html`
   - `https://lavallealquila.com.ar/terminos.html`
4. En el cliente OAuth de Google, el redirect autorizado de Supabase es el que muestra el panel (algo como `https://TU_PROYECTO.supabase.co/auth/v1/callback`).
5. **Authentication** → **URL configuration**:
   - **Site URL**: `https://lavallealquila.com.ar/`
   - **Redirect URLs**, agregá estas (con y sin barra final):
     - `https://lavallealquila.com.ar/`
     - `https://lavallealquila.com.ar`
     - `http://127.0.0.1:5173`
     - `http://localhost:5173`

Google y el enlace del correo vuelven a la página con `?code=`. La app usa PKCE (`detectSessionInUrl`), así que no choca con las rutas `#/aviso/...`. Después del ingreso, si falta el nombre o el WhatsApp, se completan en **Yo** antes de publicar. El nombre de Google se propone solo; el WhatsApp siempre lo escribe la persona.

Si más adelante querés que el correo traiga también el código, en **Email templates** → **Magic Link** podés sumar `{{ .Token }}`. No es obligatorio.

El plan gratis manda pocos correos por hora. No lo pruebes diez veces seguidas.

## 5. Pegar la URL y la clave anónima

1. **Project Settings** → **API**.
2. Copiá **Project URL** y la clave pública (`anon` o la clave **publishable**, la que se puede poner en el navegador). No copies la `service_role` ni la clave secreta: esas abren toda la base y no van en el sitio.
3. Editá [`src/config.js`](src/config.js):

```js
export const config = {
  supabaseUrl: "https://TU_PROYECTO.supabase.co",
  supabaseAnonKey: "eyJ...la anon key...",
  adminEmails: ["tu@email.com"],
};
```

`adminEmails` solo muestra el enlace de moderación. Quien autoriza de verdad es la tabla `admin_emails`.

4. Commit y push a `main`.

Para probar en tu máquina antes de subir: `npm install` y `npm run dev`.

## 6. Prender GitHub Pages

1. En el repo de GitHub: **Settings** → **Pages**.
2. **Build and deployment** → **Source**: **GitHub Actions**.
3. El archivo [`.github/workflows/pages.yml`](.github/workflows/pages.yml) ya publica `dist/` en cada push a `main`.
4. Entrá a **Actions** y esperá a que el workflow termine en verde.
5. Abrí `https://lavallealquila.com.ar/`.

La primera vez puede tardar un par de minutos. Si ves el cartel de modo ejemplo, las claves no llegaron al build: revisá que `src/config.js` esté en el commit que se publicó.

## 7. Probar el circuito

1. Entrá con tu email y completá nombre y WhatsApp (con código de país, o un número de Mendoza de 10 dígitos: lo convertimos a `549...`).
2. Publicá un aviso de prueba, con una foto y el pin dentro de Lavalle. Sale enseguida, sin aprobación.
3. Intentá publicar otro: la base tiene que rechazarlo mientras el primero siga activo. Marcalo como alquilado o eliminalo y recién ahí podés cargar otro.
4. Desde otro navegador, denunciá el mismo aviso tres veces (o con tres visitas distintas). A la tercera desaparece del listado.
5. Entrá con el email admin y abrí **Moderación**. Ahí podés restaurar, quitar, destacar o prender el turnero.

## Planes y suscripciones (Mercado Pago)

Hay tres planes: Gratis (1 aviso), Plus (3 avisos, estadísticas) y Pro (avisos ilimitados, turnero, 2 destacados). Se cobran con Mercado Pago Suscripciones. Los pasos para activarlo (SQL, funciones, secrets) están en `supabase/SUSCRIPCIONES.md`. Hasta que se cargue `MP_ACCESS_TOKEN` y `billingLive` pase a `true` en `src/config.js`, el botón «Suscribirme» avisa que viene muy pronto.

Los ganchos de abajo siguen valiendo (la suscripción los completa sola, y `profiles.plan` ahora admite también `plus`; el ilimitado se guarda como `max_listings = 1000`):

| Qué | Dónde | Para qué |
| --- | --- | --- |
| Plan | `profiles.plan` (`free` o `pro`) | Etiqueta del plan |
| Tope de avisos | `profiles.max_listings` | El gratis vale 1. Subilo para un plan pago |
| Turnero en la cuenta | `profiles.booking_enabled` | Los quinchos y salones **nuevos** salen con calendario |
| Turnero de un aviso | `listings.booking_enabled` | Calendario de ese quincho o salón |
| Destacado | `listings.featured` | Se muestra primero |

Desde **Moderación** (con tu email en `admin_emails`) podés destacar y prender o apagar el turnero. También podés hacerlo en el SQL Editor, que corre como dueño de la base:

```sql
update public.profiles
set plan = 'pro', booking_enabled = true, max_listings = 5
where id = 'UUID-DEL-USUARIO';

update public.listings
set booking_enabled = true
where id = 'UUID-DEL-QUINCHO';

update public.listings
set featured = true
where id = 'UUID-DEL-AVISO';
```

El aviso del quincho o salón se publica gratis, como el resto. El calendario es el extra. Si el flag está apagado, la ficha muestra: «Activá el turnero (próximamente, servicio pago)» y la consulta sigue por WhatsApp.

Cada aviso pide una dirección (calle y número, o una referencia). En la ficha hay un mapa de Google embebido, sin clave, y un botón para cómo llegar. Compartir usa el enlace directo del aviso (`#/aviso/...` o `#/busco/...`).

En un quincho o salón, quien publica define los horarios con nombre, hora de inicio, hora de fin y precio (por ejemplo Mediodía 11:00–18:00 y Noche 20:00–04:00), o elige Día completo con su horario. El turnero muestra esos nombres, las horas y el precio.

Si ya corriste `schema.sql` antes, en el SQL Editor ejecutá una sola vez los archivos que te falten: [`supabase/migration-direccion-turnos.sql`](supabase/migration-direccion-turnos.sql) y [`supabase/migration-estadisticas.sql`](supabase/migration-estadisticas.sql). Una instalación nueva no los necesita: `schema.sql` ya trae la dirección, los horarios y las estadísticas.

Las visitas, los compartidos y los clics a WhatsApp se guardan como un número por día. No hay datos de la persona. Cada navegador cuenta una visita por aviso y por día. Solo el dueño y un admin pueden leer esos números.

Quien alquila marca qué días ofrece cada horario. Otra persona pide ese turno con nombre, WhatsApp, cantidad de gente y una nota. En tu cuenta ves el pedido: **Confirmar y abrir WhatsApp** manda el mensaje ya escrito y deja el turno tomado. **Rechazar** lo vuelve a liberar. No puede haber dos reservas confirmadas del mismo día y turno: lo impide un índice único.

## Límites del plan gratis

- Supabase free: base chica, 1 GB de storage, ancho de banda y correos de login limitados. Alcanza para un tablón de Lavalle.
- Las fotos se guardan en `listing-photos`, públicas, a nombre de quien las subió (`su-usuario/id-del-aviso/foto.jpg`).
- El mapa usa teselas de OpenStreetMap. Para un sitio chico está bien. No scrapees el mapa ni lo uses como GPS de flota.
- El contorno de Lavalle es el del departamento en OpenStreetMap, simplificado. Un punto justo sobre el límite puede quedar afuera. Si pasa con una calle real de Lavalle, se puede aflojar el polígono en `data/lavalle-boundary.json` y en `point_in_lavalle` dentro del SQL.
- Cualquiera puede denunciar. Con tres denuncias el aviso se oculta. Alguien insistido puede esconder un aviso legítimo; por eso la moderación puede restaurarlo.
- Los avisos vencen a los 60 días solos, porque el listado público pide `expires_at` futuro. No hay que programar un cron.

## Si algo no entra

- **No llega el correo**: mirá spam, la plantilla Magic Link y el límite de envíos. El enlace tiene que volver a la URL de Pages.
- **«No autorizado» al publicar**: falta el perfil (nombre y WhatsApp) o el trigger de `auth.users` no se creó. Entrá de nuevo: la página crea el perfil si no está.
- **La foto no sube**: el bucket tiene que ser público y la política de insert tiene que dejar la carpeta de tu usuario. La foto ya comprimida no puede pasar de 2 MB.
- **El pin no deja publicar**: está fuera del polígono. Acercate a Villa Tulumaya y tocá de nuevo.

La `service_role` no se pega en `config.js` ni se sube al repo.
