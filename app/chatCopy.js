// @purpose: Copia un bloque de texto al portapapeles para llevarlo al chat y dice cómo salió (copiado o a mano); nunca lanza (2.8-T3 punto 2).
// Pegamento sin DOM. Misma regla que la hoja «Preguntas IA»: si el portapapeles falta o falla, el motivo va al log y quien llama muestra el texto para copiarlo a mano.
//
//   copyForChat(text, clipboard, { log? }) → Promesa de { status:'copied' } | { status:'manual', text }
//     clipboard  { writeText(texto) }; sin él o si falla → 'manual'.
export async function copyForChat(text, clipboard, { log = console.error } = {}) {
  try {
    if (!clipboard || typeof clipboard.writeText !== 'function') throw new Error('Portapapeles no disponible');
    await clipboard.writeText(text);
    return { status: 'copied' };
  } catch (e) {
    try { log('No se pudo copiar el bloque', e); } catch { /* el log nunca debe romper */ }
    return { status: 'manual', text };
  }
}
