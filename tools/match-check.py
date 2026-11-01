#!/usr/bin/env python3
# @purpose: Verificación opcional en Chromium real del componente de emparejar a 360 px: toques de 44 px, sin desbordes, feedback por pareja con texto, envío al completar, «No sé», error de envío y reintento.
"""Verificación visual y de accesibilidad del componente `match_pairs` (subparte 2.4, tramo 2, punto 4). NO forma parte de `npm run check`.

Monta el componente REAL (ui/exercises/matchPairs.js) en una página anfitriona inyectada en memoria, bajo la misma CSP de la app,
a 360x640, en los 3 temas y con el texto en «Normal» y «Muy grande». Casos: `dos` (2 parejas), `cinco` (5), `diez` (10 parejas y 4 distractores)
y `largo` (6 parejas con una palabra larguísima). Para cada caso comprueba:
  - sin desbordes horizontales, objetivos táctiles de al menos 44 px, ninguna tarjeta con el texto recortado, sin palabras partidas en los botones,
  - «No sé» DENTRO de la pantalla sin desplazarse, y dos grupos con nombre («Columna izquierda» y «Columna derecha»),
  - acierto: las dos tarjetas quedan bloqueadas con «✓ n» y el contador sube; las tarjetas NO cambian de sitio,
  - fallo: las dos se marcan (is-miss) y el aviso lleva «✗» con texto; no queda nada resuelto,
  - todo acertado sin fallos: se envía solo UN `correct` (sin pulsar «Comprobar»); con un fallo: `wrong` y se muestran las parejas,
  - «No sé»: se envía dont_know y se muestran las parejas; tras responder las acciones se ocultan,
  - error de envío: aparece «Enviar otra vez» y el aviso, nada se pierde; al reintentar se envía una vez más y queda hecho,
  - sin errores de consola.
Guarda capturas (por defecto en /tmp/match-shots: fuera del repo, TRAMPA-33). Sale con código 1 si algo falla y con 2 si Playwright no está instalado.

Uso:  python3 tools/match-check.py [--out /tmp/match-shots]
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
CASES = ['dos', 'cinco', 'diez', 'largo']
COUNTS = {'dos': 2, 'cinco': 5, 'diez': 10, 'largo': 6}

HOST_HTML = r"""<!doctype html>
<html lang="es" data-theme="aurora"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<link rel="stylesheet" href="/ui/styles/tokens.css"><link rel="stylesheet" href="/ui/styles/themes.css">
<link rel="stylesheet" href="/ui/styles/base.css"><link rel="stylesheet" href="/ui/styles/components.css">
<link rel="stylesheet" href="/ui/styles/widgets.css"></head>
<body><div class="app-shell"><main class="app-main" id="slot"></main></div><script type="module" src="/__host.js"></script></body></html>"""

HOST_JS = r"""
import { createMatchPairs } from '/ui/exercises/matchPairs.js';
import { createRng } from '/core/rng.js';
const LONG = 'supercalifragilisticoespialidosoextraordinariamenteinterminable';
const P = (l, r) => ({ left: l, right: r });
const ITEMS = {
  dos: { id: 'd', type: 'match_pairs', prompt_es: 'Une cada palabra con su significado.', data: { pairs: [P('cat', 'gato'), P('dog', 'perro')] } },
  cinco: { id: 'c', type: 'match_pairs', prompt_es: 'Une cada palabra con su significado.', situation: 'En casa',
    data: { pairs: [P('kitchen', 'cocina'), P('bedroom', 'dormitorio'), P('bathroom', 'baño'), P('window', 'ventana'), P('stairs', 'escaleras')] } },
  diez: { id: 'x', type: 'match_pairs', prompt_es: 'Une cada verbo con su significado.', situation: 'Rutina diaria',
    data: { pairs: [P('wake up', 'despertarse'), P('get up', 'levantarse'), P('have a shower', 'ducharse'), P('get dressed', 'vestirse'), P('have breakfast', 'desayunar'),
      P('go to work', 'ir al trabajo'), P('have lunch', 'almorzar'), P('come back home', 'volver a casa'), P('cook dinner', 'preparar la cena'), P('go to bed', 'irse a la cama')],
      extra_right: ['hacer deporte', 'lavar los platos', 'salir de fiesta', 'ver una película'] } },
  largo: { id: 'l', type: 'match_pairs', prompt_es: 'Une cada expresión con su significado, incluso la larga ' + LONG + '.', situation: 'Hablar de la rutina',
    data: { pairs: [P('I used to live here', 'yo vivía aquí antes'), P('She has been working for twelve years', 'ella trabaja desde hace doce años'), P(LONG, LONG + ' (es)'),
      P('look forward to', 'tener ganas de'), P('give up', 'rendirse'), P('turn down', 'rechazar')] } },
};
let current = null;
window.__calls = [];
window.__fail = false;
window.mountCase = (name) => {
  if (current) current.destroy();
  window.__calls = [];
  window.__fail = false;
  document.getElementById('slot').replaceChildren();
  const comp = createMatchPairs({ rng: createRng(7) });
  current = comp.mount(document.getElementById('slot'), ITEMS[name],
    { doc: document, win: window, submit: async (a) => { window.__calls.push(a); return window.__fail ? { status: 'error', message: 'No se pudo guardar. Inténtalo de nuevo.' } : { status: 'saved' }; } });
  return true;
};
window.__ready = true;
"""

MEASURE = r"""() => {
  const vw = document.documentElement.clientWidth;
  const out = { vw, scrollW: document.documentElement.scrollWidth, small: [], over: [], clipped: [], split: [] };
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
  for (const b of document.querySelectorAll('.ma__card')) {
    const r = b.getBoundingClientRect();
    if (b.scrollWidth > b.clientWidth + 1 || b.scrollHeight > b.clientHeight + 1) out.clipped.push([b.textContent.slice(0, 20), Math.round(r.width), Math.round(r.height)]);
  }
  return out;
}"""

POS = r"""() => [...document.querySelectorAll('.ma__card')].map((b) => { const r = b.getBoundingClientRect(); return [b.dataset.side, b.dataset.index, Math.round(r.left), Math.round(r.top + window.scrollY)].join(':'); })"""
BTN_BOX = r"""(label) => { const b = [...document.querySelectorAll('button')].find((x) => x.textContent.trim() === label); if (!b) return null; const r = b.getBoundingClientRect(); return { top: r.top, bottom: r.bottom, vh: window.innerHeight, shown: r.width > 0 }; }"""


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
        problems.append(f"{label}: tarjetas con texto recortado {m['clipped'][:3]}")


def left(page, i):
    return page.locator(f'.ma__card--left[data-index="{i}"]')


def right(page, k):
    return page.locator(f'.ma__card--right[data-index="{k}"]')


def fresh(page, case):
    page.evaluate(f"window.mountCase('{case}')")
    page.wait_for_selector('.ma__card')


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
    if page.get_by_role('group', name='Columna izquierda').count() != 1 or page.get_by_role('group', name='Columna derecha').count() != 1:
        problems.append(f'{tag}: faltan los grupos «Columna izquierda» y «Columna derecha»')
    if page.locator('.ma__card--left').count() != n:
        problems.append(f'{tag}: la columna izquierda debería tener {n} tarjetas')
    box = page.evaluate(BTN_BOX, 'No sé')
    if not box:
        problems.append(f'{tag}: no existe «No sé»')
    elif box['top'] < 0 or box['bottom'] > box['vh']:
        problems.append(f"{tag}: «No sé» NO está dentro de la pantalla sin desplazarse (y {round(box['top'])}–{round(box['bottom'])} de {round(box['vh'])})")
    else:
        notes.append(f"«No sé» termina en y={round(box['bottom'])}")
    page.screenshot(path=os.path.join(out, f'{case}_{theme}_{size}_1inicial.png'), full_page=True)

    # 2) Un acierto y un fallo: las tarjetas no se mueven, el significado va con texto.
    pos0 = page.evaluate(POS)
    left(page, 0).click()
    right(page, 0).click()
    if not left(page, 0).evaluate("e => e.classList.contains('is-done')") or '✓ 1' not in left(page, 0).inner_text() or '✓ 1' not in right(page, 0).inner_text():
        problems.append(f'{tag}: el acierto no dejó las dos tarjetas bloqueadas con «✓ 1»')
    if f'1 de {n} parejas' not in page.locator('.ma__progress').inner_text():
        problems.append(f'{tag}: el contador no marcó «1 de {n} parejas»')
    if '✓' not in page.locator('.ma__msg').inner_text():
        problems.append(f'{tag}: el acierto no avisó con «✓» en el mensaje')
    if n > 2:
        left(page, 1).click()
        right(page, 2).click()
        if page.locator('.ma__card.is-miss').count() != 2 or '✗' not in page.locator('.ma__msg').inner_text():
            problems.append(f'{tag}: el fallo no marcó las dos tarjetas ni avisó con «✗»')
        if page.locator('.ma__card.is-done').count() != 2:
            problems.append(f'{tag}: tras un fallo no debería haber más parejas resueltas')
    check_measure(page.evaluate(MEASURE), f'{tag} con feedback', problems)
    page.screenshot(path=os.path.join(out, f'{case}_{theme}_{size}_2feedback.png'), full_page=True)
    if page.evaluate(POS) != pos0:
        problems.append(f'{tag}: las tarjetas cambiaron de sitio al emparejar')

    # 3) Completar con un fallo: se envía solo, wrong, con las parejas.
    for i in range(1, n):
        left(page, i).click()
        right(page, i).click()
    page.wait_for_selector('.fb__verdict')
    calls = page.evaluate('window.__calls')
    expect = 'wrong' if n > 2 else 'correct'
    if len(calls) != 1 or calls[0].get('result') != expect:
        problems.append(f'{tag}: la respuesta enviada no fue {expect}: {calls}')
    if n > 2 and page.locator('.ma__correct').count() != 1:
        problems.append(f'{tag}: con un fallo no se mostraron las parejas')
    if page.locator('.ma__actions').is_visible():
        problems.append(f'{tag}: las acciones siguen visibles tras responder')
    check_measure(page.evaluate(MEASURE), f'{tag} completado', problems)
    page.screenshot(path=os.path.join(out, f'{case}_{theme}_{size}_3completado.png'), full_page=True)

    # 4) Sin fallos: correct, un solo envío, sin botón «Comprobar».
    fresh(page, case)
    for i in range(n):
        left(page, i).click()
        right(page, i).click()
    page.wait_for_selector('.fb__verdict')
    calls = page.evaluate('window.__calls')
    if len(calls) != 1 or calls[0].get('result') != 'correct':
        problems.append(f'{tag}: sin fallos no se envió un solo correct: {calls}')
    if not calls or not str(calls[0].get('responseRaw', '')).strip():
        problems.append(f'{tag}: el envío no llevó responseRaw')
    page.screenshot(path=os.path.join(out, f'{case}_{theme}_{size}_4correcta.png'), full_page=True)

    # 5) «No sé».
    fresh(page, case)
    page.get_by_role('button', name='No sé').click()
    page.wait_for_selector('.fb__verdict')
    calls = page.evaluate('window.__calls')
    if len(calls) != 1 or calls[0].get('result') != 'dont_know' or calls[0].get('dontKnow') is not True:
        problems.append(f'{tag}: «No sé» no envió dont_know: {calls}')
    if page.locator('.ma__correct').count() != 1:
        problems.append(f'{tag}: con «No sé» no se mostraron las parejas')
    check_measure(page.evaluate(MEASURE), f'{tag} no sé', problems)
    page.screenshot(path=os.path.join(out, f'{case}_{theme}_{size}_5nose.png'), full_page=True)

    # 6) Error de envío y reintento (solo en el caso de 5 parejas, en cada tema y tamaño).
    if case == 'cinco':
        fresh(page, case)
        page.evaluate('window.__fail = true')
        for i in range(n):
            left(page, i).click()
            right(page, i).click()
        page.wait_for_function("document.querySelector('.ma__msg') && document.querySelector('.ma__msg').textContent.trim() !== ''")
        retry = page.get_by_role('button', name='Enviar otra vez')
        if retry.count() != 1 or not retry.is_visible():
            problems.append(f'{tag}: tras el error no aparece «Enviar otra vez»')
        elif page.locator('.ma__card.is-done').count() != 2 * n:
            problems.append(f'{tag}: tras el error de envío se perdieron parejas')
        else:
            check_measure(page.evaluate(MEASURE), f'{tag} error de envío', problems)
            page.screenshot(path=os.path.join(out, f'{case}_{theme}_{size}_6error.png'), full_page=True)
            page.evaluate('window.__fail = false')
            retry.click()
            page.wait_for_selector('.fb__verdict')
            calls = page.evaluate('window.__calls')
            if len(calls) != 2 or calls[1].get('result') != 'correct':
                problems.append(f'{tag}: el reintento no envió un segundo correct: {calls}')

    real = [e for e in errors if 'favicon' not in e]
    if real:
        problems.append(f'{tag}: errores de consola {real[:3]}')
    ctx.close()
    return problems, notes


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--out', default='/tmp/match-shots')
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
