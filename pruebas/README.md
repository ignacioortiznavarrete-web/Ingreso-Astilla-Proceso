# Pruebas del panel

**Esto NO va a Apps Script.** Ninguno de estos archivos se pega en el
editor. Son `.js` y corren en **node**, en el computador, contra el
código de `Codigo.gs` leído como texto.

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
```

| Archivo | Qué cuida |
|---|---|
| `gmail.js` | Que la búsqueda de Gmail no pierda un correo que la regla del asunto acepta |
| `planilla.js` | Que la tabla se lea en sus dos formas: con despachos y en cero |

Las dos leen `Codigo.gs` y recortan de ahí las funciones que necesitan,
así que prueban el código de verdad y no una copia.

Las alertas tienen las suyas aparte, en `alertas/pruebas/`.
