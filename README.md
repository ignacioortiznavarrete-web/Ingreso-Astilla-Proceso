# Ingreso Astilla Proceso

Planilla de control de suministro de astilla verde a proceso, hecha con
Google Apps Script sobre un spreadsheet. La unidad de trabajo es la
**tonelada seca (TS)**.

## Qué hace

- **Ingresos** (hoja) es la fuente válida: el registro real de recepción.
- **InformeAstilla** (hoja) guarda las planillas diarias del reservador,
  importadas desde Gmail. Solo complementa el desfase temporal: desde el
  día siguiente a la última `Fecha Contab.` de Ingresos y hasta la última
  planilla recibida, con `camiones × factor del material`.
- **Plan** (hoja) aporta precio unitario y volumen mensual comprometido
  por proveedor y material.
- **Proveedores** (hoja) es la tabla de equivalencias de nombres. Manda
  sobre el parecido automático.
- **Mapeos**, **Rutas** y **Apuntes** cubren la gestión de terreno y las
  reuniones semanales.

Cuando una fecha aparece en Ingresos, el estimado de esa fecha deja de
entrar automáticamente al dashboard.

### Factor por material

| Código SAP | Subproducto                | TS por camión |
|-----------:|----------------------------|--------------:|
|    3009003 | ASTILLA EUCALYPTUS NITENS  |          15,2 |
|    3009002 | AST. PINO VERDE C/ CORTEZA |          10,7 |
|    3000039 | ASTILLA PINO VERDE         |            11 |

## Archivos

| Archivo            | Qué es                                            |
|--------------------|---------------------------------------------------|
| `Codigo.gs`        | Todo el servidor: lectura, cruces, Gmail, Calendar |
| `Index.html`       | El dashboard (HTML + CSS + JS en un archivo)       |
| `appsscript.json`  | Manifiesto: zona horaria, scopes y Drive API v3    |

## El panel

Tres vistas: **Suministro** (la regla del mes, KPIs, gráficos, tablas y
plan de acción), **Mapeos** (aserraderos en el mapa y armado de rutas) y
**Apuntes** (pauta de la reunión semanal y su registro).

### Sistema visual

El color del dato significa una sola cosa, siempre la misma:

| Color    | Qué es                                     |
|----------|--------------------------------------------|
| Verde    | Ingreso real, confirmado en `Ingresos`     |
| Madera   | Complemento estimado del reservador        |
| Pizarra  | Plan (referencia, no material)             |
| Ladrillo | Riesgo: bajo plan, precio sin homologar    |

Nada decorativo usa esos cuatro. Tres familias tipográficas con un solo
trabajo cada una: **Fraunces** para titulares (serif con eje óptico, aire
de informe impreso), **Inter** para interfaz y tablas, **IBM Plex Mono**
para toda cifra.

Hay **modo claro y oscuro**: por defecto sigue al sistema y el
interruptor de la barra deja fija la preferencia. Las tablas anchas
mantienen fija la columna del proveedor al desplazarse, y hay hoja de
estilos de impresión para llevar el panel en papel a la reunión.

### Cuánta historia se ve

Dos reglas en `CONFIG`, y la ventana es la más larga de las dos:

| Ajuste | Qué hace |
|---|---|
| `HISTORY_MONTHS: 6` | Ventana móvil de seis meses hacia atrás |
| `HISTORY_DESDE_ENERO: true` | Además, nunca corta después del 1 de enero del año en curso |

La segunda existe porque una ventana móvil **no puede** significar «desde
enero»: en septiembre harían falta 9 meses, en octubre 10 y en marzo del
año siguiente 15. Subir el número arregla el mes en que se sube y se
vuelve a romper al siguiente. En enero manda la ventana móvil, que llega
más atrás, para que el panel no arranque el día 1 sin nada que comparar.

Estas filas viajan enteras al navegador. Si el panel se pone lento,
`HISTORY_MONTHS` es la perilla.

En pantalla, los atajos **Mes · 3 meses · Año** junto a las fechas
recorren esa historia sin escribir fechas a mano, y el aviso de arriba
dice desde cuándo hay datos. El plan solo se prorratea dentro del mes
vigente: con un rango más ancho, las columnas de plan quedan en «—» y
dicen por qué.

### Filtrar y ordenar

Cada tabla lleva su propia tira de mandos: búsqueda, las facetas que esa
tabla necesita (subproducto, fuente, brecha, tendencia, estado…) y la
cuenta de filas cuando algún filtro está puesto. Se suman a los filtros
globales de arriba, así que se puede acotar una tabla sin mover el resto
del panel.

El orden vive en el encabezado: un clic ordena por esa columna, otro da
vuelta el sentido. Los valores vacíos van siempre al final, porque «sin
precio» no es un precio de cero.

### Plan de acción

Agrupado por **caso**, no por proveedor: el guion de una conversación es
el mismo para todos los que están en esa situación, así que se dice una
vez y debajo va la lista de a quién llamar, con la **cinta de ingresos**
de cada uno —una barra por día hábil, verde lo recibido y madera lo
estimado— y las TS en juego.

Solo habla de suministro. Un proveedor sin precio homologado no genera
una conversación sino una fila que falta en el Plan o un alias que falta
en Proveedores: eso se cuenta al pie del panel y se arregla en la hoja.

## Instalación

1. Abrir el spreadsheet → **Extensiones › Apps Script**.
2. Pegar `Codigo.gs` y crear un archivo HTML llamado exactamente `Index`
   con el contenido de `Index.html`.
3. En **Servicios**, agregar **Drive API v3** (se necesita para leer las
   planillas que llegan como adjunto Excel).
4. Recargar el spreadsheet: aparece el menú **Astilla Dashboard**.
5. Desde ese menú: *Preparar hoja de proveedores*, *…de mapeos*,
   *…de rutas*, *…de apuntes* y, por último, *Instalar automatización*.

Con [clasp](https://github.com/google/clasp) instalado:

```bash
clasp login
clasp clone <SCRIPT_ID>   # deja el .clasp.json (ignorado por git)
clasp push
```

## Menú

| Ítem                                   | Qué hace                                        |
|----------------------------------------|-------------------------------------------------|
| Abrir dashboard                        | Abre el panel en un diálogo modal               |
| Importar nuevas planillas              | Lee Gmail y suma los correos no procesados      |
| Reconstruir planillas desde Gmail      | Respalda y reimporta todo el historial          |
| Probar último correo (sin escribir)    | Muestra qué extraería, sin tocar la hoja        |
| Diagnosticar cruce Ingresos vs planilla| Qué materiales y proveedores no están cruzando  |
| Validar hoja Plan                      | Solo lee y valida; no modifica formato          |
| Ubicar en el mapa                      | Geocodifica los aserraderos de la hoja Mapeos   |

## Origen de la planilla

Solo se acepta el correo **original** de `reservador.horario@masisa.com`
cuyo asunto **empieza** con `PLANILLA CUMPLIMIENTO SUB-PRODUCTOS` o
`CUMPLIMIENTO SUBPRODUCTOS`. Eso descarta `Re:`, `RV:` y `Fwd:`. Las
filas «Total…» y las que vienen sin proveedor se ignoran siempre: son
sumas y duplicarían los camiones.
