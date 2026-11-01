#!/usr/bin/env python3
"""Corre la suite de contrato de almacenamiento contra IndexedDB REAL en Chromium (subparte 0.7B). NO forma parte de `npm run check`.
Sirve el repo por http, abre tests/browser/idb-contract.html y muestra cada prueba. Sale con código 1 si algo falla.
Requiere Python 3 + Playwright con Chromium.   Uso:  python3 tools/idb-check.py [events|errors|clear|sync|study]
(sin argumento: suite de contrato de almacenamiento; con `sync`: el puente con el chat y el respaldo, subparte 1.12; con `events`: contrato de events.log, subparte 1.1; con `errors`: registro de errores y detector, subparte 1.6; con `study`: guardado atómico, sesión, foto diaria y repasos adelantados, subparte 2.1-T2; con `clear`: banco de medidas del borrado de almacenes, subparte 1.12-T1; el segundo argumento opcional es la consulta de la página, p. ej. `clear only=wipe&runs=3`)
"""
import functools
import http.server
import os
import sys
import threading
import time

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PORT = 8766


def main():
    pages = {'events': 'events-idb.html', 'errors': 'errors-idb.html', 'clear': 'clear-idb.html', 'sync': 'sync-idb.html', 'study': 'study-idb.html'}
    page_name = pages.get(sys.argv[1], 'idb-contract.html') if len(sys.argv) > 1 else 'idb-contract.html'
    from playwright.sync_api import sync_playwright
    class Quiet(http.server.SimpleHTTPRequestHandler):
        def log_message(self, *args, **kwargs):
            return None

    handler = functools.partial(Quiet, directory=ROOT)
    srv = http.server.ThreadingHTTPServer(('127.0.0.1', PORT), handler)
    threading.Thread(target=srv.serve_forever, daemon=True).start()
    page_errors = []
    with sync_playwright() as p:
        browser = p.chromium.launch()
        page = browser.new_page()
        page.on('pageerror', lambda e: page_errors.append(str(e)))
        page.on('console', lambda m: print('  consola:', m.text) if m.type in ('error', 'warning') else None)
        query = f'?{sys.argv[2]}' if len(sys.argv) > 2 else ''
        page.goto(f'http://127.0.0.1:{PORT}/tests/browser/{page_name}{query}')
        end = time.time() + (900 if page_name == 'clear-idb.html' else 300)
        while time.time() < end and not page.evaluate('globalThis.__sophia && globalThis.__sophia.done'):
            time.sleep(0.2)
        data = page.evaluate('globalThis.__sophia')
        print('Chromium', browser.version)
        browser.close()
    srv.shutdown()
    res = data['results']
    for r in res:
        mark = {'pass': '✔', 'skip': '-', 'fail': '✘'}[r['status']]
        print(f"{mark} {r['name']}")
        if r['status'] == 'fail':
            print('    ' + r['error'].replace('\n', '\n    '))
    for line in data['log']:
        print(line)
    n = {k: sum(1 for r in res if r['status'] == k) for k in ('pass', 'skip', 'fail')}
    print(f"\n{n['pass']} aprobadas · {n['skip']} omitidas · {n['fail']} fallidas · {len(page_errors)} errores de página")
    for e in page_errors:
        print('  pageerror:', e)
    if not data['done'] or n['fail'] or page_errors or n['pass'] == 0:
        sys.exit(1)


if __name__ == '__main__':
    main()
