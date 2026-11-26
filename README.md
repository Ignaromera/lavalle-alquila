# Lavalle Alquila

Avisos de alquiler entre vecinos de Lavalle, Mendoza: casas, departamentos, locales, terrenos, quinchos y salones. Se consulta por WhatsApp. Está en línea en [lavallealquila.com.ar](https://lavallealquila.com.ar/). El sitio es estático y se publica en GitHub Pages. Los datos viven en el plan gratis de Supabase.

Si todavía no pegaste las claves, la app abre en **modo ejemplo** con avisos ficticios marcados como tales. Sirve para recorrerla antes de crear el proyecto.

## En tu computadora

```bash
npm install
npm run dev
```

Abrí http://127.0.0.1:5173 . `npm test` corre las reglas (límite de avisos, denuncias, turnero, polígono) y `npm run build` deja el sitio en `dist/`.

## Para publicarlo de verdad

Está todo en [SETUP.md](SETUP.md): proyecto gratis de Supabase, SQL, login por email y GitHub Pages.

## Qué incluye

- Listado, filtros y mapa (Leaflet + OpenStreetMap).
- Publicar desde el teléfono, con fotos achicadas antes de subirlas y el pin dentro de Lavalle.
- Un aviso activo por cuenta gratis. El tope está en la base, no solo en la pantalla.
- A los 60 días vence. Quien publicó lo renueva con un clic.
- Tres denuncias ocultan el aviso. Hay una vista de moderación.
- «Busco alquiler», con el mismo vencimiento.
- Quinchos y salones, con calendario de turnos. El aviso es gratis; el turnero es un extra que se prende con un flag (`booking_enabled` / `plan`) y todavía no se cobra.

## Marca

Los archivos del logo están en `public/brand/` (marca, versión horizontal, en una línea y apilada; claras y oscuras; los textos ya están pasados a trazos). Los íconos de la app (`favicon.svg`, `favicon-32.png`, `apple-touch-icon.png`, `icon-192.png`, `icon-512.png`, `icon-maskable-512.png`) y `og-image.png` están en `public/`.

- Paleta: Naranja `#FC6F20`, Crema adobe `#FEE8D0`, Papel `#FFF8F0`, Carbón `#323232`, Arena `#EBD4B8`, Mostaza `#D9A51E` (destacado), Ladrillo `#9E2B25` (alertas), Naranja profundo `#C34B0B` (texto), Verde `#1F7A44` (solo WhatsApp).
- Tipografías: Bricolage Grotesque (títulos) e Instrument Sans (texto), ambas con licencia SIL Open Font License, servidas desde el propio sitio.
- La silueta del departamento de Lavalle del logo se armó con datos de © OpenStreetMap contributors, licencia ODbL (https://www.openstreetmap.org/copyright).
- Las fotos de los avisos de ejemplo (`public/demo/fotos/`) son de Pexels (licencia libre de Pexels) y solo se usan en el modo ejemplo. Los avisos reales llevan las fotos de cada dueño.
