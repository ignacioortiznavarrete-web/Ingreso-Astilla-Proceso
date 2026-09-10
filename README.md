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

Cuatro vistas: **Suministro** (la regla del mes, KPIs, gráficos, tablas
y plan de acción), **Comparación** (el año partido por mes),
**Mapeos** (aserraderos en el mapa y armado de rutas) y **Apuntes**
(pauta de la reunión semanal y su registro).

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

### Cifras dentro de los gráficos

Los gráficos se pegan en presentaciones, donde no hay cursor: una cifra
que solo vive en el globo, en una lámina no existe. Por eso cada marca
va rotulada, con tres reglas:

- **Solo si cabe.** Antes de rotular se compara el rótulo más largo
  contra el ancho disponible por marca. Con el rango en «Año» —187
  días— no se dibuja ninguno: a esa densidad el gráfico es una forma,
  no una tabla.
- **Un formato por serie.** El techo de la serie decide si todo va en
  entero (`874`, `1.036`) o todo en corto (`19,1k`). Mezclar `874` con
  `1k` en el mismo gráfico obliga a convertir de cabeza para comparar
  dos barras vecinas.
- **Nunca sobre otra cosa.** Los rótulos se dibujan al final, con un
  halo del color del papel, para que una traza que pase por encima no
  los tache. Donde hay dos series —precio y volumen— se rotula una
  sola.

En el acumulado no se rotula cada día sino las tres cifras que se
buscan: dónde va el real, dónde termina el plan y dónde termina la
proyección.

### Brecha vs plan a la fecha

El Pareto dice quién es grande; este gráfico dice quién está en deuda,
que no es lo mismo: un proveedor chico que entregó la mitad de su plan
es una llamada más urgente que uno grande que entregó el 98%.

Barras divergentes, un proveedor por fila: a la izquierda lo que no
llegó, a la derecha lo que se adelantó, contra el plan prorrateado a
los días hábiles corridos. Se muestran los diez más desviados en
cualquiera de los dos sentidos, ordenados de la peor brecha a la mejor.

El eje se arma sobre el rango real de los datos —no simétrico— porque a
mitad de mes casi todos caen del mismo lado y media lámina en blanco no
dice nada. La comparación no se pierde: la escala es lineal, así que un
-500 y un +500 siguen midiendo lo mismo.

Depende del plan prorrateado, así que solo aparece con el mes vigente
seleccionado; con cualquier otro rango dice por qué no está.

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

### Comparación entre meses

Suministro responde «cómo va este mes». Comparación responde «cómo viene
el año, y quién cambió». Son cuatro paneles:

- **El año, mes a mes** — una columna por mes, verde lo real y rayado lo
  estimado, con el plan del mes como travesaño encima.
- **Quién despachó cada mes** — matriz proveedor × mes. El tono de cada
  celda es su volumen contra **el mejor mes de ese mismo proveedor**, no
  contra los demás, así que la fila se lee como una tendencia y un hueco
  es un mes en que no despachó.
- **Resumen por mes** — real, estimado, plan, cumplimiento, proveedores,
  precio ponderado y costo valorizado.
- **Mezcla de subproductos por mes** — para ver un cambio de mezcla que
  el total esconde.

Dos diferencias de fondo con Suministro, y conviene tenerlas presentes:

1. **El plan no se prorratea.** Un mes cerrado se compara con su plan
   completo; prorratear un mes terminado sería inventar un objetivo que
   ya no existe. Los planes salen de todas las columnas de mes de la
   hoja `Plan`, y se acotan con el filtro: si se filtra por pino verde,
   el plan también.
2. **No usa los filtros de Suministro.** Tiene los suyos y siempre mira
   toda la historia disponible; «comparar meses» con un rango de un mes
   no compara nada.

**El mes en curso está marcado en todas partes** —un `·` en la columna,
«en curso» en el resumen, un aviso arriba— y queda fuera de las cifras
que lo volverían mentira: el cumplimiento del período se calcula solo
sobre meses cerrados, y la columna de tendencia compara los **dos
últimos meses cerrados**, no el mes a medias contra el anterior. Sin
eso, cada proveedor aparecía cayendo un 20% el día 10 del mes.

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
