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
