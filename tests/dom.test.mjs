// @purpose: Pruebas de ui/dom.js (h, hs, esc, on, qs) con DOM falso, incluido el escape contra XSS.
// Pruebas de ui/dom.js (subparte 0.4): h(), hs(), esc(), on(), qs() con DOM falso. Incluye XSS.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { h as domH, esc, on, qs } from '../ui/dom.js';
import { makeEnv } from './_fakeDom.mjs';

const mk = () => {
  const env = makeEnv();
  return { ...env, ...domH.with(env.doc) };
};

test('h: crea elemento con clase, atributos, dataset, estilo CSSOM e hijos anidados', () => {
  const { h } = mk();
  const el = h('div', { class: ['a', false, 'b'], id: 'x', 'aria-label': 'Hola', hidden: true, dataset: { tab: 'hoy' }, style: { '--value': 60 } },
    'texto', ['uno', ['dos', null, false]], h('span', 'hijo'));
  assert.equal(el.getAttribute('class'), 'a b');
  assert.equal(el.getAttribute('aria-label'), 'Hola');
  assert.equal(el.getAttribute('hidden'), '');
  assert.equal(el.dataset.tab, 'hoy');
  assert.equal(el.style.getPropertyValue('--value'), '60');
  assert.equal(el.textContent, 'textounodoshijo');
});

test('h: atajos h(tag, "texto") y h(tag, [hijos]) sin objeto de propiedades', () => {
  const { h } = mk();
  assert.equal(h('p', 'hola').textContent, 'hola');
  assert.equal(h('p', ['a', 'b']).textContent, 'ab');
  assert.equal(h('p', null, 5, 0).textContent, '50');
  assert.equal(h('p').childNodes.length, 0);
});

test('h: atributos false/null/undefined no se escriben; números y true sí', () => {
  const { h } = mk();
  const el = h('input', { disabled: false, readonly: true, rows: 6, title: null, alt: undefined });
  assert.equal(el.hasAttribute('disabled'), false);
  assert.equal(el.getAttribute('readonly'), '');
  assert.equal(el.getAttribute('rows'), '6');
  assert.equal(el.hasAttribute('title') || el.hasAttribute('alt'), false);
});

test('h: onClick (o onclick) con función registra el listener y se dispara', () => {
  const { h, stats } = mk();
  let n = 0;
  const b = h('button', { onClick: () => { n += 1; } });
  b.dispatchEvent({ type: 'click' });
  assert.equal(n, 1);
  assert.equal(stats.live(), 1);
});

test('XSS: texto con etiquetas queda como TEXTO; no se crea ningún elemento', () => {
  const { h } = mk();
  const evil = '<img src=x onerror=alert(1)><script>alert(2)</script>';
  const p = h('p', evil);
  assert.equal(p.children.length, 0);
  assert.equal(p.textContent, evil);
  assert.ok(!p.outerHTML.includes('<img'), p.outerHTML);
  assert.ok(p.outerHTML.includes('&lt;img'));
});

test('XSS: html/innerHTML/outerHTML/srcdoc, on* con texto y URLs javascript: lanzan error', () => {
  const { h } = mk();
  for (const p of [{ html: '<b>' }, { innerHTML: '<b>' }, { outerHTML: '<b>' }, { srcdoc: '<b>' }]) assert.throws(() => h('div', p), /no está permitida/);
  assert.throws(() => h('div', { onclick: 'alert(1)' }), /debe ser una función/);
  assert.throws(() => h('a', { href: 'javascript:alert(1)' }), /URL no permitida/);
  assert.throws(() => h('a', { href: ' JaVa\tScRiPt:alert(1)' }), /URL no permitida/);
  assert.throws(() => h('a', { href: 'data:text/html,<script>x</script>' }), /URL no permitida/);
  assert.doesNotThrow(() => h('a', { href: '#/hoy' }));
  assert.doesNotThrow(() => h('a', { href: 'https://example.com/a?b=1' }));
});

test('h: etiqueta inválida y style como texto lanzan error claro', () => {
  const { h } = mk();
  for (const bad of ['', 'div onclick=x', '<div>', 5, null]) assert.throws(() => h(bad), /etiqueta inválido/);
  assert.throws(() => h('div', { style: 'color:red' }), /style debe ser un objeto/);
});

test('hs: crea elementos SVG con espacio de nombres SVG', () => {
  const { hs } = mk();
  const svg = hs('svg', { viewBox: '0 0 24 24' }, hs('path', { d: 'M0 0' }));
  assert.equal(svg.namespaceURI, 'http://www.w3.org/2000/svg');
  assert.equal(svg.children[0].getAttribute('d'), 'M0 0');
});

test('esc: escapa los 5 caracteres y tolera null, undefined y números', () => {
  assert.equal(esc(`<a href="x">Tom & 'Jerry'</a>`), '&lt;a href=&quot;x&quot;&gt;Tom &amp; &#39;Jerry&#39;&lt;/a&gt;');
  assert.equal(esc(null), '');
  assert.equal(esc(undefined), '');
  assert.equal(esc(42), '42');
  assert.equal(esc('canción ñ 😀 ’'), 'canción ñ 😀 ’');
  assert.equal(esc(esc('<')), '&amp;lt;');
});

test('on: añade y quita el listener; quitar dos veces no falla; entradas inválidas lanzan', () => {
  const { h, stats } = mk();
  const b = h('button');
  let n = 0;
  const off = on(b, 'click', () => { n += 1; });
  b.dispatchEvent({ type: 'click' });
  off();
  off();
  b.dispatchEvent({ type: 'click' });
  assert.equal(n, 1);
  assert.equal(stats.live(), 0);
  assert.throws(() => on(null, 'click', () => {}), /no es un elemento/);
  assert.throws(() => on(b, 'click', 'x'), /función/);
});

test('qs: busca con raíz opcional', () => {
  const { h, doc } = mk();
  const root = h('div', h('p', { class: 'x' }, 'a'));
  assert.equal(qs('.x', root).textContent, 'a');
  assert.equal(qs('.nada', root), null);
  void doc;
});

test('texto largo (1000+ caracteres) con acentos, emoji y comillas curvas se conserva exacto', () => {
  const { h } = mk();
  const s = 'ñandú “comillas” ’ 😀 '.repeat(60);
  assert.ok(s.length > 1000);
  assert.equal(h('p', s).textContent, s);
});
