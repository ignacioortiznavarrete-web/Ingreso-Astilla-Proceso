# Ingreso Astilla Proceso

Planilla de control de suministro de astilla verde a proceso, hecha con
Google Apps Script sobre un spreadsheet. La unidad de trabajo es la
**tonelada seca (TS)**.

## Qué hace

- **Ingresos** (hoja) es la fuente válida: el registro real de recepción.
- **InformeAstilla** (hoja) guarda las planillas diarias del reservador,
  importadas desde Gmail. Completa los días que Ingresos todavía no
  tiene, con `camiones × factor del material`.
- **Plan** (hoja) aporta precio unitario y volumen mensual comprometido
  por proveedor y material.
- **Proyeccion** (hoja) son los camiones que cada proveedor se
  compromete a mandar, por día hábil. Ver más abajo.
- **Proveedores** (hoja) es la tabla de equivalencias de nombres. Manda
  sobre el parecido automático.
- **Mapeos**, **Rutas** y **Apuntes** cubren la gestión de terreno y las
  reuniones semanales.

**La decisión es día por día, no una fecha de corte.** Un día con TS en
Ingresos manda entero y su estimado se descarta; un día que en Ingresos
suma cero —porque aún no se carga, o quedó como hueco entre dos días ya
cargados— se completa con la planilla. Antes había una sola fecha de
corte, y eso daba por supuesto que Ingresos viene sin huecos: cuando uno
aparecía, el día salía en cero en el panel aunque la planilla tuviera
camiones esa fecha. El aviso de arriba dice qué días se completaron así,
porque son los que hay que ir a cargar.

La unidad es el día completo y no el proveedor: dentro de una misma
fecha, mezclar las dos fuentes contaría dos veces los camiones que ya
llegaron a SAP.

### Cuando SAP carga el día a medias

La base del complemento es el **día completo**: un día con TS en
Ingresos manda entero. Es así a propósito —mezclar las dos fuentes
dentro de una misma fecha contaría dos veces los camiones que ya
llegaron a SAP si la homologación del nombre falla—.

Pero un día puede venir cargado **a medias**, y ahí esa regla borra
despachos que existieron. Dos excepciones, las dos atadas a poder
afirmar **con certeza** que SAP no tiene eso:

| | Quién | Por qué es seguro |
|---|---|---|
| **ajeno** | El proveedor que Ingresos no nombra ni una vez en toda la ventana | No hay nada suyo en SAP, ningún día: no hay con qué contarlo dos veces |
| **rezagado** | El que **sí** está en SAP pero a quien le falta **este** día | Su nombre cruzó exacto o escrito a mano, así que «SAP no tiene nada suyo ese día» es una afirmación confiable |

El rezagado es el caso de **AITUE**: entrega nitens, es el único que
entrega nitens, y su día quedó sin cargar mientras el resto del día sí
se cargó. La regla del día completo descartaba su planilla entera y el
nitens de esa fecha desaparecía —que es justamente lo que lo hace fácil
de ver—.

**El «seguro» no es un detalle.** Con un cruce por *parecido* no se
puede afirmar que SAP no tiene nada de ese proveedor ese día, porque
puede ser otro proveedor; ahí sí se contaría dos veces. Por eso el
parecido no basta y hay que confirmarlo en Homologación —esa
confirmación es lo que habilita el complemento—.

Las dos se corrigen solas: el día que Ingresos cargue lo que falta, la
fila se descarta como cualquier otra. Y las dos se dicen en la nota de
Suministro, con nombre y fecha, porque son exactamente lo que hay que ir
a cargar.

### Factor por material

| Código SAP | Subproducto                | TS por camión |
|-----------:|----------------------------|--------------:|
|    3009003 | ASTILLA EUCALYPTUS NITENS  |          15,2 |
|    3009002 | AST. PINO VERDE C/ CORTEZA |          10,7 |
|    3000039 | ASTILLA PINO VERDE         |            11 |

## Archivos

Al proyecto de Apps Script del panel suben **tres** archivos:

| Archivo            | Qué es                                            |
|--------------------|---------------------------------------------------|
| `Codigo.gs`        | El servidor: lectura, cruces, Gmail, Calendar      |
| `Index.html`       | El dashboard (HTML + CSS + JS en un archivo)       |
| `appsscript.json`  | Manifiesto: zona horaria, scopes y Drive API v3    |

Y estos **no** suben:

| Carpeta            | Qué es                                            |
|--------------------|---------------------------------------------------|
| `pruebas/`         | Pruebas en **node**, no en Apps Script. Ver `pruebas/README.md` |
| `alertas/`         | Otro proyecto de Apps Script: el correo diario     |

`pruebas/` son archivos `.js` que corren en el computador con node y
leen `Codigo.gs` como texto. **Nunca se pegan en el editor de Apps
Script**, y el `.claspignore` de la raíz lo deja escrito para que
`clasp push` no pueda subirlos ni por error: ignora todo y después deja
pasar solo los tres de arriba.

`alertas/` tampoco es parte de este proyecto: es otro, con su propio
manifiesto y sus propios permisos, que abre la misma planilla en modo
lectura. Ver `alertas/README.md`. El panel no manda correo.

## El panel

Cinco vistas: **Suministro** (la regla del mes, KPIs, gráficos, tablas
y plan de acción), **Comparación** (el año partido por mes),
**Homologación** (nombres de la planilla y de Proyección que no
cruzan con SAP),
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
  sola. Dentro de una barra lisa van en color papel sin halo; sobre un
  rayado conservan el halo, que es lo único que los recorta contra las
  franjas.
- **Las reglas van ancladas a `.grafico`.** `.grafico text` ya fija
  `fill` y le gana en especificidad a una clase suelta: sin el ancla,
  todos los rótulos salen gris `--ink-3` en vez de su color. Y
  `.rotulo` ya existía como clase de versalitas, que además les metía
  `letter-spacing` y mayúsculas a las cifras.

En el acumulado no se rotula cada día sino las tres cifras que se
buscan: dónde va el real, dónde termina el plan y dónde termina la
proyección.

### Cómo cerraría el mes

Cuatro cifras que juntan las tres cosas de la conversación —plan,
ingreso y proyección— en la única pregunta que se hace a mitad de mes:
**con cuánto terminamos**.

| Cifra | Qué es |
|---|---|
| Ingresado a la fecha | Real + estimado de los días corridos |
| Comprometido del mes | Todo lo escrito en `Proyeccion` para el mes, días pasados incluidos |
| Cumple el compromiso | De lo prometido que ya venció, cuánto llegó |
| Cierre con proyección | Lo entrado más lo que falta por llegar, contra el plan del mes |
| Brecha al cierre | Cuánto sobra o falta al terminar así |

**La promesa no caduca.** «Comprometido del mes» cuenta el mes entero y
no se encoge al avanzar los días: antes solo mostraba lo que quedaba por
llegar, así que a fin de mes la proyección se había evaporado y no
quedaba contra qué comparar. Lo que sí distingue el panel son dos cosas
distintas por día: `comprometido` (lo que prometieron, siempre) y
`proyectado` (la parte de eso que todavía cuenta para el cierre, o sea
solo la de los días que no han pasado).

Hay **dos cierres** en el panel y no son lo mismo:

- **Al ritmo actual** (en la lectura de arriba) estira lo que va del mes
  hasta el último día. No sabe nada de compromisos: si el mes viene
  flojo porque faltó una semana, lo proyecta flojo para siempre.
- **Con proyección** suma a lo entrado los camiones comprometidos día
  por día. Es el que sirve para llamar por teléfono, porque cada TS
  tiene un proveedor y una fecha detrás.

Se ven los dos juntos: el comprometido es la cifra grande y el del ritmo
va en su pie, para poder leer la distancia entre lo que prometieron y lo
que vienen haciendo. Por eso la tarjeta vieja pasó a llamarse «Cierre al
ritmo actual»: se llamaba «Proyección de cierre» y no proyecta nada de
la hoja `Proyeccion`.

Los días salen de `cubosDiarios()`, el mismo reparto que dibujan los dos
gráficos de abajo, así que la cifra y la barra no pueden decir cosas
distintas. De ahí salen también las dos reglas que evitan inflar el
cierre:

- **Un día ya despachado no vuelve a sumar su compromiso.** Manda lo que
  entró; la proyección solo rellena el día del que no se sabe nada.
- **Un día pasado sin despacho cuenta cero, no se proyecta.** Su
  compromiso ya venció.

Debajo, tres avisos cuando corresponde: cuántos días hábiles quedan sin
un solo camión escrito (el cierre los cuenta como cero), cuánto falta
por comprometer para llegar al plan, y cuántos proveedores de
`Proyeccion` no cruzan con SAP.

Solo aparece con el mes vigente seleccionado; con otro rango dice por
qué no está.

### Día a día y semana a semana: plan, ingreso y proyección

Dos gráficos sobre el mismo dato, a dos acercamientos. El diario
responde «qué día se cayó»; el semanal, «cómo viene la semana». Los dos
juntan las tres cosas de esa conversación: cuánto tocaba, cuánto entró
y cuánto viene comprometido.

**Lo que entra un día no hábil se suma al día hábil anterior, y no se
muestra aparte.** Un sábado no tiene columna propia: el camión que
llegó ese sábado se despachó, en la práctica, en la semana del
viernes. Vale igual para un feriado en que igual llegó un camión.
Antes ese volumen no se perdía del total del panel, pero no aparecía
en estos gráficos: los dos sumaban solo días hábiles y lo del fin de
semana quedaba fuera.

La regla vale para **todos** los gráficos por día del panel, incluido
«Ingreso diario por fuente», que la tenía distinta: mostraba el sábado
con columna propia mientras los otros dos lo sumaban al viernes, y el
mismo mes se veía de dos formas según dónde se mirara. El mapeo fecha
→ día hábil se arma una vez por carga y lo usan todos.

El arrastre **no se marca por columna**. Para la operación el camión
del sábado ES del viernes, y una señal en esa columna hace preguntar
qué pasó ahí cuando no pasó nada. La regla se dice una vez en la nota
del panel, y el globo del día que lo trae nombra la fecha, por si
alguien va a buscarla.

La hoja **Proyeccion** tiene esta forma:

| Col | Qué |
|---|---|
| A | Material, en celdas combinadas (`Astilla Verde o 3000039`) |
| B | Proveedor |
| C… | `Dia 1`, `Dia 2`, … con **camiones**, no toneladas |

Tres cosas que conviene saber:

- **`Dia N` es el N-ésimo día HÁBIL del mes en curso.** No hay fecha en
  ninguna celda de esa hoja, así que el anclaje vive en el código
  (`readProyeccion_`). Cambiarlo cambia a qué semana cae cada columna.
  Esto se recalcula solo cada mes: no hay nada anclado a un mes
  concreto.
- **Un mes puede tener menos días hábiles que columnas.** La hoja tiene
  23 y un mes va de 20 a 23 según feriados: en un mes de 20, las
  columnas `Dia 21`–`Dia 23` no caen en ninguna fecha. Lo que se
  escriba ahí **no entra**, así que el panel lo dice con el número de
  camiones y las columnas involucradas. 23 es el máximo posible, así
  que nunca faltan columnas; sobran.
- **El proveedor de la columna B pasa por el mismo cruce que la
  planilla.** Esa hoja la escribe la misma mano, y se nota: `Madeex`,
  `Guivar`, `La Orilla`, `Foresol` y `FORESOL` en filas distintas. Sin
  cruzarlos, un camión proyectado y uno recibido caen sobre dos
  proveedores distintos. Con el cruce —la hoja `Proveedores` primero, el
  parecido después— **34 de los 46 nombres escritos hoy** llegan a su
  proveedor de SAP. Los 12 que no salen en la pestaña Homologación, con
  sus camiones comprometidos, y en la nota de Suministro. Sus camiones
  **sí** cuentan en el total del día: lo comprometido es lo
  comprometido; lo que no se puede es compararlos contra su plan.
- **Los camiones se convierten con el factor del material de la columna
  A**, no con un promedio: un camión de nitens no pesa lo que uno de
  pino con corteza.
- **La fila 1 de esa hoja lleva las etiquetas `Dia 1…` y a la vez un
  proveedor**, así que ese proveedor no puede cargar camiones sin pisar
  las etiquetas. El panel lo dice por su nombre; se arregla insertando
  una fila de encabezado arriba.

Cada barra es una semana (lunes a domingo) y significa siempre lo
mismo: **lo que se espera terminar teniendo**. Para eso se decide día
por día, con la misma precedencia que el resto del panel — SAP manda,
la planilla tapa el hueco, la proyección rellena solo el día del que
todavía no se sabe nada. Sumarlas contaría dos veces el camión que la
planilla ya reportó y la proyección prometía. Un día pasado sin nada es
un día sin despacho, no un día por proyectar: su proyección ya venció.

El travesaño pizarra es el plan del mes repartido entre los días
hábiles de esa semana.

### La semana: lo prometido y lo que llegó

El gráfico semanal lleva **dos barras por semana**: a la izquierda,
rayada, lo que los proveedores comprometieron en `Proyeccion` para esa
semana; a la derecha, lo que entró. El travesaño pizarra es el plan.

La barra de la promesa se dibuja completa **aunque la semana ya haya
pasado**. Antes se apagaba al llegar el día —la proyección solo existía
hacia adelante— y una semana cerrada quedaba sin nada con qué
compararse, que es justo cuando interesa saber si cumplieron.

Debajo, **Cumplimiento por proveedor, semana a semana**: quién prometió
qué y quién lo cumplió. Abre en la última semana cerrada —la de la
reunión del lunes— y el selector recorre las demás.

| Columna | Qué es |
|---|---|
| Camiones comp. | Los camiones escritos en `Proyeccion` para esos días |
| Comprometido | Esos camiones en TS, con el factor de su material |
| Ingresó | Lo que realmente entró esa semana |
| Diferencia · Cumple | Lo segundo contra lo primero |
| Plan semana | El plan mensual del proveedor prorrateado a esos días |

Tres decisiones que conviene saber:

- **Se cruza por proveedor, no por proveedor y material.** La llamada es
  al proveedor. Quien prometió nitens y trajo pino cumplió el tonelaje;
  el material queda en la columna de al lado.
- **Solo entra quien tiene algo que contestar**: comprometió, trajo, o
  las dos. Uno que esa semana ni prometió ni despachó sería una fila de
  guiones —para el plan sin ingreso está la brecha del mes—.
- **La regla del fin de semana es la misma** que en los gráficos: lo que
  llega sábado cuenta en el viernes.

La nota de arriba dice quién trajo sin haber comprometido nada y quién
prometió y no despachó.

Esto necesita el detalle por día **y** por proveedor, así que
`readProyeccion_` guarda un `porFecha` dentro de cada proveedor y no solo
el total del mes.

### Brecha vs plan a la fecha

El Pareto dice quién es grande; este gráfico dice quién está en deuda,
que no es lo mismo: un proveedor chico que entregó la mitad de su plan
es una llamada más urgente que uno grande que entregó el 98%.

Barras divergentes, un proveedor por fila: a la izquierda lo que no
llegó, a la derecha lo que se adelantó, contra el plan prorrateado a
los días hábiles corridos. Se muestran los diez más desviados en
cualquiera de los dos sentidos, ordenados de la peor brecha a la mejor.

Solo entran los proveedores **con plan este mes**. Uno con fila en la
hoja `Plan` pero la celda del mes en blanco no tiene brecha que medir:
como su plan a la fecha es cero, su ingreso entero salía como barra
verde y parecía el más adelantado del mes, además de empujar fuera del
top a las brechas de verdad. Se mira el plan del mes y no el
prorrateado, porque el primer día hábil el prorrateo todavía es cero
para todos y el filtro vaciaría el gráfico. Si alguno de los excluidos
igual despachó, la nota del panel lo nombra: falta una fila en el Plan.

El eje se arma sobre el rango real de los datos —no simétrico— porque a
mitad de mes casi todos caen del mismo lado y media lámina en blanco no
dice nada. La comparación no se pierde: la escala es lineal, así que un
-500 y un +500 siguen midiendo lo mismo.

Depende del plan prorrateado, así que solo aparece con el mes vigente
seleccionado; con cualquier otro rango dice por qué no está.

### Feriados: se calculan, no se escriben

Eran una lista escrita a mano que terminaba el 25-12-2026. Una lista así
no se acaba con un aviso: se acaba en silencio. Pasado el último año, el
1 de enero y el 18 de septiembre pasan a contar como días hábiles, el
plan a la fecha queda inflado, el mapeo `Dia N` de Proyección se corre y
el correo cuenta mal los días de silencio. Nadie se entera hasta que los
números están mal hace semanas.

Ahora `CONFIG.FERIADOS` los calcula para el año en curso y dos a cada
lado, cada vez que se abre el panel. No hay nada que renovar.

| Feriado | De dónde sale |
|---|---|
| Viernes y Sábado Santo | Domingo de Pascua, algoritmo gregoriano anónimo |
| Pueblos Indígenas | Solsticio de junio (Ley 21.357), fórmula de Meeus en hora de Chile |
| 29 de junio y 12 de octubre | Ley 19.973: al lunes de su semana si caen martes a jueves, al lunes siguiente si caen viernes |
| 31 de octubre | Ley 20.299: al viernes anterior si cae martes, al siguiente si cae miércoles |
| Los nueve de fecha fija | Tal cual |

Al contrastar el cálculo contra la lista vieja aparecieron **dos** errores
que llevaban tiempo ahí:

- El Viernes Santo de 2024 estaba escrito como 19-04 —que es el de 2025—
  y el de verdad, 29-03, faltaba.
- El lunes **21-09-2026** estaba marcado como feriado y no lo es. La Ley
  20.215 corre el día solo cuando el 18 cae martes o el 19 cae viernes, y
  en 2026 caen viernes y sábado. Con él adentro ese lunes no era hábil, y
  el arrastre al hábil anterior lo mandaba al **jueves 17** —al otro lado
  del 18, 19 y 20—: dos días de despacho aparecían como uno solo. Además
  septiembre contaba 20 días hábiles en vez de 21, así que el plan a la
  fecha y el mapeo `Dia N` de Proyección también salían corridos.

**Lo único que sigue a mano** es `FERIADOS_EXTRA`, hoy vacío. Ahí va
**solo** el feriado que declara una ley para un año concreto y que ninguna
regla predice; no va un día que la planta no trabaja —para eso está
`WORKDAYS`—. Escribir de menos cuesta un día; escribir de más junta dos
días en uno, que es peor porque no se nota. La prueba exige que nada de
`FERIADOS_EXTRA` repita algo que la regla ya calcula.

`alertas/Feriados.gs` es una copia del mismo módulo —son dos proyectos de
Apps Script distintos, no comparten código—. `alertas/pruebas/feriados.js`
corre las dos copias contra el calendario real de 2024, 2025 y 2026 y
exige que den lo mismo, así que si una se toca sin la otra, la prueba lo
dice.

### Lo que sí caduca

| Qué | Cuándo | Qué pasa si nadie lo toca |
|---|---|---|
| Columnas de `Proyeccion` | Cada mes de menos de 23 días hábiles | Los camiones escritos en las columnas que sobran se descartan |

Avisa solo en la nota de arriba de Suministro: dice cuántos camiones
quedaron fuera y en qué columnas están.

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

### Homologación: un proveedor, un nombre

SAP escribe cada proveedor de **una** sola forma. La planilla del
reservador lo escribe de muchas: `PROMASA S.A.`, `Promasa`,
`PROMASA SPA`. Cuando un nombre no cruza, el panel no lo corrige: lo
deja pasar con el nombre que traía, y ahí aparece un proveedor nuevo
que en realidad ya existía. **Eso es la duplicidad.**

Entran las **tres** hojas que escriben nombres de proveedor:
`InformeAstilla` (la planilla del reservador), `Proyeccion` y `Plan`.
Cada fila dice de cuál viene, y una sola asignación las arregla todas:
el cruce es el mismo para las tres.

### Solo lo del mes en curso

La lista de revisión mira **toda la historia cargada** —seis meses, o
desde enero—, y ahí un nombre que apareció una vez en marzo pesa lo
mismo que el que llegó ayer. Para sentarse a homologar eso estorba: lo
que hay que resolver es lo del mes que se está mirando.

El selector de arriba acota las dos listas de trabajo —«Sin par en
SAP» y «Cruzados por parecido»— y **abre en el mes en curso**, sea
septiembre, octubre o el que toque: sale de `DATA.month`, no hay ningún
mes escrito en el código.

| Origen del nombre | Cuándo es del mes |
|---|---|
| Planilla | Su **última** fecha cae dentro del mes |
| Proyección | Siempre: esa hoja numera los días hábiles de este mes |
| Plan | Siempre: se lee la columna de este mes |

Las cifras de arriba siguen al alcance. Si la tabla muestra tres y la
tarjeta dice doce, la tarjeta miente.

Y **nada se esconde callado**: al costado del selector se dice cuántos
nombres quedan fuera (`1 nombre más en meses anteriores`), y están a un
clic.

> Cuidado al tocar `esDelMes`: **`Plan` es principio de `Planilla`**.
> Buscar el origen como texto suelto hace pasar a todos y el filtro deja
> de filtrar sin que se note. Van tokens exactos.

### El ancla es SAP

La pestaña nació mirando lo que falla: los nombres sueltos que no
cruzan. Eso sirve para arreglar, pero no para saber si el cruce está
sano —los que están bien no salían en ninguna parte, así que «no hay
nada pendiente» y «no hay nada cargado» se veían igual—.

La primera tabla da la vuelta la pregunta: **una fila por proveedor de
SAP**, y en cada columna cómo lo escribe esa hoja.

| Proveedor SAP | En la planilla | En Proyección | En el Plan |
|---|---|---|---|
| PROMASA SPA. | PROMASA S.A. | PROMASA SPA. | Promasa |
| BIOMASAS SUR SPA | BIOMASAS SUR SPA | BIOMASAS SUR SPA | *no aparece* |

Un nombre igual al de SAP va en gris; uno **distinto** va recuadrado,
porque es una equivalencia que alguien tuvo que resolver y que se rompe
si alguien la borra. Debajo del proveedor se dice en qué hoja falta.

El selector filtra: los que están en las tres, a los que les falta una,
los que tienen algún nombre distinto, los que **ninguna hoja nombra**
—esos están en SAP y nadie los escribe— y los que **todavía no están en
SAP**.

Un proveedor que todavía no está en SAP **también lleva su fila**, con
una raya madera al costado y un «todavía no está en SAP» debajo del
nombre. Mientras SAP no lo tenga, su propio nombre hace de ancla:
cuenta igual y agrupa sus tres hojas igual, y lo único que le falta es
el nombre definitivo. Dejarlo fuera era dejar la casilla vacía justo en
la tabla donde se mira si un proveedor está completo.

Los nombres que no cruzan con **nada** siguen yendo a «Sin par en SAP»,
que es donde se asignan o se agregan.

La vista separa dos casos, que no son lo mismo:

| Caso | Qué pasó | Por qué importa |
|---|---|---|
| **Sin par en SAP** | No cruzó con nada y entró con su propio nombre | Cada uno **es** un proveedor repetido en el panel |
| **Cruzado por parecido** | Cruzó por similitud, no porque alguien lo escribiera | Funciona hasta que el parecido se equivoca, y ahí el volumen se le carga a otro |

Los que cruzan exacto o ya están homologados a mano no aparecen: están
resueltos y solo llenarían la pantalla.

Cada fila trae el volumen entregado, los camiones, los **camiones
comprometidos** en Proyección, los días y la última fecha —para saber
cuál corregir primero— y un selector con **los candidatos de SAP
ordenados por parecido** y, debajo, la lista completa. Lo entregado y
lo comprometido van en columnas distintas: son TS de distinta
naturaleza y sumarlas en una cifra diría algo que no es. Un nombre que
solo está en Proyección todavía no entregó nada, así que ahí va un
guion y no un cero. La lista
completa no sobra: cuando el nombre no se parece a nada (`LLASA` →
`LAMINADORA LOS ANGELES`) el parecido no propone nada, y es justo
cuando hace falta escribirlo.

### La homologación tiene dos tiempos

Porque el mundo los tiene. Un proveedor empieza despachando y la
planilla lo escribe de tres formas **antes** de que alguien lo cree en
SAP. Hasta ahora esas tres formas no se podían juntar: el selector solo
ofrecía proveedores de SAP, y ese proveedor todavía no existía ahí.
Quedaban tres filas sueltas y tres proveedores inventados en el panel.

| | Qué se hace | Dónde |
|---|---|---|
| **Primer tiempo** | **Agregarlo con su propio nombre**, aunque SAP no lo tenga | «Sin par en SAP» → *No está en SAP todavía* |
| | Y si la planilla ya lo escribe de varias formas, elegir una como **cabeza** y colgar las demás | «Sin par en SAP» → *agrupar bajo…* |
| **Segundo tiempo** | El día que SAP lo crea, se elige el nombre real y **el grupo entero se va con él** | «Agrupados, esperando a SAP» |

El primer tiempo ya sirve de algo aunque SAP no sepa del proveedor: el
panel cuenta **uno** en vez de tres, y su volumen queda junto.

#### Agregarlo aunque SAP no lo tenga

SAP no carga a un proveedor nuevo el mismo día que empieza a despachar:
pasan días, a veces semanas. Mientras tanto el selector no tenía nada
que ofrecer —solo lista proveedores de SAP—, así que el nombre se
quedaba sin asignar: contaba como un proveedor inventado más, su plan no
tenía contra qué compararse y **la casilla quedaba vacía**.

«Agregarlo así, con este mismo nombre» lo escribe en la hoja
`Proveedores` como cabeza de su propio grupo, con la nota de que falta
SAP. Desde ese momento:

- cruza por la hoja, que va **antes** que el parecido;
- sus camiones caen todos sobre un mismo proveedor;
- lleva su fila en el mapa, con sus tres hojas, y aparece en
  «Agrupados, esperando a SAP» con lo que de verdad mueve —entregado,
  comprometido y plan del mes—, no en cero;
- **y sus otras formas de escribirse llegan solas.** Esto último es lo
  que lo hace rendir: el parecido ahora busca entre los proveedores de
  SAP **y** los agregados a mano, así que `AITUE NITENS` en el Plan y
  `Aitue nitens` en la planilla caen sobre `AITUE NITENS SPA` sin que
  nadie los escriba uno por uno. Antes había que homologar a mano cada
  forma de un proveedor que ya estaba resuelto.

Cuando dos candidatos empatan —`MADEEX` escrito en la hoja y
`MADEEX S.A.` en SAP son el mismo nombre comparable— **gana el de
SAP**: es el ancla de verdad.

El día que SAP lo cree, «Pasar a SAP» reapunta la cabeza, se lleva el
grupo entero y **borra la nota**, que deja de ser verdad en ese mismo
momento. Una nota vieja que dice lo contrario de su fila confunde más
que no tener nota.

Un nombre que ya cuelga de otro proveedor **no se puede agregar
aparte**: partiría en dos lo que alguien juntó a propósito. El panel
dice de quién cuelga y manda a corregirlo en la hoja.

El segundo no obliga a reasignar alias por alias. `reasignarProveedor`
reapunta la cabeza y, como los alias cuelgan de ella por arrastre, se
van solos. Escribe además una fila que manda la cabeza vieja al nombre
de SAP: las planillas que traigan escrito **ese** nombre también tienen
que llegar, y son justamente las que motivaron el grupo.

Los que ya cruzan con SAP no ofrecen agrupar: no tiene sentido colgar de
un provisorio algo que ya tiene su nombre definitivo.

Asignar escribe la equivalencia en la hoja `Proveedores` y recarga. Se
escriben las **dos** celdas en la misma fila —proveedor SAP y alias— en
vez de apoyarse en el arrastre hacia abajo: una fila que depende de la
de arriba se rompe sola cuando alguien ordena o inserta. Recargar no es
pereza: el cruce se hace en el servidor al leer las hojas, así que
tocar la tabla en el navegador mostraría un panel que no corresponde a
ningún dato.

Arriba se avisa de lo que hay que arreglar en la hoja a mano: alias
repetidos apuntando a dos SAP distintos (mientras estén así no cruzan)
y alias escritos sin proveedor SAP a la izquierda.

### Filtrar y ordenar

Cada tabla lleva su propia tira de mandos: búsqueda, las facetas que esa
tabla necesita (subproducto, fuente, brecha, tendencia, estado…) y la
cuenta de filas cuando algún filtro está puesto. Se suman a los filtros
globales de arriba, así que se puede acotar una tabla sin mover el resto
del panel.

El orden vive en el encabezado: un clic ordena por esa columna, otro da
vuelta el sentido. Los valores vacíos van siempre al final, porque «sin
precio» no es un precio de cero.

### Marcar filas y sumarlas

Una tabla contesta «cuánto lleva cada uno» y, en el pie, «cuánto llevan
todos». Faltaba el medio: cuánto llevan **estos cinco**. Eso se hacía
copiando a una calculadora, y al copiar se pierde el decimal y nadie lo
revisa.

Un clic en una fila la marca. Abajo del TOTAL aparece otra línea con la
suma de lo marcado, alineada con sus columnas, para leerla o pegarla
como una fila más. `Esc` quita todas las marcas; el botón de abajo,
solo las de esa tabla.

La marca sobrevive a ordenar y a filtrar: si un filtro esconde una fila
marcada, la línea lo dice (`2 fuera del filtro`) en vez de sumarla a
escondidas. Funciona en todas las tablas del panel, incluidas las de
Comparación y Homologación.

**No todo se suma, y esa es la parte que importa.** Cada columna declara
en su encabezado cómo se resume:

| Cómo | Qué hace | Dónde |
|---|---|---|
| suma | Lo normal | Cantidades, camiones, costos, participaciones |
| `razon:a/b` | Cociente de las sumas | `Cumpl.` es `sum(total)/sum(plan)`, **no** el promedio de los cumplimientos |
| `pond:campo` | Promedio ponderado | `Precio/TS` se pondera por volumen |
| `no` | Un guion | Un acumulado, un puesto, una variación, proveedores por mes |

La diferencia no es cosmética. Tres proveedores al 50%, 100% y 150% de
su plan no cumplen «100% promedio»: cumplen lo que digan sus toneladas.
Y sumar `Acum.` —que ya es una suma— daría un número que no significa
nada. Por eso una columna de números que no se suma muestra un guion y
no queda en blanco: en blanco es «acá no va nada», el guion es «esto no
se suma».

Los valores se leen de la pantalla, no de los datos, así que lo que se
suma es exactamente lo que se ve. Una celda con formato propio —la
duración de una ruta, `1 h 20 min`— lleva el número crudo en
`data-valor` y conserva su formato en el total.

### Plan de acción

Agrupado por **caso**, no por proveedor: el guion de una conversación es
el mismo para todos los que están en esa situación, así que se dice una
vez y debajo va la lista de a quién llamar, con la **cinta de ingresos**
de cada uno —una barra por día hábil, verde lo recibido y madera lo
estimado— y las TS en juego.

Solo habla de suministro. Un proveedor sin precio homologado no genera
una conversación sino una fila que falta en el Plan o un alias que falta
en Proveedores: eso se cuenta al pie del panel y se arregla en la hoja.

## Aviso diario de proveedores sin despachar

Un correo cada mañana a `francisco.correa@masisa.com` y
`jaime.rojas@masisa.com` con los proveedores que tienen plan del mes y
llevan 3, 5 o 7 días hábiles sin un ingreso, en tres tablas.

**Vive en un proyecto de Apps Script aparte**, en `alertas/`, y no
necesita que nadie abra la web: el disparador horario corre solo con
la autorización de quien lo instaló. Cómo instalarlo y por qué toma
las decisiones que toma, en [`alertas/README.md`](alertas/README.md).

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
| ¿Por qué falta un día?                 | Correo por correo, dónde se cayó cada uno       |
| Diagnosticar cruce Ingresos vs planilla| Qué materiales y proveedores no están cruzando  |
| Validar hoja Plan                      | Solo lee y valida; no modifica formato          |
| Ubicar en el mapa                      | Geocodifica los aserraderos de la hoja Mapeos   |
| Rellenar proveedores sugeridos         | Vuelca los nombres sin par al final de la hoja  |

## Origen de la planilla

Solo se acepta el correo **original** de `reservador.horario@masisa.com`
cuyo asunto **empieza** con `PLANILLA CUMPLIMIENTO SUB-PRODUCTOS` o
`CUMPLIMIENTO SUBPRODUCTOS`, comparado sin espacios ni guiones —así
`SUB-PRODUCTOS`, `SUB PRODUCTOS` y `SUBPRODUCTOS` son lo mismo—. Eso
descarta `Re:`, `RV:` y `Fwd:`. Las filas «Total…» y las que vienen sin
proveedor se ignoran siempre: son sumas y duplicarían los camiones.

**La búsqueda de Gmail es un prefiltro, no la regla.** La regla vive en
`matchesPlanillaMessage_` y mira mensaje por mensaje; la búsqueda solo
evita traerse el buzón entero, y por eso va escrita lo más ancha
posible: la **primera palabra** de cada frase aceptada, suelta y sin
comillas, sacada de `CONFIG` para que una frase nueva entre sola.

Iba con la frase completa entrecomillada y eso **perdía correos en
silencio**: en la búsqueda de Gmail el guion no es una letra más, y un
asunto real como `PLANILLA CUMPLIMIENTO SUB-PRODUCTOS VIERNES 25 DE
SEPTIEMBRE DE 2026` no volvía en los resultados. El día entero
desaparecía del panel sin una sola señal, porque un correo que la
búsqueda no devuelve es un correo que nadie revisó.

Para que no se repita, el resumen de la importación cuenta aparte
**cuántos correos del reservador quedaron fuera por el asunto**, y lista
los primeros cinco. Y `pruebas/gmail.js` exige que todo asunto que la
regla acepta traiga alguna de las palabras que la búsqueda pide.

### Un día en cero no es un día que falta

La tabla admite llegar **sin una sola línea de detalle**: la fecha, un
cero y la fila `Total`, en el mismo orden de columnas de siempre. Es el
día que el reservador reportó y vino en cero.

Antes eso reventaba con «no se encontraron filas», el correo quedaba
marcado como error y el día desaparecía. Ahora el encabezado se
reconoce igual y se escribe **una** fila con Estado `SIN DESPACHO`: sin
proveedor y sin TS, así que el panel no la suma, pero el día queda
contestado. En la nota de Suministro se dice con nombre y fecha, porque
un día en blanco y un día sin despacho se ven igual en un gráfico y no
son lo mismo: uno hay que ir a cargarlo, el otro ya está respondido.

### La planilla que llega sin encabezados

La del martes 6 de octubre vino **sin la fila de rótulos**: arranca
directo en la fecha y el total del día.

```
06/10/2026 | Total                     |                           |          | 0
           | ASERRÍN COMBUSTIBLE       | COMERCIAL EL CHACAY LTDA. | NEOMAS   | 2
           | Total ASERRÍN COMBUSTIBLE |                           |          | 2
           | ASTILLA PINO VERDE        | PROMASA SPA.              | TABLEROS | 4
```

Las columnas van en el orden de siempre —fecha, subproducto, proveedor,
destino, camiones—, pero el lector buscaba el rótulo `PROVEEDORES` para
saber dónde estaba cada una. Sin rótulos devolvía tabla vacía: el día
entero se perdía, y encima en silencio, porque un correo leído «sin
filas» queda marcado y no se vuelve a intentar.

Ahora, cuando no hay encabezado, la tabla **se reconoce por su forma**:

| Condición | Para qué sirve |
|---|---|
| Una fecha en las primeras celdas de una fila | Es el ancla: ahí empieza la tabla |
| Una columna de números a la derecha, con sitio para subproducto, proveedor y destino en medio | Son los camiones |
| Alguna fila `Total` más abajo | La planilla cierra con subtotales |

Hacen falta **las tres**, y por una razón concreta: el cuerpo del correo
llega como una sola matriz con *todas* sus tablas pegadas una tras otra
—la firma, el hilo citado, los wrappers de Outlook—, así que la planilla
puede no ser la primera y cualquier otra tabla podría colarse. Una firma
no tiene fecha arriba a la izquierda; una tabla de turnos no tiene fila
`Total`; un párrafo con la fecha no tiene columna de números a la
derecha. `pruebas/planilla.js` prueba las tres por separado, y además
que la tabla se siga leyendo bien cuando viene con otra tabla encima.

Un detalle que importa: la celda de los camiones tiene que ser **el
número solo**. El lector de números es a propósito tolerante —les saca
las letras y se queda con la cifra—, así que `COMERCIAL EL CHACAY LTDA.`
le vale 0 por el punto final; eso sirve para leer una cantidad, no para
reconocer una columna.

El encabezado, cuando viene, sigue mandando: la forma se mira **solo**
si no se encontró. Y de paso queda cubierto el día en que le cambien los
rótulos —`PROVEEDOR / RAZÓN SOCIAL` en vez de `PROVEEDORES`—, que antes
tiraba la tabla completa. Un día en cero sin encabezados se lee igual
que uno con encabezados: `SIN DESPACHO`.

Si el correo ya quedó con `ERROR:` en `InformeAstilla`, la importación
normal no lo vuelve a mirar —está leído, aunque haya salido mal—; hay
que correr `Astilla Dashboard › Reconstruir planillas desde Gmail`.

### Cuando un día no aparece

`Astilla Dashboard › ¿Por qué falta un día?` revisa **todos** los
correos del reservador de los últimos 120 días —a propósito más ancho
que la importación, para ver también los que la regla descarta— y dice,
correo por correo, en cuál de las cuatro puertas se cayó:

| Veredicto | Qué significa |
|---|---|
| `NO: lo mandó otro` | El remitente no es el oficial |
| `NO: el asunto no empieza…` | La regla del asunto lo descarta |
| `ya estaba leído` | Está en `InformeAstilla`; mira su Estado |
| `SÍ: N filas` / `día sin despacho` | Entra, y con qué fecha |

Si un correo no aparece **ni en esa lista**, entonces no está en la
casilla o no lo mandó ese remitente. No escribe nada.

```
node pruebas/gmail.js
node pruebas/planilla.js
```
