// @purpose: Descarga y lectura de archivos del navegador para el respaldo, con todo inyectable para probar con Node.
// Archivos del navegador para el respaldo (subparte 0.8, cuarto 3B). Todo inyectable (`doc`, `win`) para probar con Node.
//
//   createFileIO({ doc?, win? }) → {
//     download(filename, text, mime? = 'application/json')   baja un archivo de texto (enlace temporal con `download`).
//     pickFile({ accept? }) → Promesa de { name, text } | null   abre el selector de archivos; null si la persona cancela.
//                             Si el archivo no se puede leer devuelve { name, text: '' }. Pedir otro selector cancela el anterior.
//     destroy()                                                suelta un selector que haya quedado abierto.
//   }
// Nada se envía a ningún sitio: el archivo se lee y se baja en este mismo dispositivo.
export const BACKUP_ACCEPT = '.json,application/json';

export function createFileIO({ doc = globalThis.document, win = globalThis.window ?? globalThis } = {}) {
  let pending = null; // { finish }
  const api = {
    download(filename, text, mime = 'application/json') {
      const url = win.URL.createObjectURL(new win.Blob([text], { type: mime }));
      const a = doc.createElement('a');
      a.href = url;
      a.download = filename;
      a.style.display = 'none';
      doc.body.appendChild(a);
      a.click();
      a.remove();
      // El enlace temporal se suelta un poco después, cuando el navegador ya empezó la descarga.
      win.setTimeout(() => win.URL.revokeObjectURL(url), 4000);
    },
    pickFile({ accept = BACKUP_ACCEPT } = {}) {
      pending?.finish(null);
      return new Promise((resolve) => {
        const input = doc.createElement('input');
        input.type = 'file';
        input.accept = accept;
        input.style.display = 'none';
        let done = false;
        const finish = (value) => {
          if (done) return;
          done = true;
          input.removeEventListener('change', onChange);
          input.removeEventListener('cancel', onCancel);
          input.remove();
          if (pending?.finish === finish) pending = null;
          resolve(value);
        };
        const onCancel = () => finish(null);
        const onChange = async () => {
          const file = input.files?.[0];
          if (!file) { finish(null); return; }
          let text = '';
          try { text = await file.text(); } catch { /* no se pudo leer: la importación avisará de que está vacío */ }
          finish({ name: String(file.name ?? ''), text });
        };
        input.addEventListener('change', onChange);
        input.addEventListener('cancel', onCancel);
        pending = { finish };
        doc.body.appendChild(input);
        input.click();
      });
    },
    destroy() { pending?.finish(null); },
  };
  return api;
}
