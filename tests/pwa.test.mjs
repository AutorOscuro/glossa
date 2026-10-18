import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const manifest = JSON.parse(fs.readFileSync(path.join(ROOT, 'manifest.webmanifest'), 'utf8'));
const themes = fs.readFileSync(path.join(ROOT, 'ui/styles/themes.css'), 'utf8');
const aurora = themes.slice(0, themes.indexOf('[data-theme="neo"]'));

function png(rel) {
  const b = fs.readFileSync(path.join(ROOT, rel));
  assert.equal(b.subarray(0, 8).toString('hex'), '89504e470d0a1a0a', `${rel} no es un PNG`);
  return { w: b.readUInt32BE(16), h: b.readUInt32BE(20), colorType: b[25], bytes: b.length };
}

test('manifest: campos obligatorios, rutas RELATIVAS y modo standalone', () => {
  assert.equal(manifest.name, 'Sophia Inglés'); assert.ok(manifest.short_name.length <= 12);
  assert.equal(manifest.display, 'standalone'); assert.equal(manifest.lang, 'es');
  for (const k of ['start_url', 'scope', 'id']) {
    assert.ok(!/^(\/|[a-z]+:)/i.test(manifest[k]), `${k} debe ser relativa (funciona en subcarpetas de GitHub Pages): ${manifest[k]}`);
  }
  assert.equal(manifest.start_url, './'); assert.equal(manifest.scope, './');
  assert.ok(manifest.description.length > 10);
});

test('manifest: colores = tema Aurora (el de index.html) y en formato #rrggbb', () => {
  const bg = /--bg:\s*(#[0-9a-f]{6})/i.exec(aurora)[1];
  assert.match(manifest.background_color, /^#[0-9a-f]{6}$/i); assert.match(manifest.theme_color, /^#[0-9a-f]{6}$/i);
  assert.equal(manifest.background_color.toLowerCase(), bg); assert.equal(manifest.theme_color.toLowerCase(), bg);
  const index = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  assert.equal(/name="theme-color" content="(#[0-9a-f]{6})"/i.exec(index)[1].toLowerCase(), manifest.theme_color.toLowerCase());
});

test('manifest: iconos 192 y 512 (any) y 512 maskable existen y miden lo que dicen', () => {
  const by = (purpose, size) => manifest.icons.find((i) => i.purpose === purpose && i.sizes === size);
  for (const [purpose, size] of [['any', '192x192'], ['any', '512x512'], ['maskable', '512x512']]) {
    const icon = by(purpose, size);
    assert.ok(icon, `falta icono ${purpose} ${size}`);
    assert.equal(icon.type, 'image/png');
    assert.ok(!icon.src.startsWith('/'), 'ruta relativa');
    const [w, h] = size.split('x').map(Number);
    const info = png(icon.src);
    assert.deepEqual([info.w, info.h], [w, h], icon.src);
  }
  assert.ok(manifest.icons.every((i) => i.purpose === 'any' || i.purpose === 'maskable'), 'nunca "any maskable" junto');
});

test('iconos: el "any" es transparente en las esquinas y el maskable ocupa todo el cuadro', () => {
  assert.equal(png('icons/icon-192.png').colorType, 6, 'RGBA');
  assert.ok(fs.existsSync(path.join(ROOT, 'icons/icon.svg')) && fs.existsSync(path.join(ROOT, 'icons/icon-maskable.svg')));
  for (const f of ['icons/icon.svg', 'icons/icon-maskable.svg']) {
    const svg = fs.readFileSync(path.join(ROOT, f), 'utf8');
    assert.doesNotMatch(svg, /<script|https?:\/\/(?!www\.w3\.org)|xlink:href|<image/i, `${f}: sin scripts ni recursos remotos`);
  }
  const maskable = fs.readFileSync(path.join(ROOT, 'icons/icon-maskable.svg'), 'utf8');
  assert.doesNotMatch(maskable, /<rect[^>]*\srx=/, 'el maskable va a sangre (sin esquinas redondeadas propias)');
});

test('index.html: la CSP ya permite manifest y worker del mismo origen', () => {
  const index = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  assert.match(index, /manifest-src 'self'/); assert.match(index, /worker-src 'self'/);
});
