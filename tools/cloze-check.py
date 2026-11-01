#!/usr/bin/env python3
# @purpose: Verificación opcional en Chromium real del componente de huecos con banco a 360 px: toques de 44 px, sin desbordes, bandeja fija, marcas ✓/✗ con texto, comprobar, «No sé», deshacer, error de envío y reintento.
"""Verificación visual y de accesibilidad del componente `cloze_bank` (subparte 2.4, tramo 2, punto 5c). NO forma parte de `npm run check`.

Monta el componente REAL (ui/exercises/clozeBank.js) en una página anfitriona inyectada en memoria, bajo la misma CSP de la app,
a 360x640, en los 3 temas y con el texto en «Normal» y «Muy grande». Casos: `uno` (1 hueco), `tres` (3 huecos), `seis` (6 huecos y 20 palabras)
y `largo` (una palabra larguísima en la frase y en el banco). Para cada caso comprueba:
  - sin desbordes horizontales, objetivos táctiles de al menos 44 px (huecos, palabras y botones), sin palabras partidas en los botones,
  - «No sé» DENTRO de la pantalla sin desplazarse, y dos grupos con nombre («Frase» y «Palabras»),
  - poner una palabra la lleva al primer hueco y la bandeja NO cambia de sitio (en `largo` solo se avisa: una palabra enorme puede recolocar la frase),
  - «Comprobar» con huecos vacíos no envía y avisa; con todo mal envía `wrong`, marca los huecos con «✗» en su texto y muestra la frase correcta,
  - mezcla de aciertos y fallos: los buenos llevan «✓» y los malos «✗»,
  - todo bien envía un solo `correct` con `responseRaw`; «No sé» envía `dont_know` y muestra la frase; tras responder las acciones se ocultan,
  - deshacer y empezar de nuevo vacían los huecos paso a paso,
  - error de envío (caso `tres`): aparece el aviso y se puede volver a comprobar sin perder nada,
  - sin errores de consola.
Guarda capturas (por defecto en /tmp/cloze-shots: fuera del repo, TRAMPA-33). Sale con código 1 si algo falla y con 2 si Playwright no está instalado.

Uso:  python3 tools/cloze-check.py [--out /tmp/cloze-shots] [--cases uno,tres,seis,largo]
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
CASES = ['uno', 'tres', 'seis', 'largo']
LONG = 'supercalifragilisticoespialidosoextraordinariamenteinterminable'
# Por caso: palabras correctas (en el orden de los huecos) y palabras equivocadas (distractores del banco, del mismo largo).
WORDS = {
    'uno': {'right': ['is'], 'wrong': ['are']},
    'tres': {'right': ['get', 'have', 'go'], 'wrong': ['gets', 'has', 'goes']},
    'seis': {'right': ['woke', 'had', 'ate', 'took', 'went', 'came'], 'wrong': ['wake', 'have', 'eat', 'take', 'go', 'come']},
    'largo': {'right': [LONG, 'say'], 'wrong': ['sai', 'sey']},
}
GAPS = {k: len(v['right']) for k, v in WORDS.items()}

HOST_HTML = r"""<!doctype html>
<html lang="es" data-theme="aurora"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<link rel="stylesheet" href="/ui/styles/tokens.css"><link rel="stylesheet" href="/ui/styles/themes.css">
<link rel="stylesheet" href="/ui/styles/base.css"><link rel="stylesheet" href="/ui/styles/components.css">
<link rel="stylesheet" href="/ui/styles/widgets.css"></head>
<body><div class="app-shell"><main class="app-main" id="slot"></main></div><script type="module" src="/__host.js"></script></body></html>"""

HOST_JS = r"""
import { createClozeBank } from '/ui/exercises/clozeBank.js';
import { createRng } from '/core/rng.js';
const LONG = 'supercalifragilisticoespialidosoextraordinariamenteinterminable';
const ITEMS = {
  uno: { id: 'u', type: 'cloze_bank', prompt_es: 'Completa la frase.', data: { text: 'She ___ a teacher.', answers: [['is']], bank: ['is', 'are', 'am'] } },
  tres: { id: 't', type: 'cloze_bank', prompt_es: 'Completa la rutina de la mañana.', situation: 'Rutina diaria',
    data: { text: 'I ___ up at seven, ___ breakfast and ___ to school.', answers: [['get'], ['have'], ['go']], bank: ['get', 'have', 'go', 'gets', 'has', 'goes'] } },
  seis: { id: 's', type: 'cloze_bank', prompt_es: 'Completa el relato con el pasado.', situation: 'Ayer',
    data: { text: 'Yesterday I ___ up early, ___ a shower, ___ breakfast, ___ the bus, ___ to work and ___ home late.',
      answers: [['woke'], ['had'], ['ate'], ['took'], ['went'], ['came']],
      bank: ['woke', 'had', 'ate', 'took', 'went', 'came', 'wake', 'have', 'eat', 'take', 'go', 'come', 'woken', 'waked', 'has', 'eats', 'takes', 'goes', 'comes', 'wakes'] } },
  largo: { id: 'l', type: 'cloze_bank', prompt_es: 'Completa la frase, incluso con la palabra larga.', situation: 'Palabras enormes',
    data: { text: 'Nobody can ___ ' + LONG + ' and then ___ it twice.', answers: [[LONG], ['say']], bank: [LONG, 'say', 'sai', 'sey'] } },
};
let current = null;
window.__calls = [];
window.__fail = false;
window.mountCase = (name) => {
  if (current) current.destroy();
  window.__calls = [];
  window.__fail = false;
  document.getElementById('slot').replaceChildren();
  const comp = createClozeBank({ rng: createRng(7) });
  current = comp.mount(document.getElementById('slot'), ITEMS[name],
    { doc: document, win: window, submit: async (a) => { window.__calls.push(a); return window.__fail ? { status: 'error', message: 'No se pudo guardar. Inténtalo de nuevo.' } : { status: 'saved' }; } });
  return true;
};
window.__ready = true;
"""

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

TRAY_POS = r"""() => [...document.querySelectorAll('.cb__word')].map((b) => { const r = b.getBoundingClientRect(); return [b.dataset.index, Math.round(r.left), Math.round(r.top + window.scrollY)].join(':'); })"""
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


def tap(page, text):
    # Palabra exacta y libre de la bandeja (evita «go» dentro de «goes»). El clic de Playwright desplaza hasta que nada la tapa (la barra fija puede cubrirla).
    page.locator('.cb__tray .cb__word:not([aria-disabled="true"])').filter(has_text=re.compile(rf'^{re.escape(text)}$')).first.click()


def fresh(page, case):
    page.evaluate(f"window.mountCase('{case}')")
    page.wait_for_selector('.cb__gap')


def gap_texts(page):
    return page.locator('.cb__gap').evaluate_all('els => els.map((e) => e.textContent)')


def run_case(browser, base, theme, size, case, out):
    problems, notes = [], []
    n = GAPS[case]
    right, wrong = WORDS[case]['right'], WORDS[case]['wrong']
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
    if page.get_by_role('group', name='Frase').count() != 1 or page.get_by_role('group', name='Palabras').count() != 1:
        problems.append(f'{tag}: faltan los grupos «Frase» y «Palabras»')
    if page.locator('.cb__gap').count() != n:
        problems.append(f'{tag}: la frase debería tener {n} huecos')
    box = page.evaluate(BTN_BOX, 'No sé')
    if not box:
        problems.append(f'{tag}: no existe «No sé»')
    elif box['top'] < 0 or box['bottom'] > box['vh']:
        problems.append(f"{tag}: «No sé» NO está dentro de la pantalla sin desplazarse (y {round(box['top'])}–{round(box['bottom'])} de {round(box['vh'])})")
    else:
        notes.append(f"«No sé» termina en y={round(box['bottom'])}")
    cover = page.evaluate("() => { const a = document.querySelector('.cb__actions').getBoundingClientRect(); const t = document.querySelector('.cb__tray').getBoundingClientRect(); return Math.max(0, Math.min(a.bottom, t.bottom) - Math.max(a.top, t.top)); }")
    if cover > 0:
        notes.append(f'la barra de acciones tapa {round(cover)} px de la bandeja sin desplazar')
    page.screenshot(path=os.path.join(out, f'{case}_{theme}_{size}_1inicial.png'), full_page=True)

    # 2) Comprobar con huecos vacíos: no envía y avisa.
    page.get_by_role('button', name='Comprobar').click()
    if page.locator('.cb__msg').inner_text().strip() == '' or page.evaluate('window.__calls.length') != 0:
        problems.append(f'{tag}: comprobar con huecos vacíos debía avisar y no enviar')

    # 3) Poner una palabra: va al primer hueco y la bandeja no se mueve.
    pos0 = page.evaluate(TRAY_POS)
    tap(page, right[0])
    if gap_texts(page)[0] != right[0]:
        problems.append(f'{tag}: la palabra no fue al primer hueco: {gap_texts(page)}')
    if page.evaluate(TRAY_POS) != pos0:
        (notes if case == 'largo' else problems).append(f'{tag}: la bandeja cambió de sitio al poner una palabra')
    check_measure(page.evaluate(MEASURE), f'{tag} con una palabra', problems)

    # 4) Deshacer y empezar de nuevo.
    page.get_by_role('button', name='Deshacer').click()
    if any(t != '___' for t in gap_texts(page)):
        problems.append(f'{tag}: deshacer no vació el hueco: {gap_texts(page)}')
    for w in right[:2] if n > 1 else right:
        tap(page, w)
    page.get_by_role('button', name='Empezar de nuevo').click()
    if any(t != '___' for t in gap_texts(page)):
        problems.append(f'{tag}: empezar de nuevo no vació los huecos: {gap_texts(page)}')

    # 5) Todo mal: wrong, marcas ✗ en el texto, frase correcta.
    for w in wrong:
        tap(page, w)
    page.get_by_role('button', name='Comprobar').click()
    page.wait_for_selector('.fb__verdict')
    calls = page.evaluate('window.__calls')
    if len(calls) != 1 or calls[0].get('result') != 'wrong':
        problems.append(f'{tag}: todo mal no envió un solo wrong: {calls}')
    if page.locator('.cb__gap--off').count() != n or any('✗' not in t for t in gap_texts(page)):
        problems.append(f'{tag}: no todos los huecos malos llevan «✗»: {gap_texts(page)}')
    if page.locator('.cb__correct').count() != 1 or page.locator('.cb__review').count() != 1:
        problems.append(f'{tag}: faltan la frase correcta o la revisión')
    if page.locator('.cb__actions').is_visible():
        problems.append(f'{tag}: las acciones siguen visibles tras responder')
    check_measure(page.evaluate(MEASURE), f'{tag} todo mal', problems)
    page.screenshot(path=os.path.join(out, f'{case}_{theme}_{size}_2mal.png'), full_page=True)

    # 6) Mezcla (si hay 2 huecos o más): el primero bien y el resto mal → ✓ y ✗.
    if n > 1:
        fresh(page, case)
        tap(page, right[0])
        for w in wrong[1:]:
            tap(page, w)
        page.get_by_role('button', name='Comprobar').click()
        page.wait_for_selector('.fb__verdict')
        texts = gap_texts(page)
        if '✓' not in texts[0] or any('✗' not in t for t in texts[1:]) or page.locator('.cb__gap--ok').count() != 1:
            problems.append(f'{tag}: la mezcla no marcó un ✓ y el resto ✗: {texts}')
        page.screenshot(path=os.path.join(out, f'{case}_{theme}_{size}_3mezcla.png'), full_page=True)

    # 7) Todo bien: un solo correct, con responseRaw.
    fresh(page, case)
    for w in right:
        tap(page, w)
    page.get_by_role('button', name='Comprobar').click()
    page.wait_for_selector('.fb__verdict')
    calls = page.evaluate('window.__calls')
    if len(calls) != 1 or calls[0].get('result') != 'correct':
        problems.append(f'{tag}: todo bien no envió un solo correct: {calls}')
    if not calls or not str(calls[0].get('responseRaw', '')).strip():
        problems.append(f'{tag}: el envío no llevó responseRaw')
    if page.locator('.cb__correct').count() != 0:
        problems.append(f'{tag}: al acertar no debería mostrarse la frase correcta')
    page.screenshot(path=os.path.join(out, f'{case}_{theme}_{size}_4correcta.png'), full_page=True)

    # 8) «No sé».
    fresh(page, case)
    tap(page, wrong[0])
    page.get_by_role('button', name='No sé').click()
    page.wait_for_selector('.fb__verdict')
    calls = page.evaluate('window.__calls')
    if len(calls) != 1 or calls[0].get('result') != 'dont_know' or calls[0].get('dontKnow') is not True:
        problems.append(f'{tag}: «No sé» no envió dont_know: {calls}')
    if page.locator('.cb__correct').count() != 1:
        problems.append(f'{tag}: con «No sé» no se mostró la frase correcta')
    check_measure(page.evaluate(MEASURE), f'{tag} no sé', problems)
    page.screenshot(path=os.path.join(out, f'{case}_{theme}_{size}_5nose.png'), full_page=True)

    # 9) Error de envío y reintento (solo en el caso `tres`).
    if case == 'tres':
        fresh(page, case)
        page.evaluate('window.__fail = true')
        for w in right:
            tap(page, w)
        page.get_by_role('button', name='Comprobar').click()
        page.wait_for_function("document.querySelector('.cb__msg') && document.querySelector('.cb__msg').textContent.trim() !== ''")
        if page.locator('.fb__verdict').count() != 0 or gap_texts(page) != right:
            problems.append(f'{tag}: tras el error de envío se perdió algo: {gap_texts(page)}')
        else:
            check_measure(page.evaluate(MEASURE), f'{tag} error de envío', problems)
            page.screenshot(path=os.path.join(out, f'{case}_{theme}_{size}_6error.png'), full_page=True)
            page.evaluate('window.__fail = false')
            page.get_by_role('button', name='Comprobar').click()
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
    ap.add_argument('--out', default='/tmp/cloze-shots')
    ap.add_argument('--cases', default=','.join(CASES), help='casos a correr, separados por comas (por defecto todos)')
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
        for case in [c for c in args.cases.split(',') if c in CASES]:
            for theme in THEMES:
                for size in SIZES:
                    total += 1
                    try:
                        problems, notes = run_case(browser, base, theme, size, case, args.out)
                    except Exception as exc:  # un paso que no se puede hacer (p. ej. un botón fuera de pantalla) también es un fallo
                        problems, notes = [f'{case}/{theme}/{size}: el recorrido se interrumpió: {' / '.join(str(exc).splitlines()[:4])[:400]}'], []
                    failed += 1 if problems else 0
                    sys.stdout.write(f"{'✘' if problems else '✔'} {case} {theme} {size}" + (f" — {' | '.join(problems)}" if problems else f" ({'; '.join(notes)})") + '\n')
        browser.close()
    srv.shutdown()
    sys.stdout.write(json.dumps({'casos': total, 'fallos': failed}, ensure_ascii=False) + '\n')
    return 1 if failed else 0


if __name__ == '__main__':
    sys.exit(main())
