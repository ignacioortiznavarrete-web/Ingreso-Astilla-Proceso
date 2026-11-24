# Pruebas del panel

**Esto NO va a Apps Script.** Ninguno de estos archivos se pega en el
editor. Son `.js` y corren en **node**, en el computador, contra
`Codigo.gs` e `Index.html` leídos como texto.

Al proyecto de Apps Script del panel suben **tres** archivos y nada más:

| Sube | No sube |
|---|---|
| `Codigo.gs` | `pruebas/` |
| `Index.html` | `alertas/` (es otro proyecto) |
| `appsscript.json` | `README.md` y los `.md` |

El `.claspignore` de la raíz lo deja escrito, así que `clasp push` no
puede subirlos ni por error.

## Correrlas

```
node pruebas/gmail.js
node pruebas/planilla.js
node pruebas/camiones.js
node pruebas/dia.js
node pruebas/archivo.js
node pruebas/homologacion.js
node pruebas/descuadres.js
node pruebas/panel.js
```

| Archivo | Qué cuida |
|---|---|
| `gmail.js` | Que la búsqueda de Gmail no pierda un correo que la regla del asunto acepta |
| `planilla.js` | Que la tabla se lea como venga: con despachos, en cero y sin la fila de encabezados |
| `camiones.js` | Que el libro en vivo se lea como viene y que el cruce por guía no cuente un camión dos veces |
| `dia.js` | La proyección de cierre del día (08:30 a 23:00) y el plan convertido a camiones |
| `archivo.js` | Que la copia diaria caiga en la carpeta del mes que corresponde y no invente demoras en el día que ya pasó |
| `homologacion.js` | Los dos tiempos, los grupos de tres hojas y asignarlos de una vez |
| `descuadres.js` | Que la comparación planilla ↔ SAP solo afirme lo que se puede afirmar |
| `panel.js` | Que el panel dibuje lo que el servidor le manda: homologación y descuadres |

Las siete primeras leen `Codigo.gs` y `panel.js` lee `Index.html`;
todas recortan de ahí las funciones que necesitan, así que prueban el
código de verdad y no una copia. `panel.js` corre el dibujo con un DOM
de mentira: no abre un navegador.

Las alertas tienen las suyas aparte, en `alertas/pruebas/`.
