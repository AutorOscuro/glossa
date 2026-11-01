#!/usr/bin/env python3
# @purpose: Verificación opcional en Chromium real del componente de ordenar bloques a 360 px: toques de 44 px, bandeja que no se mueve, «No sé» a la vista, textos completos y correcciones con texto.
"""Verificación visual y de accesibilidad del componente `order_blocks` (subparte 2.4, tramo 1, punto 4c). NO forma parte de `npm run check`.

Monta el componente REAL (ui/exercises/orderBlocks.js) en una página anfitriona que se inyecta en memoria, bajo la misma CSP de la app,
a 360x640, en los 3 temas y con el texto en «Normal» y «Muy grande». Casos: `dos` (2 bloques), `simple` (3 bloques), `largo` (12 bloques,
uno con una palabra larguísima) y `dialogo` (`order_dialogue`: 8 líneas con hablante, uno de 20 caracteres y una línea con una palabra larguísima). Para cada caso comprueba:
  - sin desbordes horizontales, objetivos táctiles de al menos 44 px y sin palabras partidas en los botones,
  - ningún bloque con el texto recortado y ninguno fuera de la frase armada,
  - «No sé» y «Comprobar» DENTRO de la pantalla sin desplazarse,
  - roles accesibles: dos grupos con nombre («Tu frase» y «Bloques»),
  - al colocar bloques la bandeja NO cambia de sitio; «Deshacer» devuelve el bloque; «Comprobar» incompleto no envía y avisa,
  - orden correcto: se envía correct; orden con los dos primeros cambiados: se envía wrong, se muestra la frase correcta y las posiciones fuera de lugar con texto,
  - «No sé»: se envía dont_know y se muestra la frase correcta; tras responder las acciones se ocultan,
  - sin errores de consola.
Guarda capturas. Sale con código 1 si algo falla y con 2 si Playwright no está instalado.

Uso:  python3 tools/order-check.py [--out shots]
"""
import argparse
import http.server
import json
import os
import socketserver
import sys
import threading

CSP = ("default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; font-src 'self'; connect-src 'self'; "
       "object-src 'none'; base-uri 'none'; form-action 'none'")
THEMES = ['aurora', 'neo', 'claro']
SIZES = ['normal', 'xlarge']
CASES = ['dos', 'simple', 'largo', 'dialogo']

HOST_HTML = r"""<!doctype html>
<html lang="es" data-theme="aurora"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<link rel="stylesheet" href="/ui/styles/tokens.css"><link rel="stylesheet" href="/ui/styles/themes.css">
<link rel="stylesheet" href="/ui/styles/base.css"><link rel="stylesheet" href="/ui/styles/components.css">
<link rel="stylesheet" href="/ui/styles/widgets.css"></head>
<body><div class="app-shell"><main class="app-main" id="slot"></main></div><script type="module" src="/__host.js"></script></body></html>"""

HOST_JS = r"""
import { createOrderBlocks } from '/ui/exercises/orderBlocks.js';
import { createRng } from '/core/rng.js';
const LONG = 'supercalifragilisticoespialidosoextraordinariamenteinterminable'.repeat(2);
const ITEMS = {
  dos: { id: 'd', type: 'order_blocks', prompt_es: 'Ordena el saludo.', data: { blocks: ['Hello', 'there'] } },
  simple: { id: 's', type: 'order_blocks', prompt_es: 'Ordena la frase.', situation: 'Presentarse con un nuevo vecino',
    data: { blocks: ['I have lived', 'here', 'for two years'] } },
  largo: { id: 'l', type: 'order_blocks', prompt_es: 'Ordena la frase completa, es larga ' + LONG + ' pero se puede.', situation: 'Hablar de la rutina',
    data: { blocks: ['She', 'has been working', 'at the same company', 'for almost twelve years', 'now,', 'and she still enjoys', 'every single day', 'of it,', LONG, 'especially', 'the', 'mornings.'] } },
  dialogo: { id: 'g', type: 'order_dialogue', prompt_es: 'Ordena el diálogo.', situation: 'En la oficina',
    data: { lines: [
      { speaker: 'Ana', text: 'Good morning, Ben.' }, { speaker: 'Benjamin Alexander S', text: 'Morning! Did you sleep well?' },
      { speaker: 'Ana', text: 'Not really. The neighbours were very loud last night.' }, { speaker: 'Ben', text: 'That sounds terrible.' },
      { speaker: 'Ana', text: LONG }, { speaker: 'Ben', text: 'Do you want a coffee?' },
      { speaker: 'Ana', text: 'Yes, please.' }, { speaker: 'Ben', text: 'Coming right up.' }] } },
};
let current = null;
window.__calls = [];
window.mountCase = (name) => {
  if (current) current.destroy();
  window.__calls = [];
  document.getElementById('slot').replaceChildren();
  const comp = createOrderBlocks({ rng: createRng(7) });
  current = comp.mount(document.getElementById('slot'), ITEMS[name],
    { doc: document, win: window, submit: async (a) => { window.__calls.push(a); return { status: 'saved' }; } });
  return true;
};
window.__ready = true;
"""

MEASURE = r"""() => {
  const vw = document.documentElement.clientWidth;
  const out = { vw, scrollW: document.documentElement.scrollWidth, small: [], over: [], clipped: [] };
  for (const el of document.querySelectorAll('button, input, .btn')) {
    const r = el.getBoundingClientRect();
    if (r.width === 0 || r.height === 0) continue;
    if (r.height < 43.5 || r.width < 43.5) out.small.push([el.tagName, (el.textContent || el.getAttribute('aria-label') || '').trim().slice(0, 20), Math.round(r.width), Math.round(r.height)]);
  }
  for (const el of document.querySelectorAll('body *')) {
    const r = el.getBoundingClientRect();
    if (r.width && (r.right > vw + 0.5 || r.left < -0.5)) out.over.push([el.tagName, String(el.className).slice(0, 30), Math.round(r.left), Math.round(r.right)]);
  }
  out.split = [];
  for (const el of document.querySelectorAll('.btn')) {
    const node = [...el.childNodes].flatMap((n) => (n.nodeType === 3 ? [n] : [...n.childNodes].filter((m) => m.nodeType === 3)))[0];
    if (!node) continue;
    for (const m of node.data.matchAll(/\S+/g)) {
      const rg = document.createRange(); rg.setStart(node, m.index); rg.setEnd(node, m.index + m[0].length);
      if (new Set([...rg.getClientRects()].map((x) => Math.round(x.top))).size > 1) out.split.push(m[0]);
    }
  }
  for (const b of document.querySelectorAll('.ob__block')) {
    const r = b.getBoundingClientRect();
    if (b.scrollWidth > b.clientWidth + 1 || b.scrollHeight > b.clientHeight + 1) out.clipped.push([b.textContent.slice(0, 20), Math.round(r.width), Math.round(r.height)]);
    const line = b.closest('.ob__line');
    if (line) { const l = line.getBoundingClientRect(); if (r.right > l.right + 0.5 || r.left < l.left - 0.5) out.clipped.push(['fuera de la frase', Math.round(r.left), Math.round(r.right)]); }
  }
  return out;
}"""


def serve(root):
    class Handler(http.server.SimpleHTTPRequestHandler):
        def __init__(self, *a, **k):
            super().__init__(*a, directory=root, **k)

        def do_GET(self):
            path = self.path.split('?')[0]
            if path in ('/__host.html', '/__host.js'):
                body = (HOST_HTML if path.endswith('.html') else HOST_JS).encode('utf-8')
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
    if m['clipped']:
        problems.append(f"{label}: bloques con texto recortado o fuera de la frase {m['clipped'][:3]}")


TRAY_POS = r"""() => { const t = document.querySelector('.ob__tray').getBoundingClientRect(); return [...document.querySelectorAll('.ob__tray .ob__block')].map((b) => { const r = b.getBoundingClientRect(); return [b.dataset.index, Math.round(r.left - t.left), Math.round(r.top - t.top)].join(':'); }); }"""
LINE_BOX = r"""() => ({ line: Math.round(document.querySelector('.ob__line').getBoundingClientRect().height), tray: Math.round(document.querySelector('.ob__tray').getBoundingClientRect().top + window.scrollY) })"""
BTN_BOX = r"""(label) => { const b = [...document.querySelectorAll('button')].find((x) => x.textContent.trim() === label); if (!b) return null; const r = b.getBoundingClientRect(); return { top: r.top, bottom: r.bottom, vh: window.innerHeight }; }"""
COUNTS = {'dos': 2, 'simple': 3, 'largo': 12, 'dialogo': 8}


def tap(page, i):
    page.locator(f'.ob__tray .ob__block[data-index="{i}"]').click()


def fresh(page, case):
    page.evaluate(f"window.mountCase('{case}')")
    page.wait_for_selector('.ob__block')


def run_case(browser, base, theme, size, case, out):
    problems, notes = [], []
    n = COUNTS[case]
    tag = f'{case}/{theme}/{size}'
    ctx = browser.new_context(viewport={'width': 360, 'height': 640}, device_scale_factor=2, is_mobile=True, has_touch=True)
    page = ctx.new_page()
    errors = []
    page.on('console', lambda m: errors.append(m.text) if m.type in ('error', 'warning') else None)
    page.on('pageerror', lambda x: errors.append(f'pageerror: {x}'))
    page.goto(f'{base}/__host.html')
    page.evaluate(f"document.documentElement.setAttribute('data-theme', '{theme}'); document.documentElement.setAttribute('data-text-size', '{size}')")
    page.wait_for_function('window.__ready === true')
    fresh(page, case)

    # 1) Estado inicial.
    check_measure(page.evaluate(MEASURE), f'{tag} inicial', problems)
    if page.get_by_role('group', name='Tu frase').count() != 1 or page.get_by_role('group', name='Bloques').count() != 1:
        problems.append(f'{tag}: faltan los grupos «Tu frase» y «Bloques»')
    if page.locator('.ob__tray .ob__block').count() != n:
        problems.append(f'{tag}: la bandeja debería tener {n} bloques')
    if case == 'dialogo' and page.locator('.ob__tray .ob__block', has_text=': ').count() != n:
        problems.append(f'{tag}: en el diálogo cada bloque debe mostrarse «Hablante: texto»')
    for label in ('No sé', 'Comprobar'):
        box = page.evaluate(BTN_BOX, label)
        if not box:
            problems.append(f'{tag}: no existe «{label}»')
        elif box['top'] < 0 or box['bottom'] > box['vh']:
            problems.append(f"{tag}: «{label}» NO está dentro de la pantalla sin desplazarse (y {round(box['top'])}–{round(box['bottom'])} de {round(box['vh'])})")
        else:
            notes.append(f"«{label}» termina en y={round(box['bottom'])}")
    page.screenshot(path=os.path.join(out, f'{case}_{theme}_{size}_1inicial.png'), full_page=True)

    # 2) Colocar dos, la bandeja no se mueve, comprobar incompleto, deshacer.
    before = page.evaluate(TRAY_POS)
    box0 = page.evaluate(LINE_BOX)
    tap(page, 0)
    box1 = page.evaluate(LINE_BOX)
    if box1['tray'] != box0['tray']:
        problems.append(f"{tag}: al colocar el primer bloque la bandeja saltó de y={box0['tray']} a y={box1['tray']}")
    tap(page, 1)
    box2 = page.evaluate(LINE_BOX)
    if page.evaluate(TRAY_POS) != before:
        problems.append(f'{tag}: los bloques de la bandeja cambiaron de sitio entre sí al colocar')
    if box2['line'] == box1['line'] and box2['tray'] != box1['tray']:
        problems.append(f"{tag}: la bandeja se movió aunque el recuadro de la frase no creció")
    if page.locator('.ob__block--placed').count() != 2:
        problems.append(f'{tag}: no se colocaron dos bloques')
    check_measure(page.evaluate(MEASURE), f'{tag} colocando', problems)
    if n > 2:
        page.get_by_role('button', name='Comprobar').click()
        if 'Coloca todos' not in page.locator('.ob__msg').inner_text() or page.evaluate('window.__calls').__len__() != 0:
            problems.append(f'{tag}: «Comprobar» incompleto no avisó o envió algo')
    page.get_by_role('button', name='Deshacer').click()
    if page.locator('.ob__block--placed').count() != 1:
        problems.append(f'{tag}: «Deshacer» no quitó el último bloque')
    tap(page, 1)

    # 3) Completar en orden y comprobar.
    for i in range(2, n):
        tap(page, i)
    page.get_by_role('button', name='Comprobar').click()
    page.wait_for_selector('.fb__verdict')
    calls = page.evaluate('window.__calls')
    if len(calls) != 1 or calls[0].get('result') != 'correct':
        problems.append(f'{tag}: la respuesta enviada no fue correct: {calls}')
    if page.locator('.ob__actions').is_visible():
        problems.append(f'{tag}: las acciones siguen visibles tras responder')
    check_measure(page.evaluate(MEASURE), f'{tag} correcta', problems)
    page.screenshot(path=os.path.join(out, f'{case}_{theme}_{size}_2correcta.png'), full_page=True)

    # 4) Orden equivocado: los dos primeros cambiados.
    fresh(page, case)
    tap(page, 1)
    tap(page, 0)
    for i in range(2, n):
        tap(page, i)
    page.get_by_role('button', name='Comprobar').click()
    page.wait_for_selector('.fb__verdict')
    calls = page.evaluate('window.__calls')
    if len(calls) != 1 or calls[0].get('result') != 'wrong':
        problems.append(f'{tag}: la respuesta enviada no fue wrong: {calls}')
    if page.locator('.ob__correct').count() != 1:
        problems.append(f'{tag}: no se mostró la frase correcta')
    if case == 'dialogo' and page.locator('.ob__correct strong').count() != n:
        problems.append(f'{tag}: la corrección del diálogo debe mostrar las {n} líneas, cada una con su hablante')
    if page.locator('.ob__block--off').count() < 1 or 'Fuera de lugar' not in page.locator('.ob__misplaced').inner_text():
        problems.append(f'{tag}: no se marcaron con texto las posiciones fuera de lugar')
    check_measure(page.evaluate(MEASURE), f'{tag} incorrecta', problems)
    page.screenshot(path=os.path.join(out, f'{case}_{theme}_{size}_3incorrecta.png'), full_page=True)

    # 5) «No sé».
    fresh(page, case)
    page.get_by_role('button', name='No sé').click()
    page.wait_for_selector('.fb__verdict')
    calls = page.evaluate('window.__calls')
    if len(calls) != 1 or calls[0].get('result') != 'dont_know' or calls[0].get('dontKnow') is not True:
        problems.append(f'{tag}: «No sé» no envió dont_know: {calls}')
    if page.locator('.ob__correct').count() != 1:
        problems.append(f'{tag}: con «No sé» no se mostró la frase correcta')
    check_measure(page.evaluate(MEASURE), f'{tag} no sé', problems)
    page.screenshot(path=os.path.join(out, f'{case}_{theme}_{size}_4nose.png'), full_page=True)

    if errors:
        problems.append(f'{tag}: errores de consola {errors[:3]}')
    ctx.close()
    return problems, notes


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--out', default='order-shots')
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
        for case in CASES:
            for theme in THEMES:
                for size in SIZES:
                    total += 1
                    try:
                        problems, notes = run_case(browser, base, theme, size, case, args.out)
                    except Exception as exc:  # un paso que no se puede hacer (p. ej. un botón fuera de pantalla) también es un fallo
                        problems, notes = [f'{case}/{theme}/{size}: el recorrido se interrumpió: {str(exc).splitlines()[0][:120]}'], []
                    failed += 1 if problems else 0
                    sys.stdout.write(f"{'✘' if problems else '✔'} {case} {theme} {size}" + (f" — {' | '.join(problems)}" if problems else f" ({'; '.join(notes)})") + '\n')
        browser.close()
    srv.shutdown()
    sys.stdout.write(json.dumps({'casos': total, 'fallos': failed}, ensure_ascii=False) + '\n')
    return 1 if failed else 0


if __name__ == '__main__':
    sys.exit(main())
