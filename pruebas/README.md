# Pruebas

**Nada de esta carpeta va a Apps Script.** Ningún archivo de acá se
pega en el editor. Son `.js`, corren en **node** en el computador, y
leen los `.gs` y el `.html` de los proyectos como texto para probarlos.

La regla, por si alguna vez hay dudas frente al editor:

> **Se pega lo que termina en `.gs` o en `.html`. Lo que termina en
> `.js` o en `.md`, nunca.**

Por eso el repositorio está partido en tres carpetas:

```
panel/      ← se pega en el proyecto del panel
alertas/    ← se pega en el proyecto del aviso diario
pruebas/    ← esta. No se pega en ninguna parte
  panel/      prueba lo de panel/
  alertas/    prueba lo de alertas/
```

Y cada proyecto lleva su `.claspignore`, que va al revés de lo normal
—ignora todo y después deja pasar, uno por uno, solo sus archivos—,
así que `clasp push` tampoco puede subir esto por error.

## Correrlas

```
node pruebas/panel/gmail.js
node pruebas/panel/planilla.js
node pruebas/panel/camiones.js
node pruebas/panel/dia.js
node pruebas/panel/archivo.js
node pruebas/panel/homologacion.js
node pruebas/panel/descuadres.js
node pruebas/panel/panel.js

node pruebas/alertas/prueba.js
node pruebas/alertas/feriados.js
```

Las once de una vez:

```
for f in pruebas/panel/*.js pruebas/alertas/*.js; do node "$f" || break; done
```

## Las del panel

| Archivo | Qué cuida |
|---|---|
| `gmail.js` | Que la búsqueda de Gmail no pierda un correo que la regla del asunto acepta |
| `planilla.js` | Que la tabla se lea como venga: con despachos, en cero y sin la fila de encabezados |
| `camiones.js` | Que el libro en vivo se lea como viene y que el cruce por guía no cuente un camión dos veces |
| `dia.js` | La proyección de cierre del día (08:30 a 23:00), los tramos de cada camión y el plan convertido a camiones |
| `archivo.js` | Que la copia diaria caiga en la carpeta del mes que corresponde y no invente demoras en el día que ya pasó |
| `homologacion.js` | Los dos tiempos, los grupos de tres hojas y asignarlos de una vez |
| `descuadres.js` | Que la comparación planilla ↔ SAP solo afirme lo que se puede afirmar |
| `panel.js` | Que el panel dibuje lo que el servidor le manda: homologación, descuadres y el conteo de camiones por material |

Las siete primeras leen `panel/Codigo.gs` y `panel.js` lee
`panel/Index.html`; todas recortan de ahí las funciones que necesitan,
así que prueban el código de verdad y no una copia. `panel.js` corre el
dibujo con un DOM de mentira: no abre un navegador.

## Las del aviso

| Archivo | Qué cuida |
|---|---|
| `prueba.js` | Que el correo diario diga lo que corresponde y a quién corresponde |
| `feriados.js` | Que los feriados del aviso y los del panel den exactamente la misma lista |
| `entorno.js` | No es una prueba: es el Apps Script de mentira que las otras dos usan |

`feriados.js` existe porque `alertas/Feriados.gs` es una **copia** del
módulo del panel: son dos proyectos distintos y no comparten código, así
que lo único que impide que se separen es una prueba que los compare.
