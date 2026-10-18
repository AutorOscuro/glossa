#!/usr/bin/env python3
"""Corre la suite de contrato de almacenamiento contra IndexedDB REAL en Chromium (subparte 0.7B). NO forma parte de `npm run check`.
Sirve el repo por http, abre tests/browser/idb-contract.html y muestra cada prueba. Sale con código 1 si algo falla.
Requiere Python 3 + Playwright con Chromium.   Uso:  python3 tools/idb-check.py [events]
(sin argumento: suite de contrato de almacenamiento; con `events`: contrato de events.log, subparte 1.1)
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
    page_name = 'events-idb.html' if len(sys.argv) > 1 and sys.argv[1] == 'events' else 'idb-contract.html'
    from playwright.sync_api import sync_playwright
    handler = functools.partial(http.server.SimpleHTTPRequestHandler, directory=ROOT)
    handler.log_message = lambda *a, **k: None
    srv = http.server.ThreadingHTTPServer(('127.0.0.1', PORT), handler)
    threading.Thread(target=srv.serve_forever, daemon=True).start()
    page_errors = []
    with sync_playwright() as p:
        browser = p.chromium.launch()
        page = browser.new_page()
        page.on('pageerror', lambda e: page_errors.append(str(e)))
        page.on('console', lambda m: print('  consola:', m.text) if m.type in ('error', 'warning') else None)
        page.goto(f'http://127.0.0.1:{PORT}/tests/browser/{page_name}')
        end = time.time() + 300
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
