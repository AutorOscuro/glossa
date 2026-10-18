// Pruebas del ciclo de vida de vistas (ui/views/_viewBase.js, subparte 0.4): sin fugas, idempotente, errores, asíncrono.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { h as domH } from '../ui/dom.js';
import { createView } from '../ui/views/_viewBase.js';
import { makeEnv, makeTimers } from './_fakeDom.mjs';

const mk = () => {
  const env = makeEnv();
  const root = env.doc.createElement('main');
  env.doc.body.appendChild(root);
  return { ...env, ...domH.with(env.doc), root };
};

test('mount renderiza, pasa params y services; destroy vacía la raíz', () => {
  const { h, root } = mk();
  const make = createView((ctx) => { ctx.root.appendChild(h('p', `${ctx.params.id}/${ctx.services.x}`)); });
  const v = make();
  v.mount(root, { id: 'a' }, { x: 'b' });
  assert.equal(root.textContent, 'a/b');
  v.destroy();
  assert.equal(root.childNodes.length, 0);
});

test('destroy quita TODOS los listeners (la prueba cuenta listeners): 0 fugas', () => {
  const { h, root, stats, win } = mk();
  const timers = makeTimers();
  const make = createView((ctx) => {
    const b1 = h('button');
    const b2 = h('button');
    ctx.root.appendChild(b1);
    ctx.root.appendChild(b2);
    ctx.on(b1, 'click', () => {});
    ctx.on(b1, 'focus', () => {});
    ctx.on(b2, 'click', () => {});
    ctx.on(win, 'resize', () => {});
    ctx.on(win, 'resize', () => {});
  });
  const before = stats.live();
  const v = make();
  v.mount(root);
  assert.equal(stats.live() - before, 5);
  assert.equal(v.listenerCount(), 5);
  v.destroy();
  assert.equal(stats.live() - before, 0);
  assert.equal(v.listenerCount(), 0);
  void timers;
});

test('muchas montadas y destruidas seguidas no acumulan listeners (50 ciclos)', () => {
  const { h, root, stats } = mk();
  const make = createView((ctx) => {
    const b = h('button');
    ctx.root.appendChild(b);
    ctx.on(b, 'click', () => {});
  });
  const before = stats.live();
  for (let i = 0; i < 50; i += 1) { const v = make(); v.mount(root); v.destroy(); }
  assert.equal(stats.live(), before);
});

test('destroy es idempotente y destroy sin mount no falla', () => {
  const { root } = mk();
  let cleaned = 0;
  const make = createView((ctx) => { ctx.cleanup(() => { cleaned += 1; }); });
  const v = make();
  v.destroy();
  v.mount(root);
  v.destroy();
  v.destroy();
  assert.equal(cleaned, 1);
});

test('montar dos veces la misma instancia lanza; una instancia nueva sí puede', () => {
  const { root } = mk();
  const make = createView(() => {});
  const v = make();
  v.mount(root);
  assert.throws(() => v.mount(root), /ya está montada/);
  v.destroy();
  assert.doesNotThrow(() => make().mount(root));
});

test('las limpiezas corren en orden inverso y una que falla no impide las demás', () => {
  const { root } = mk();
  const order = [];
  const logs = [];
  const make = createView((ctx) => {
    ctx.cleanup(() => order.push('a'));
    ctx.cleanup(() => { throw new Error('rota'); });
    ctx.cleanup(() => order.push('c'));
  }, { log: (...a) => logs.push(a) });
  const v = make();
  v.mount(root);
  v.destroy();
  assert.deepEqual(order, ['c', 'a']);
  assert.equal(logs.length, 1);
});

test('si setup lanza, se limpia lo ya registrado y el error se relanza', () => {
  const { h, root, stats } = mk();
  const make = createView((ctx) => {
    const b = h('button');
    ctx.root.appendChild(b);
    ctx.on(b, 'click', () => {});
    throw new Error('fallo al montar');
  });
  const before = stats.live();
  const v = make();
  assert.throws(() => v.mount(root), /fallo al montar/);
  assert.equal(stats.live(), before);
  assert.equal(root.childNodes.length, 0);
});

test('setup puede devolver una función de limpieza: se ejecuta en destroy', () => {
  const { root } = mk();
  let n = 0;
  const v = createView(() => () => { n += 1; })();
  v.mount(root);
  v.destroy();
  assert.equal(n, 1);
});

test('ctx.later: el temporizador se cancela en destroy y no corre después', () => {
  const { root } = mk();
  let ran = 0;
  const real = globalThis.setTimeout;
  const timers = makeTimers();
  globalThis.setTimeout = timers.setTimeout;
  const realClear = globalThis.clearTimeout;
  globalThis.clearTimeout = timers.clearTimeout;
  try {
    const v = createView((ctx) => { ctx.later(() => { ran += 1; }, 100); ctx.later(() => { ran += 10; }, 200); })();
    v.mount(root);
    timers.advance(150);
    v.destroy();
    timers.advance(1000);
    assert.equal(ran, 1);
    assert.equal(timers.pending(), 0);
  } finally {
    globalThis.setTimeout = real;
    globalThis.clearTimeout = realClear;
  }
});

test('vista asíncrona: si se destruye antes de terminar, se descarta y se limpia al final', async () => {
  const { root } = mk();
  let cleaned = 0;
  let release;
  const gate = new Promise((r) => { release = r; });
  const v = createView(async (ctx) => {
    await gate;
    assert.equal(ctx.alive(), false);
    return () => { cleaned += 1; };
  })();
  const p = v.mount(root);
  v.destroy();
  release();
  await p;
  assert.equal(cleaned, 1);
});

test('vista asíncrona que rechaza: se destruye y la promesa rechaza con el mismo error', async () => {
  const { root, h, stats } = mk();
  const before = stats.live();
  const v = createView(async (ctx) => {
    const b = h('button');
    ctx.on(b, 'click', () => {});
    throw new Error('async roto');
  })();
  await assert.rejects(() => v.mount(root), /async roto/);
  assert.equal(stats.live(), before);
});

test('tras destroy, ctx.on y ctx.later no registran nada (uso tardío tras un await)', async () => {
  const { root, h, stats } = mk();
  let ctxRef;
  const v = createView((ctx) => { ctxRef = ctx; })();
  v.mount(root);
  v.destroy();
  const before = stats.live();
  assert.equal(typeof ctxRef.on(h('button'), 'click', () => {}), 'function');
  assert.equal(ctxRef.later(() => {}, 5), null);
  assert.equal(stats.live(), before);
});

test('createView exige una función', () => {
  assert.throws(() => createView(null), /setup debe ser una función/);
});
