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

### Factor por material

| Código SAP | Subproducto                | TS por camión |
|-----------:|----------------------------|--------------:|
|    3009003 | ASTILLA EUCALYPTUS NITENS  |          15,2 |
|    3009002 | AST. PINO VERDE C/ CORTEZA |          10,7 |
|    3000039 | ASTILLA PINO VERDE         |            11 |

## Archivos

| Archivo            | Qué es                                            |
|--------------------|---------------------------------------------------|
| `Codigo.gs`        | El servidor: lectura, cruces, Gmail, Calendar      |
| `Index.html`       | El dashboard (HTML + CSS + JS en un archivo)       |
| `appsscript.json`  | Manifiesto: zona horaria, scopes y Drive API v3    |
| `alertas/`         | Proyecto de Apps Script **aparte**: el correo diario |

`alertas/` no es parte de este proyecto de Apps Script: es otro, que
abre la misma planilla en modo lectura. Ver `alertas/README.md`.

El panel no manda correo: eso vive en `alertas/`, con su propio
manifiesto y sus propios permisos.

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
| Comprometido por venir | Los camiones de `Proyeccion` para los días que faltan, en TS |
| Cierre con proyección | La suma de los dos, contra el plan del mes |
| Brecha al cierre | Cuánto sobra o falta al terminar así |

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

Entran **dos** hojas, porque las escribe la misma mano y fallan igual:
`InformeAstilla` (la planilla del reservador) y `Proyeccion`. Cada fila
dice de cuál viene, y una sola asignación arregla las dos: el cruce es
el mismo.

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
| Diagnosticar cruce Ingresos vs planilla| Qué materiales y proveedores no están cruzando  |
| Validar hoja Plan                      | Solo lee y valida; no modifica formato          |
| Ubicar en el mapa                      | Geocodifica los aserraderos de la hoja Mapeos   |
| Rellenar proveedores sugeridos         | Vuelca los nombres sin par al final de la hoja  |

## Origen de la planilla

Solo se acepta el correo **original** de `reservador.horario@masisa.com`
cuyo asunto **empieza** con `PLANILLA CUMPLIMIENTO SUB-PRODUCTOS` o
`CUMPLIMIENTO SUBPRODUCTOS`. Eso descarta `Re:`, `RV:` y `Fwd:`. Las
filas «Total…» y las que vienen sin proveedor se ignoran siempre: son
sumas y duplicarían los camiones.
