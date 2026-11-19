# Ingreso Astilla Proceso

Planilla de control de suministro de astilla verde a proceso, hecha con
Google Apps Script sobre un spreadsheet. La unidad de trabajo es la
**tonelada seca (TS)**.

## Qué hace

- **Ingresos** (hoja) es la fuente válida: el registro real de recepción
  de SAP, con el peso de cada camión y su **número de guía**.
- **El libro de camiones** es el registro **en vivo**: una fila por
  camión, con su guía, escrita en la portería. No es una hoja de este
  libro —es de otra área, no se toca y cambia de archivo cada mes— y
  completa lo que SAP todavía no carga, con
  `camiones × factor del material`. Ver más abajo.
- **InformeAstilla** (hoja) guarda las planillas diarias que el
  reservador mandaba por correo. Quedó como **historia**: completa los
  días anteriores a donde empieza el libro.
- **Plan** (hoja) aporta precio unitario y volumen mensual comprometido
  por proveedor y material.
- **Proyeccion** (hoja) son los camiones que cada proveedor se
  compromete a mandar, por día hábil. Ver más abajo.
- **Proveedores** (hoja) es la tabla de equivalencias de nombres. Manda
  sobre el parecido automático.
- **Mapeos**, **Rutas** y **Apuntes** cubren la gestión de terreno y las
  reuniones semanales.

**La decisión es camión por camión, por su guía.** Si la guía del libro
está en Ingresos, ese camión ya está contado con su peso real; si no
está, entra estimado. Nada de fechas de corte, nada de reglas de día: el
estimado de un camión desaparece solo el día que SAP carga **esa** guía.

En los días anteriores al libro —los que cubría la planilla del
correo— sigue valiendo la regla vieja, que es de día completo y está
explicada más abajo.

### Hoy: lo que va entrando, y con qué cierra

Es lo que el libro de camiones vino a hacer posible. Antes esta
pregunta —qué entró hoy— se respondía al día siguiente, cuando llegaba
el correo.

Arriba de Suministro, y sin depender de los filtros de abajo —hoy es
hoy, se esté mirando el mes o el año—:

| Tarjeta | Qué dice |
|---|---|
| **Entraron hoy** | Camiones y TS, y cuántos de ellos ya están cargados en Ingresos |
| **Cierre a las 23:00** | Con cuántos cerraría el día **a este ritmo**, y cuántos faltarían por entrar |
| **En patio ahora** | Los que llegaron y el libro todavía no cierra, y cuánto lleva el que más |
| **Demora en patio** | Lo que demora un camión, de llegada a cierre |

**Cada tarjeta lleva su propio reparto por material**, debajo de la
cifra: 4 de pino verde, 1 con corteza, 1 de nitens, 1 de aserrín. No es
la misma lista cuatro veces —cada una reparte **su** número—: la de
"entraron" reparte los que entraron, la de cierre los proyectados, la
de patio solo los que están adentro ahora, y la de demora la mediana de
cada material. El material que no aporta a esa cifra no aparece: una
fila en cero ocupa el mismo alto y no dice nada.

Y debajo, la tabla del día: llegó → salió, guía, proveedor, material
y destino, **cuánto estuvo en patio** y el estado —en patio, salió, o
ya en Ingresos—. Lo último arriba, que es lo que se viene a mirar.

**El panel no dice "descargado", y es a propósito.** El libro anota la
llegada y el cierre, y nada entremedio: no hay hora de descarga en
ninguna de sus columnas. Entonces de un camión se sabe que está en
patio o que salió, y eso es lo que se escribe. Lo que pasó adentro no
lo anota nadie.

### La demora: cuánto se demora un camión

El libro trae cuatro horas y tres sirven para medir:

| Columna | Qué es |
|---|---|
| `HORA RESERVA` | la hora que se le dio al camión |
| `HORA LLEGADA` | cuando llegó a portería |
| `HORA` | cuando se cerró la fila y se fue |

Con esas tres salen los tramos, y cada uno responde otra pregunta:

| Tramo | Cuenta | Responde |
|---|---|---|
| **agenda** | llegada − reserva | si el proveedor llega a la hora que se le dio |
| **patio** | cierre − llegada | cuánto se demora un camión adentro |
| **flujo** | cierre − reserva | desde que tenía hora hasta que salió |

En la tabla, el **patio** es el número grande y el **flujo** va abajo;
la agenda queda bajo las horas, como «10′ tarde» o «5′ antes de su
hora».

**El flujo puede ser negativo y no es un error.** Un camión que llegó
antes de su hora reservada y alcanzó a salir antes de ella salió antes
de que su hora llegara. Pasa seguido.

**Cuatro decisiones que explican los números:**

- **La mediana, no el promedio.** Hay un camión al mes que espera siete
  horas y media. Ese mueve el promedio y no mueve la mediana, y lo que
  se quiere saber es cuánto demora un camión normal. El p90 y el más
  largo van al lado para que el caso raro no desaparezca.
- **Solo los que ya cerraron.** Al que sigue en patio todavía le
  falta: meterlo en la mediana la tiraría para abajo justo cuando más
  interesa. En su fila dice «20′ y sigue», que es otra cosa.
- **El cierre antes que la llegada no se arregla.** Es la hora escrita
  al revés. Recortarla a cero sería inventar el dato: la fila dice
  «hora al revés», no entra en ninguna cuenta, y el aviso de la carga
  dice cuántas hay.
- **Las horas vienen sucias y se leen igual.** La portería escribe
  `8:46`, pero también `08.53`, `21.46`, `18;35` y `9:;40`. Cualquier
  cosa que no sea dígito separa la hora del minuto. Lo que no es una
  hora —un número suelto, una celda vacía— no se inventa.

El aviso de la carga, abajo en Suministro, dice la demora **del mes
entero**: la mediana, el p90 y el más largo.

**La proyección es una regla de tres, no un pronóstico.** La planta
recibe de **08:30 a 23:00** (`CONFIG.JORNADA`): si en las primeras horas
entraron N camiones, al cierre entrarán los que da ese mismo ritmo. Los
camiones no llegan parejo, así que el panel dice «a este ritmo» y no
«van a entrar».

Dos momentos en que **no** proyecta, y lo dice:

- **Antes de hora y media** de jornada corrida. Con dos camiones a las
  nueve de la mañana, la regla de tres dice cualquier cosa.
- **Después de las 23:00**: el día ya está, no hay nada que proyectar.

### Camiones para cumplir el plan

El plan está en toneladas y la planta se maneja en camiones, así que la
pregunta de todos los días —«¿cuántos camiones pido?»— obligaba a
dividir de cabeza. La tabla lo deja escrito, material por material:

| Material | Plan del mes | Camiones del plan | Entraron | Faltan | Por día hábil | Ritmo del plan |
|---|---:|---:|---:|---:|---:|---:|
| Pino verde | 4.620 | 420 | 210 | **210** | **21** | 21 |
| Pino verde c/corteza | 5.350 | 500 | 240 | **260** | **26** | 25 |
| Eucalyptus Nitens | 1.824 | 120 | 0 | **120** | **12** | 6 |

Cada material con **su** factor: el corteza pide 26 camiones al día
donde el pino verde pide 21, porque sus camiones pesan distinto.

**Un material escrito en el Plan sin toneladas para el mes no se
muestra en cero.** Así llegó el aserrín: once filas con su precio y la
columna del mes en blanco. Cero diría que su compromiso es cero, y no
es eso —es que falta escribirlo—, así que esas celdas van con un guion
y el panel dice cuántas filas tiene escritas. Lo que entró se cuenta
igual; lo que falta no se inventa.

La última columna es la que da el contexto: el ritmo que el plan pedía
**desde el primer día**. Sin ella no se sabe si el número de hoy es el
de siempre o uno que se disparó porque el mes viene atrasado —cuando el
de ahora es mayor, va marcado—.

### Las notas de la carga, plegadas

De dónde salió cada cifra y qué hay que ir a arreglar seguía siendo
útil, pero eran **dos muros de texto** arriba de todo que había que
saltarse para llegar a los datos. Ahora van al final de Suministro,
dentro de un `Notas de la carga`, y el título dice cuántas cosas hay
que mirar: nada se esconde en silencio, pero tampoco estorba.

### El panel se relee solo

El libro de camiones se escribe **mientras el panel está abierto**: una
fila cada vez que entra un camión. Si el panel leyera solo al abrirse, a
media mañana estaría mostrando lo de hace dos horas.

El libro es ajeno y no se le puede poner un disparador que avise, así
que el panel vuelve a preguntar **cada tres minutos**. Al lado del botón
Actualizar queda dicho cuándo fue la última vez: `en vivo · hace 2 min`,
y en rojo si pasaron diez o si la relectura falló.

Tres reglas para que eso no estorbe:

| Regla | Por qué |
|---|---|
| Solo con la pestaña a la vista | Un panel en segundo plano no lo mira nadie, y cada relectura son segundos de Apps Script que salen de la cuota del día |
| Sin el velo de «cargando» | Un parpadeo cada tres minutos molesta más que el dato viejo |
| Nunca encima de algo que se esté haciendo | Si hay una asignación en curso o el foco está en un selector, se espera al turno siguiente |

Y lo que se está mirando no se pierde: el rango de fechas elegido se
guarda y se devuelve —`configureDashboard` lo reescribe con el mes en
curso—, los filtros se conservan solos, y una relectura que **falla** no
borra la pantalla: deja el dato viejo y lo dice en el sello.

### El libro de camiones: el registro en vivo

Una fila por camión, con su guía, el proveedor, el producto, el destino
y la hora en que llegó. La escribe la portería de la planta en una
planilla que **no es de este proyecto**: es de otra área, no se puede
tocar y **cambia de archivo todos los meses**.

Reemplazó al correo del reservador por dos razones:

| | Correo del reservador | Libro de camiones |
|---|---|---|
| Cuándo se ve | Al día siguiente, cuando llega el correo | **En vivo**: la fila existe cuando el camión entra |
| Qué trae | Camiones por proveedor y subproducto, del día | **La guía de cada camión** |

La guía es lo que cambia todo. Es **el mismo número** que SAP escribe en
su columna `Nº Guia`, así que por primera vez se puede saber si un
camión concreto ya está cargado:

```
guía 1312  LATSAGUE SAAVEDRA   →  está en Ingresos  →  ya contado, con su peso real
guía 17696 BIOMASA SUR         →  no está           →  se complementa, 11 TS estimadas
```

Antes esto se decidía **por día completo**, y hubo que inventarle
excepciones —el proveedor que SAP no conoce, el día cargado a medias—
porque no había forma de saber si un camión suelto ya estaba en SAP.
Con la guía no hacen falta: el cruce es exacto.

**Lo que el panel dice del libro**, en el aviso de Suministro: de qué
archivo y pestaña salió, hasta qué día alcanzó a ver, cuántos de sus
camiones ya están en Ingresos, cuántos se complementan, y cuántos
**llegaron y el libro todavía no cierra** —esos cuentan igual,
porque entraron—, y la **demora** del mes entero.

**Cerrar un camión son dos cosas, y basta una.** El libro lo cierra con
el `OK` de la columna `ESTADO` y con la hora de la columna `HORA`, y la
portería las escribe en ese orden: primero la hora, después el `OK`.
Mirar solo el estado va un paso atrás —el camión ya salió y el panel
lo muestra en patio— y mirar solo la hora deja afuera al que cerraron
sin anotarla. El panel mira las dos: está en patio mientras no haya
ninguna.

**Tres cosas que no se complementan, y se dicen:**

| Caso | Por qué |
|---|---|
| El camión sin número de guía | Sin guía no hay con qué cruzarlo contra Ingresos |
| La guía cuyo número está en SAP **a nombre de otro proveedor** | O son camiones distintos, o es el mismo con el nombre escrito de otra forma, y no se puede saber cuál. Contar un camión dos veces infla el ingreso y rompe el plan, que es peor que mostrar uno de menos. Se arregla **homologando** ese nombre |
| Lo que no es astilla de proceso | El libro trae todo lo que entra a la planta: trozo aserrable, MR, aserrín, astilla combustible. Se filtra por producto, igual que siempre |

#### Dónde está el libro cada mes

El archivo se llama `CAMIONES INGRESO <MES> AÑO <AAAA>` y es nuevo cada
mes, así que no se puede fijar su código en el script. El panel lo
resuelve en este orden:

1. **La hoja `Fuentes`** de este libro: si hay una fila para ese mes con
   un enlace pegado, manda esa. Es el respaldo y también la ventana —ahí
   se ve cuál está usando el panel—.
2. **Drive, por el nombre del archivo.** Lo busca una vez y se lo
   guarda unas horas; dentro del mes no cambia.

`Astilla Dashboard › Buscar el libro de camiones del mes` fuerza la
búsqueda y deja escrito en `Fuentes` lo que encontró. Si algún mes
cambian el nombre del archivo, basta pegar el enlace en esa hoja.

Se leen **dos** libros: el del mes en curso y el del anterior. SAP se
atrasa días, no meses, y leer seis libros ajenos en cada carga del panel
sería pagar mucho por nada.

### Cuando SAP carga el día a medias

> Esta sección vale para los días que cubre la **planilla del correo**,
> donde no hay guía con qué cruzar. Donde llega el libro de camiones, el
> cruce es por guía y estas excepciones no hacen falta.

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

### Cuando la planilla registró de menos

La planilla la escribe una persona a mano, día a día, y a veces registra
**menos** de lo que entró: se le queda un proveedor afuera, o anota
menos camiones de los que llegaron.

Donde Ingresos tiene el día cargado el panel no se equivoca por eso
—Ingresos manda y el estimado se descarta—, y precisamente por eso el
error **no aparecía en ninguna parte**: ni movía una cifra, ni quien
escribe la planilla se enteraba nunca. El único lugar donde se notaba
era al revés, cuando SAP venía atrasado y el panel tenía que completar
el día con una planilla incompleta.

El panel de **«La planilla y SAP no cuentan lo mismo»** (en Suministro,
bajo el plan de acción) compara las dos fuentes **solo en los días que
cubren las dos**: si Ingresos no tiene el día, la planilla es lo único
que hay y no hay con qué compararla; si la planilla no llegó, no hay
nada que revisar.

| Caso | Qué muestra |
|---|---|
| El proveedor que Ingresos registró y la planilla **no nombra** | Sus camiones y sus TS: eso no quedó registrado |
| Los que están en las dos con cantidades que **no cuadran** | Lo que dice la planilla, lo que pesó Ingresos y de cuánto es la diferencia |

**La comparación de cantidades pisa con cuidado.** La planilla cuenta
*camiones* y SAP pesa *toneladas*, y un camión no pesa siempre lo
mismo: se avisa solo cuando la diferencia pasa de **0,6 camiones** del
factor de ese material, que es más de lo que explica una carga liviana.
La diferencia se redondea **antes** de comparar: `15,4 / 11` da
`1,4000000000000001`, y un umbral que se decide por el error del punto
flotante no es un umbral.

**Y hay una honestidad en el medio.** Si ese día la planilla trae un
nombre que todavía no cruza y que **se parece** al proveedor que falta,
puede ser el mismo escrito de otra forma. Ahí no se afirma nada: el caso
se cuenta aparte y se dice cuántos hay. Acusar a la planilla de no
registrar algo que sí registró quemaría la lista entera, y una lista que
miente una vez no se vuelve a mirar. Homologar ese nombre destapa el
caso. Para dudar basta un parecido lejano (0,45); para afirmar un cruce
hace falta mucho más (0,72).

La lista muestra el mes en curso, lo más nuevo primero —el error de ayer
todavía se puede conversar—, y dice cuántos casos quedaron en meses
anteriores.

### Qué entra a proceso

Cuatro materiales, y la lista es exactamente esa:

| Código SAP | Subproducto                | TS por camión |
|-----------:|----------------------------|--------------:|
|    3009003 | ASTILLA EUCALYPTUS NITENS  |          15,2 |
|    3009002 | AST. PINO VERDE C/ CORTEZA |          10,7 |
|    3000039 | ASTILLA PINO VERDE         |            11 |
|    3000043 | ASERRÍN PINO VERDE         |   11 *(provisorio)* |

El **aserrín de pino verde** entró después, y tiene una particularidad
que hay que tener presente: **cada fuente lo llama distinto**.

| Dónde | Cómo aparece |
|---|---|
| El libro de camiones y la planilla | `ASERRÍN PINO VERDE` |
| SAP | `ASERRIN (TS)`, código **3000043**, sin decir la especie |

Por eso la regla no exige que diga «verde»: pedirla dejaba fuera justo
al lado que trae el peso real. Entra todo lo que diga `ASERRÍN` y no
diga `COMBUSTIBLE` ni nombre otra especie (`ÁLAMO`, `EUCALIPTO`). En
SAP el que manda es el código; la descripción es la red por si llega
una fila con un código que todavía no está en la tabla —así fue como
el aserrín cruzó antes de que apareciera el suyo—.

**Su factor sigue siendo provisorio.** Nadie ha dicho cuánto pesa un
camión de aserrín, así que usa el factor general (11 TS). Ahora que SAP
lo reconoce, el panel va a poder decir el real: ver abajo.

El **aserrín combustible no entra**: ese va a NEOMAS y no es materia
prima del tablero. Lo mismo el trozo aserrable, el MR y la astilla
combustible, que el libro de camiones también trae.

### El factor que se estima contra la balanza

Los factores de arriba son un **acuerdo**, no una medición. SAP sí los
mide: cada guía cargada trae su peso real.

El panel los compara. Por cada material cuenta **guías distintas** —la
misma guía puede venir partida en dos posiciones, y contarla dos veces
bajaría el promedio a la mitad—, saca las TS por camión que muestra
Ingresos y, cuando se aparta más de un 8% del factor configurado, lo
dice en el aviso de Suministro:

> El factor con que se estiman los camiones no se parece a lo que pesa
> Ingresos: **Aserrín pino verde** 7,5 TS por camión en 15 guías, y se
> está estimando con 11.

No cambia ninguna cifra: solo deja a la vista el número que hay que ir a
corregir en `CONFIG.FACTOR_POR_MATERIAL`. Con menos de diez guías no
opina, porque con tres camiones un promedio dice cualquier cosa.

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

### Un proveedor, sus nombres, una decisión

Lo difícil de homologar no es el cruce: es que el mismo proveedor llega
escrito por **tres manos** —la planilla del reservador, `Proyeccion` y
el `Plan`— y la lista de pendientes los muestra como **tres problemas
sueltos**. Resolver uno no resuelve los otros dos, así que había que
buscar al mismo proveedor tres veces y acertarle tres veces al mismo
nombre de SAP.

La primera tabla de la pestaña da vuelta esa lista: **una fila por
proveedor**, con todos sus nombres colgando, de qué hoja viene cada uno,
lo que mueven entre los tres, y **un solo botón** que los asigna a todos.

El ancla es SAP siempre que se pueda:

| | Cuándo | Qué propone |
|---|---|---|
| 1 | El nombre ya cruza por parecido | Ese proveedor de SAP. El botón solo lo deja escrito —confirmarlo lo fija— |
| 2 | No cruza, pero se parece a uno de SAP ≥ **0,5** | Ese proveedor, diciendo cuánto se parece |
| 3 | No hay ningún SAP al que parecerse | Nada: los nombres se juntan entre ellos por cómo se escriben |

**0,5 para proponer, 0,72 para cruzar solo.** Una cosa es sugerirle
algo a quien mira y otra decidirlo sin preguntar. Por eso el selector
**viene elegido** cuando el parecido alcanza para cruzar por sí mismo
—ahí el panel ya está usando ese proveedor y el botón solo lo deja
escrito— y **viene vacío** cuando es una propuesta más floja: esa
decisión es de quien mira.

El caso 3 es el que pedía la otra opción. Ese grupo no tiene a quién
asignarse todavía, así que el selector ofrece **dejar uno de sus propios
nombres como el proveedor**: se agrega con ese nombre, los demás se le
cuelgan, y el día que SAP lo cree se pasa el grupo entero desde
«Agrupados, esperando a SAP».

**No se cae por uno.** Si uno de los nombres del grupo ya apunta a otro
proveedor, se dice cuál y se escribe el resto. Abortar todo por un
nombre dejaría el grupo a medio escribir sin decir cuál fue.

Las dos tablas de más abajo —«Sin par en SAP» y «Cruzados por
parecido»— siguen estando: son el camino fino, para cuando un grupo
junta dos proveedores que en realidad no son el mismo, o hay que mirar
un nombre solo.

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
tarjeta dice doce, la tarjeta miente. Lo mismo con los grupos: un
nombre de otro mes sale del grupo y las cifras del grupo se rehacen,
porque una fila que muestra dos nombres y suma las TS de cuatro
también miente.

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

## Aviso diario de proveedores del plan en riesgo

Un correo **todos los días hábiles a las 9:00** a
`francisco.correa@masisa.com` y `jaime.rojas@masisa.com` con los
proveedores que **tienen plan este mes** y están en riesgo de no
cumplirlo, en tres grupos excluyentes:

| Grupo | Quién entra |
|---|---|
| **No han entregado este mes** | Plan comprometido y ni un ingreso suyo en el mes |
| **Callados** | Entregaron, pero llevan 3 días hábiles o más sin un ingreso nuevo |
| **A la baja** | Entregando y al día, pero por debajo del ritmo que pide su plan a esta altura del mes, o de lo que ellos mismos entregaban |

**Vive en un proyecto de Apps Script aparte**, en `alertas/`, y no
necesita que nadie abra la web: el disparador horario corre solo con
la autorización de quien lo instaló. Cómo instalarlo, cuándo se dice
que alguien viene «a la baja» y por qué toma las decisiones que toma,
en [`alertas/README.md`](alertas/README.md).

## Compartirlo con gente que no tiene acceso a las hojas

El panel se puede abrir de dos maneras, y la diferencia **no es de
permisos sino de despliegue**:

| | Desde la planilla | Como aplicación web |
|---|---|---|
| Cómo se abre | `Extensiones › Apps Script › Abrir dashboard` | Un enlace |
| Con qué permisos lee | **Los de quien mira** | **Los de quien la desplegó** |
| Qué necesita el que mira | Acceso a la planilla **y** al libro de camiones | Nada |

La segunda es la que sirve para compartir. El libro de camiones es
ajeno —de otra área— y la planilla tiene datos que no todos tienen por
qué ver; con la aplicación web **los lee el script**, no el que mira.

`Implementar › Nueva implementación › Aplicación web`, con
**Ejecutar como: yo** y **Quién tiene acceso: cualquier usuario de
masisa.com**. Eso ya está escrito en `appsscript.json`; el enlace que
entrega es el que se reparte.

### Y por eso el panel distingue mirar de escribir

Si el script escribe con los permisos de quien lo desplegó, cualquiera
que abra el enlace podría homologar un proveedor o borrar un apunte
**en su nombre**, y en la hoja quedaría su correo como autor.

Así que:

- **Mirar es de todos.** Quien abre el enlace ve el panel completo.
- **Escribir es de quien desplegó la app**, más los correos escritos en
  `CONFIG.EDITORES`.
- La comprobación está **en el servidor**, en cada función que escribe
  —homologar, apuntes, mapeos, rutas, importar—: esconder un botón no
  impide llamar a la función que había detrás.
- El panel además **esconde lo que no se va a poder hacer** y lo dice
  con un sello `solo lectura`, para no ofrecer un botón que después
  responde que no.
- Si no se sabe quién está mirando —otro dominio, acceso anónimo—,
  solo lectura. Es el lado seguro del error.

Las funciones del **menú** (instalar hojas, reconstruir, rellenar) no
llevan esa comprobación: se corren desde la planilla, y ahí el control
son los permisos de la planilla misma. Quien puede abrirla ya podía
escribirla a mano.

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
| Buscar el libro de camiones del mes    | Busca el archivo del mes en Drive y lo deja escrito en `Fuentes` |
| Preparar hoja de fuentes               | Crea la hoja `Fuentes` y escribe el libro del mes |
| Importar nuevas planillas              | Lee Gmail y suma los correos no procesados      |
| Reconstruir planillas desde Gmail      | Respalda y reimporta todo el historial          |
| Probar último correo (sin escribir)    | Muestra qué extraería, sin tocar la hoja        |
| ¿Por qué falta un día?                 | Correo por correo, dónde se cayó cada uno       |
| Diagnosticar cruce Ingresos vs planilla| Qué materiales y proveedores no están cruzando  |
| Validar hoja Plan                      | Solo lee y valida; no modifica formato          |
| Ubicar en el mapa                      | Geocodifica los aserraderos de la hoja Mapeos   |
| Rellenar proveedores sugeridos         | Vuelca los nombres sin par al final de la hoja  |

## Origen de la planilla

> El correo del reservador quedó como **historia**. La fuente en vivo
> es el libro de camiones; esto sigue valiendo para los días que ya
> están importados y para reconstruirlos si hiciera falta.

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
