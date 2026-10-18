// Pruebas estáticas de index.html (CSP de 8.16, sin código en línea), boot-check, tema y registro de vistas (subparte 0.4).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
import { ROUTES } from '../app/router.js';
import { VIEWS } from '../app/shell.js';
import { THEMES, isTheme, suggestedTheme, initialTheme, applyTheme } from '../app/theme.js';
import { makeEnv, makeTimers } from './_fakeDom.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');

function csp() {
  const m = html.match(/<meta http-equiv="Content-Security-Policy" content="([^"]+)">/);
  assert.ok(m, 'falta la meta de CSP');
  return Object.fromEntries(m[1].split(';').map((d) => d.trim()).filter(Boolean).map((d) => { const [k, ...v] = d.split(/\s+/); return [k, v]; }));
}

test('index.html: CSP del contrato 8.16 (solo origen propio, sin inline ni eval, sin hosts remotos)', () => {
  const p = csp();
  assert.deepEqual(p['default-src'], ["'self'"]);
  assert.deepEqual(p['script-src'], ["'self'"]);
  assert.deepEqual(p['style-src'], ["'self'"]);
  assert.deepEqual(p['connect-src'], ["'self'"]);
  assert.deepEqual(p['media-src'], ["'self'", 'blob:']);
  assert.deepEqual(p['object-src'], ["'none'"]);
  assert.deepEqual(p['base-uri'], ["'none'"]);
  assert.deepEqual(p['form-action'], ["'none'"]);
  const all = JSON.stringify(p);
  assert.ok(!/unsafe-inline|unsafe-eval|https?:|\*/.test(all), all);
});

test('index.html: la CSP va ANTES de cualquier script o estilo', () => {
  const at = html.indexOf('Content-Security-Policy');
  assert.ok(at > 0);
  for (const marker of ['<link', '<script']) assert.ok(html.indexOf(marker) > at, marker);
});

test('index.html: idioma, viewport accesible, noscript y tema de color', () => {
  assert.match(html, /<html lang="es"/);
  assert.match(html, /<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">/);
  assert.doesNotMatch(html, /maximum-scale|user-scalable\s*=\s*no/i);
  assert.match(html, /<noscript>[\s\S]*JavaScript[\s\S]*<\/noscript>/);
  assert.match(html, /<meta name="theme-color" content="#070a1d">/);
  assert.match(html, /<div id="app">[\s\S]*<p id="boot"/);
});

test('index.html: sin <style>, style="", on*= ni scripts en línea; main.js es módulo y boot-check clásico con defer', () => {
  assert.doesNotMatch(html, /<style[\s>]/i);
  assert.doesNotMatch(html.replace(/<noscript>[\s\S]*?<\/noscript>/, ''), /\sstyle\s*=/i);
  assert.doesNotMatch(html, /\son[a-z]+\s*=/i);
  const scripts = [...html.matchAll(/<script\b([^>]*)>/gi)].map((m) => m[1]);
  assert.equal(scripts.length, 2);
  assert.ok(scripts.every((a) => /\bsrc="/.test(a)));
  assert.ok(scripts.some((a) => /type="module"/.test(a) && /src="app\/main\.js"/.test(a)));
  assert.ok(scripts.some((a) => !/type=/.test(a) && /defer/.test(a) && /src="app\/boot-check\.js"/.test(a)));
});

test('index.html: los 5 estilos van en el orden tokens → themes → base → components → widgets y todos los archivos existen', () => {
  const hrefs = [...html.matchAll(/<link rel="stylesheet" href="([^"]+)">/g)].map((m) => m[1]);
  assert.deepEqual(hrefs, ['ui/styles/tokens.css', 'ui/styles/themes.css', 'ui/styles/base.css', 'ui/styles/components.css', 'ui/styles/widgets.css']);
  for (const f of [...hrefs, 'app/main.js', 'app/boot-check.js']) assert.ok(fs.existsSync(path.join(root, f)), f);
  assert.doesNotMatch(html, /https?:\/\//i);
});

test('registro de vistas: cada ruta del router tiene su vista y cada vista tiene mount y destroy', () => {
  for (const r of ROUTES) assert.equal(typeof VIEWS[r.name], 'function', r.name);
  for (const make of Object.values(VIEWS)) {
    const v = make();
    assert.equal(typeof v.mount, 'function');
    assert.equal(typeof v.destroy, 'function');
  }
});

// ---------- boot-check ----------
function runBootCheck({ booted }) {
  const env = makeEnv();
  const timers = makeTimers();
  if (booted) env.doc.documentElement.setAttribute('data-booted', '1');
  const win = { setTimeout: timers.setTimeout, location: env.win.location };
  vm.runInNewContext(fs.readFileSync(path.join(root, 'app', 'boot-check.js'), 'utf8'), { window: win, document: { ...env.doc, getElementById: env.doc.getElementById, createElement: env.doc.createElement, documentElement: env.doc.documentElement } });
  return { env, timers };
}

test('boot-check: si la app no arrancó a los 5 s, muestra un botón Recargar; si arrancó, no toca nada', () => {
  const bad = runBootCheck({ booted: false });
  bad.timers.advance(4999);
  assert.equal(bad.env.doc.getElementById('boot').querySelectorAll('button').length, 0);
  bad.timers.advance(2);
  const btn = bad.env.doc.getElementById('boot').querySelector('button');
  assert.equal(btn.textContent, 'Recargar');
  assert.ok(bad.env.doc.getElementById('boot').textContent.includes('no terminó de cargar'));
  btn.dispatchEvent({ type: 'click' });
  assert.equal(bad.env.win.reloads, 1);

  const good = runBootCheck({ booted: true });
  good.timers.advance(10000);
  assert.equal(good.env.doc.getElementById('boot').textContent, '');
});

// ---------- tema ----------
test('tema: THEMES, isTheme y suggestedTheme (claro/aurora, matchMedia ausente o que lanza)', () => {
  assert.deepEqual(THEMES, ['aurora', 'neo', 'claro']);
  assert.ok(isTheme('neo') && !isTheme('rojo') && !isTheme(null) && !isTheme(5));
  assert.equal(suggestedTheme((q) => ({ matches: q.includes('light') })), 'claro');
  assert.equal(suggestedTheme(() => ({ matches: false })), 'aurora');
  assert.equal(suggestedTheme(null), 'aurora');
  const logged = [];
  const orig = console.error;
  console.error = (...a) => logged.push(a);
  try {
    assert.equal(suggestedTheme(() => { throw new Error('sin soporte'); }), 'aurora');
  } finally { console.error = orig; }
  assert.equal(logged.length, 1);
});

test('tema: initialTheme prefiere ?tema= válido; applyTheme escribe data-theme y theme-color; tema desconocido lanza', () => {
  assert.equal(initialTheme(makeEnv({ search: '?tema=claro' }).win), 'claro');
  assert.equal(initialTheme(makeEnv({ search: '?tema=zzz', light: true }).win), 'claro');
  assert.equal(initialTheme({ location: {}, matchMedia: undefined }), 'aurora');
  const env = makeEnv();
  applyTheme(env.doc, env.win, 'neo');
  assert.equal(env.doc.documentElement.getAttribute('data-theme'), 'neo');
  assert.equal(env.doc.querySelector('meta[name="theme-color"]').getAttribute('content'), '#070a1d');
  assert.throws(() => applyTheme(env.doc, env.win, 'rojo'), /Tema desconocido/);
});
