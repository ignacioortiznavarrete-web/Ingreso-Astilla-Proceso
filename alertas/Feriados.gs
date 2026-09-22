/**
 * ASTILLA PROCESO · ALERTAS · FERIADOS
 *
 * Copia exacta del módulo del panel. Está duplicado porque son dos
 * proyectos de Apps Script distintos y no comparten código; si cambia
 * la ley, hay que cambiarlo en los dos. Es la misma advertencia que
 * vale para los códigos de material y la normalización de nombres.
 *
 * Al menos ya no es una LISTA duplicada, que era lo que se
 * desincronizaba: son las mismas reglas dando el mismo resultado.
 */

/* =====================================================================
 * FERIADOS DE CHILE, CALCULADOS
 *
 * Antes eran una lista escrita a mano que llegaba hasta el 25-12-2026.
 * Una lista así no se acaba con un aviso: se acaba en silencio, y a
 * partir de ahí el 18 de septiembre cuenta como día hábil, el plan a
 * la fecha queda inflado y nadie se entera. Peor: al contrastar la
 * lista contra el cálculo apareció que el Viernes Santo de 2024 estaba
 * escrito como 19-04 —que es el de 2025— y el de verdad, 29-03,
 * faltaba.
 *
 * Lo que sí queda a mano es FERIADOS_EXTRA: los que agrega una ley
 * puntual y ninguna regla predice, como el lunes 21-09-2026. Son uno
 * cada varios años y su ausencia cuesta un día, no la lista entera.
 * ===================================================================== */

const FERIADOS_EXTRA = Object.freeze([
  // Vacío, y así debe quedarse mientras ninguna ley puntual diga otra
  // cosa. Acá va SOLO el feriado que declara una ley para un año
  // concreto y que ninguna regla predice. No va un día que la planta
  // no trabaja: para eso está WORKDAYS.
  //
  // Escribir de más cuesta caro. El lunes 21-09-2026 estuvo acá,
  // heredado de la lista vieja, y no es feriado: la Ley 20.215 corre el
  // día solo cuando el 18 cae martes o el 19 cae viernes, y en 2026
  // caen viernes y sábado. Con él adentro, ese lunes dejaba de ser
  // hábil y su planilla se sumaba al jueves 17 —el hábil anterior,
  // al otro lado del 18, 19 y 20—, así que dos días de despacho
  // aparecían como uno.
]);

/** Domingo de Pascua (algoritmo gregoriano anónimo). */
function pascuaDe_(anio) {
  const a = anio % 19;
  const b = Math.floor(anio / 100);
  const c = anio % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const mes = Math.floor((h + l - 7 * m + 114) / 31);
  const dia = ((h + l - 7 * m + 114) % 31) + 1;

  return new Date(Date.UTC(anio, mes - 1, dia));
}

/**
 * Solsticio de junio en hora de Chile: el Día Nacional de los Pueblos
 * Indígenas (Ley 21.357) cae ahí, y no es un 20 ni un 21 fijo.
 *
 * Fórmula de Meeus. Junio siempre es invierno acá, así que el huso es
 * UTC-4 sin excepción de horario de verano.
 */
function solsticioJunio_(anio) {
  const Y = (anio - 2000) / 1000;

  let JDE = 2451716.56767 + 365241.62603 * Y + 0.00325 * Y * Y +
    0.00888 * Math.pow(Y, 3) - 0.00030 * Math.pow(Y, 4);

  const T = (JDE - 2451545.0) / 36525;
  const W = 35999.373 * T - 2.47;
  const rad = Math.PI / 180;
  const lambda = 1 + 0.0334 * Math.cos(W * rad) +
    0.0007 * Math.cos(2 * W * rad);

  const TERMINOS = [
    [485, 324.96, 1934.136], [203, 337.23, 32964.467],
    [199, 342.08, 20.186], [182, 27.85, 445267.112],
    [156, 73.14, 45036.886], [136, 171.52, 22518.443],
    [77, 222.54, 65928.934], [74, 296.72, 3034.906],
    [70, 243.58, 9037.513], [58, 119.81, 33718.147],
    [52, 297.17, 150.678], [50, 21.02, 2281.226],
    [45, 247.54, 29929.562], [44, 325.15, 31555.956],
    [29, 60.93, 4443.417], [18, 155.12, 67555.328],
    [17, 288.79, 4562.452], [16, 198.04, 62894.029],
    [14, 199.76, 31436.921], [12, 95.39, 14577.848],
    [12, 287.11, 31931.756], [12, 320.81, 34777.259],
    [9, 227.73, 1222.114], [8, 15.45, 16859.074]
  ];

  let S = 0;

  TERMINOS.forEach(function(t) {
    S += t[0] * Math.cos((t[1] + t[2] * T) * rad);
  });

  JDE += (0.00001 * S) / lambda;

  return new Date((JDE - 2440587.5) * 86400000 - 4 * 3600000);
}

function masDias_(fecha, n) {
  return new Date(fecha.getTime() + n * 86400000);
}

// El relleno va escrito acá y no con pad2_ de Lectura.gs a
// propósito: este archivo es una copia del panel y se sostiene solo,
// sin depender de en qué orden cargue el resto del proyecto.
function claveDeFecha_(fecha) {
  const mes = fecha.getUTCMonth() + 1;
  const dia = fecha.getUTCDate();

  return fecha.getUTCFullYear() + '-' +
    (mes < 10 ? '0' : '') + mes + '-' +
    (dia < 10 ? '0' : '') + dia;
}

/**
 * Ley 19.973: el 29 de junio y el 12 de octubre se corren al lunes de
 * su misma semana si caen martes, miércoles o jueves, y al lunes
 * siguiente si caen viernes.
 */
function aLunes_(fecha) {
  const dow = fecha.getUTCDay();

  if (dow >= 2 && dow <= 4) { return masDias_(fecha, -(dow - 1)); }
  if (dow === 5) { return masDias_(fecha, 3); }

  return fecha;
}

/**
 * Ley 20.299: el Día de las Iglesias Evangélicas se corre al viernes
 * anterior si el 31 de octubre cae martes, y al siguiente si cae
 * miércoles.
 */
function aViernes_(fecha) {
  const dow = fecha.getUTCDay();

  if (dow === 2) { return masDias_(fecha, -4); }
  if (dow === 3) { return masDias_(fecha, 2); }

  return fecha;
}

/** Los feriados nacionales de un año. */
function feriadosDe_(anio) {
  const pascua = pascuaDe_(anio);

  return [
    anio + '-01-01',                        // Año Nuevo
    claveDeFecha_(masDias_(pascua, -2)),              // Viernes Santo
    claveDeFecha_(masDias_(pascua, -1)),              // Sábado Santo
    anio + '-05-01',                        // Día del Trabajo
    anio + '-05-21',                       // Glorias Navales
    claveDeFecha_(solsticioJunio_(anio)),             // Pueblos Indígenas
    claveDeFecha_(aLunes_(new Date(Date.UTC(anio, 5, 29)))),
    anio + '-07-16',                       // Virgen del Carmen
    anio + '-08-15',                       // Asunción
    anio + '-09-18',                       // Independencia
    anio + '-09-19',                       // Glorias del Ejército
    claveDeFecha_(aLunes_(new Date(Date.UTC(anio, 9, 12)))),
    claveDeFecha_(aViernes_(new Date(Date.UTC(anio, 9, 31)))),
    anio + '-11-01',                       // Todos los Santos
    anio + '-12-08',                       // Inmaculada
    anio + '-12-25'                       // Navidad
  ];
}

let FERIADOS_PANEL = null;

/**
 * La ventana de años que el panel puede necesitar. La historia llega
 * como mucho al 1 de enero del año en curso y el plan mira hasta fin
 * del mes vigente, así que con dos años a cada lado sobra.
 *
 * Se calcula la primera vez que alguien pregunta y queda guardado. No
 * se calcula al cargar el archivo a propósito: Apps Script evalúa los
 * .gs en el orden del proyecto, y quien pide los feriados puede estar
 * en un archivo que corre antes que este.
 */
function feriadosDelPanel_() {
  if (FERIADOS_PANEL) { return FERIADOS_PANEL; }

  const anio = new Date().getUTCFullYear();
  const vistos = {};

  for (let a = anio - 2; a <= anio + 2; a++) {
    feriadosDe_(a).forEach(function(f) { vistos[f] = true; });
  }

  FERIADOS_EXTRA.forEach(function(f) { vistos[f] = true; });

  FERIADOS_PANEL = Object.freeze(Object.keys(vistos).sort());
  return FERIADOS_PANEL;
}
