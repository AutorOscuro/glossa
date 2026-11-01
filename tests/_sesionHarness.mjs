// @purpose: Ayudantes compartidos de las pruebas de la vista de sesión (2.1-T3): DOM falso, servicios de estudio reales, anfitrión de ejercicios falso y apertura de una sesión nueva.
// 2.1-T3. Lo usan tests/sesionView.test.mjs y tests/sesionView.adversarial.test.mjs; no contiene pruebas.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { makeEnv } from './_fakeDom.mjs';
import { createStudyServices } from '../app/services.js';
import { createMemoryDb } from '../core/db.memory.js';
import { createErrorCatalog } from '../core/errorCatalog.js';
import { createRng } from '../core/rng.js';
import { makeClock } from './_helpers.mjs';
import sesion from '../ui/views/sesion.js';

const read = (p) => JSON.parse(fs.readFileSync(new URL(`../${p}`, import.meta.url), 'utf8'));
export const CATALOG = createErrorCatalog(read('content/taxonomy/error_codes.json'));
export const TOPICS = read('content/taxonomy/topics.json').topics;
export const TOPIC = 'gram.be.present_forms';

export const fakeVisibility = () => {
  let hidden = false; const subs = new Set();
  return { hidden: () => hidden, onChange: (fn) => { subs.add(fn); return () => subs.delete(fn); }, set(v) { hidden = v; for (const f of [...subs]) f(); } };
};

// Anfitrión de ejercicios falso: dibuja un botón «Comprobar» que responde por ejCtx.submit.
export function fakeHost({ answer = { result: 'correct', exerciseType: 'fix_error' }, failMount = false } = {}) {
  const calls = { mounted: [], destroyed: 0, ctxs: [], results: [] };
  return {
    calls,
    async mount(slot, entry, ejCtx) {
      if (failMount) throw new Error('ejercicio roto');
      calls.mounted.push(entry); calls.ctxs.push(ejCtx);
      const doc = globalThis.document;
      const btn = doc.createElement('button'); btn.textContent = 'Comprobar';
      const onClick = async () => { calls.results.push(await ejCtx.submit(answer)); };
      btn.addEventListener('click', onClick);
      slot.appendChild(btn);
      return { destroy() { calls.destroyed += 1; btn.removeEventListener('click', onClick); btn.remove(); } };
    },
  };
}

export async function mk({ cards = 3, params = { id: 'nueva' }, host = fakeHost(), noStudy = false, noDb = false, wrapStudy = (s) => s, services: extra = {}, clock: given, db: givenDb } = {}) {
  const env = makeEnv();
  globalThis.document = env.doc;
  const clock = given ?? makeClock('2026-10-26T15:00:00.000Z');
  const db = givenDb ?? createMemoryDb(); if (!givenDb) await db.open();
  const logs = [];
  const study = createStudyServices({ db: noDb ? null : db, catalog: CATALOG, topics: TOPICS, clock, rng: createRng(3), log: () => {} });
  if (!givenDb) for (let i = 0; i < cards; i += 1) await db.put('cards', study.srs.newCard(`it00${i}`, 0, clock.now(), [TOPIC]));
  const nav = []; const toasts = [];
  const vis = fakeVisibility();
  const services = {
    study: noStudy ? null : wrapStudy(study), studyReady: Promise.resolve(), visibility: vis,
    navigate: (...a) => nav.push(a), toast: { show: (m) => toasts.push(m) }, ...(host ? { exercises: host } : {}), ...extra,
  };
  const root = env.doc.getElementById('app'); root.replaceChildren();
  const realError = console.error;
  console.error = (...a) => logs.push(a);
  const view = sesion();
  const mount = async (p = params) => { try { await view.mount(root, p, services); } finally { console.error = realError; } };
  await mount();
  const q = (sel) => root.querySelectorAll(sel);
  const btn = (text) => q('button').find((b) => b.textContent === text);
  const click = (el) => el.dispatchEvent({ type: 'click', preventDefault() {} });
  const dialog = () => env.doc.body.querySelectorAll('[role="alertdialog"]')[0] ?? null;
  const dlgBtn = (text) => dialog()?.querySelectorAll('button').find((b) => b.textContent === text);
  const foot = () => q('.session__foot')[0];
  const progressText = () => q('.progress-bar__text')[0]?.textContent ?? null;
  const events = () => db.query('events', {});
  return { env, db, study, clock, vis, nav, toasts, logs, root, view, q, btn, click, dialog, dlgBtn, foot, progressText, events, services, host, flush: env.flush };
}

// Abre la sesión nueva como lo haría el router: la ruta `nueva` guarda y manda a #/sesion/<id>; se monta de nuevo con ese id.
export async function openNew(t) {
  const loaded = await t.study.session.load();
  assert.equal(loaded.status, 'restored');
  t.view.destroy();
  const second = sesion();
  t.view2 = second;
  t.root.replaceChildren();
  await second.mount(t.root, { id: loaded.sessionId }, t.services);
  return loaded.sessionId;
}

