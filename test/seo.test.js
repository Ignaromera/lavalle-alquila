import assert from "node:assert/strict";
import { readFileSync, statSync } from "node:fs";
import test from "node:test";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");

test("el HTML trae title, description, canonical, Open Graph y Twitter en español", () => {
  const html = readFileSync(path.join(root, "index.html"), "utf8");
  assert.match(html, /<title>Lavalle Alquila — Alquileres en Lavalle, Mendoza<\/title>/);
  assert.match(html, /<meta name="description" content="Alquileres entre vecinos de Lavalle, Mendoza\. Publicá tu aviso gratis y consultá por WhatsApp\."/);
  assert.match(html, /<link rel="canonical" href="https:\/\/lavallealquila\.com\.ar\/"/);
  assert.match(html, /property="og:type" content="website"/);
  assert.match(html, /property="og:locale" content="es_AR"/);
  assert.match(html, /property="og:title" content="Lavalle Alquila — Alquileres en Lavalle, Mendoza"/);
  assert.match(html, /property="og:description" content="Alquileres entre vecinos de Lavalle, Mendoza\. Publicá tu aviso gratis y consultá por WhatsApp\."/);
  assert.match(html, /property="og:url" content="https:\/\/lavallealquila\.com\.ar\/"/);
  assert.match(html, /property="og:image" content="https:\/\/lavallealquila\.com\.ar\/og-image\.png"/);
  assert.match(html, /property="og:image:width" content="1200"/);
  assert.match(html, /property="og:image:height" content="630"/);
  assert.match(html, /name="twitter:card" content="summary_large_image"/);
  assert.match(html, /name="twitter:image" content="https:\/\/lavallealquila\.com\.ar\/og-image\.png"/);
});

test("robots.txt y sitemap.xml apuntan al sitio", () => {
  const robots = readFileSync(path.join(root, "public/robots.txt"), "utf8");
  assert.match(robots, /User-agent: \*/);
  assert.match(robots, /Allow: \//);
  assert.match(robots, /Sitemap: https:\/\/lavallealquila\.com\.ar\/sitemap\.xml/);
  const sitemap = readFileSync(path.join(root, "public/sitemap.xml"), "utf8");
  assert.match(sitemap, /<loc>https:\/\/lavallealquila\.com\.ar\/<\/loc>/);
  assert.match(sitemap, /terminos\.html/);
  assert.match(sitemap, /privacidad\.html/);
});

test("la imagen OG mide 1200x630 y pesa menos de 300 KB", async () => {
  const file = path.join(root, "public/og-image.png");
  assert.ok(statSync(file).size < 300 * 1024);
  const { PNG } = await import("node:zlib");
  void PNG;
  const buf = readFileSync(file);
  assert.equal(buf[0], 0x89);
  assert.equal(buf.toString("ascii", 1, 4), "PNG");
  const width = buf.readUInt32BE(16);
  const height = buf.readUInt32BE(20);
  assert.equal(width, 1200);
  assert.equal(height, 630);
});
