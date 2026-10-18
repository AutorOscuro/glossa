HITO M0 — Primera publicación: la app instalable y sólida — versión 0.9.0 — tiempo estimado: 15 min de pruebas (más unos 30 min la primera vez para crear el repositorio)
Preparación: sigue `docs/DEPLOY.md`, Parte 1, pasos 1 a 4, hasta tener tu dirección `https://TU-USUARIO.github.io/sophia-ingles/`. Usa el Chrome del Android, con internet. Esta guía junta las pruebas en cola de la 0.3, 0.4, 0.5, 0.6, 0.7 y 0.8, ordenadas por pantalla. Lo marcado (Opcional) puedes saltarlo si vas justo de tiempo. Ten a mano el administrador de archivos (carpeta Descargas).

BIENVENIDA E INSTALACIÓN (0.6, 0.7, 0.8)
1. Abre tu dirección. Debes ver "Cargando…" y enseguida la BIENVENIDA ("¡Hola! Me alegra que estés aquí", "Paso 1 de 3"): es la primera vez. Nada de pantalla en blanco ni de avisos de "solo memoria" o de error de datos. Puede salir una sola vez el aviso verde "Lista para usar sin conexión."
2. Escribe "William" en el nombre (el teclado no debe tapar el campo ni corregirlo) y toca "Siguiente". Toca Baja, Normal y Alta: se marca la tocada. "Atrás" conserva "William". Elige Normal, "Siguiente": la pantalla 3 dice "William, así funciona esto:". Toca "Empezar": llegas a "Hoy" y el botón atrás NO vuelve a la bienvenida. (Opcional: con TalkBack, cada pantalla anuncia su título.)
3. Toca ⋮ → "Instalar app" (o "Añadir a pantalla de inicio") e instálala. El icono debe mostrar a Chispa entera sobre fondo azul oscuro, sin recortarse. Ábrela desde ahí: pantalla completa, sin barra de direcciones. Ciérrala del todo y ábrela: va directo a "Hoy", sin bienvenida.

PESTAÑAS Y ERRORES (0.4)
4. Abajo hay 5 pestañas: Hoy, Mapa, Practicar, Errores, Más. Toca cada una: cambia el título y solo la tocada queda resaltada. La barra no se mueve ni la tapa la barra de gestos. Toca Mapa, luego Errores y usa atrás dos veces: vuelves a Mapa y luego a Hoy.
5. En "Más" debe verse "Versión de la app: 0.9.0". Toca "Probar un aviso": aviso verde sobre la barra que desaparece solo a los ~4 s. Toca "Simular un error": sale "Algo no salió bien" con "Reintentar" y "Copiar detalle" y la barra sigue funcionando; "Reintentar" vuelve a "Más". En la barra de direcciones cambia el final por `#/lo-que-sea`: sale "No encontramos esa pantalla" con "Ir a Hoy".

AJUSTES (0.8)
6. En "Más" → "Abrir Ajustes". Debes ver 10 tarjetas en este orden: Apariencia, Repaso, Sonido y vibración, Inteligencia artificial, Pronunciación (Azure), Respaldo, Claves, Bienvenida, Acerca de (versión 0.9.0) y Zona de peligro.
7. Cambia el Tema (4 opciones) y el Tamaño de texto (4 niveles): cambian al instante y nada se corta, ni en "Muy grande". Arrastra con el dedo los deslizadores de Repaso y prueba los interruptores. Cierra la app del todo y ábrela: se conserva todo. Anota si ves un parpadeo del tema anterior al abrir.
8. Clave de IA: pega `prueba-123`. Mostrar/ocultar enseña y esconde lo escrito. Al guardar dice que está guardada y el campo ya NO la muestra; Chrome NO ofrece "Guardar contraseña". Bórrala.
9. Respaldo: con la casilla de claves apagada, "Exportar respaldo" baja un archivo y avisa que no incluye tus claves (dime dónde quedó en Descargas). "Importar respaldo" abre el selector; elige ese archivo: sale "¿Reemplazar tu progreso?" con su nombre; cancelar no cambia nada y "Reemplazar" avisa "Respaldo restaurado". Con una foto en vez del respaldo sale un aviso amable y nada cambia.
10. Tarjeta "Bienvenida" → "Repetir bienvenida": sale con "William" ya escrito. Vacía el nombre y termina con "Empezar": llegas a "Hoy"; atrás vuelve a Ajustes.
11. Zona de peligro → "Borrar todo" (hazlo al final de las pruebas de Ajustes): pide escribir BORRAR. El teclado deja escribir en mayúsculas, el botón de confirmar sigue apagado con otra palabra y cancelar no borra nada. Escribe BORRAR y confirma: aviso "Todo borrado", tema y tamaño vuelven a los de fábrica y TE QUEDAS en Ajustes. Cierra la app del todo y ábrela: sale la bienvenida otra vez ("Saltar por ahora" te lleva a "Hoy").

GALERÍA DE COMPONENTES (0.3, 0.5)
12. Abre `<tu dirección>/ui/styles/demo.html`. Debes ver "Galería de componentes". Baja hasta el final: nada se sale por los lados. Toca Aurora, Neo y Claro: colores y fondo cambian al instante y todo se lee bien en los tres. Los botones "Deshabilitado" se ven apagados y no responden.
13. Toca "Abrir hoja": sube desde abajo sin quedar tapada por la barra de gestos. Ciérrala de tres formas, una por vez: arrastrando el asa hacia abajo, tocando fuera y con "Entendido". Con la hoja abierta, toca dos veces rápido "Abrir hoja": NO debe cerrarse sola. Toca el "?" junto a "Nivel 3": debe salir un aviso y ser fácil de tocar.
14. Toca "Peligro": "Borrar" está apagado hasta que escribas BORRAR en mayúsculas. En el campo "Tu respuesta" el teclado NO debe poner mayúscula sola ni corregir. Mueve el deslizador de tiempo (15 … 120 min): valor y relleno cambian a la vez. (Opcional: con "quitar animaciones" activado en el teléfono, la mascota se queda quieta.)

SIN CONEXIÓN Y ACTUALIZACIÓN (0.6, 0.7)
15. Activa el MODO AVIÓN. Cierra la app del todo y ábrela desde el icono: debe abrir y mostrar "Hoy" (o la pantalla en que estabas, nunca pantalla blanca). Toca "Mapa" y vuelve: funciona. Ciérrala y ábrela otra vez: sigue igual. Desactiva el modo avión.
16. (Opcional, se hace con el siguiente zip que te dé el chat) Actualización: súbelo según `docs/DEPLOY.md`, Parte 2, espera 2 minutos y abre la app con internet. Debe salir un aviso fijo "Hay una actualización disponible." con "Ahora no" y "Actualizar". No se va solo ni recarga la app sola. "Ahora no" lo quita y vuelve a salir al reabrir; "Actualizar" recarga UNA vez.

Si algo no coincide: copia este formato y pégalo en el chat:
BUG
Dónde: <pantalla o pestaña>
Qué hice: <pasos, con el número de paso de esta guía>
Qué esperaba:
Qué pasó:
Versión (Ajustes → Acerca de):
Detalle copiado de la app (si salió "Copiar detalle"):
Si quedaste con la versión vieja, sigue "Si algo falla" de `docs/DEPLOY.md`. No borres datos del sitio sin hacer antes un respaldo: borra tu progreso. No pegues tu clave real en ningún chat ni captura.
