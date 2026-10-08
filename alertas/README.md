# Alertas · proyecto aparte

Script de Apps Script **independiente** del dashboard. Abre la misma
planilla en modo lectura y manda un correo diario; no comparte código
con `Codigo.gs` ni necesita que nadie abra la web.

## Quién lo ejecuta

**Nadie tiene que entrar a ningún lado.** El disparador horario corre
solo, con la autorización de quien apretó `instalarAvisoDiario`, y el
correo sale desde esa cuenta.

La cuenta que instala es la que queda ejecutándolo y la que aparece
como remitente, así que conviene instalarlo desde la cuenta
corporativa que corresponde, no desde una personal.

## Instalar

1. [script.google.com](https://script.google.com) → **Nuevo proyecto**.
2. Pegar los cuatro archivos como archivos separados del proyecto:
   `Config.gs`, `Feriados.gs`, `Lectura.gs`, `Aviso.gs`. El orden en que
   queden no importa: nada se calcula al cargar.
3. En el ícono de engranaje del editor, marcar «Mostrar el archivo de
   manifiesto» y reemplazar `appsscript.json` por el de esta carpeta.
   (Alternativa: dejar el manifiesto como viene; los permisos se piden
   igual al ejecutar.)
4. Confirmar `SPREADSHEET_ID` y `PARA` en `Config.gs`.
5. Ejecutar **`probarSinEnviar`** y mirar el registro: dice cuántos
   proveedores encontró en el Plan, en qué día hábil del mes va y
   cuáles no cruzan con ningún ingreso. Es la forma de detectar un
   alias que falta antes de que salga un correo diciendo que alguien no
   despacha cuando sí lo hizo.
6. Ejecutar **`enviarAhora`** para recibir uno de prueba.
7. Ejecutar **`instalarAvisoDiario`**. Listo.

Para apagarlo: `eliminarAvisoDiario`.

## Cuándo sale

**Todos los días hábiles a las 9:00**, con el margen de ±15 minutos que
es lo más exacto que ofrece Apps Script (`HORA` y `MINUTO` en
`Config.gs`).

Sábado y domingo **no** sale (`SOLO_HABILES`): no son días hábiles, el
número es idéntico al del viernes y el correo sería el mismo tres veces.
Si se quiere igual, es cambiar esa línea a `false`.

## Qué manda

Los proveedores que **tienen plan este mes** y están en riesgo de no
cumplirlo, en tres grupos **excluyentes** y en orden de gravedad:

| Grupo | Quién entra | Orden |
|---|---|---|
| **No han entregado este mes** | Plan comprometido y ni un ingreso suyo en el mes | Por plan: lo que está en juego |
| **Callados** | Entregaron, pero llevan 3 días hábiles o más sin un ingreso nuevo | Por días: el más callado primero |
| **A la baja** | Entregando y al día, pero el ritmo viene cayendo | Por TS de atraso |

Excluyentes quiere decir que un proveedor aparece **una** vez: el que no
ha entregado nada también lleva días callado y también viene a la baja,
y decirlo tres veces no agrega nada.

### Cuándo se dice que alguien viene «a la baja»

Dos señales, y basta una. Son distintas a propósito:

| Señal | Qué compara | Umbral |
|---|---|---|
| **Contra su plan** | Lo entregado contra lo que el plan pide a esta altura del mes, prorrateado por días hábiles | `RITMO_PLAN`: bajo el 85% |
| **Contra sí mismo** | Sus TS por día hábil de este mes contra las de los meses cerrados anteriores | `CAIDA_PROPIA`: 25% menos |

Un proveedor puede ir bien contra un plan chico y haberse caído a la
mitad; eso igual hay que verlo. Por eso la barra de «ritmo vs plan» se
pinta **verde** cuando ese eje está sano aunque la fila esté en el
grupo: el color dice cómo va contra el plan, y el texto debajo del
nombre dice por qué entró.

**Hasta el cuarto día hábil del mes no se habla de ritmo**
(`MINIMO_DIAS`). El día 1 nadie ha entregado nada y el prorrateo
acusaría a todo el mundo; un aviso que el primer día del mes reclama a
los veinte proveedores no se vuelve a leer. Hasta entonces manda el
silencio, que no depende del mes. Por eso «no han entregado este mes»
también espera: el único que entra siempre es el que **nunca** despachó
en toda la ventana.

### Lo demás que decide el correo

- **Los días son hábiles, no corridos.** Con días corridos, quien
  despachó el viernes aparecería todos los lunes con tres días de
  silencio sin que hubiera pasado nada.
- **Una fila por proveedor**, no por fila del Plan: la llamada es una
  sola aunque tenga tres subproductos comprometidos.
- **Solo entran los que tienen plan este mes.** Una fila del Plan con
  la celda del mes en blanco no compromete nada, así que ese proveedor
  no aparece por mucho que lleve semanas sin despachar.
- **«Entregado» no suma las dos fuentes.** Por día y por proveedor manda
  SAP, y la planilla solo tapa el día que SAP todavía no cargó. Sumarlas
  contaba dos veces el mismo camión, y de ese número salen el ritmo y la
  tendencia: inflado, decía que un proveedor va al día cuando viene
  cayendo.

Si no hay nadie en riesgo, el correo igual sale diciéndolo: un correo
que no llega no distingue entre «todo al día» y «el script falló».

## Cómo está hecho el correo

Todo en **tablas**, con estilos en línea y con los atributos de tabla
(`bgcolor`, `width`, `align`) además de las propiedades CSS: Outlook
descarta las hojas de estilo y renderiza con Word. Nada de flex, grid,
posicionamiento ni variables. Las barras de avance también son tablas,
que es la única forma de que se dibujen igual en todas partes.

Las dos familias son las que existen en cualquier cliente —Georgia para
títulos y cifras, Arial para el texto—, que es el mismo reparto que hace
el panel con Fraunces e Inter. Los colores son los suyos: verde lo real,
madera lo que avisa, pizarra lo que se mira, ladrillo el riesgo.

Va además una **versión en texto**. No es un adorno: hay clientes y
relojes que muestran esa, y un correo sin alternativa de texto puntúa
peor en los filtros de correo no deseado.

## Qué lee, y qué no

| Hoja | Para qué |
|---|---|
| `Plan` | Plan del mes en curso por proveedor y subproducto |
| `Ingresos` | Último despacho confirmado en SAP |
| `InformeAstilla` | Último despacho según la planilla del reservador |
| `Proveedores` | Alias, para cruzar nombres entre las tres |

El cruce de nombres es el mismo del panel y tiene tres pasos: la hoja
`Proveedores` manda y no tiene umbral; si no hay alias escrito, decide
el **parecido** contra los nombres reales de SAP; si tampoco, el nombre
queda como viene. El paso del parecido no estaba, y por eso el correo
daba por callados a los proveedores que la planilla escribe distinto
—`FATIMA` por `FORESTAL FATIMA LTDA.`— y que el panel sí cruza. Medido
sobre la planilla real: cinco de ochenta y tres nombres.

Son **dos preguntas con reglas distintas**, y conviene no mezclarlas:

- **Cuándo despachó por última vez.** Basta la fecha más alta de las dos
  fuentes, venga de donde venga. No hace falta la fusión día por día del
  panel: la pregunta es otra.
- **Cuánto entró.** Acá sumar las dos fuentes está **mal**: el mismo
  camión está en SAP y en la planilla, y sumarlos lo cuenta dos veces.
  Por día y por proveedor manda SAP, y la planilla solo tapa el día que
  SAP todavía no tiene cargado. Es la regla del panel, y acá importa
  porque de este número salen el ritmo y la tendencia.

Esto último era un error: el correo sumaba las dos fuentes y «ingresado
en el mes» salía inflado para todo proveedor cuyo día estuviera en las
dos. Mientras la columna era solo informativa se notaba poco; con el
ritmo encima, habría dicho que un proveedor va al día cuando viene
cayendo.

Lo que **sí** está duplicado del dashboard son constantes y funciones
puras: códigos de material, días hábiles y la normalización de nombres
de proveedor. Están todas juntas en `Config.gs` y `comparable_()` para
que se vean de una mirada. Si alguna cambia en el panel, hay que
cambiarla también acá.

Los feriados también son copia, pero de esos se encarga una prueba.
`Feriados.gs` los calcula —Pascua, solsticio de junio y los traslados
de las leyes 19.973 y 20.299— en vez de tenerlos escritos, así que no
se acaban nunca. `pruebas/feriados.js` corre esta copia y la del panel
contra el calendario real y falla si se separan. Lo único a mano es
`FERIADOS_EXTRA`, hoy vacío, para el feriado que declare una ley puntual
y ninguna regla prediga.

`Feriados.gs` no depende de ningún otro archivo: se puede copiar solo.

## Pruebas

```
node pruebas/prueba.js
node pruebas/feriados.js
```

Corre los `.gs` en node con hojas falsas que imitan la forma real
(fechas como `Date`, cantidades con coma decimal, `Suministro`
arrastrado, filas `TOTAL`, filas con `Estado: ERROR`, materiales que
no son astilla). Cubre el cruce por alias, los tres grupos y que sean
excluyentes, las dos señales de «a la baja» por separado, el día que
está en SAP y en la planilla a la vez, el primer día del mes sin
acusar a nadie, el salto del sábado, el caso sin nadie en riesgo y el
Plan sin columna del mes. Deja el correo armado en
`pruebas/correo.html` para poder mirarlo en el navegador.
`Config.gs` se carga **antes** que `Feriados.gs` a propósito: es el
orden que reventaría si alguien volviera a calcular los feriados al
cargar el archivo en vez de pedirlos cuando se usan.

`feriados.js` compara los feriados calculados —los de acá y los del
panel— contra el calendario oficial de 2024, 2025 y 2026, revisa los
traslados por ley uno por uno y comprueba que con un «hoy» de 2099 la
lista siga cubriendo el año en curso y los dos siguientes.
