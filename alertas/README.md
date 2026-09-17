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
2. Pegar los tres archivos como archivos separados del proyecto:
   `Config.gs`, `Lectura.gs`, `Aviso.gs`.
3. En el ícono de engranaje del editor, marcar «Mostrar el archivo de
   manifiesto» y reemplazar `appsscript.json` por el de esta carpeta.
   (Alternativa: dejar el manifiesto como viene; los permisos se piden
   igual al ejecutar.)
4. Confirmar `SPREADSHEET_ID` y `PARA` en `Config.gs`.
5. Ejecutar **`probarSinEnviar`** y mirar el registro: dice cuántos
   proveedores encontró en el Plan y cuáles no cruzan con ningún
   ingreso. Es la forma de detectar un alias que falta antes de que
   salga un correo diciendo que alguien no despacha cuando sí lo hizo.
6. Ejecutar **`enviarAhora`** para recibir uno de prueba.
7. Ejecutar **`instalarAvisoDiario`**. Listo.

Para apagarlo: `eliminarAvisoDiario`.

## Qué manda

Tres tablas de proveedores con plan del mes y sin ingresos recientes:

| Tabla | Quién entra |
|---|---|
| 3 a 4 días hábiles | Se apagaron esta semana |
| 5 a 6 días hábiles | Ya es un patrón |
| 7 días hábiles o más | Incluye a los que no registran ningún ingreso |

Cuatro decisiones, todas en `Config.gs`:

- **Los tramos son excluyentes.** Un proveedor aparece en una sola
  tabla. Acumulativos, el que lleva ocho días saldría en las tres y el
  correo diría tres veces lo mismo.
- **Los días son hábiles, no corridos.** Con días corridos, quien
  despachó el viernes aparecería todos los lunes con tres días de
  silencio sin que hubiera pasado nada.
- **Una fila por proveedor**, no por fila del Plan: la llamada es una
  sola aunque tenga tres subproductos comprometidos.
- **Solo entran los que tienen plan este mes.** Una fila del Plan con
  la celda del mes en blanco no compromete nada, así que ese proveedor
  no aparece por mucho que lleve semanas sin despachar.
- **Sábado y domingo no sale** (`SOLO_HABILES`), porque el número no
  cambia y el correo sería idéntico al del viernes.

Si no hay nadie atrasado, el correo igual sale diciéndolo: un correo
que no llega no distingue entre «todo al día» y «el script falló».

## Qué lee, y qué no

| Hoja | Para qué |
|---|---|
| `Plan` | Plan del mes en curso por proveedor y subproducto |
| `Ingresos` | Último despacho confirmado en SAP |
| `InformeAstilla` | Último despacho según la planilla del reservador |
| `Proveedores` | Alias, para cruzar nombres entre las tres |

**No** usa la fusión día por día que hace el panel. Para «cuándo
despachó por última vez» basta la fecha más alta de las dos fuentes,
venga de donde venga; la regla de fusión resuelve otra cosa —cuánto
sumar cada día sin contar dos veces— que aquí no se pregunta. Es menos
código y una cosa menos que se puede desincronizar.

Lo que **sí** está duplicado del dashboard son constantes y funciones
puras: códigos de material, feriados, días hábiles y la normalización
de nombres de proveedor. Están todas juntas en `Config.gs` y
`comparable_()` para que se vean de una mirada. Si alguna cambia en el
panel, hay que cambiarla también acá.

## Pruebas

```
node pruebas/prueba.js
```

Corre los `.gs` en node con hojas falsas que imitan la forma real
(fechas como `Date`, cantidades con coma decimal, `Suministro`
arrastrado, filas `TOTAL`, filas con `Estado: ERROR`, materiales que
no son astilla). Cubre el cruce por alias, los tres tramos, el salto
del sábado, el caso sin atrasados y el Plan sin columna del mes.
