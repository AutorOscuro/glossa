// Ciclo de vida de vistas (subparte 0.4). Cada vista expone mount(root, params) y destroy().
// createView(setup) devuelve una FÁBRICA: cada llamada crea una instancia nueva y limpia.
//
//   const miVista = createView((ctx) => {
//     ctx.root.appendChild(h('p', 'Hola'));
//     ctx.on(boton, 'click', () => …);     // listener que se quita solo en destroy()
//     ctx.later(() => …, 300);              // temporizador que se cancela solo en destroy()
//     ctx.cleanup(() => …);                 // cualquier otra limpieza (se ejecuta en orden inverso)
//     // ctx.params, ctx.services, ctx.root, ctx.alive() (false tras destroy: úsalo tras un await)
//   });
//
// Garantías: destroy() es idempotente, nunca lanza (los errores de limpieza van a `log`), vacía la raíz y
// ejecuta TODAS las limpiezas aunque una falle. Si setup() lanza, lo ya registrado se limpia antes de relanzar.
// Una vista puede ser asíncrona: setup puede devolver una promesa; si la vista se destruye antes de que termine,
// el resultado se descarta y su limpieza (si la devuelve) se ejecuta de inmediato.
//
// view.listenerCount() cuenta los listeners/temporizadores vivos (lo usan las pruebas de "sin fugas").

export function createView(setup, { log = console.error } = {}) {
  if (typeof setup !== 'function') throw new Error('createView: setup debe ser una función');

  return function makeView() {
    let cleanups = [];
    let alive = false;
    let mounted = false;
    let root = null;

    const runCleanups = () => {
      const list = cleanups;
      cleanups = [];
      for (let i = list.length - 1; i >= 0; i -= 1) {
        try {
          list[i]();
        } catch (e) {
          log('Error al limpiar una vista', e);
        }
      }
    };

    const ctx = {
      root: null,
      params: {},
      services: {},
      alive: () => alive,
      cleanup(fn) {
        if (typeof fn !== 'function') throw new Error('ctx.cleanup: se necesita una función');
        if (!alive) { fn(); return; }
        cleanups.push(fn);
      },
      on(el, type, fn, options) {
        if (!alive) return () => {};
        el.addEventListener(type, fn, options);
        let active = true;
        const off = () => {
          if (!active) return;
          active = false;
          el.removeEventListener(type, fn, options);
        };
        cleanups.push(off);
        return off;
      },
      later(fn, ms) {
        if (!alive) return null;
        const id = setTimeout(() => {
          if (alive) fn();
        }, ms);
        cleanups.push(() => clearTimeout(id));
        return id;
      },
    };

    return {
      mount(target, params = {}, services = {}) {
        if (mounted) throw new Error('La vista ya está montada');
        mounted = true;
        alive = true;
        root = target;
        ctx.root = target;
        ctx.params = params;
        ctx.services = services;
        let result;
        try {
          result = setup(ctx);
        } catch (e) {
          this.destroy();
          throw e;
        }
        if (result && typeof result.then === 'function') {
          return result.then(
            (cleanupFn) => {
              if (typeof cleanupFn === 'function') {
                if (alive) cleanups.push(cleanupFn);
                else cleanupFn();
              }
            },
            (e) => {
              this.destroy();
              throw e;
            },
          );
        }
        if (typeof result === 'function') cleanups.push(result);
        return undefined;
      },
      destroy() {
        if (!mounted && !alive) return;
        alive = false;
        mounted = false;
        runCleanups();
        if (root && typeof root.replaceChildren === 'function') {
          try {
            root.replaceChildren();
          } catch (e) {
            log('No se pudo vaciar la raíz de la vista', e);
          }
        }
        root = null;
        ctx.root = null;
      },
      listenerCount: () => cleanups.length,
    };
  };
}
