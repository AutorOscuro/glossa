#!/usr/bin/env python3
# @purpose: Verificación opcional en Chromium real del componente de elección a 360 px: objetivos táctiles de 44 px, opciones largas completas, «No sé» a la vista y roles accesibles.
"""Verificación visual y de accesibilidad del componente `choice` (subparte 2.3, tramo 1). NO forma parte de `npm run check`.

Monta el componente REAL (ui/exercises/choice.js) en una página anfitriona que se inyecta en memoria (no hay archivos nuevos
que publicar) bajo la misma CSP de la app, a 360x640, en los 3 temas y con el texto en «Normal» y «Muy grande».
Casos: `simple` (4 opciones), `ab` (2 opciones), `largo` (8 opciones muy largas y un enunciado largo) y `multi` (selección múltiple).
Para cada caso comprueba:
  - sin desbordes horizontales (documento ni elementos),
  - objetivos táctiles de al menos 44 px (todas las opciones y los botones),
  - cada opción se ve COMPLETA: su texto cabe dentro de la caja de la opción, sin recortes,
  - el botón «No sé» existe y está DENTRO de la pantalla sin desplazarse, también con 8 opciones largas y con «Muy grande»,
  - tras responder las acciones se ocultan (el «Continuar» de la sesión ocupa ese sitio),
  - roles accesibles: radiogroup + radio (o group + checkbox en selección múltiple) y el hueco con nombre «hueco»,
  - al elegir y comprobar: la respuesta enviada es la esperada, la corrección marca la opción correcta con texto (no solo color) y no hay desbordes,
  - con «No sé»: se envía dont_know y se marca la respuesta correcta,
  - sin errores de consola.
Guarda capturas. Sale con código 1 si algo falla y con 2 si Playwright no está instalado.

Además (2.3-T2): la «Pista:» tras fallar (una sola, y una por opción en selección múltiple, con una palabra larguísima en la pista) a 360 px, en los 3 temas y en ambos tamaños.

Uso:  python3 tools/choice-check.py [--out shots]
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
CASES = ['simple', 'ab', 'largo', 'multi']
HINT_MODES = ['una', 'varias']

HOST_HTML = r"""<!doctype html>
<html lang="es" data-theme="aurora"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<link rel="stylesheet" href="/ui/styles/tokens.css"><link rel="stylesheet" href="/ui/styles/themes.css">
<link rel="stylesheet" href="/ui/styles/base.css"><link rel="stylesheet" href="/ui/styles/components.css">
<link rel="stylesheet" href="/ui/styles/widgets.css"></head>
<body><div class="app-shell"><main class="app-main" id="slot"></main></div><script type="module" src="/__host.js"></script></body></html>"""

HOST_JS = r"""
import { createChoice } from '/ui/exercises/choice.js';
import { createRng } from '/core/rng.js';
const LONG = 'supercalifragilisticoespialidosoextraordinariamenteinterminable'.repeat(2);
const SENT = 'She has been working at the same company for almost twelve years now, and she still enjoys every single day of it, especially the mornings.';
const ITEMS = {
  simple: { id: 's', type: 'choose_correct', prompt_es: 'Completa la frase.', prompt_en: 'She ___ to work every day.', situation: 'Hablar de la rutina',
    data: { options: ['go', 'goes', 'going', 'gone'], correct: 1 }, distractors: [{ text: 'go', code: 'GRM.S3' }, { text: 'going', code: 'GRM.ING' }, { text: 'gone', code: 'GRM.PP' }] },
  ab: { id: 'a', type: 'ab_natural', prompt_es: '¿Cuál suena más natural?',
    data: { options: ["I'm agree with you.", 'I agree with you.'], correct: 1 }, distractors: [{ text: "I'm agree with you.", code: 'GRM.BE_AGREE' }] },
  largo: { id: 'l', type: 'choose_correct', prompt_es: 'Elige la opción correcta para ' + LONG + ' en la reunión de mañana.', prompt_en: 'Which sentence is right? ' + LONG,
    data: { options: [SENT + ' (1)', SENT + ' (2)', LONG, SENT + ' (4)', 'Short one', SENT + ' (6)', SENT + ' (7)', SENT + ' (8)'], correct: 2 },
    distractors: [] },
  multi: { id: 'm', type: 'choose_correct', prompt_es: 'Elige las dos correctas.', prompt_en: 'Which are countable?',
    data: { options: ['apple', 'water', 'book', 'money', 'chair'], correct: [0, 2] }, distractors: [] },
};
const OKP = "I've lived here for two years.";
const D1P = 'I live here since two years.';
const D3P = 'I lived here for two years ago.';
const LONGHINT = 'Usa «for» con una duración y «since» con un inicio; no los mezcles. ' + 'supercalifragilisticoespialidosoextraordinariamenteinterminable';
const CATALOG = { has: (c) => c === 'TNS.SINCE_FOR' || c === 'TNS.PP_PS', hint: (c) => (c === 'TNS.SINCE_FOR' ? LONGHINT : 'Con «ago» se usa el pasado simple, no el present perfect.') };
const HINT_ITEM = { id: 'p', type: 'choose_correct', prompt_es: 'Elige la frase correcta.', situation: 'Presentarse con un nuevo vecino',
  data: { options: [OKP, D1P, D3P], correct: 0 }, distractors: [{ text: D1P, code: 'TNS.SINCE_FOR' }, { text: D3P, code: 'TNS.PP_PS' }] };
window.mountHint = (multiple) => {
  if (current) current.destroy();
  window.__calls = [];
  document.getElementById('slot').replaceChildren();
  const comp = createChoice({ rng: createRng(7), multiple, catalog: CATALOG });
  current = comp.mount(document.getElementById('slot'), HINT_ITEM,
    { doc: document, win: window, submit: async (a) => { window.__calls.push(a); return { status: 'saved' }; } });
  return true;
};
window.__calls = [];
let current = null;
window.mountCase = (name) => {
  if (current) current.destroy();
  window.__calls = [];
  document.getElementById('slot').replaceChildren();
  const comp = createChoice({ rng: createRng(7), multiple: name === 'multi' });
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
  for (const opt of document.querySelectorAll('.ch__option')) {
    const box = opt.getBoundingClientRect();
    const t = opt.querySelector('.ch__text');
    const tr = t.getBoundingClientRect();
    const inside = tr.left >= box.left - 0.5 && tr.right <= box.right + 0.5 && tr.top >= box.top - 0.5 && tr.bottom <= box.bottom + 0.5;
    const noClip = t.scrollWidth <= t.clientWidth + 1 && opt.scrollHeight <= opt.clientHeight + 1;
    if (!inside || !noClip) out.clipped.push([t.textContent.slice(0, 20), Math.round(tr.width), Math.round(box.width)]);
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
        problems.append(f"{label}: opciones con texto recortado {m['clipped'][:3]}")


def run_case(browser, base, theme, size, case, out):
    problems = []
    notes = []
    multi = case == 'multi'
    ctx = browser.new_context(viewport={'width': 360, 'height': 640}, device_scale_factor=2, is_mobile=True, has_touch=True)
    page = ctx.new_page()
    errors = []
    page.on('console', lambda m: errors.append(m.text) if m.type in ('error', 'warning') else None)
    page.on('pageerror', lambda x: errors.append(f'pageerror: {x}'))
    page.goto(f'{base}/__host.html')
    page.evaluate(f"document.documentElement.setAttribute('data-theme', '{theme}'); document.documentElement.setAttribute('data-text-size', '{size}')")
    page.wait_for_function('window.__ready === true')
    page.evaluate(f"window.mountCase('{case}')")
    page.wait_for_selector('.ch__option')
    tag = f'{case}/{theme}/{size}'
    n_options = page.locator('.ch__option').count()

    # 1) Estado inicial: medidas, roles, «No sé».
    check_measure(page.evaluate(MEASURE), f'{tag} inicial', problems)
    group_role, item_role = ('group', 'checkbox') if multi else ('radiogroup', 'radio')
    if page.get_by_role(group_role).count() != 1 or page.get_by_role(item_role).count() != n_options:
        problems.append(f'{tag}: roles accesibles esperados {group_role}/{item_role} x{n_options}')
    if case in ('simple', 'largo', 'multi') and page.get_by_role('img', name='hueco').count() != (1 if case == 'simple' else 0):
        problems.append(f'{tag}: cuenta de «hueco» inesperada')
    dont = page.get_by_role('button', name='No sé')
    if dont.count() != 1 or not dont.is_visible():
        problems.append(f'{tag}: «No sé» no está visible')
    else:
        box = page.evaluate("() => { const r = [...document.querySelectorAll('button')].find((b) => b.textContent.trim() === 'No sé').getBoundingClientRect(); return { top: r.top, bottom: r.bottom, vh: window.innerHeight }; }")
        notes.append(f"«No sé» termina en y={round(box['bottom'])} de {round(box['vh'])}")
        if box['top'] < 0 or box['bottom'] > box['vh']:
            problems.append(f"{tag}: «No sé» NO está dentro de la pantalla sin desplazarse (y {round(box['top'])}–{round(box['bottom'])} de {round(box['vh'])})")
    page.screenshot(path=os.path.join(out, f'{case}_{theme}_{size}_1inicial.png'), full_page=True)

    # 2) Elegir y comprobar. simple: la 2.ª visible no es necesariamente la correcta; se busca por texto.
    target = {'simple': 'goes', 'ab': 'I agree with you.', 'largo': LONG_TEXT, 'multi': None}[case]
    if multi:
        for word in ('apple', 'book'):
            page.locator('.ch__option', has_text=word).click()
        if page.locator('.ch__option[aria-checked="true"]').count() != 2:
            problems.append(f'{tag}: no se pudieron marcar dos opciones')
    else:
        page.locator('.ch__option', has_text=target).first.click()
        if page.locator('.ch__option[aria-checked="true"]').count() != 1:
            problems.append(f'{tag}: elegir una opción no la marcó')
    page.get_by_role('button', name='Comprobar').click()
    page.wait_for_selector('.fb__verdict')
    calls = page.evaluate('window.__calls')
    if len(calls) != 1 or calls[0].get('result') != 'correct':
        problems.append(f'{tag}: la respuesta enviada no fue correct: {calls}')
    if page.locator('.ch__flag', has_text='Correcta').count() < 1:
        problems.append(f'{tag}: la corrección no marca con texto la opción correcta')
    if page.locator('.ch__actions').is_visible():
        problems.append(f'{tag}: las acciones siguen visibles tras responder (taparían el «Continuar»)')
    if page.locator('.ch__option[aria-disabled="true"]').count() != n_options:
        problems.append(f'{tag}: tras responder las opciones deberían quedar bloqueadas')
    check_measure(page.evaluate(MEASURE), f'{tag} corrección', problems)
    page.screenshot(path=os.path.join(out, f'{case}_{theme}_{size}_2correccion.png'), full_page=True)

    # 3) «No sé» en un montaje nuevo: dont_know y respuesta marcada.
    page.evaluate(f"window.mountCase('{case}')")
    page.wait_for_selector('.ch__option')
    page.get_by_role('button', name='No sé').click()
    page.wait_for_selector('.fb__verdict')
    calls = page.evaluate('window.__calls')
    if len(calls) != 1 or calls[0].get('result') != 'dont_know' or calls[0].get('dontKnow') is not True:
        problems.append(f'{tag}: «No sé» no envió dont_know: {calls}')
    if page.locator('.ch__flag', has_text='Correcta').count() < 1:
        problems.append(f'{tag}: con «No sé» no se marcó la respuesta correcta')
    check_measure(page.evaluate(MEASURE), f'{tag} no sé', problems)
    page.screenshot(path=os.path.join(out, f'{case}_{theme}_{size}_3nose.png'), full_page=True)

    if errors:
        problems.append(f'{tag}: errores de consola {errors[:3]}')
    ctx.close()
    return problems, notes


HINT_WHY = r"""() => {
  const vw = document.documentElement.clientWidth;
  return [...document.querySelectorAll('.ch__why')].map((el) => {
    const r = el.getBoundingClientRect();
    return { text: el.textContent.trim(), left: Math.round(r.left), right: Math.round(r.right), top: Math.round(r.top), bottom: Math.round(r.bottom),
             clipped: el.scrollWidth > el.clientWidth + 1, vw, vh: window.innerHeight };
  });
}"""


def run_hint_case(browser, base, theme, size, mode):
    """«Pista:» tras fallar: una sola (selección única) o una por opción con su «texto» (selección múltiple), sin desborde ni recorte."""
    problems = []
    notes = []
    multi = mode == 'varias'
    tag = f'pista-{mode}/{theme}/{size}'
    ctx = browser.new_context(viewport={'width': 360, 'height': 640}, device_scale_factor=2, is_mobile=True, has_touch=True)
    page = ctx.new_page()
    errors = []
    page.on('console', lambda m: errors.append(m.text) if m.type in ('error', 'warning') else None)
    page.on('pageerror', lambda x: errors.append(f'pageerror: {x}'))
    page.goto(f'{base}/__host.html')
    page.evaluate(f"document.documentElement.setAttribute('data-theme', '{theme}'); document.documentElement.setAttribute('data-text-size', '{size}')")
    page.wait_for_function('window.__ready === true')
    page.evaluate(f"window.mountHint({'true' if multi else 'false'})")
    page.wait_for_selector('.ch__option')
    picks = ['I live here since two years.', 'I lived here for two years ago.'] if multi else ['I live here since two years.']
    for text in picks:
        page.locator('.ch__option', has_text=text).first.click()
    page.get_by_role('button', name='Comprobar').click()
    page.wait_for_selector('.fb__verdict')
    calls = page.evaluate('window.__calls')
    want = 2 if multi else 1
    if len(calls) != 1 or calls[0].get('result') != 'wrong' or len(calls[0].get('errors') or []) != want:
        problems.append(f"{tag}: la respuesta enviada no fue wrong con {want} error(es): {calls}")
    why = page.evaluate(HINT_WHY)
    if len(why) != want:
        problems.append(f'{tag}: se esperaban {want} bloque(s) de pista y hay {len(why)}')
    for w in why:
        if not multi and not w['text'].startswith('Pista:'):
            problems.append(f"{tag}: la pista única no empieza por «Pista:»: {w['text'][:40]}")
        if multi and '«' not in w['text']:
            problems.append(f"{tag}: una pista por opción debería nombrar la opción entre « »: {w['text'][:40]}")
        if w['left'] < -0.5 or w['right'] > w['vw'] + 0.5:
            problems.append(f"{tag}: la pista se sale de la pantalla en horizontal ({w['left']}–{w['right']} de {w['vw']})")
        if w['clipped']:
            problems.append(f'{tag}: el texto de la pista queda recortado')
        notes.append(f"pista y={w['top']}–{w['bottom']}")
    check_measure(page.evaluate(MEASURE), f'{tag} corrección', problems)
    page.screenshot(path=os.path.join(OUT_DIR[0], f'pista-{mode}_{theme}_{size}.png'), full_page=True)
    if errors:
        problems.append(f'{tag}: errores de consola {errors[:3]}')
    ctx.close()
    return problems, notes


OUT_DIR = ['shots']

LONG_TEXT = 'supercalifragilisticoespialidosoextraordinariamenteinterminable' * 2


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--out', default='choice-shots')
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
        OUT_DIR[0] = args.out
        for mode in HINT_MODES:
            for theme in THEMES:
                for size in SIZES:
                    total += 1
                    try:
                        problems, notes = run_hint_case(browser, base, theme, size, mode)
                    except Exception as exc:
                        problems, notes = [f'pista-{mode}/{theme}/{size}: el recorrido se interrumpió: {str(exc).splitlines()[0][:120]}'], []
                    failed += 1 if problems else 0
                    sys.stdout.write(f"{'✘' if problems else '✔'} pista-{mode} {theme} {size}" + (f" — {' | '.join(problems)}" if problems else f" ({'; '.join(notes)})") + '\n')
        browser.close()
    srv.shutdown()
    sys.stdout.write(json.dumps({'casos': total, 'fallos': failed}, ensure_ascii=False) + '\n')
    return 1 if failed else 0


if __name__ == '__main__':
    sys.exit(main())
