#!/usr/bin/env python3
# @purpose: Verificación opcional en Chromium real (360 px) del componente de construir con piezas y, con --bars, de que toda pieza de las 4 barras fijas (ordenar, emparejar, banco y construir) se puede dejar por encima de la barra: toques de 44 px, sin desbordes, bandeja fija, marcas ✓/✗ con texto, piezas de más, comprobar, «No sé», deshacer y error de envío.
"""Verificación visual y de accesibilidad del componente `buildPieces` (subparte 2.4, tramo 3, punto 4c). NO forma parte de `npm run check`.

Monta el componente REAL (ui/exercises/buildPieces.js) en una página anfitriona inyectada en memoria, bajo la misma CSP de la app,
a 360x640, en los 3 temas y con el texto en «Normal» y «Muy grande». Casos: `letras` (palabra de 6 letras con 2 de más, `unscramble_letters`),
`frase` (5 piezas con 2 de más), `maximo` (12 piezas con 4 de más, el tope del contrato) y `largo` (una pieza larguísima). Para cada caso comprueba:
  - sin desbordes horizontales, objetivos táctiles de al menos 44 px (piezas y botones), sin palabras partidas en los botones,
  - «No sé» DENTRO de la pantalla sin desplazarse, y dos grupos con nombre (la respuesta y «Piezas»),
  - colocar la primera pieza no cambia el alto de la zona de respuesta y la bandeja NO cambia de sitio (en `largo` solo se avisa: una pieza enorme puede recolocar),
  - «Comprobar» con una pieza menos de las necesarias no envía y avisa,
  - deshacer y empezar de nuevo vacían la respuesta paso a paso,
  - orden mal: envía un solo `wrong`, marca las piezas fuera de lugar (nombre accesible con «✗», borde rojo) y muestra la respuesta correcta,
  - mezcla (las dos últimas cambiadas): el resto lleva «✓» y las dos cambiadas «✗»,
  - pieza de más usada: envía `wrong` y dice «Sobra» con texto,
  - todo bien: un solo `correct` con `responseRaw` igual a la respuesta (sin espacio con letras, con un espacio con palabras); tras responder las acciones se ocultan,
  - «No sé»: envía `dont_know`, muestra la respuesta y no marca ninguna pieza,
  - error de envío (caso `frase`): aparece el aviso y se puede volver a comprobar sin perder nada,
  - sin errores de consola.
Guarda capturas (por defecto en /tmp/build-shots: fuera del repo, TRAMPA-33). Sale con código 1 si algo falla y con 2 si Playwright no está instalado.

Modo `--bars` (2.4-T4, respuesta 7 del Administrador): las 4 barras de acciones (`.ob__actions`, `.ma__actions`, `.cb__actions`, `.bp__actions`) comparten CSS y son fijas (sticky)
sobre la navegación. Con el MÁXIMO de piezas del contrato (ordenar 12, diálogo 8, emparejar 10 + 2, banco 6 huecos + 2, construir 12 + 4, letras 12 + 4), a 360x640 y con
«Normal» y «Muy grande», comprueba para CADA pieza (bandeja, respuesta, huecos y tarjetas) que existe una posición de desplazamiento en la que queda entera por encima
de la barra y dentro de la pantalla; lo hace al empezar y con todas las piezas ya colocadas. Si alguna no se puede dejar libre, o si la barra ocupa más del 40 % de la pantalla (256 px de 640), falla. Anota la altura de la barra.
No exige un relleno inferior: la medición mostró que al final del desplazamiento ninguna pieza queda tapada (DECISIONS.md).

Uso:  python3 tools/build-check.py [--out /tmp/build-shots] [--cases letras,frase,maximo,largo] [--themes aurora,neo,claro] [--sizes normal,xlarge]
      python3 tools/build-check.py --bars [--cases ordenar,dialogo,emparejar,banco,construir,letras] [--themes aurora] [--sizes normal,xlarge]
"""
import argparse
import http.server
import json
import os
import re
import socketserver
import sys
import threading

CSP = ("default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; font-src 'self'; connect-src 'self'; "
       "object-src 'none'; base-uri 'none'; form-action 'none'")
THEMES = ['aurora', 'neo', 'claro']
SIZES = ['normal', 'xlarge']
LONG = 'supercalifragilisticoespialidosoextraordinariamenteinterminable'
# Por caso: tipo, piezas de la respuesta (en orden), piezas de más y unión esperada.
CASE_DEFS = {
    'letras': {'type': 'unscramble_letters', 'pieces': list('orange'), 'extra': ['z', 'k'], 'prompt': 'Forma la palabra «naranja».', 'situation': 'Frutas'},
    'frase': {'type': 'build_from_keywords', 'pieces': ['She', 'drinks', 'coffee', 'every', 'morning'], 'extra': ['drink', 'are'], 'prompt': 'Arma la frase: ella bebe café cada mañana.', 'situation': 'Rutina diaria'},
    'maximo': {'type': 'build_from_keywords', 'pieces': ['We', 'went', 'to', 'the', 'old', 'park', 'and', 'played', 'with', 'our', 'new', 'kite'],
               'extra': ['goes', 'is', 'was', 'an'], 'prompt': 'Arma la frase con las 12 piezas.', 'situation': 'Ayer'},
    'largo': {'type': 'build_from_keywords', 'pieces': ['Nobody', 'can', 'say', LONG], 'extra': ['sai', 'sey'], 'prompt': 'Arma la frase, incluso con la pieza larga.', 'situation': 'Palabras enormes'},
}
CASES = list(CASE_DEFS)
ITEMS = {k: {'id': f'chk.{k}', 'type': d['type'], 'prompt_es': d['prompt'], 'situation': d['situation'], 'data': {'pieces': d['pieces'], 'extra_pieces': d['extra']}} for k, d in CASE_DEFS.items()}

HOST_HTML = r"""<!doctype html>
<html lang="es" data-theme="aurora"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<link rel="stylesheet" href="/ui/styles/tokens.css"><link rel="stylesheet" href="/ui/styles/themes.css">
<link rel="stylesheet" href="/ui/styles/base.css"><link rel="stylesheet" href="/ui/styles/components.css">
<link rel="stylesheet" href="/ui/styles/widgets.css"></head>
<body><div class="app-shell"><main class="app-main" id="slot"></main></div><script type="module" src="/__host.js"></script></body></html>"""

HOST_JS = r"""
import { createBuildPieces } from '/ui/exercises/buildPieces.js';
import { createRng } from '/core/rng.js';
const ITEMS = __ITEMS__;
let current = null;
window.__calls = [];
window.__fail = false;
window.mountCase = (name) => {
  if (current) current.destroy();
  window.__calls = [];
  window.__fail = false;
  document.getElementById('slot').replaceChildren();
  const comp = createBuildPieces({ rng: createRng(7) });
  current = comp.mount(document.getElementById('slot'), ITEMS[name],
    { doc: document, win: window, submit: async (a) => { window.__calls.push(a); return window.__fail ? { status: 'error', message: 'No se pudo guardar. Inténtalo de nuevo.' } : { status: 'saved' }; } });
  return true;
};
window.__ready = true;
""".replace('__ITEMS__', json.dumps(ITEMS, ensure_ascii=False))

# Modo --bars: por caso, la barra, los selectores de piezas y los datos del máximo del contrato (los mismos topes que tests/family24ScreenFuzz.test.mjs).
BAR_CASES = {
    'ordenar': {'bar': '.ob__actions', 'pieces': '.ob__tray .ob__block, .ob__line .ob__block', 'taps': '.ob__tray .ob__block'},
    'dialogo': {'bar': '.ob__actions', 'pieces': '.ob__tray .ob__block, .ob__line .ob__block', 'taps': '.ob__tray .ob__block'},
    'emparejar': {'bar': '.ma__actions', 'pieces': '.ma__card', 'taps': None},
    'banco': {'bar': '.cb__actions', 'pieces': '.cb__tray .cb__word, .cb__gap', 'taps': '.cb__tray .cb__word'},
    'construir': {'bar': '.bp__actions', 'pieces': '.bp__tray .bp__piece, .bp__line .bp__piece', 'taps': '.bp__tray .bp__piece'},
    'letras': {'bar': '.bp__actions', 'pieces': '.bp__tray .bp__piece, .bp__line .bp__piece', 'taps': '.bp__tray .bp__piece'},
}
BARS_JS = r"""
import { createOrderBlocks } from '/ui/exercises/orderBlocks.js';
import { createMatchPairs } from '/ui/exercises/matchPairs.js';
import { createClozeBank } from '/ui/exercises/clozeBank.js';
import { createBuildPieces } from '/ui/exercises/buildPieces.js';
import { createRng } from '/core/rng.js';
const range = (n) => Array.from({ length: n }, (_, i) => i);
const WORDS = ['Yesterday', 'my', 'older', 'brother', 'and', 'I', 'went', 'to', 'the', 'new', 'market', 'together'];
const ITEMS = {
  ordenar: { id: 'bar.ordenar', type: 'order_blocks', prompt_es: 'Ordena la frase.', situation: 'Prueba', data: { blocks: WORDS } },
  dialogo: { id: 'bar.dialogo', type: 'order_dialogue', prompt_es: 'Ordena el diálogo.', data: { lines: range(8).map((i) => ({ speaker: i % 2 ? 'Ana' : 'Ben', text: 'Esta es la línea número ' + (i + 1) + ' del diálogo de prueba' })) } },
  emparejar: { id: 'bar.emparejar', type: 'match_pairs', prompt_es: 'Une cada palabra.', data: { pairs: range(10).map((i) => ({ left: 'palabra ' + i, right: 'significado ' + i })), extra_right: ['sobra uno', 'sobra dos'] } },
  banco: { id: 'bar.banco', type: 'cloze_bank', prompt_es: 'Completa la frase.', data: { text: range(6).map((i) => 'parte ' + i + ' ___').join(' ') + ' fin.', answers: range(6).map((i) => ['resp' + i]), bank: [...range(6).map((i) => 'resp' + i), 'x1', 'x2'] } },
  construir: { id: 'bar.construir', type: 'build_from_keywords', prompt_es: 'Construye la frase.', situation: 'Ayer', data: { pieces: WORDS, extra_pieces: ['goes', 'is', 'was', 'an'] } },
  letras: { id: 'bar.letras', type: 'unscramble_letters', prompt_es: 'Forma la palabra.', data: { pieces: 'abcdefghijkl'.split(''), extra_pieces: ['z', 'y', 'w', 'v'] } },
};
const MAKERS = { ordenar: createOrderBlocks, dialogo: createOrderBlocks, emparejar: createMatchPairs, banco: createClozeBank, construir: createBuildPieces, letras: createBuildPieces };
let current = null;
window.mountBar = (name) => {
  if (current) current.destroy();
  document.getElementById('slot').replaceChildren();
  window.scrollTo({ top: 0, behavior: 'instant' });
  current = MAKERS[name]({ rng: createRng(7) }).mount(document.getElementById('slot'), ITEMS[name], { doc: document, win: window, submit: async () => ({ status: 'saved' }) });
  return true;
};
window.__ready = true;
"""

# Para cada pieza visible: ¿hay una posición de desplazamiento con la pieza entera dentro de la pantalla y por encima de la barra? Barre de 8 en 8 px.
REACH = r"""([pieceSel, barSel]) => {
  const bar = document.querySelector(barSel);
  const pieces = [...document.querySelectorAll(pieceSel)].filter((e) => e.getBoundingClientRect().width > 0 && !e.classList.contains('is-used'));
  const vh = window.innerHeight;
  const maxY = Math.max(0, document.documentElement.scrollHeight - vh);
  const out = { pieces: pieces.length, unreachable: [], atEndCovered: 0, bar: Math.round(bar.getBoundingClientRect().height), maxY };
  const docTops = pieces.map((e) => { const r = e.getBoundingClientRect(); return [r.top + window.scrollY, r.height, (e.textContent || '').trim().slice(0, 16)]; });
  const jump = (y) => window.scrollTo({ top: y, left: 0, behavior: 'instant' });  // base.css puede tener scroll-behavior: smooth: sin «instant» el desplazamiento no se aplica a tiempo
  const barDoc = (y) => { jump(y); const b = bar.getBoundingClientRect(); return [b.top, b.bottom]; };
  for (const [top, h, label] of docTops) {
    let ok = false;
    for (let y = 0; y <= maxY + 8 && !ok; y += 8) {
      const sy = Math.min(y, maxY);
      const [bt] = barDoc(sy);
      const t = top - window.scrollY;
      if (t >= 0 && t + h <= bt + 0.5 && t + h <= vh) ok = true;
    }
    if (!ok) out.unreachable.push(label);
  }
  jump(maxY);
  const bt = bar.getBoundingClientRect().top;
  for (const [top, h] of docTops) { const t = top - window.scrollY; if (t + h > bt + 0.5 && t < bar.getBoundingClientRect().bottom) out.atEndCovered += 1; }
  jump(0);
  return out;
}"""

MEASURE = r"""() => {
  const vw = document.documentElement.clientWidth;
  const out = { vw, scrollW: document.documentElement.scrollWidth, small: [], over: [], split: [] };
  for (const el of document.querySelectorAll('button, input, .btn')) {
    const r = el.getBoundingClientRect();
    if (r.width === 0 || r.height === 0) continue;
    if (r.height < 43.5 || r.width < 43.5) out.small.push([el.tagName, (el.textContent || '').trim().slice(0, 20), Math.round(r.width), Math.round(r.height)]);
  }
  for (const el of document.querySelectorAll('body *')) {
    const r = el.getBoundingClientRect();
    if (r.width && (r.right > vw + 0.5 || r.left < -0.5)) out.over.push([el.tagName, String(el.className).slice(0, 30), Math.round(r.left), Math.round(r.right)]);
  }
  for (const el of document.querySelectorAll('.btn')) {
    const node = [...el.childNodes].flatMap((n) => (n.nodeType === 3 ? [n] : [...n.childNodes].filter((m) => m.nodeType === 3)))[0];
    if (!node) continue;
    for (const m of node.data.matchAll(/\S+/g)) {
      const rg = document.createRange(); rg.setStart(node, m.index); rg.setEnd(node, m.index + m[0].length);
      if (new Set([...rg.getClientRects()].map((x) => Math.round(x.top))).size > 1) out.split.push(m[0]);
    }
  }
  return out;
}"""

TRAY_POS = r"""() => [...document.querySelectorAll('.bp__tray .bp__piece')].map((b) => { const r = b.getBoundingClientRect(); return [b.dataset.index, Math.round(r.left), Math.round(r.top + window.scrollY)].join(':'); })"""
LINE_H = r"""() => Math.round(document.querySelector('.bp__line').getBoundingClientRect().height * 10) / 10"""
BTN_BOX = r"""(label) => { const b = [...document.querySelectorAll('button')].find((x) => x.textContent.trim() === label); if (!b) return null; const r = b.getBoundingClientRect(); return { top: r.top, bottom: r.bottom, vh: window.innerHeight, shown: r.width > 0 }; }"""

STYLE = r"""(sel) => { const e = document.querySelector(sel); if (!e) return null; const s = getComputedStyle(e);
  return { bs: s.borderTopStyle, bw: s.borderTopWidth, bc: s.borderTopColor, bg: s.backgroundColor, cur: s.cursor, minH: s.minHeight, minW: s.minWidth, ow: s.overflowWrap, ta: s.textAlign,
    br: s.borderTopLeftRadius, pos: s.position, disp: s.display, cg: s.columnGap, rg: s.rowGap, fw: s.flexWrap, fd: s.flexDirection, tt: s.textTransform, color: s.color, pe: s.pointerEvents, w: s.width, fs: s.fontSize, fwt: s.fontWeight, pad: s.paddingTop + ' ' + s.paddingRight + ' ' + s.paddingBottom + ' ' + s.paddingLeft, mg: s.marginTop + ' ' + s.marginBottom, zi: s.zIndex, bot: s.bottom, tp: s.transitionProperty, oo: s.outlineOffset, bw1: s.borderTopWidth, mw: s.maxWidth, lh: s.lineHeight, ls: s.letterSpacing, ab: s.alignItems, fx: s.flexGrow + ' ' + s.flexShrink, mnw: s.minWidth, bgcol: s.backgroundColor, bsz: s.boxSizing, wb: s.wordBreak, hy: s.hyphens }; }"""
TOK_COLOR = r"""(name) => { const e = document.createElement('i'); document.body.appendChild(e); e.style.color = 'var(' + name + ')'; const c = getComputedStyle(e).color; e.remove(); return c; }"""
TOK_BG = r"""(name) => { const e = document.createElement('i'); document.body.appendChild(e); e.style.backgroundColor = 'var(' + name + ')'; const c = getComputedStyle(e).backgroundColor; e.remove(); return c; }"""
TOK_LEN = r"""(name) => { const e = document.createElement('i'); e.style.display = 'block'; e.style.position = 'absolute'; document.body.appendChild(e); e.style.width = name.startsWith('--') ? 'var(' + name + ')' : name; const c = getComputedStyle(e).width; e.remove(); return c; }"""

TOK_WEIGHT = r"""(name) => { const e = document.createElement('i'); document.body.appendChild(e); e.style.fontWeight = 'var(' + name + ')'; const c = getComputedStyle(e).fontWeight; e.remove(); return c; }"""
TOK_Z = r"""(name) => { const e = document.createElement('i'); e.style.position = 'relative'; document.body.appendChild(e); e.style.zIndex = 'var(' + name + ')'; const c = getComputedStyle(e).zIndex; e.remove(); return c; }"""
TOK_LH = r"""(name) => { const e = document.createElement('i'); e.style.display = 'block'; e.style.fontSize = '16px'; document.body.appendChild(e); e.style.lineHeight = 'var(' + name + ')'; const c = getComputedStyle(e).lineHeight; e.remove(); return c; }"""


def settle(page):
    page.wait_for_timeout(260)  # deja terminar las transiciones de fondo y borde (--dur-fast); si no, se leen colores a medio camino


def ratio(st):
    return round(float(st['lh'][:-2]) / float(st['fs'][:-2]), 2) if st['lh'].endswith('px') else None


def style_of(page, sel, wait=False):
    if wait:
        settle(page)
    return page.evaluate(STYLE, sel)


def expect(problems, tag, what, got, want):
    if got != want:
        problems.append(f'{tag}: estilo de {what}: {got!r} ≠ {want!r}')


def style_initial(page, tag, letters, problems):
    c = lambda n: page.evaluate(TOK_COLOR, n)
    l = lambda n: page.evaluate(TOK_LEN, n)
    root = style_of(page, '.bp')
    expect(problems, tag, '.bp (columna)', (root['disp'], root['fd'], root['rg']), ('flex', 'column', l('--space-3')))
    sit = style_of(page, '.bp__situation')
    expect(problems, tag, 'situación (mayúsculas)', sit['tt'], 'uppercase')
    pc = style_of(page, '.bp__prompt')
    expect(problems, tag, 'enunciado (negrita, tamaño)', (pc['fs'], int(pc['fwt']) >= 600), (l('--text-lg'), True))
    line = style_of(page, '.bp__line')
    expect(problems, tag, 'zona de respuesta (borde)', (line['bs'], line['bw'], line['bc'], line['pos'], line['fw'], line['disp']), ('dashed', '2px', c('--border-input'), 'relative', 'wrap', 'flex'))
    gap = l('--space-1') if letters else l('--space-2')
    expect(problems, tag, 'huecos de la zona de respuesta y la bandeja', (line['cg'], line['rg'], style_of(page, '.bp__tray')['cg'], style_of(page, '.bp__tray')['fw']), (gap, l('--space-2') if not letters else line['rg'], gap, 'wrap'))
    em = style_of(page, '.bp__empty')
    expect(problems, tag, 'texto de zona vacía (posición absoluta, sin clics)', (em['pos'], em['pe']), ('absolute', 'none'))
    sp = style_of(page, '.bp__spacer')
    expect(problems, tag, 'espaciador (sin ancho)', sp['w'], '0px')
    pc = style_of(page, '.bp__tray .bp__piece:not(.is-used)')
    expect(problems, tag, 'pieza libre (borde de reposo)', (pc['bs'], pc['bw'], pc['bc'], pc['br'], pc['cur']), ('solid', '2px', c('--border-input'), l('--radius-md'), 'pointer'))
    expect(problems, tag, 'pieza libre (objetivo táctil, ajuste y centrado)', (pc['minH'], pc['minW'], pc['ow'], pc['ta']), (l('--touch-min'), l('--touch-min'), 'anywhere', 'center'))
    act = style_of(page, '.bp__actions')
    expect(problems, tag, 'barra de acciones (fija)', act['pos'], 'sticky')
    expect(problems, tag, 'avisos vacíos ocultos', (style_of(page, '.bp__msg')['disp'], style_of(page, '.bp__feedback')['disp']), ('none', 'none'))
    expect(problems, tag, 'herramientas y botones (en línea que baja)', (style_of(page, '.bp__tools')['disp'], style_of(page, '.bp__tools')['fw'], style_of(page, '.bp__buttons')['disp'], style_of(page, '.bp__buttons')['fw']), ('flex', 'wrap', 'flex', 'wrap'))
    zero = '0px 0px'
    for sel in ['.bp__situation', '.bp__prompt', '.bp__instruction', '.bp__empty']:
        expect(problems, tag, f'{sel} (márgenes en cero)', style_of(page, sel)['mg'], zero)
    expect(problems, tag, 'enunciado (se ajusta, interlineado)', (style_of(page, '.bp__prompt')['ow'], style_of(page, '.bp__prompt')['lh'] != 'normal'), ('anywhere', True))
    expect(problems, tag, 'situación e instrucción (color atenuado y tamaño)', (style_of(page, '.bp__situation')['color'], style_of(page, '.bp__instruction')['color'], style_of(page, '.bp__situation')['fs'], style_of(page, '.bp__instruction')['fs']), (c('--text-muted'), c('--text-muted'), l('--text-sm'), l('--text-sm')))
    expect(problems, tag, 'zona de respuesta (relleno, radio, ancho mínimo)', (line['pad'], line['br'], line['mnw']), (' '.join([l('--space-2')] * 4), l('--radius-md'), '0px'))
    # Alto reservado: al menos una pieza táctil + relleno 16 + borde 4 (con «Muy grande» crece con el texto; que no cambie al colocar se comprueba en el paso 2).
    reserved = page.evaluate("() => Math.round(document.querySelector('.bp__line').getBoundingClientRect().height)")
    if reserved < round(float(l('--touch-min')[:-2])) + 16 + 4:
        problems.append(f'{tag}: la zona de respuesta vacía no reserva el alto de una pieza ({reserved} px)')
    expect(problems, tag, 'texto vacío (color y tamaño)', (em['color'], em['fs']), (c('--text-muted'), l('--text-sm')))
    off = page.evaluate("() => { const e = document.querySelector('.bp__empty').getBoundingClientRect(); const b = document.querySelector('.bp__line').getBoundingClientRect(); return [Math.round((e.left - b.left) * 10) / 10, Math.round(((e.top + e.bottom) / 2 - (b.top + b.bottom) / 2) * 10) / 10]; }")
    expect(problems, tag, 'texto vacío (a la izquierda y centrado en vertical)', (off[0], abs(off[1]) <= 1), (round(float(l('--space-3')[:-2]) + 2, 1), True))
    sp = style_of(page, '.bp__spacer')
    expect(problems, tag, 'espaciador (alto y bloque)', (sp['minH'], sp['disp']), (l('--touch-min'), 'block'))
    expect(problems, tag, 'pieza libre (relleno, fondo, color, ajuste, ancho máximo)', (pc['pad'], pc['bg'], pc['color'], pc['mw']), ((' '.join([l('--space-2'), l('--space-2' if letters else '--space-4')] * 2)), page.evaluate(TOK_BG, '--surface'), c('--text'), '100%'))
    expect(problems, tag, 'pieza libre (transición de fondo y borde)', ('background' in pc['tp'], 'border-color' in pc['tp']), (True, True))
    expect(problems, tag, 'pieza libre (tamaño de texto)', pc['fs'], l('--text-base'))
    for tries in range(8):
        page.keyboard.press('Tab')
        if page.evaluate("() => document.activeElement.classList.contains('bp__piece')"):
            break
    expect(problems, tag, 'foco con teclado en una pieza (separación del borde)', page.evaluate("() => document.activeElement.classList.contains('bp__piece') ? getComputedStyle(document.activeElement).outlineOffset : null"), '2px')
    expect(problems, tag, 'barra de acciones (borde, radio, fondo, columna, relleno, hueco)', (act['bw1'], act['br'], act['bg'], act['fd'], act['pad'], act['rg'], act['disp']),
           ('1px', l('--radius-md'), page.evaluate(TOK_BG, '--surface-solid'), 'column', ' '.join([l('--space-2')] * 4), l('--space-2'), 'flex'))
    expect(problems, tag, 'barra de acciones (z-index y separación inferior)', (act['zi'], act['bot']), (page.evaluate(TOK_Z, '--z-raised'), l('calc(var(--nav-h) + var(--nav-gap) + var(--safe-bottom) + var(--space-3))')))
    tools = style_of(page, '.bp__tools')
    buttons = style_of(page, '.bp__buttons')
    expect(problems, tag, 'herramientas y botones (huecos)', (tools['cg'], tools['rg'], buttons['cg'], buttons['rg']), (l('--space-2'),) * 4)
    for sel in ['.bp__tools .btn', '.bp__buttons .btn']:
        b = style_of(page, sel)
        expect(problems, tag, f'{sel} (crecen, no se parten)', (b['fx'].split(' ')[0], b['mnw'] != '0px', b['ow'] == 'normal'), ('1', True, True))
    expect(problems, tag, 'avisos vacíos (márgenes)', (style_of(page, '.bp__msg')['mg'], style_of(page, '.bp__feedback')['rg']), (zero, l('--space-2')))
    expect(problems, tag, 'respuesta en construcción (dirección de la columna de comentarios)', (style_of(page, '.bp__feedback')['fd'], style_of(page, '.bp__feedback')['mnw']), ('column', '0px'))
    expect(problems, tag, 'bandeja (contenedor flex que baja)', (style_of(page, '.bp__tray')['disp'], style_of(page, '.bp__tray')['mnw']), ('flex', '0px'))
    expect(problems, tag, '.bp (ancho mínimo)', style_of(page, '.bp')['mnw'], '0px')

    # Mediciones añadidas en 4-d (roturas vivas): propiedades que un valor heredado o por defecto ocultaba.
    snug = 1.35
    expect(problems, tag, 'situación (espaciado de letras)', style_of(page, '.bp__situation')['ls'] != 'normal', True)
    expect(problems, tag, 'interlineado de enunciado, espaciador y pieza', (ratio(style_of(page, '.bp__prompt')), ratio(style_of(page, '.bp__spacer')), ratio(pc)), (snug, snug, snug))
    expect(problems, tag, 'zona de respuesta (alineación, caja y alto mínimo)', (line['ab'], line['bsz'], line['minH']), ('flex-start', 'border-box', l('calc(var(--touch-min) + var(--space-4) + 4px)')))
    sp = style_of(page, '.bp__spacer')
    expect(problems, tag, 'espaciador (caja, relleno, borde, tamaño de texto)', (sp['bsz'], sp['pad'], sp['bw1'], sp['bs'], sp['bc'], sp['fs']), ('border-box', ' '.join([l('--space-2'), '0px', l('--space-2'), '0px']), '2px', 'solid', 'rgba(0, 0, 0, 0)', l('--text-base')))
    for sel in ['.bp__tools .btn', '.bp__buttons .btn']:
        expect(problems, tag, f'{sel} (ancho mínimo por contenido)', style_of(page, sel)['mnw'], 'min-content')
    page.evaluate("() => { const e = document.querySelector('.bp'); e.style.wordBreak = 'break-all'; e.style.hyphens = 'auto'; e.style.overflowWrap = 'anywhere'; }")
    for sel in ['.bp__tools .btn', '.bp__buttons .btn']:
        b = style_of(page, sel)
        expect(problems, tag, f'{sel} (no heredan corte de palabra ni guiones)', (b['wb'], b['hy'], b['ow']), ('normal', 'none', 'normal'))
    page.evaluate("() => { const e = document.querySelector('.bp'); e.style.wordBreak = ''; e.style.hyphens = ''; e.style.overflowWrap = ''; }")
    expect(problems, tag, 'aviso de error (tamaño de texto)', style_of(page, '.bp__msg')['fs'], l('--text-sm'))

    r = page.evaluate("() => { const e = document.querySelector('.bp__empty').getBoundingClientRect(); const b = document.querySelector('.bp__line').getBoundingClientRect(); return e.left >= b.left && e.right <= b.right && e.top >= b.top && e.bottom <= b.bottom; }")
    if not r:
        problems.append(f'{tag}: el texto de la zona vacía no queda dentro de la zona de respuesta')


def style_placed(page, tag, problems):
    settle(page)
    settle(page)
    c = lambda n: page.evaluate(TOK_COLOR, n)
    b = lambda n: page.evaluate(TOK_BG, n)
    used = style_of(page, '.bp__tray .bp__piece.is-used')
    expect(problems, tag, 'pieza usada (discontinua, atenuada, sin clic)', (used['bs'], used['cur'], used['color'], used['bg']), ('dashed', 'default', c('--text-muted'), 'rgba(0, 0, 0, 0)'))
    pl = style_of(page, '.bp__line .bp__piece--placed')
    expect(problems, tag, 'pieza colocada', (pl['bs'], pl['bc'], pl['bg'], pl['cur']), ('solid', c('--accent'), b('--surface-strong'), 'pointer'))


def style_marks(page, tag, problems):
    settle(page)
    settle(page)
    c = lambda n: page.evaluate(TOK_COLOR, n)
    ok = style_of(page, '.bp__line .bp__piece--ok')
    off = style_of(page, '.bp__line .bp__piece--off')
    expect(problems, tag, 'pieza en su lugar / fuera de lugar (bordes)', (ok['bc'], off['bc'], ok['bs'], off['bs']), (c('--success'), c('--danger'), 'solid', 'solid'))
    expect(problems, tag, 'piezas tras responder (sin clic)', (ok['cur'], off['cur']), ('default', 'default'))
    mp = style_of(page, '.bp__misplaced')
    expect(problems, tag, 'línea «Fuera de lugar»', (mp['color'], mp['fs']), (c('--danger-text'), page.evaluate(TOK_LEN, '--text-sm')))
    vd = style_of(page, '.fb__verdict')
    if vd['color'] == c('--success-text') and c('--success-text') != c('--danger-text'):
        problems.append(f'{tag}: el veredicto «wrong» no debe verse en el color de acierto')
    expect(problems, tag, 'veredicto (tamaño)', vd['fs'], page.evaluate(TOK_LEN, '--text-lg'))
    expect(problems, tag, 'respuesta correcta (ajuste de texto)', style_of(page, '.bp__correct')['ow'], 'anywhere')
    fb = style_of(page, '.bp__feedback')
    expect(problems, tag, 'comentarios (columna flex con hueco)', (fb['disp'], fb['fd'], fb['rg']), ('flex', 'column', page.evaluate(TOK_LEN, '--space-2')))
    expect(problems, tag, 'veredicto, correcta y fuera de lugar (márgenes en cero)', (style_of(page, '.fb__verdict')['mg'], style_of(page, '.bp__correct')['mg'], mp['mg']), ('0px 0px',) * 3)
    heavy = page.evaluate(TOK_WEIGHT, '--weight-heavy')
    expect(problems, tag, 'veredicto y fuera de lugar (peso)', (vd['fwt'], mp['fwt']), (heavy, heavy))


def style_correct(page, tag, problems):
    settle(page)
    settle(page)
    vd = style_of(page, '.fb__verdict--correct')
    expect(problems, tag, 'veredicto de acierto (color)', vd['color'], page.evaluate(TOK_COLOR, '--success-text'))


def style_hover(browser, base, theme, problems):
    ctx = browser.new_context(viewport={'width': 800, 'height': 700})
    page = ctx.new_page()
    page.set_default_timeout(6000)
    page.goto(f'{base}/__host.html')
    page.evaluate(f"document.documentElement.setAttribute('data-theme', '{theme}')")
    page.wait_for_function('window.__ready === true')
    fresh(page, 'letras')
    tag = f'letras/{theme}/hover'
    if not page.evaluate("() => matchMedia('(hover: hover)').matches"):
        problems.append(f'{tag}: el contexto de escritorio no tiene hover (prueba no válida)')
        ctx.close()
        return
    surface = page.evaluate(TOK_BG, '--surface')
    strong = page.evaluate(TOK_BG, '--surface-strong')
    free = page.locator('.bp__tray .bp__piece:not([aria-disabled="true"])').first
    free.hover()
    settle(page)
    expect(problems, tag, 'pieza libre con el cursor encima (fondo)', style_of(page, '.bp__tray .bp__piece:not(.is-used):hover', True)['bg'] if page.locator('.bp__tray .bp__piece:hover').count() else None, strong)
    page.mouse.move(790, 690)
    settle(page)
    expect(problems, tag, 'pieza libre sin cursor (fondo)', style_of(page, '.bp__tray .bp__piece:not(.is-used)', True)['bg'], surface)
    tap(page, 'o')
    page.locator('.bp__tray .bp__piece.is-used').first.hover(force=True)
    settle(page)
    expect(problems, tag, 'pieza usada con el cursor encima (sigue transparente)', style_of(page, '.bp__tray .bp__piece.is-used', True)['bg'], 'rgba(0, 0, 0, 0)')
    page.locator('.bp__line .bp__piece--placed').first.hover()
    settle(page)
    expect(problems, tag, 'pieza colocada con el cursor encima (sigue en su fondo)', style_of(page, '.bp__line .bp__piece--placed', True)['bg'], strong)
    page.get_by_role('button', name='No sé').click()
    page.locator('.bp__tray .bp__piece:not(.is-used)').first.hover(force=True)
    settle(page)
    expect(problems, tag, 'pieza libre tras responder con el cursor encima (sigue en reposo)', style_of(page, '.bp__tray .bp__piece:not(.is-used)', True)['bg'], surface)
    ctx.close()


def serve(root):
    class Handler(http.server.SimpleHTTPRequestHandler):
        def __init__(self, *a, **k):
            super().__init__(*a, directory=root, **k)

        def do_GET(self):
            path = self.path.split('?')[0]
            hosts = {'/__host.html': HOST_HTML, '/__host.js': HOST_JS, '/__bars.html': HOST_HTML.replace('/__host.js', '/__bars.js'), '/__bars.js': BARS_JS}
            if path in hosts:
                body = hosts[path].encode('utf-8')
                self.send_response(200)
                self.send_header('Content-Type', 'text/html; charset=utf-8' if path.endswith('.html') else 'text/javascript; charset=utf-8')
                self.send_header('Content-Length', str(len(body)))
                self.send_header('Content-Security-Policy', CSP)
                self.send_header('Cache-Control', 'no-store')
                self.end_headers()
                self.wfile.write(body)
                return
            super().do_GET()

        def end_headers(self):
            self.send_header('Content-Security-Policy', CSP)
            self.send_header('Cache-Control', 'no-store')
            super().end_headers()

        def log_message(self, *a):
            pass

    socketserver.TCPServer.allow_reuse_address = True
    srv = socketserver.TCPServer(('127.0.0.1', 0), Handler)
    threading.Thread(target=srv.serve_forever, daemon=True).start()
    return srv


def check_measure(m, label, problems):
    if m['scrollW'] > m['vw']:
        problems.append(f"{label}: desborde horizontal ({m['scrollW']} > {m['vw']})")
    if m['over']:
        problems.append(f"{label}: elementos fuera de pantalla {m['over'][:3]}")
    if m['small']:
        problems.append(f"{label}: objetivos táctiles < 44 px {m['small'][:3]}")
    if m['split']:
        problems.append(f"{label}: palabras partidas en botones {m['split'][:3]}")


def tap(page, text):
    # Pieza exacta y libre de la bandeja. El clic de Playwright desplaza hasta que nada la tapa (la barra fija puede cubrirla).
    page.locator('.bp__tray .bp__piece:not([aria-disabled="true"])').filter(has_text=re.compile(rf'^{re.escape(text)}$')).first.click()


def fresh(page, case):
    page.evaluate(f"window.mountCase('{case}')")
    page.wait_for_selector('.bp__piece')


def placed(page):
    return page.locator('.bp__line .bp__piece').evaluate_all('els => els.map((e) => e.textContent)')


def msg(page):
    return page.locator('.bp__msg').inner_text().strip()


def run_case(browser, base, theme, size, case, out):
    problems, notes = [], []
    d = CASE_DEFS[case]
    right, extra = d['pieces'], d['extra']
    n = len(right)
    joiner = '' if d['type'] == 'unscramble_letters' else ' '
    expected = joiner.join(right)
    line_name = 'Tu palabra' if d['type'] == 'unscramble_letters' else 'Tu frase'
    tag = f'{case}/{theme}/{size}'
    ctx = browser.new_context(viewport={'width': 360, 'height': 640}, device_scale_factor=2, is_mobile=True, has_touch=True)
    page = ctx.new_page()
    page.set_default_timeout(6000)
    errors = []
    page.on('console', lambda m: errors.append(m.text) if m.type in ('error', 'warning') else None)
    page.on('pageerror', lambda x: errors.append(f'pageerror: {x}'))
    page.goto(f'{base}/__host.html')
    page.evaluate(f"document.documentElement.setAttribute('data-theme', '{theme}'); document.documentElement.setAttribute('data-text-size', '{size}')")
    page.wait_for_function('window.__ready === true')
    fresh(page, case)

    # 1) Estado inicial.
    check_measure(page.evaluate(MEASURE), f'{tag} inicial', problems)
    if page.get_by_role('group', name=line_name).count() != 1 or page.get_by_role('group', name='Piezas').count() != 1:
        problems.append(f'{tag}: faltan los grupos «{line_name}» y «Piezas»')
    if page.locator('.bp__tray .bp__piece').count() != n + len(extra):
        problems.append(f'{tag}: la bandeja debería tener {n + len(extra)} piezas')
    if not page.locator('.bp__empty').is_visible():
        problems.append(f'{tag}: no se ve el texto de la zona vacía')
    box = page.evaluate(BTN_BOX, 'No sé')
    if not box:
        problems.append(f'{tag}: no existe «No sé»')
    elif box['top'] < 0 or box['bottom'] > box['vh']:
        problems.append(f"{tag}: «No sé» NO está dentro de la pantalla sin desplazarse (y {round(box['top'])}–{round(box['bottom'])} de {round(box['vh'])})")
    else:
        notes.append(f"«No sé» termina en y={round(box['bottom'])}")
    cover = page.evaluate("() => { const a = document.querySelector('.bp__actions').getBoundingClientRect(); const t = document.querySelector('.bp__tray').getBoundingClientRect(); return Math.max(0, Math.min(a.bottom, t.bottom) - Math.max(a.top, t.top)); }")
    if cover > 0:
        notes.append(f'la barra de acciones tapa {round(cover)} px de la bandeja sin desplazar')
    style_initial(page, f'{tag} inicial', d['type'] == 'unscramble_letters', problems)
    page.screenshot(path=os.path.join(out, f'{case}_{theme}_{size}_1inicial.png'), full_page=True)

    # 2) Colocar la primera pieza: la zona de respuesta no cambia de alto y la bandeja no se mueve.
    line0, pos0 = page.evaluate(LINE_H), page.evaluate(TRAY_POS)
    tap(page, right[0])
    if placed(page) != [right[0]]:
        problems.append(f'{tag}: la pieza no apareció en la respuesta: {placed(page)}')
    if page.evaluate(LINE_H) != line0:
        (notes if case == 'largo' else problems).append(f'{tag}: la zona de respuesta cambió de alto al colocar la primera pieza ({line0} → {page.evaluate(LINE_H)})')
    if page.evaluate(TRAY_POS) != pos0:
        (notes if case == 'largo' else problems).append(f'{tag}: la bandeja cambió de sitio al colocar una pieza')
    check_measure(page.evaluate(MEASURE), f'{tag} con una pieza', problems)
    style_placed(page, f'{tag} con una pieza', problems)

    # 3) Deshacer y empezar de nuevo.
    page.get_by_role('button', name='Deshacer').click()
    if placed(page) != []:
        problems.append(f'{tag}: deshacer no vació la respuesta: {placed(page)}')
    for w in right[:2]:
        tap(page, w)
    page.get_by_role('button', name='Deshacer').click()
    if placed(page) != [right[0]]:
        problems.append(f'{tag}: deshacer no quitó solo la última: {placed(page)}')
    page.get_by_role('button', name='Empezar de nuevo').click()
    if placed(page) != []:
        problems.append(f'{tag}: empezar de nuevo no vació la respuesta: {placed(page)}')

    # 4) Comprobar con una pieza menos: no envía y avisa.
    for w in right[:n - 1]:
        tap(page, w)
    page.get_by_role('button', name='Comprobar').click()
    if msg(page) == '' or page.evaluate('window.__calls.length') != 0:
        problems.append(f'{tag}: comprobar con una pieza menos debía avisar y no enviar')
    else:
        aviso = style_of(page, '.bp__msg')
        expect(problems, f'{tag} aviso', 'aviso «Faltan piezas» (visible y en rojo)', (aviso['disp'], aviso['color']), ('block', page.evaluate(TOK_COLOR, '--danger-text')))
    page.get_by_role('button', name='Empezar de nuevo').click()
    if msg(page) != '':
        problems.append(f'{tag}: el aviso no se limpió al reiniciar')

    # 5) Orden mal (al revés): wrong, marcas ✗ con texto y respuesta correcta.
    fresh(page, case)
    rev = list(reversed(right))
    for w in rev:
        tap(page, w)
    page.get_by_role('button', name='Comprobar').click()
    page.wait_for_selector('.fb__verdict')
    calls = page.evaluate('window.__calls')
    if len(calls) != 1 or calls[0].get('result') != 'wrong':
        problems.append(f'{tag}: orden mal no envió un solo wrong: {calls}')
    bad = [i for i in range(n) if rev[i] != right[i]]
    labels = page.locator('.bp__line .bp__piece--off').evaluate_all('els => els.map((e) => e.getAttribute("aria-label"))')
    if len(labels) != len(bad) or any('✗' not in (t or '') for t in labels):
        problems.append(f'{tag}: las piezas fuera de lugar deberían ser {len(bad)} y llevar «✗» en su nombre: {labels}')
    if page.locator('.bp__misplaced').count() != 1 or 'Fuera de lugar' not in page.locator('.bp__misplaced').inner_text():
        problems.append(f'{tag}: falta la línea «Fuera de lugar» con texto')
    if page.locator('.bp__correct').count() != 1 or page.locator('.bp__correct').inner_text().strip() != expected:
        problems.append(f'{tag}: la respuesta correcta mostrada no es «{expected}»')
    if page.locator('.bp__actions').is_visible():
        problems.append(f'{tag}: las acciones siguen visibles tras responder')
    check_measure(page.evaluate(MEASURE), f'{tag} orden mal', problems)
    page.screenshot(path=os.path.join(out, f'{case}_{theme}_{size}_2mal.png'), full_page=True)

    # 6) Mezcla: las dos últimas cambiadas → el resto ✓ y esas dos ✗.
    fresh(page, case)
    mix = right[:n - 2] + [right[n - 1], right[n - 2]]
    for w in mix:
        tap(page, w)
    page.get_by_role('button', name='Comprobar').click()
    page.wait_for_selector('.fb__verdict')
    oks = page.locator('.bp__line .bp__piece--ok').evaluate_all('els => els.map((e) => e.getAttribute("aria-label"))')
    offs = page.locator('.bp__line .bp__piece--off').evaluate_all('els => els.map((e) => e.getAttribute("aria-label"))')
    if len(oks) != n - 2 or len(offs) != 2 or any('✓' not in (t or '') for t in oks) or any('✗' not in (t or '') for t in offs):
        problems.append(f'{tag}: la mezcla no marcó {n - 2} ✓ y 2 ✗: ✓={oks} ✗={offs}')
    style_marks(page, f'{tag} mezcla', problems)
    page.screenshot(path=os.path.join(out, f'{case}_{theme}_{size}_3mezcla.png'), full_page=True)

    # 7) Pieza de más en el último lugar: wrong y «Sobra» con texto.
    fresh(page, case)
    for w in right[:n - 1] + [extra[0]]:
        tap(page, w)
    page.get_by_role('button', name='Comprobar').click()
    page.wait_for_selector('.fb__verdict')
    calls = page.evaluate('window.__calls')
    if len(calls) != 1 or calls[0].get('result') != 'wrong':
        problems.append(f'{tag}: pieza de más no envió un solo wrong: {calls}')
    texts = ' '.join(page.locator('.bp__misplaced').evaluate_all('els => els.map((e) => e.textContent)'))
    if 'Sobra' not in texts or extra[0] not in texts:
        problems.append(f'{tag}: falta «Sobra: {extra[0]}» con texto: {texts!r}')
    sobra = page.locator('.bp__line .bp__piece--off').evaluate_all('els => els.map((e) => e.getAttribute("aria-label"))')
    if not any('✗ Sobra' in (t or '') for t in sobra):
        problems.append(f'{tag}: la pieza de más no dice «✗ Sobra» en su nombre: {sobra}')
    page.screenshot(path=os.path.join(out, f'{case}_{theme}_{size}_4sobra.png'), full_page=True)

    # 8) Todo bien: un solo correct con responseRaw igual a la respuesta.
    fresh(page, case)
    for w in right:
        tap(page, w)
    page.get_by_role('button', name='Comprobar').click()
    page.wait_for_selector('.fb__verdict')
    calls = page.evaluate('window.__calls')
    if len(calls) != 1 or calls[0].get('result') != 'correct':
        problems.append(f'{tag}: todo bien no envió un solo correct: {calls}')
    elif calls[0].get('responseRaw') != expected:
        problems.append(f"{tag}: responseRaw {calls[0].get('responseRaw')!r} ≠ {expected!r}")
    if page.locator('.bp__correct').count() != 0:
        problems.append(f'{tag}: al acertar no debería mostrarse la respuesta correcta')
    if page.locator('.bp__actions').is_visible():
        problems.append(f'{tag}: las acciones siguen visibles tras acertar')
    style_correct(page, f'{tag} correcta', problems)
    page.screenshot(path=os.path.join(out, f'{case}_{theme}_{size}_5correcta.png'), full_page=True)

    # 9) «No sé»: dont_know, respuesta visible y ninguna pieza marcada.
    fresh(page, case)
    tap(page, extra[0])
    page.get_by_role('button', name='No sé').click()
    page.wait_for_selector('.fb__verdict')
    calls = page.evaluate('window.__calls')
    if len(calls) != 1 or calls[0].get('result') != 'dont_know' or calls[0].get('dontKnow') is not True:
        problems.append(f'{tag}: «No sé» no envió dont_know: {calls}')
    if page.locator('.bp__correct').count() != 1 or page.locator('.bp__correct').inner_text().strip() != expected:
        problems.append(f'{tag}: con «No sé» no se mostró la respuesta correcta')
    if page.locator('.bp__piece--off').count() or page.locator('.bp__piece--ok').count():
        problems.append(f'{tag}: con «No sé» no debía marcarse ninguna pieza')
    check_measure(page.evaluate(MEASURE), f'{tag} no sé', problems)
    page.screenshot(path=os.path.join(out, f'{case}_{theme}_{size}_6nose.png'), full_page=True)

    # 10) Error de envío y reintento (solo en el caso `frase`).
    if case == 'frase':
        fresh(page, case)
        page.evaluate('window.__fail = true')
        for w in right:
            tap(page, w)
        page.get_by_role('button', name='Comprobar').click()
        page.wait_for_function("document.querySelector('.bp__msg') && document.querySelector('.bp__msg').textContent.trim() !== ''")
        if page.locator('.fb__verdict').count() != 0 or placed(page) != right:
            problems.append(f'{tag}: tras el error de envío se perdió algo: {placed(page)}')
        else:
            check_measure(page.evaluate(MEASURE), f'{tag} error de envío', problems)
            page.screenshot(path=os.path.join(out, f'{case}_{theme}_{size}_7error.png'), full_page=True)
            page.evaluate('window.__fail = false')
            page.get_by_role('button', name='Comprobar').click()
            page.wait_for_selector('.fb__verdict')
            calls = page.evaluate('window.__calls')
            if len(calls) != 2 or calls[1].get('result') != 'correct':
                problems.append(f'{tag}: el reintento no envió un segundo correct: {calls}')

    if case == 'letras' and size == 'normal':
        style_hover(browser, base, theme, problems)

    real = [e for e in errors if 'favicon' not in e]
    if real:
        problems.append(f'{tag}: errores de consola {real[:3]}')
    ctx.close()
    return problems, notes


def run_bars(browser, base, theme, size, case, out):
    """Un caso de --bars: ¿toda pieza se puede dejar por encima de la barra fija, al empezar y con todo colocado?"""
    d = BAR_CASES[case]
    tag = f'{case}/{theme}/{size}'
    problems, notes = [], []
    ctx = browser.new_context(viewport={'width': 360, 'height': 640}, device_scale_factor=1, is_mobile=True, has_touch=True)
    page = ctx.new_page()
    page.set_default_timeout(6000)
    errors = []
    page.on('console', lambda m: errors.append(m.text) if m.type in ('error', 'warning') else None)
    page.on('pageerror', lambda x: errors.append(f'pageerror: {x}'))
    page.goto(f'{base}/__bars.html')
    page.evaluate(f"document.documentElement.setAttribute('data-theme', '{theme}'); document.documentElement.setAttribute('data-text-size', '{size}')")
    page.wait_for_function('window.__ready === true')
    page.evaluate(f"window.mountBar('{case}')")
    page.wait_for_selector(d['bar'])
    if page.evaluate(f"getComputedStyle(document.querySelector('{d['bar']}')).position") != 'sticky':
        problems.append(f'{tag}: la barra {d["bar"]} no es sticky')
    states = [('inicio', None)]
    if d['taps']:
        states.append(('todo colocado', d['taps']))
    for label, taps in states:
        if taps:
            page.evaluate("(sel) => { for (let i = 0; i < 40; i++) { const b = document.querySelector(sel + ':not([aria-disabled=\"true\"]):not(.is-used)'); if (!b) break; b.click(); } }", taps)
        r = page.evaluate(REACH, [d['pieces'], d['bar']])
        if r['pieces'] == 0:
            problems.append(f'{tag} ({label}): no se encontró ninguna pieza con {d["pieces"]}')
        if r['unreachable']:
            problems.append(f"{tag} ({label}): {len(r['unreachable'])} de {r['pieces']} piezas no se pueden dejar por encima de la barra: {r['unreachable'][:4]}")
        notes.append(f"{label}: {r['pieces']} piezas, barra {r['bar']} px, desplazamiento {r['maxY']} px, tapadas al final {r['atEndCovered']}")
        if r['atEndCovered']:
            problems.append(f"{tag} ({label}): {r['atEndCovered']} piezas quedan tapadas por la barra al final del desplazamiento")
        if r['bar'] > 0.4 * 640:
            problems.append(f"{tag} ({label}): la barra mide {r['bar']} px, más del 40 % de la pantalla (256 px): deja poco espacio para las piezas")
    page.screenshot(path=os.path.join(out, f'bars_{case}_{theme}_{size}.png'), full_page=True)
    real = [e for e in errors if 'favicon' not in e]
    if real:
        problems.append(f'{tag}: errores de consola {real[:3]}')
    ctx.close()
    return problems, notes


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--out', default='/tmp/build-shots')
    ap.add_argument('--bars', action='store_true', help='comprueba las 4 barras fijas (ordenar, emparejar, banco, construir) con el máximo de piezas')
    ap.add_argument('--cases', default=None, help='casos a correr, separados por comas (por defecto todos)')
    ap.add_argument('--themes', default=None, help='temas a correr (por defecto los 3; con --bars solo aurora)')
    ap.add_argument('--sizes', default=','.join(SIZES), help='tamaños de texto a correr (por defecto normal y xlarge)')
    args = ap.parse_args()
    try:
        from playwright.sync_api import sync_playwright
    except ImportError:
        sys.stderr.write('Playwright no está instalado: verificación omitida (no probado en este entorno).\n')
        return 2
    root = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
    os.makedirs(args.out, exist_ok=True)
    srv = serve(root)
    base = f'http://127.0.0.1:{srv.server_address[1]}'
    failed = 0
    total = 0
    with sync_playwright() as p:
        browser = p.chromium.launch()
        sys.stdout.write(f'Chromium {browser.version}\n')
        names = list(BAR_CASES) if args.bars else CASES
        run_one = run_bars if args.bars else run_case
        cases = args.cases if args.cases is not None else ','.join(names)
        themes = args.themes if args.themes is not None else ('aurora' if args.bars else ','.join(THEMES))
        for case in [c for c in cases.split(',') if c in names]:
            for theme in [t for t in themes.split(',') if t in THEMES]:
                for size in [z for z in args.sizes.split(',') if z in SIZES]:
                    total += 1
                    try:
                        problems, notes = run_one(browser, base, theme, size, case, args.out)
                    except Exception as exc:  # un paso que no se puede hacer (p. ej. un botón fuera de pantalla) también es un fallo
                        detail = ' / '.join(str(exc).splitlines()[:4])[:400]
                        problems, notes = [f'{case}/{theme}/{size}: el recorrido se interrumpió: {detail}'], []
                    failed += 1 if problems else 0
                    tail = ' — ' + ' | '.join(problems) if problems else ' (' + '; '.join(notes) + ')'
                    sys.stdout.write(('✘' if problems else '✔') + f' {case} {theme} {size}' + tail + '\n')
        browser.close()
    srv.shutdown()
    sys.stdout.write(json.dumps({'casos': total, 'fallos': failed}, ensure_ascii=False) + '\n')
    return 1 if failed else 0


if __name__ == '__main__':
    sys.exit(main())
