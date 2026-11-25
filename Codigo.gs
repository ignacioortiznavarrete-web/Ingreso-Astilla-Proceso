/**
 * ASTILLA PROCESO · INGRESOS REALES + COMPLEMENTO DEL LIBRO
 *
 * Unidad de trabajo: TONELADA SECA (TS).
 *
 * Fuentes, dos y nada más:
 * - Ingresos: la hoja con el registro real de recepción, bajada de
 *   SAP. Es la fuente válida y siempre tiene prioridad, pero va días
 *   atrás.
 * - El libro de camiones de la portería: un archivo de Drive, ajeno y
 *   nuevo cada mes, con una fila por camión y su número de guía. Es
 *   el registro en vivo y completa lo que SAP todavía no carga.
 * - Y el Plan, que no es un ingreso: precio unitario y plan mensual en
 *   TS por proveedor y material.
 *
 * Regla de complemento, camión por camión:
 * - La guía es la llave. El mismo número está escrito en los dos
 *   lados, así que se sabe exactamente qué camión del libro ya está
 *   en SAP y cuál no.
 * - El que está en SAP manda con su peso real; el que no, entra
 *   estimado con el factor de su material (nitens 15,2 · pino 11 ·
 *   con corteza 10,7 · aserrín 11).
 * - Cada estimado desaparece solo el día que SAP carga esa guía. No
 *   hay reglas de día completo ni excepciones que mantener.
 *
 * Subproductos de proceso:
 *   ASTILLA EUCALYPTUS NITENS
 *   AST. PINO VERDE C/ CORTEZA
 *   ASTILLA PINO VERDE
 *
 * Homologación primaria de la hoja Ingresos:
 *   3000039 -> ASTILLA PINO VERDE
 *   3009002 -> AST. PINO VERDE C/ CORTEZA
 *   3009003 -> ASTILLA EUCALYPTUS NITENS
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

function claveDeFecha_(fecha) {
  return buildDateKey_(
    fecha.getUTCFullYear(),
    fecha.getUTCMonth() + 1,
    fecha.getUTCDate()
  );
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
    buildDateKey_(anio, 1, 1),                        // Año Nuevo
    claveDeFecha_(masDias_(pascua, -2)),              // Viernes Santo
    claveDeFecha_(masDias_(pascua, -1)),              // Sábado Santo
    buildDateKey_(anio, 5, 1),                        // Día del Trabajo
    buildDateKey_(anio, 5, 21),                       // Glorias Navales
    claveDeFecha_(solsticioJunio_(anio)),             // Pueblos Indígenas
    claveDeFecha_(aLunes_(new Date(Date.UTC(anio, 5, 29)))),
    buildDateKey_(anio, 7, 16),                       // Virgen del Carmen
    buildDateKey_(anio, 8, 15),                       // Asunción
    buildDateKey_(anio, 9, 18),                       // Independencia
    buildDateKey_(anio, 9, 19),                       // Glorias del Ejército
    claveDeFecha_(aLunes_(new Date(Date.UTC(anio, 9, 12)))),
    claveDeFecha_(aViernes_(new Date(Date.UTC(anio, 9, 31)))),
    buildDateKey_(anio, 11, 1),                       // Todos los Santos
    buildDateKey_(anio, 12, 8),                       // Inmaculada
    buildDateKey_(anio, 12, 25)                       // Navidad
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

const CONFIG = Object.freeze({
  SPREADSHEET_ID: '1PNQToRtF7g-obmmOHuoonNGN5-VhhTYnW6SEhK36EOk',
  SHEET_INGRESOS: 'Ingresos',
  // Dónde está escrito qué libro de camiones usar cada mes.
  SHEET_FUENTES: 'Fuentes',

  /**
   * Quién puede ESCRIBIR desde el panel compartido.
   *
   * Mirar es de todos; escribir, de los que estén acá. Quien desplegó
   * la aplicación web siempre puede, sin necesidad de escribirse.
   * Correos completos, uno por línea:
   *
   *   EDITORES: Object.freeze(['alguien@masisa.com']),
   */
  EDITORES: Object.freeze([]),
  SHEET_PLAN: 'Plan',
  SHEET_PROYECCION: 'Proyeccion',
  SHEET_MAPEOS: 'Mapeos',
  SHEET_PROVEEDORES: 'Proveedores',
  SHEET_RUTAS: 'Rutas',
  SHEET_APUNTES: 'Apuntes',
  HTML_FILE: 'Index',
  TIMEZONE: 'America/Santiago',

  /**
   * La jornada de recepción de la planta. De esto sale la proyección
   * de cierre del día: sin saber cuánto falta para cerrar, "llevamos
   * 14 camiones" no dice nada.
   */
  JORNADA: Object.freeze({ DESDE: '08:30', HASTA: '23:00' }),

  // Toneladas secas por camión, POR MATERIAL. No es un promedio de
  // oficina: un camión de nitens carga más seco que uno de pino con
  // corteza, y usar 11 para todo desinflaba el nitens y sobrestimaba
  // la corteza en cada día complementado desde la planilla.
  //
  //   3009003 nitens          15,2
  //   3009002 con corteza     10,7
  //   3000039 pino verde      11
  //
  FACTOR_CAMION: 11,
  FACTOR_POR_MATERIAL: Object.freeze({
    'ASTILLA EUCALYPTUS NITENS': 15.2,
    'AST. PINO VERDE C/ CORTEZA': 10.7,
    'ASTILLA PINO VERDE': 11,
    // PROVISORIO. El aserrín entró después y nadie ha dicho cuánto
    // pesa su camión, así que por ahora usa el factor general. El
    // panel compara estos factores contra lo que SAP pesa de verdad y
    // avisa cuando no se parecen: ahí está el número que hay que
    // poner acá.
    'ASERRÍN PINO VERDE': 11
  }),
  UNIDAD: 'TS',

  // Historia que viaja al dashboard. Son DOS reglas y la ventana es
  // la más larga de las dos:
  //
  //   HISTORY_MONTHS      ventana móvil de N meses hacia atrás.
  //   HISTORY_DESDE_ENERO además, nunca corta después del 1 de enero
  //                       del año en curso.
  //
  // La segunda existe porque una ventana móvil NUNCA puede significar
  // "desde enero": en septiembre hacen falta 9 meses, en octubre 10 y
  // en marzo del año siguiente 15. Subir el número arregla el mes en
  // que se sube y se vuelve a romper al siguiente.
  //
  // En enero manda la ventana móvil, que es más larga: si no, el panel
  // arrancaría el día 1 sin nada con qué comparar.
  //
  // Estas filas viajan enteras al navegador, así que la ventana se
  // deja en el mínimo que cumple: seis meses de estadística y, encima,
  // la garantía de enero. Subir HISTORY_MONTHS a 12 haría la regla de
  // enero inerte —la ventana móvil ya la taparía— y mandaría el doble
  // de filas para nada.
  HISTORY_MONTHS: 6,
  HISTORY_DESDE_ENERO: true,

  FUZZY_THRESHOLD: 0.72,

  // Cruce de precio Plan ↔ proveedor operativo. Si dos candidatos
  // quedan demasiado cerca, el precio NO se asigna automáticamente.
  PRICE_MATCH_THRESHOLD: 0.72,
  PRICE_MATCH_MARGIN: 0.08,

  // 0=domingo ... 6=sábado. Agrega el 6 si trabajan sábados.
  WORKDAYS: Object.freeze([1, 2, 3, 4, 5]),

  // Feriados excluidos del prorrateo. Ya no se escriben: se calculan
  // para el año en curso y dos a cada lado. Lo único a mano es
  // FERIADOS_EXTRA, arriba. Se pide, no se guarda: así el cálculo
  // ocurre recién cuando alguien lo usa.
  get FERIADOS() { return feriadosDelPanel_(); },

  // Posición de respaldo de las columnas de Ingresos (base cero),
  // con el layout habitual de la hoja Ingresos.
  // Si la hoja trae encabezados, se detectan por nombre y esto no
  // se usa.
  MATERIAL_MAP: Object.freeze({
    '3000039': 'ASTILLA PINO VERDE',
    '3009002': 'AST. PINO VERDE C/ CORTEZA',
    '3009003': 'ASTILLA EUCALYPTUS NITENS',
    // En SAP se llama "ASERRIN (TS)", sin decir la especie: el código
    // es lo que lo identifica.
    '3000043': 'ASERRÍN PINO VERDE'
  }),

  // Posiciones de respaldo (base cero) de la hoja Ingresos.
  // Si los encabezados están presentes, se detectan por nombre.
  /**
   * El libro de camiones: el registro en vivo de la portería.
   *
   * Es de otra área y cambia de archivo cada mes, así que no se puede
   * fijar un id acá. Se busca por el nombre del archivo y, si alguien
   * lo renombra o quiere fijar uno distinto, manda lo que esté escrito
   * en la hoja Fuentes.
   */
  // El registro propio: una copia en Excel de cada día, en una
  // carpeta de Drive que es nuestra. CARPETA acepta el enlace
  // completo o solo el código.
  ARCHIVO: Object.freeze({
    CARPETA: 'https://drive.google.com/drive/folders/' +
      '1amDJBZ_U4RoMksMN2sZXMYxvVbabZRMF',
    PREFIJO: 'Ingresos',
    // Quince minutos antes de las doce: el día queda guardado el mismo
    // día, con la jornada cerrada hace tres cuartos de hora.
    HORA: 23,
    MINUTO: 45
  }),

  // Cómo se reparte el día: a qué hora llegan los camiones.
  PERFIL: Object.freeze({
    // Un día con menos camiones que esto no dice nada de la forma del
    // día: un sábado con tres no se parece a un martes.
    MINIMO_CAMIONES: 8,
    // Antes de que haya pasado esta parte del día típico, proyectar
    // es dividir por un número muy chico y el resultado se dispara.
    MINIMA_PARTE: 0.15,
    // Cuántas horas entran en "la punta".
    HORAS_PUNTA: 3
  }),

  CAMIONES: Object.freeze({
    PATRON: 'CAMIONES INGRESO',
    // Hasta qué columna se lee. La hoja tiene decenas, y las que
    // importan están todas antes de la 24.
    COLUMNAS_MAX: 24
  }),

  INGRESOS_COLUMNS: Object.freeze({
    // La guía es la llave entre SAP y el libro de camiones: el mismo
    // número está escrito en los dos lados.
    GUIA: 1,
    MATERIAL: 2,
    DESCRIPCION_MATERIAL: 3,
    FECHA_CONTABLE: 4,
    TEXTO_POSICION: 7,
    CANTIDAD: 8,
    UM: 10,
    PROVEEDOR: 11,
    DESCRIPCION_PROVEEDOR: 12,
    DESTINO: 13,
    ROL: 14,
    PREDIO: 16
  })
});

const SUBPRODUCTOS_OBJETIVO = Object.freeze([
  'ASTILLA EUCALYPTUS NITENS',
  'AST. PINO VERDE C/ CORTEZA',
  'ASTILLA PINO VERDE',
  // El aserrín de pino verde también entra a proceso. El de
  // combustible no: ese va a NEOMAS y no es materia prima del tablero.
  'ASERRÍN PINO VERDE'
]);

/* =====================================================================
 * MENÚ Y APLICACIÓN WEB
 * ===================================================================== */

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('Astilla Dashboard')
    .addItem('Abrir dashboard', 'abrirDashboard')
    .addSeparator()
    .addItem('Validar hoja Plan (no modifica)', 'prepararHojaPlan')
    .addItem('¿Por qué no toma el plan?', 'diagnosticarPlan')
    .addSeparator()
    .addItem('Preparar hoja de fuentes', 'instalarFuentes')
    .addItem(
      'Buscar el libro de camiones del mes',
      'buscarLibroDelMes'
    )
    .addItem('Preparar hoja de proveedores', 'instalarProveedores')
    .addItem('Rellenar proveedores sugeridos', 'rellenarProveedores')
    .addItem('Preparar hoja de mapeos', 'instalarMapeos')
    .addItem('Ubicar en el mapa', 'ubicarMapeos')
    .addItem('Preparar hoja de rutas', 'instalarRutas')
    .addItem('Preparar hoja de apuntes', 'instalarApuntes')
    .addSeparator()
    .addItem('Guardar en Drive el día de hoy', 'archivarHoy')
    .addItem('Guardar en Drive el día de ayer', 'archivarDia')
    .addItem('Guardar en Drive el mes completo', 'archivarMes')
    .addItem('Instalar el guardado diario', 'instalarArchivoDiario')
    .addItem('Eliminar el guardado diario', 'eliminarArchivoDiario')
    .addToUi();
}

/* =====================================================================
 * QUIÉN PUEDE ESCRIBIR
 *
 * El panel se comparte como aplicación web para que lo vea gente que
 * NO tiene acceso a las hojas: la app corre con los permisos de quien
 * la desplegó, así que el libro de camiones, Ingresos y el Plan los
 * lee el script y no el que mira. Esa es justamente la gracia.
 *
 * Y es también lo que hay que atajar acá. Si el script escribe con los
 * permisos de quien lo desplegó, cualquiera que abra el enlace podría
 * homologar un proveedor o borrar un apunte EN NOMBRE DE ÉL, y en la
 * hoja quedaría su correo como autor.
 *
 * La comprobación va en el servidor y no en el panel: esconder un
 * botón no impide llamar a la función que había detrás.
 *
 * Solo se guardan las funciones que el panel puede llamar. Las del
 * menú —instalar hojas, reconstruir, rellenar— se corren desde la
 * planilla, y ahí el control son los permisos de la planilla misma:
 * quien puede abrirla ya podía escribirla a mano.
 * ===================================================================== */

/**
 * ¿Quién está mirando, y puede escribir?
 *
 * En la aplicación web el usuario ACTIVO es el que abrió el enlace y
 * el EFECTIVO es quien la desplegó. Abierto desde la planilla, los dos
 * son la misma persona y todo sigue como antes.
 */
function puedeEditar_() {
  const quien = normalizeKey_(autorActual_());

  // Sin saber quién es —otro dominio, o un acceso anónimo— solo se
  // mira. Es el lado seguro del error.
  if (!quien) { return false; }

  let dueno = '';

  try {
    dueno = normalizeKey_(Session.getEffectiveUser().getEmail());
  } catch (ignorado) {}

  if (dueno && quien === dueno) { return true; }

  return (CONFIG.EDITORES || []).some(function(correo) {
    return normalizeKey_(correo) === quien;
  });
}

function exigirEdicion_(accion) {
  if (puedeEditar_()) { return; }

  throw new Error(
    'Esta vista es de solo lectura. ' +
    (accion || 'Eso') + ' lo hace quien tiene el panel a su nombre; ' +
    'si necesitas hacerlo tú, pide que te agreguen a EDITORES.'
  );
}

function doGet() {
  return HtmlService
    .createTemplateFromFile(CONFIG.HTML_FILE)
    .evaluate()
    .setTitle('Astilla Proceso · Control de suministro')
    .setXFrameOptionsMode(
      HtmlService.XFrameOptionsMode.ALLOWALL
    );
}

function abrirDashboard() {
  const output = HtmlService
    .createTemplateFromFile(CONFIG.HTML_FILE)
    .evaluate()
    .setWidth(1700)
    .setHeight(950);

  SpreadsheetApp.getUi().showModalDialog(
    output,
    'Astilla Proceso · Control de suministro'
  );
}


/**
 * Compatibilidad con el menú anterior.
 * IMPORTANTE: esta función NO crea columnas, NO limpia celdas y NO cambia
 * formatos de la hoja Plan. Solo lee y valida la estructura existente.
 */
function prepararHojaPlan() {
  return validarHojaPlan();
}

/**
 * Por qué un proveedor no toma su plan.
 *
 * El cruce contra el Plan puede fallar en tres lugares distintos y el
 * panel solo muestra el resultado: una celda vacía se ve igual venga
 * de un nombre que no cruzó, de un material que el Plan no tiene o de
 * una fila del Plan escrita en el mes equivocado.
 *
 * Esto los separa. Por cada proveedor y material que entró este mes
 * dice con qué fila del Plan cruzó y por qué camino; y al final, las
 * filas del Plan que nadie usó.
 */
function diagnosticarPlan() {
  const spreadsheet = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
  const timezone =
    spreadsheet.getSpreadsheetTimeZone() || CONFIG.TIMEZONE;
  const month = getCurrentMonthWindow_(timezone);
  const homologacion = leerProveedores_(spreadsheet);

  const ingresos = readIngresos_(
    spreadsheet, timezone, month.startKey, homologacion
  );

  const camiones = readCamiones_(
    spreadsheet,
    mesesDelLibro_(month),
    ingresos.proveedores,
    homologacion,
    timezone
  );

  const delLibro = complementarCamiones_(ingresos.rows, camiones.rows);
  const plan = readPlan_(spreadsheet, month);

  // Lo que entró este mes, juntado por proveedor y material.
  const porPar = {};

  ingresos.rows.concat(delLibro.rows).forEach(function(row) {
    if (String(row.fecha).slice(0, 7) !== month.prefix) { return; }

    const llave = row.proveedor + '||' + row.subproducto;

    if (!porPar[llave]) {
      porPar[llave] = {
        proveedor: row.proveedor,
        subproducto: row.subproducto,
        ts: 0
      };
    }

    porPar[llave].ts += Number(row.ts) || 0;
  });

  const usadas = {};
  const cruzan = [];
  const fallan = [];

  Object.keys(porPar).sort().forEach(function(llave) {
    const par = porPar[llave];
    const r = resolvePlanPrice_(
      par.proveedor, par.subproducto, plan.details, homologacion
    );

    const linea = par.proveedor + ' · ' + subCorto_(par.subproducto) +
      ' · ' + round_(par.ts, 1) + ' TS';

    if (r.detail) {
      usadas[r.detail.planKey] = true;

      cruzan.push(
        linea + '\n      → ' + r.method + ' con "' +
        r.detail.proveedorPlan + '" · plan ' +
        round_(r.detail.plan || 0, 1) + ' TS a ' + r.detail.precio
      );
    } else {
      fallan.push(
        linea + '\n      → ' + r.method +
        (r.score ? ' (mejor parecido ' + r.score + ')' : '')
      );
    }
  });

  // Filas del Plan con toneladas este mes que nadie usó.
  const sinIngreso = plan.details.filter(function(d) {
    return (Number(d.plan) || 0) > 0 && !usadas[d.planKey];
  }).map(function(d) {
    return subCorto_(d.subproducto) + ' · "' + d.proveedorPlan +
      '" · ' + round_(d.plan, 1) + ' TS';
  });

  const lineas = [
    'Cruce con el Plan · ' + (plan.monthLabel || month.label),
    '',
    'Filas del Plan leídas: ' + plan.details.length,
    '',
    'CRUZAN (' + cruzan.length + ')',
    cruzan.length ? '  ' + cruzan.join('\n  ') : '  ninguno',
    '',
    'NO CRUZAN (' + fallan.length + ')',
    fallan.length ? '  ' + fallan.join('\n  ') : '  ninguno',
    '',
    'EN EL PLAN Y SIN INGRESO (' + sinIngreso.length + ')',
    sinIngreso.length ? '  ' + sinIngreso.join('\n  ') : '  ninguna'
  ];

  const texto = lineas.join('\n');

  Logger.log(texto);
  avisarEnPantalla_(texto);

  return texto;
}

function validarHojaPlan() {
  const spreadsheet = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
  const timezone =
    spreadsheet.getSpreadsheetTimeZone() || CONFIG.TIMEZONE;
  const month = getCurrentMonthWindow_(timezone);
  const plan = readPlan_(spreadsheet, month);

  const lines = [
    'Validación de hoja Plan',
    '',
    'Hoja: ' + (plan.sheetName || CONFIG.SHEET_PLAN),
    'Mes: ' + (plan.monthLabel || month.label),
    'Filas proveedor/material: ' + plan.details.length,
    'Plan mensual total: ' + round_(plan.totalPlan || 0, 1) + ' TS',
    'Precio promedio ponderado plan: ' +
      (
        plan.weightedPrice !== null
          ? round_(plan.weightedPrice, 2) + ' por TS'
          : 'Sin volumen planificado con precio'
      ),
    'Costo plan valorizado: ' + round_(plan.plannedCost || 0, 2),
    ''
  ];

  SUBPRODUCTOS_OBJETIVO.forEach(function(name) {
    const row = plan.rows.filter(function(item) {
      return item.subproducto === name;
    })[0];

    if (!row) {
      lines.push('- ' + name + ': sin filas en Plan');
      return;
    }

    lines.push(
      '- ' +
      name +
      ': ' +
      round_(row.plan || 0, 1) +
      ' TS · precio pond. ' +
      (
        row.weightedPrice !== null
          ? round_(row.weightedPrice, 2)
          : '—'
      )
    );
  });

  if (plan.invalidRows.length) {
    lines.push('');
    lines.push(
      'Filas no reconocidas: ' + plan.invalidRows.length
    );
    plan.invalidRows.slice(0, 15).forEach(function(item) {
      lines.push('- Fila ' + item.row + ': ' + item.reason);
    });
  }

  try {
    SpreadsheetApp.getUi().alert(lines.join('\n'));
  } catch (ignoredUi) {}

  return plan;
}

/* =====================================================================
 * API DEL DASHBOARD
 * ===================================================================== */

function getDashboardData() {
  const spreadsheet = SpreadsheetApp.openById(
    CONFIG.SPREADSHEET_ID
  );

  const timezone =
    spreadsheet.getSpreadsheetTimeZone() ||
    CONFIG.TIMEZONE;

  const month = getCurrentMonthWindow_(timezone);
  const historyStart = buildHistoryStart_(month);

  // Se lee una sola vez y viaja a los tres cruces: unificar los
  // nombres de SAP, cruzar la planilla y cruzar el precio del Plan.
  const homologacion = leerProveedores_(spreadsheet);

  const ingresos = readIngresos_(
    spreadsheet,
    timezone,
    historyStart,
    homologacion
  );

  // El registro en vivo: una fila por camión, con su guía. Se leen el
  // mes en curso y el anterior; más atrás ya está todo en SAP.
  const camiones = readCamiones_(
    spreadsheet,
    mesesDelLibro_(month),
    ingresos.proveedores,
    homologacion,
    timezone
  );

  // Y de esos camiones, los que SAP todavía no tiene cargados. El
  // cruce es por guía: no hace falta ninguna regla de día.
  const delLibro = complementarCamiones_(ingresos.rows, camiones.rows);

  // Dos fuentes y nada más: SAP para lo pesado, el libro para lo que
  // SAP todavía no carga.
  const baseRows = ingresos.rows.concat(delLibro.rows);

  // Hasta dónde llega lo real, que es hasta donde llegó SAP.
  const ultimaSap = ingresos.rows.reduce(function(mayor, row) {
    return row.fecha > mayor ? row.fecha : mayor;
  }, '');

  const workdays = buildWorkdaysInfo_(
    timezone,
    month,
    ultimaSap,
    // Hasta dónde llega lo estimado: lo marca el libro, que va al día.
    camiones.ultimaFecha > ultimaSap ? camiones.ultimaFecha : ultimaSap,
    historyStart
  );

  // Desde qué día el panel muestra estimado en vez de real.
  const desdeElLibro = delLibro.rows.reduce(function(menor, row) {
    return !menor || row.fecha < menor ? row.fecha : menor;
  }, '');

  const plan = readPlan_(spreadsheet, month);

  // El plan mes a mes es lo que permite comparar; readPlan_ solo mira
  // la columna del mes vigente.
  const planMeses = readPlanMeses_(
    spreadsheet,
    historyStart.slice(0, 7),
    month.prefix
  );

  // Camiones comprometidos por día hábil, convertidos a TS con el
  // factor del material de la columna A.
  const proyeccion = readProyeccion_(
    spreadsheet,
    month,
    workdays.workdayKeys,
    ingresos.proveedores,
    homologacion
  );

  const pricing = applyPlanPricing_(
    baseRows,
    plan.details,
    homologacion
  );
  const rows = pricing.rows;

  return {
    generatedAt: Utilities.formatDate(
      new Date(),
      timezone,
      "yyyy-MM-dd'T'HH:mm:ss"
    ),
    timezone: timezone,
    unidad: CONFIG.UNIDAD,
    factor: CONFIG.FACTOR_CAMION,
    factorPorMaterial: CONFIG.FACTOR_POR_MATERIAL,
    month: month,
    workdays: workdays,
    holidays: CONFIG.FERIADOS.slice(),
    subproductos: SUBPRODUCTOS_OBJETIVO.slice(),
    materialMap: CONFIG.MATERIAL_MAP,
    source: {
      spreadsheetName: spreadsheet.getName(),
      spreadsheetUrl: spreadsheet.getUrl(),
      missingIngresos: ingresos.missingSheet,
      ingresosRows: ingresos.rows.length,
      ingresosIgnored: ingresos.ignored,
      // Lo que el libro aporta y SAP todavía no tiene. Un camión por
      // fila: la guía es la llave y no se cuenta dos veces.
      supplementRows: delLibro.rows.length,
      supplementCamiones: delLibro.rows.length,
      historyStart: historyStart,
      historyStartLabel: formatDateKey_(historyStart),
      historyMonths: CONFIG.HISTORY_MONTHS,
      lastActualDate: ultimaSap,
      lastActualDateLabel: ultimaSap
        ? formatDateKey_(ultimaSap)
        : 'Sin datos reales',
      supplementStart: desdeElLibro,
      // Qué entró hoy, camión por camión, y con cuánto cerraría el
      // día si sigue a este ritmo.
      hoy: resumenDelDia_(
        camiones.rows,
        ingresos.rows,
        workdays.todayKey,
        timezone
      ),
      // Cuántos camiones faltan para cumplir el plan de cada material.
      camionesPlan: camionesDelPlan_(
        plan.details,
        rows,
        month,
        workdays
      ),
      // Quién está mirando y si puede escribir. El panel esconde lo
      // que no va a poder hacer, para no ofrecer un botón que después
      // responde que no.
      permisos: {
        quien: autorActual_(),
        puedeEditar: puedeEditar_()
      },
      // Cuánto pesa de verdad un camión de cada material, según las
      // guías que SAP ya tiene pesadas.
      factoresObservados: factoresObservados_(ingresos.rows),
      // El libro de camiones: de dónde salió, qué alcanzó a ver y
      // cuántos de sus camiones ya estaban en SAP.
      camiones: {
        libros: camiones.libros,
        mes: month.prefix,
        faltan: camiones.faltan,
        filas: camiones.rows.length,
        complementados: delLibro.camiones,
        ts: delLibro.ts,
        yaEnSap: delLibro.yaEnSap,
        // Guías cuyo número está en SAP pero a nombre de otro
        // proveedor: no se complementan y se dice por qué.
        porNumero: delLibro.porNumero,
        dudosos: delLibro.dudosos,
        sinGuia: camiones.sinGuia,
        otrosProductos: camiones.otrosProductos,
        repetidas: camiones.repetidas,
        // Camiones que llegaron y el libro todavía no cierra.
        enCurso: camiones.enCurso,
        horasDudosas: camiones.horasDudosas,
        demora: camiones.demora,
        primeraFecha: camiones.primeraFecha,
        ultimaFecha: camiones.ultimaFecha,
        ultimaFechaLabel: camiones.ultimaFecha
          ? formatDateKey_(camiones.ultimaFecha)
          : ''
      },
      supplementStartLabel: desdeElLibro
        ? formatDateKey_(desdeElLibro)
        : 'Sin complemento',
      latestReportDate: camiones.ultimaFecha,
      latestReportDateLabel: camiones.ultimaFecha
        ? formatDateKey_(camiones.ultimaFecha)
        : 'Sin libro',
      hasPlan: plan.details.length > 0,
      planInvalidRows: plan.invalidRows.length,
      planMissingProducts: SUBPRODUCTOS_OBJETIVO.filter(function(name) {
        return !plan.rows.some(function(item) {
          return item.subproducto === name;
        });
      }),
      planWeightedPrice: plan.weightedPrice,
      planCost: plan.plannedCost,
      priceCoverage: pricing.stats.coverage,
      priceUnmatchedTs: pricing.stats.unpricedTs,
      planSheetName: plan.sheetName || CONFIG.SHEET_PLAN,
      planMonthLabel: plan.monthLabel || '',
      materialesSinReconocer: ingresos.materialesSinReconocer,
      homologacion: {
        hoja: CONFIG.SHEET_PROVEEDORES,
        revision: buildHomologacionPendiente_(
          rows,
          ingresos.proveedores,
          homologacion,
          proyeccion,
          plan.details
        ),
        // Cada proveedor de SAP con sus tres nombres. Es la vista al
        // derecho: no «qué no cruza» sino «cómo escribe cada hoja a
        // cada proveedor», los que están bien incluidos.
        mapa: buildHomologacionMapa_(
          ingresos.proveedores,
          rows,
          proyeccion,
          plan.details,
          homologacion
        ),
        existe: !homologacion.missingSheet,
        alias: homologacion.alias,
        proveedores: homologacion.canonicos.length,
        unificadosSap: ingresos.unificados || 0,
        pendientes: homologacion.pendientes,
        conflictos: homologacion.conflictos
      }
    },
    filters: {
      subproductos: uniqueSorted_(
        rows.map(function(item) {
          return item.subproducto;
        })
      ),
      proveedores: uniqueSorted_(
        rows.map(function(item) {
          return item.proveedor;
        })
      ),
      destinos: uniqueSorted_(
        rows.map(function(item) {
          return item.destino;
        })
      )
    },
    plan: plan.rows,
    planDetails: plan.details,
    planMeses: planMeses,
    proyeccion: proyeccion,
    pricing: pricing.stats,
    rows: rows
  };
}

function buildHistoryStart_(month) {
  const back = Math.max(
    0,
    Number(CONFIG.HISTORY_MONTHS) - 1
  );

  const date = new Date(
    Date.UTC(month.year, month.month - 1 - back, 1)
  );

  const movil = buildDateKey_(
    date.getUTCFullYear(),
    date.getUTCMonth() + 1,
    1
  );

  if (!CONFIG.HISTORY_DESDE_ENERO) {
    return movil;
  }

  // La más larga de las dos ventanas. En enero gana la móvil, que
  // llega más atrás; el resto del año gana enero.
  const enero = buildDateKey_(month.year, 1, 1);

  return movil < enero ? movil : enero;
}

/* =====================================================================
 * LECTURA DE INGRESOS REALES
 * ===================================================================== */

function readIngresos_(
  spreadsheet,
  timezone,
  historyStart,
  homologacion
) {
  const sheet = spreadsheet.getSheetByName(CONFIG.SHEET_INGRESOS);

  if (!sheet || sheet.getLastRow() < 2) {
    return {
      rows: [],
      proveedores: [],
      ignored: 0,
      unificados: 0,
      materialesSinReconocer: [],
      missingSheet: !sheet
    };
  }

  const range = sheet.getDataRange();
  const values = range.getValues();
  const displayed = range.getDisplayValues();
  const columns = resolveIngresosColumns_(values[0]);

  const rows = [];
  const noMatch = {};
  let ignored = 0;
  let unificados = 0;

  for (let rowIndex = 1; rowIndex < values.length; rowIndex++) {
    const row = values[rowIndex];
    const displayRow = displayed[rowIndex] || [];

    const dateKey = toDateKey_(
      row[columns.FECHA_CONTABLE],
      displayRow[columns.FECHA_CONTABLE],
      timezone
    );

    if (!dateKey || dateKey < historyStart) {
      continue;
    }

    const material = row[columns.MATERIAL];
    const descripcion = text_(row[columns.DESCRIPCION_MATERIAL]);
    const textoPosicion = columns.TEXTO_POSICION >= 0
      ? text_(row[columns.TEXTO_POSICION])
      : '';

    const resolved = resolveIngresosSubproducto_(
      material,
      descripcion,
      textoPosicion
    );

    if (!resolved.subproducto) {
      ignored++;

      const rawKey = [
        normalizeSapMaterialCode_(material) || text_(material),
        descripcion
      ].filter(Boolean).join(' | ');

      if (rawKey) {
        noMatch[rawKey] = true;
      }

      continue;
    }

    const proveedorSap =
      text_(row[columns.DESCRIPCION_PROVEEDOR]) ||
      (columns.PROVEEDOR >= 0
        ? text_(row[columns.PROVEEDOR])
        : '') ||
      'SIN PROVEEDOR';

    // SAP también se repite a sí mismo: la misma empresa con y sin
    // "S.A.", o dada de alta dos veces. Si la hoja Proveedores dice
    // que son la misma, aquí se juntan y el resto del dashboard las
    // ve como un solo proveedor.
    const unificado = homologarProveedor_(proveedorSap, homologacion);

    const proveedor = unificado || proveedorSap;

    if (unificado && normalizeKey_(unificado) !== normalizeKey_(proveedorSap)) {
      unificados++;
    }

    const cantidad = toNumber_(
      row[columns.CANTIDAD],
      displayRow[columns.CANTIDAD]
    );

    if (!isFinite(cantidad) || cantidad === 0) {
      continue;
    }

    rows.push({
      fecha: dateKey,
      source: 'INGRESOS',
      // Con qué camión entró. Es lo que permite saber si una guía del
      // libro ya está cargada en SAP sin mirar fechas ni cantidades.
      guia: columns.GUIA >= 0
        ? normalizaGuia_(row[columns.GUIA])
        : '',
      subproducto: resolved.subproducto,
      subproductoRaw: descripcion || text_(material),
      material: normalizeSapMaterialCode_(material) || text_(material),
      proveedor: proveedor,
      proveedorRaw: proveedorSap,
      matchMethod: resolved.method,
      destino: columns.DESTINO >= 0
        ? text_(row[columns.DESTINO])
        : '',
      camiones: null,
      ts: cantidad,
      predio: columns.PREDIO >= 0
        ? text_(row[columns.PREDIO])
        : '',
      rol: columns.ROL >= 0
        ? text_(row[columns.ROL])
        : ''
    });
  }

  return {
    rows: rows,
    proveedores: uniqueSorted_(
      rows.map(function(item) {
        return item.proveedor;
      })
    ),
    ignored: ignored,
    unificados: unificados,
    materialesSinReconocer: Object.keys(noMatch).sort(),
    missingSheet: false
  };
}

function normalizeSapMaterialCode_(value) {
  if (typeof value === 'number' && isFinite(value)) {
    return String(Math.trunc(value));
  }

  const text = String(value || '').trim();

  if (!text) {
    return '';
  }

  const match = text.match(/\b(3000039|3009002|3009003)\b/);

  if (match) {
    return match[1];
  }

  if (/^\d+(?:[.,]0+)?$/.test(text)) {
    return String(Math.trunc(Number(text.replace(',', '.'))));
  }

  return text.replace(/\s+/g, '');
}

function resolveIngresosSubproducto_(material, descripcion, textoPosicion) {
  const code = normalizeSapMaterialCode_(material);

  if (CONFIG.MATERIAL_MAP[code]) {
    return {
      subproducto: CONFIG.MATERIAL_MAP[code],
      method: 'Código material ' + code
    };
  }

  const key = normalizeKey_(
    [descripcion, textoPosicion].join(' ')
  );

  // El código es lo que manda —3000043 es el aserrín de proceso— y se
  // resolvió más arriba. Esto es la red por si SAP exporta una fila
  // con un código que todavía no está en la tabla: así fue como el
  // aserrín cruzó antes de que apareciera el suyo.
  if (key.indexOf('ASERRIN') !== -1) {
    return aserrinDeProceso_(key)
      ? {
          subproducto: 'ASERRÍN PINO VERDE',
          method: 'Descripción material'
        }
      : { subproducto: '', method: '' };
  }

  if (
    key.indexOf('OTRA ESPECIE') !== -1 ||
    key.indexOf('EUCA') !== -1 ||
    key.indexOf('EUCALYPTUS') !== -1 ||
    key.indexOf('NITENS') !== -1
  ) {
    return {
      subproducto: 'ASTILLA EUCALYPTUS NITENS',
      method: 'Descripción material'
    };
  }

  if (
    key.indexOf('ASTILLA VERDE CON CORTEZA') !== -1 ||
    (
      key.indexOf('ASTILLA VERDE') !== -1 &&
      key.indexOf('CORTEZA') !== -1
    )
  ) {
    return {
      subproducto: 'AST. PINO VERDE C/ CORTEZA',
      method: 'Descripción material'
    };
  }

  if (key.indexOf('ASTILLA VERDE') !== -1) {
    return {
      subproducto: 'ASTILLA PINO VERDE',
      method: 'Descripción material'
    };
  }

  return { subproducto: '', method: '' };
}

/**
 * Ubica las columnas de Ingresos por nombre de encabezado y, si la
 * descarga no los trae, cae a las posiciones fijas de CONFIG.
 */
/**
 * ¿Esta fila es una estimación?
 *
 * Lo real es SAP y nada más. Todo lo demás —el libro de camiones, y
 * la planilla del correo mientras quede historia suya— son camiones
 * contados y convertidos a TS con el factor del material, así que el
 * panel los pinta igual: madera, no verde.
 *
 * Va en una función y no repetido en cada sitio porque la lista de
 * fuentes creció: preguntar "¿es de la planilla?" dejaba fuera al
 * libro de camiones en cada lugar donde alguien olvidara agregarlo.
 */
function esEstimada_(row) {
  return !!row && row.source !== 'INGRESOS';
}

function resolveIngresosColumns_(headerRow) {
  const map = buildHeaderMap_(headerRow);

  function pick(names, fallback) {
    for (let index = 0; index < names.length; index++) {
      if (map[names[index]] !== undefined) {
        return map[names[index]];
      }
    }

    return fallback;
  }

  const defaults = CONFIG.INGRESOS_COLUMNS;

  return {
    // "Nº Guia" en el export de SAP. Se aceptan las formas en que
    // suele venir escrito el encabezado.
    GUIA: pick(
      [
        'nº guia', 'n guia', 'no guia', 'nro guia',
        'numero guia', 'num guia', 'guia'
      ],
      defaults.GUIA
    ),
    MATERIAL: pick(
      ['material', 'cod material', 'codigo material'],
      defaults.MATERIAL
    ),
    DESCRIPCION_MATERIAL: pick(
      [
        'descripcion material',
        'des material',
        'desc material',
        'texto breve material',
        'descripcion del material'
      ],
      defaults.DESCRIPCION_MATERIAL
    ),
    FECHA_CONTABLE: pick(
      [
        'fecha contab',
        'fecha contable',
        'fecha contabilizacion'
      ],
      defaults.FECHA_CONTABLE
    ),
    TEXTO_POSICION: pick(
      ['texto posicion', 'texto de posicion'],
      defaults.TEXTO_POSICION
    ),
    CANTIDAD: pick(
      ['cantidad', 'cantidad ts', 'ts', 'volumen'],
      defaults.CANTIDAD
    ),
    UM: pick(
      ['um', 'unidad', 'unidad medida'],
      defaults.UM
    ),
    PROVEEDOR: pick(
      ['proveedor', 'codigo proveedor'],
      defaults.PROVEEDOR
    ),
    DESCRIPCION_PROVEEDOR: pick(
      [
        'descripcion proveedor',
        'des proveedor',
        'desc proveedor',
        'nombre proveedor'
      ],
      defaults.DESCRIPCION_PROVEEDOR
    ),
    DESTINO: pick(['destino'], defaults.DESTINO),
    ROL: pick(['rol'], defaults.ROL),
    PREDIO: pick(['predio'], defaults.PREDIO)
  };
}


/* =====================================================================
 * HOMOLOGACIÓN DE PROVEEDORES
 *
 * El mismo aserradero llega escrito de tres formas distintas: en SAP
 * "LAMINADORA LOS ANGELES S.A.", en el libro de la portería
 * "Laminadora Los Angeles" y en el Plan "LLASA". Las dos primeras las
 * junta el parecido; la tercera no se parece en nada y ningún
 * algoritmo la va a adivinar.
 *
 * Para eso está la hoja Proveedores: una tabla de equivalencias escrita
 * a mano donde el nombre bueno es SIEMPRE el de SAP. Lo que se escribe
 * ahí manda sobre el parecido, sin umbrales de por medio.
 * ===================================================================== */

const PROVEEDORES_HEADERS = Object.freeze([
  'Proveedor SAP',
  'Alias',
  'Origen',
  'Notas',
  'Actualizado',
  'Actualizado por'
]);

// Etiqueta informativa: dice dónde se vio ese alias. No filtra el
// cruce a propósito. Si el alias está escrito, vale en todas partes;
// lo contrario sería un alias que "está pero no toma" y esa clase de
// silencio es justamente lo que esta hoja viene a eliminar.
const ORIGENES_ALIAS = Object.freeze([
  'Todos', 'SAP', 'Libro', 'Plan'
]);

const HOMOLOGACION_VACIA = Object.freeze({
  porAlias: {},
  canonicos: [],
  alias: 0,
  pendientes: [],
  conflictos: [],
  missingSheet: true
});

function columnasProveedores_(sheet) {
  const ancho = sheet.getLastColumn();

  const encabezados = ancho
    ? sheet.getRange(1, 1, 1, ancho).getValues()[0].map(normalizeHeader_)
    : [];

  function col(nombre, obligatoria) {
    const indice = encabezados.indexOf(normalizeHeader_(nombre));

    if (indice === -1) {
      if (obligatoria) {
        throw new Error(
          'A la hoja "' + CONFIG.SHEET_PROVEEDORES + '" le falta la ' +
          'columna "' + nombre + '". Corre "Preparar hoja de ' +
          'proveedores" para repararla.'
        );
      }
      return 0;
    }

    return indice + 1;
  }

  return {
    sap: col('Proveedor SAP', true),
    alias: col('Alias', true),
    origen: col('Origen', false),
    notas: col('Notas', false),
    actualizado: col('Actualizado', false),
    actualizadoPor: col('Actualizado por', false)
  };
}

/**
 * Lee la tabla de equivalencias y devuelve un índice alias → SAP.
 *
 * Reglas de la hoja:
 *   - "Proveedor SAP" se arrastra hacia abajo dentro del grupo, igual
 *     que "Suministro" en el Plan. Una fila totalmente en blanco corta
 *     el arrastre.
 *   - Un alias sin proveedor SAP queda "pendiente": no se cruza con
 *     nada y se informa, en vez de colgarse del grupo anterior.
 *   - Si el mismo alias apunta a dos proveedores distintos, gana el
 *     primero y el choque se informa. Dejar que gane el último sería
 *     un cambio de cifras según el orden de las filas.
 */
function leerProveedores_(spreadsheet) {
  const sheet = spreadsheet.getSheetByName(
    CONFIG.SHEET_PROVEEDORES
  );

  if (!sheet || sheet.getLastRow() < 2) {
    return {
      porAlias: {},
      canonicos: [],
      alias: 0,
      pendientes: [],
      conflictos: [],
      missingSheet: !sheet
    };
  }

  const columnas = columnasProveedores_(sheet);
  const valores = sheet.getDataRange().getValues();

  const crudo = {};
  const canonicos = {};
  const pendientes = [];
  const conflictos = [];

  let arrastre = '';

  for (let i = 1; i < valores.length; i++) {
    const fila = valores[i];

    const sapCelda = text_(fila[columnas.sap - 1]);
    const alias = text_(fila[columnas.alias - 1]);

    if (!sapCelda && !alias) {
      arrastre = '';
      continue;
    }

    if (sapCelda) {
      arrastre = sapCelda;
    }

    const canonico = sapCelda || arrastre;

    if (!canonico) {
      pendientes.push(alias);
      continue;
    }

    canonicos[canonico] = true;

    if (!alias) {
      continue;
    }

    const clave = normalizeKey_(alias);

    if (!clave) {
      continue;
    }

    if (
      crudo[clave] &&
      normalizeKey_(crudo[clave]) !== normalizeKey_(canonico)
    ) {
      conflictos.push(
        alias + ' → "' + crudo[clave] + '" y "' + canonico + '"'
      );
      continue;
    }

    crudo[clave] = canonico;
  }

  // Cada proveedor SAP es alias de sí mismo. Sin esto la hoja no
  // sirve para el precio: la fila operativa llega con el nombre de SAP
  // y, si ese nombre no está en el mapa, no hay con qué compararlo
  // contra el "LLASA" del Plan. Los alias escritos a mano mandan sobre
  // esta identidad, para que se pueda redirigir un nombre de SAP a
  // otro cuando resultan ser la misma empresa.
  const explicitos = Object.keys(crudo).length;

  Object.keys(canonicos).forEach(function(canonico) {
    const clave = normalizeKey_(canonico);

    if (clave && !crudo[clave]) {
      crudo[clave] = canonico;
    }
  });

  // Un proveedor SAP puede aparecer a su vez como alias de otro
  // (te das cuenta tarde de que dos filas eran la misma empresa).
  // Se sigue la cadena hasta el final, con tope: si alguien escribe
  // A→B y B→A el mapa se queda en el primero en vez de dar vueltas.
  const porAlias = {};

  Object.keys(crudo).forEach(function(clave) {
    let destino = crudo[clave];
    const vistos = {};
    vistos[clave] = true;

    for (let salto = 0; salto < 10; salto++) {
      const siguiente = normalizeKey_(destino);

      if (!crudo[siguiente] || vistos[siguiente]) {
        break;
      }

      vistos[siguiente] = true;
      destino = crudo[siguiente];
    }

    porAlias[clave] = destino;
  });

  return {
    porAlias: porAlias,
    canonicos: Object.keys(canonicos).sort(),
    alias: explicitos,
    pendientes: uniqueSorted_(pendientes),
    conflictos: conflictos,
    missingSheet: false
  };
}

/**
 * Propuesta de equivalencias, sacada de los nombres que hoy están en
 * el Plan, en Ingresos y en el libro de camiones.
 *
 * El canónico es el nombre del Plan cuando existe: es el que viene con
 * forma de maestro SAP ("FOR.", "INMOB", campos cortados a 30
 * caracteres). Donde el Plan no tiene al proveedor, el canónico es
 * provisional —el nombre más completo que aparece en la planilla— y
 * queda dicho en la nota.
 *
 * Esto es una propuesta, no una verdad: revísala y borra lo que no
 * corresponda.
 */
const SUGERENCIAS_PROVEEDORES = Object.freeze([
  {
    sap: 'LAMINADORA LOS ANGELES S.A.',
    alias: ['LAMINADORA LOS ANGELES', 'Llasa'],
    nota: 'El Plan la llama "Llasa" y la planilla "Laminadora Los Angeles".'
  },
  {
    sap: 'INMOB FORESTAL E INVER SAVI LT',
    alias: ['INV. SAVI LTDA.'],
    nota: ''
  },
  {
    sap: 'IND. MADERERA WOOD S.A.',
    alias: ['INDUSTRIAS MADERAS WOOD S.A.'],
    nota: ''
  },
  {
    sap: 'BIOMASAS SUR SPA',
    alias: ['BIOMASA SUR'],
    nota: 'La planilla la escribe en singular.'
  },
  {
    sap: 'FORESTAL CHIP LUMBER SPA',
    alias: ['FORESTAL CHIPLUMBER SPA'],
    nota: ''
  },
  {
    sap: 'FOR.JAVIER PEZOA GUTIERREZ E.I.R.L',
    alias: ['JAVIER PEZOA'],
    nota: ''
  },
  {
    sap: 'SOCIEDAD MADERERA ALTO LONQUEN LTDA',
    alias: ['ALTO LONQUEN', 'ALTO LONQUÉN'],
    nota: ''
  },
  {
    sap: 'ASERRADERO Y SERV SAN DIEGO SPA',
    alias: ['ASERRADEROS SAN DIEGO'],
    nota: ''
  },
  {
    sap: 'ASERRADERO LIKE WOOD',
    alias: ['ASERRADERO LIKE WOOD LTDA.'],
    nota: ''
  },
  {
    sap: 'FORESTAL TAM',
    alias: ['FORESTAL TAM SPA'],
    nota: ''
  },
  {
    sap: 'COMPAÑIA MADERERA DEL BIO BIO SPA',
    alias: ['COMPAÑÍA MADERERA DEL BIOBIO SPA'],
    nota: 'El Plan la escribe de dos formas, una por material.'
  },
  {
    sap: 'PROMASA SPA.',
    alias: ['PROMASA S.A.'],
    nota: ''
  },
  {
    sap: 'ASERRADERO LOS CASTAÑOS LTDA.',
    alias: ['ASERRADEROS LOS CASTAÑOS LTDA.'],
    nota: 'Ojo: en el Plan solo tiene precio en pino con corteza.'
  },
  {
    sap: 'INDUSTRIA MADERERA LOS CASTAÑOS SPA',
    alias: [
      'INDUSTRIA MADERERA LOS CASTAÑOS',
      'INDUSTRIA MADERAS LOS CASTAÑOS',
      'IND. MADERERA LOS CASTAÑOS'
    ],
    nota: 'Revisar: el Plan también trae "LOS CASTAÑOS" a otro precio.'
  },
  {
    sap: 'INDUSTRIAL AGRIFOR LTDA.',
    alias: ['AGRIFOR'],
    nota: 'Provisional: no está en el Plan, no tiene nombre SAP todavía.'
  },
  {
    sap: 'SOC. FORESTAL E INDUSTRIAL FATIMA LTDA.',
    alias: ['FORESTAL FATIMA', 'FORESTAL FATIMA LTDA.'],
    nota: 'Provisional: no está en el Plan, no tiene nombre SAP todavía.'
  },
  {
    sap: 'ASERMAIN SAN IGNACIO LTDA',
    alias: ['ASERMAIN SAN IGNACIO'],
    nota: 'Provisional: no está en el Plan, no tiene nombre SAP todavía.'
  },

  // Estos dos no son problema de nombre y por eso no llevan alias: el
  // nombre ya cruza solo. Van aquí para sacarlos de la lista de
  // pendientes con el motivo real escrito al lado.
  {
    sap: 'FORESTAL AITUE LTDA.',
    alias: [],
    nota: 'El nombre cruza bien. Lo que falta es la fila de nitens en el Plan.'
  },
  {
    sap: 'COMERCIAL RIO CRUCES LTDA',
    alias: [],
    nota: 'El nombre cruza bien. No está en el Plan, por eso no tiene precio.'
  }
]);

/**
 * Escribe la propuesta en la hoja Proveedores.
 *
 * No pisa nada: si un alias ya está escrito con su proveedor al lado,
 * se respeta lo que decidiste. Solo rellena los que quedaron en blanco
 * y agrega al final los que faltan.
 */
function rellenarProveedores() {
  const spreadsheet = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
  const ui = SpreadsheetApp.getUi();

  const sheet = spreadsheet.getSheetByName(CONFIG.SHEET_PROVEEDORES);

  if (!sheet) {
    ui.alert(
      'Primero corre "Preparar hoja de proveedores": todavía no ' +
      'existe la hoja "' + CONFIG.SHEET_PROVEEDORES + '".'
    );
    return;
  }

  const columnas = columnasProveedores_(sheet);
  const valores = sheet.getLastRow() > 1
    ? sheet.getDataRange().getValues()
    : [];

  // Índice del estado actual, respetando el arrastre hacia abajo para
  // saber si un alias ya tiene proveedor o está esperando uno.
  const filaDeAlias = {};
  let arrastre = '';

  for (let i = 1; i < valores.length; i++) {
    const sapCelda = text_(valores[i][columnas.sap - 1]);
    const alias = text_(valores[i][columnas.alias - 1]);

    if (!sapCelda && !alias) {
      arrastre = '';
      continue;
    }

    if (sapCelda) {
      arrastre = sapCelda;
    }

    const clave = normalizeKey_(alias);

    // Una fila sembrada por el script hereda por arrastre el proveedor
    // de la fila de arriba, que no tiene nada que ver con ella. Si eso
    // contara como "ya resuelto", la propuesta no rellenaría ninguna.
    const canonico = sapCelda ||
      (esAliasDelGrupo_(valores, i, columnas, arrastre) ? arrastre : '');

    if (clave && !filaDeAlias[clave]) {
      filaDeAlias[clave] = {
        fila: i + 1,
        canonico: canonico,
        propio: !!sapCelda
      };
    }
  }

  const rellenados = [];
  const respetados = [];
  const nuevos = [];

  SUGERENCIAS_PROVEEDORES.forEach(function(grupo) {
    const pendientes = [];

    // El sembrado a veces deja escrito el propio nombre canónico como
    // si fuera un alias huérfano. Se resuelve consigo mismo, en su
    // sitio, en vez de quedar como pendiente y repetido más abajo.
    const propio = filaDeAlias[normalizeKey_(grupo.sap)];

    if (propio && !propio.canonico) {
      sheet.getRange(propio.fila, columnas.sap).setValue(grupo.sap);

      if (columnas.notas && grupo.nota) {
        sheet.getRange(propio.fila, columnas.notas).setValue(grupo.nota);
      }

      propio.canonico = grupo.sap;
      propio.propio = true;
      rellenados.push(grupo.sap);
    }

    grupo.alias.forEach(function(alias) {
      const encontrado = filaDeAlias[normalizeKey_(alias)];

      if (!encontrado) {
        pendientes.push(alias);
        return;
      }

      if (encontrado.canonico) {
        if (
          normalizeKey_(encontrado.canonico) !== normalizeKey_(grupo.sap)
        ) {
          respetados.push(
            alias + ': ya dice "' + encontrado.canonico + '"'
          );
        }
        return;
      }

      // Fila sembrada esperando su proveedor: se rellena en su sitio.
      sheet.getRange(encontrado.fila, columnas.sap).setValue(grupo.sap);

      if (columnas.notas && grupo.nota) {
        sheet.getRange(encontrado.fila, columnas.notas).setValue(grupo.nota);
      }

      encontrado.canonico = grupo.sap;
      encontrado.propio = true;
      rellenados.push(alias);
    });

    if (pendientes.length) {
      nuevos.push({ sap: grupo.sap, alias: pendientes, nota: grupo.nota });
    }
  });

  let agregados = 0;

  nuevos.forEach(function(grupo) {
    // Fila en blanco entre grupo y grupo: es lo que corta el arrastre.
    let fila = sheet.getLastRow() + 2;

    grupo.alias.forEach(function(alias, indice) {
      const destino = fila + indice;

      if (indice === 0) {
        sheet.getRange(destino, columnas.sap).setValue(grupo.sap);

        if (columnas.notas && grupo.nota) {
          sheet.getRange(destino, columnas.notas).setValue(grupo.nota);
        }
      }

      sheet.getRange(destino, columnas.alias).setValue(alias);

      if (columnas.origen) {
        sheet.getRange(destino, columnas.origen).setValue('Todos');
      }

      agregados++;
    });
  });

  const sueltos = aislarPendientes_(sheet, columnas);

  const lineas = [
    'Propuesta aplicada sobre "' + CONFIG.SHEET_PROVEEDORES + '".',
    '',
    'Filas que estaban esperando proveedor y quedaron resueltas: ' +
      rellenados.length,
    'Alias nuevos agregados al final: ' + agregados
  ];

  if (respetados.length) {
    lineas.push('');
    lineas.push('No toqué estos, ya tenían proveedor escrito:');
    respetados.slice(0, 10).forEach(function(item) {
      lineas.push('- ' + item);
    });
  }

  if (sueltos.length) {
    lineas.push('');
    lineas.push(
      'Siguen sin proveedor SAP (no me atreví a asociarlos):'
    );
    sueltos.slice(0, 15).forEach(function(item) {
      lineas.push('- ' + item);
    });
  }

  lineas.push('');
  lineas.push(
    'Revisa la propuesta antes de darla por buena y borra lo que no ' +
    'corresponda.'
  );

  ui.alert(lineas.join('\n'));
}

/**
 * Deja cada alias sin proveedor en su propio bloque.
 *
 * Rellenar un proveedor a media lista tiene un efecto que no se ve:
 * las filas de abajo que quedaron en blanco pasan a colgarse de él por
 * el arrastre. Poniendo una fila en blanco encima de cada pendiente,
 * ese arrastre se corta y el alias queda esperando, que es lo que
 * corresponde.
 */
function aislarPendientes_(sheet, columnas) {
  const valores = sheet.getLastRow() > 1
    ? sheet.getDataRange().getValues()
    : [];

  const sueltos = [];
  const insertar = [];

  let arrastre = '';

  for (let i = 1; i < valores.length; i++) {
    const sapCelda = text_(valores[i][columnas.sap - 1]);
    const alias = text_(valores[i][columnas.alias - 1]);

    if (!sapCelda && !alias) {
      arrastre = '';
      continue;
    }

    if (sapCelda) {
      arrastre = sapCelda;
      continue;
    }

    if (!arrastre) {
      if (alias) {
        sueltos.push(alias);
      }
      continue;
    }

    // Alias en blanco colgado de un grupo anterior: se separa.
    if (alias && !esAliasDelGrupo_(valores, i, columnas, arrastre)) {
      insertar.push(i + 1);
      sueltos.push(alias);
      arrastre = '';
    }
  }

  // De abajo hacia arriba, para que insertar no corra las filas que
  // todavía faltan por revisar.
  insertar.reverse().forEach(function(fila) {
    sheet.insertRowBefore(fila);
  });

  return uniqueSorted_(sueltos);
}

/**
 * Un alias pertenece al grupo de arriba si alguien lo escribió ahí a
 * propósito. Las filas sembradas por el script llevan su motivo en
 * "Notas" y son justamente las que no hay que dar por asociadas.
 */
function esAliasDelGrupo_(valores, indice, columnas, canonico) {
  if (!columnas.notas) {
    return true;
  }

  const nota = text_(valores[indice][columnas.notas - 1]);

  return nota.indexOf('escribe a la izquierda') === -1 &&
    nota.indexOf('confirma a qué proveedor') === -1;
}

/**
 * Devuelve el proveedor SAP de un nombre, o '' si no está homologado.
 */
function homologarProveedor_(nombre, homologacion) {
  if (!homologacion || !homologacion.porAlias) {
    return '';
  }

  const clave = normalizeKey_(nombre);

  if (!clave) {
    return '';
  }

  return homologacion.porAlias[clave] || '';
}

/**
 * Crea o repara la hoja y la deja sembrada con lo que hoy no cruza:
 * los proveedores de planilla sin par en SAP y los que se quedaron sin
 * precio. Una hoja vacía obliga a adivinar qué falta homologar; esta
 * llega con la lista de pendientes escrita.
 */
function instalarProveedores() {
  const spreadsheet = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
  const ui = SpreadsheetApp.getUi();

  let sheet = spreadsheet.getSheetByName(CONFIG.SHEET_PROVEEDORES);

  if (!sheet) {
    sheet = spreadsheet.insertSheet(CONFIG.SHEET_PROVEEDORES);
  }

  sheet
    .getRange(1, 1, 1, PROVEEDORES_HEADERS.length)
    .setValues([PROVEEDORES_HEADERS])
    .setBackground('#121C17')
    .setFontColor('#B5793F')
    .setFontWeight('bold');

  sheet.setFrozenRows(1);

  [280, 280, 110, 320, 160, 200].forEach(function(ancho, indice) {
    sheet.setColumnWidth(indice + 1, ancho);
  });

  const columnas = columnasProveedores_(sheet);

  const datos = getDashboardData();

  const proveedoresSap = uniqueSorted_(
    (datos.rows || [])
      .filter(function(row) {
        return row.source === 'INGRESOS';
      })
      .map(function(row) {
        return row.proveedor;
      })
  );

  // Dropdown con los nombres reales de SAP para no escribir el
  // canónico a mano. Se permite lo de fuera: un proveedor puede estar
  // en el Plan y no haber despachado todavía.
  if (proveedoresSap.length) {
    sheet
      .getRange(2, columnas.sap, Math.max(sheet.getMaxRows() - 1, 1), 1)
      .setDataValidation(
        SpreadsheetApp.newDataValidation()
          .requireValueInList(proveedoresSap.slice(0, 500), true)
          .setAllowInvalid(true)
          .setHelpText(
            'El nombre bueno es el de SAP. Si el proveedor aún no ' +
            'despacha, escríbelo igual.'
          )
          .build()
      );
  }

  if (columnas.origen) {
    sheet
      .getRange(2, columnas.origen, Math.max(sheet.getMaxRows() - 1, 1), 1)
      .setDataValidation(
        SpreadsheetApp.newDataValidation()
          .requireValueInList(ORIGENES_ALIAS.slice(), true)
          .setAllowInvalid(true)
          .setHelpText('Solo una etiqueta: dónde viste ese alias.')
          .build()
      );
  }

  const homologacion = leerProveedores_(spreadsheet);

  const yaEstan = {};

  Object.keys(homologacion.porAlias).forEach(function(clave) {
    yaEstan[clave] = true;
  });

  homologacion.pendientes.forEach(function(alias) {
    yaEstan[normalizeKey_(alias)] = true;
  });

  const pendientes = [];

  function proponer(alias, origen, nota) {
    const clave = normalizeKey_(alias);

    if (!clave || yaEstan[clave]) {
      return;
    }

    yaEstan[clave] = true;
    pendientes.push([alias, origen, nota]);
  }

  (datos.rows || []).forEach(function(row) {
    if (
      esEstimada_(row) &&
      row.matchMethod === 'Solo en planilla'
    ) {
      proponer(
        row.proveedorRaw,
        row.source === 'CAMIONES' ? 'Libro' : 'Planilla',
        'Sin par en SAP: escribe a la izquierda el proveedor SAP.'
      );
    }
  });

  // La clave de "unmatched" viene armada como
  // "subproducto | proveedor | motivo"; el nombre está en el medio.
  ((datos.pricing && datos.pricing.unmatched) || []).forEach(function(item) {
    const partes = text_(item.key).split('|');

    if (partes.length < 2) {
      return;
    }

    const alias = text_(partes[1]);

    if (!alias || alias === 'SIN PROVEEDOR') {
      return;
    }

    proponer(
      alias,
      'Plan',
      'Se quedó sin precio: escribe a la izquierda el proveedor SAP.'
    );
  });

  (datos.planDetails || []).forEach(function(item) {
    const alias = text_(item.proveedorPlan);

    if (!alias) {
      return;
    }

    const cruza = proveedoresSap.some(function(sap) {
      return normalizeKey_(sap) === normalizeKey_(alias);
    });

    if (!cruza) {
      proponer(
        alias,
        'Plan',
        'Nombre del Plan: confirma a qué proveedor SAP corresponde.'
      );
    }
  });

  if (!pendientes.length) {
    ui.alert(
      'Hoja "' + CONFIG.SHEET_PROVEEDORES + '" lista.\n\n' +
      (homologacion.alias
        ? homologacion.alias + ' alias homologados y nada nuevo por ' +
          'agregar.'
        : 'No quedó nada pendiente por homologar.') +
      '\n\nEscribe el nombre de SAP en la primera columna y, debajo, ' +
      'cada forma en que aparece escrito. La columna "Proveedor SAP" ' +
      'se arrastra hacia abajo: basta ponerla en la primera fila del ' +
      'grupo. Una fila en blanco separa un grupo del siguiente.'
    );
    return;
  }

  // Bloque nuevo al final, precedido de una fila en blanco: esa fila
  // corta el arrastre y evita que el primer pendiente se cuelgue del
  // último grupo escrito.
  let fila = Math.max(sheet.getLastRow(), 1) + 1;

  if (sheet.getLastRow() >= 2) {
    fila++;
  }

  pendientes.forEach(function(item, indice) {
    const destino = fila + indice;

    sheet.getRange(destino, columnas.alias).setValue(item[0]);

    if (columnas.origen) {
      sheet.getRange(destino, columnas.origen).setValue(item[1]);
    }

    if (columnas.notas) {
      sheet.getRange(destino, columnas.notas).setValue(item[2]);
    }
  });

  sheet
    .getRange(fila, 1, pendientes.length, PROVEEDORES_HEADERS.length)
    .setBackground('#FAF0E1');

  ui.alert(
    'Hoja "' + CONFIG.SHEET_PROVEEDORES + '" lista.\n\n' +
    'Se agregaron ' + pendientes.length + ' nombres que hoy no cruzan, ' +
    'marcados en café al final de la hoja. Escribe a la izquierda de ' +
    'cada uno el proveedor SAP que le corresponde y borra los que no ' +
    'sean equivalencias reales.\n\n' +
    'La columna "Proveedor SAP" se arrastra hacia abajo: basta ponerla ' +
    'en la primera fila del grupo. Una fila en blanco separa un grupo ' +
    'del siguiente.'
  );
}

/* =====================================================================
 * HOMOLOGACIÓN · NOMBRES DE LA PLANILLA QUE NO SON LOS DE SAP
 *
 * SAP escribe cada proveedor de UNA sola forma. El reservador lo
 * escribe de muchas: "PROMASA S.A.", "Promasa", "PROMASA SPA".
 * Cuando uno de esos nombres no cruza, el panel no lo corrige: lo
 * deja pasar con el nombre de la planilla, y ahí aparece un proveedor
 * nuevo que en realidad ya existía. Eso es la duplicidad.
 *
 * Esto arma la lista de los que hay que revisar, con los candidatos
 * de SAP ordenados por parecido, para poder asignarlos desde el panel
 * en vez de ir a escribir la hoja a mano.
 * ===================================================================== */

/**
 * Los nombres escritos a mano que merecen una mirada, agrupados.
 *
 * Vienen de las DOS hojas que escribe la misma mano: la planilla del
 * reservador y Proyeccion. Fallan igual y se arreglan igual, así que
 * van a una sola lista: una asignación sirve para las dos. Cada grupo
 * dice de dónde sale, y lo entregado (ts, camiones) va aparte de lo
 * comprometido (tsProy, camionesProy) porque son TS de distinta
 * naturaleza.
 *
 * Dos casos, y son distintos:
 *
 *   sinPar     no cruzó con nada y entró con su propio nombre. Cada
 *              uno de estos ES un proveedor duplicado en el panel.
 *   porParecido cruzó por similitud, no porque alguien lo escribiera.
 *              Funciona, pero nadie lo confirmó: si el parecido se
 *              equivocó, el volumen se le está cargando a otro.
 *
 * Los que cruzan exacto o están homologados a mano no salen: ya están
 * resueltos y llenarían la pantalla de ruido.
 */
function buildHomologacionPendiente_(
  rows,
  proveedoresSap,
  homologacion,
  proyeccion,
  planDetails
) {
  const grupos = {};

  // Lo que mueve cada proveedor YA resuelto, cruce bien o mal. Los
  // grupos que esperan a SAP lo necesitan y no pueden sacarlo de esta
  // lista: ellos no están acá justamente porque cruzan —la hoja
  // Proveedores los resuelve—, así que saldrían en cero, como si no
  // despacharan.
  const volumen = {};

  function suma(nombre) {
    const clave = normalizeKey_(nombre);

    if (!clave) { return null; }

    if (!volumen[clave]) {
      volumen[clave] = { ts: 0, tsProy: 0, planMes: 0 };
    }

    return volumen[clave];
  }

  function grupo(crudo, metodo, resuelto) {
    const clave = normalizeKey_(crudo);

    if (!grupos[clave]) {
      grupos[clave] = {
        alias: crudo,
        metodo: metodo,
        resuelto: resuelto,
        ts: 0,
        camiones: 0,
        tsProy: 0,
        camionesProy: 0,
        planMes: 0,
        fechas: {},
        subproductos: {},
        origenes: {}
      };
    }

    return grupos[clave];
  }

  (rows || []).forEach(function(row) {
    if (!esEstimada_(row)) { return; }

    const entregado = suma(row.proveedor);

    if (entregado) { entregado.ts += Number(row.ts) || 0; }

    const crudo = text_(row.proveedorRaw);
    const metodo = row.matchMethod || '';

    if (!crudo) { return; }

    if (
      metodo !== 'Solo en planilla' &&
      metodo !== 'Coincidencia aproximada'
    ) {
      return;
    }

    const g = grupo(crudo, metodo, text_(row.proveedor));

    g.ts += Number(row.ts) || 0;
    g.camiones += Number(row.camiones) || 0;
    g.fechas[row.fecha] = true;
    g.origenes[row.source === 'CAMIONES' ? 'Libro' : 'Planilla'] = true;

    if (row.subproducto) { g.subproductos[row.subproducto] = true; }
  });

  // La hoja Proyección la escribe la misma mano que la planilla y se
  // le pasa por el mismo cruce, así que sus nombres sueltos son el
  // mismo problema: un camión comprometido que no se le puede cargar a
  // ningún proveedor no se puede comparar contra su plan. Entran a la
  // misma lista, y asignarlos una vez arregla las dos hojas.
  ((proyeccion || {}).porProveedor || []).forEach(function(item) {
    const comprometido = suma(item.proveedor);

    if (comprometido) {
      comprometido.tsProy += Number(item.ts) || 0;
    }

    const crudo = text_(item.proveedorRaw);
    const metodo = item.matchMethod || '';

    if (!crudo) { return; }

    if (
      metodo !== 'Solo en planilla' &&
      metodo !== 'Coincidencia aproximada'
    ) {
      return;
    }

    const g = grupo(crudo, metodo, text_(item.proveedor));

    g.tsProy += Number(item.ts) || 0;
    g.camionesProy += Number(item.camiones) || 0;
    g.origenes['Proyección'] = true;

    if (item.subproducto) { g.subproductos[item.subproducto] = true; }
  });

  // Y el Plan, que es la tercera mano que escribe estos nombres. Un
  // proveedor del Plan que no llega a SAP no se valoriza: su volumen
  // queda sin precio y su brecha no se puede comparar con nada.
  (planDetails || []).forEach(function(item) {
    const crudo = text_(item.proveedorPlan);

    if (!crudo) { return; }

    const cruce = resolveProveedor_(crudo, proveedoresSap, homologacion);
    const delPlan = suma(cruce.proveedor);

    if (delPlan) { delPlan.planMes += Number(item.plan) || 0; }

    if (
      cruce.method !== 'Solo en planilla' &&
      cruce.method !== 'Coincidencia aproximada'
    ) {
      return;
    }

    const g = grupo(crudo, cruce.method, text_(cruce.proveedor));

    g.planMes += Number(item.plan) || 0;
    g.origenes.Plan = true;

    if (item.subproducto) { g.subproductos[item.subproducto] = true; }
  });

  const lista = Object.keys(grupos).map(function(clave) {
    const g = grupos[clave];
    const fechas = Object.keys(g.fechas).sort();

    return {
      alias: g.alias,
      metodo: g.metodo,
      sinPar: g.metodo === 'Solo en planilla',
      // Con qué se está cruzando hoy. En los sin par es su propio
      // nombre, que es justamente el problema.
      resuelto: g.resuelto,
      ts: round_(g.ts, 2),
      camiones: g.camiones,
      // Lo comprometido en la hoja Proyección con ese mismo nombre.
      // Va aparte de lo entregado: son TS de distinta naturaleza y
      // sumarlas en una sola cifra diría algo que no es.
      tsProy: round_(g.tsProy, 2),
      camionesProy: g.camionesProy,
      // Lo que el Plan le tiene comprometido al mes con ese nombre.
      planMes: round_(g.planMes, 2),
      origen: Object.keys(g.origenes).sort().join(' y ') || 'Planilla',
      dias: fechas.length,
      primera: fechas[0] || '',
      ultima: fechas[fechas.length - 1] || '',
      subproductos: Object.keys(g.subproductos).sort(),
      candidatos: candidatosSap_(g.alias, proveedoresSap)
    };
  });

  // Primero los que no cruzan, y dentro de cada grupo el que más
  // volumen mueve —entregado o comprometido—: ese es el que más
  // distorsiona el panel.
  lista.sort(function(a, b) {
    if (a.sinPar !== b.sinPar) { return a.sinPar ? -1 : 1; }

    return (b.ts + b.tsProy + b.planMes) -
      (a.ts + a.tsProy + a.planMes);
  });

  return {
    lista: lista,
    sinPar: lista.filter(function(x) { return x.sinPar; }).length,
    porParecido: lista.filter(function(x) { return !x.sinPar; }).length,
    tsSinPar: round_(lista.reduce(function(t, x) {
      return t + (x.sinPar ? x.ts : 0);
    }, 0), 2),
    // Camiones comprometidos en Proyección que hoy no caen sobre
    // ningún proveedor de SAP.
    camionesSinParProy: lista.reduce(function(t, x) {
      return t + (x.sinPar ? x.camionesProy : 0);
    }, 0),
    enProyeccion: lista.filter(function(x) {
      return x.origen.indexOf('Proyección') !== -1;
    }).length,
    proveedoresSap: (proveedoresSap || []).slice().sort(),
    // Los grupos que todavía no tienen proveedor de SAP: la cabeza es
    // un nombre de la planilla y de ella cuelgan sus variantes. El día
    // que SAP cree el proveedor, se reapunta la cabeza y el grupo se va
    // con ella.
    // Los mismos nombres, pero juntos por el proveedor al que
    // apuntan: una sola decisión para las tres hojas.
    grupos: agruparPendientes_(lista, proveedoresSap),
    provisorios: gruposProvisorios_(
      proveedoresSap,
      homologacion,
      volumen
    ),
    conflictos: homologacion.conflictos || [],
    huerfanos: homologacion.pendientes || []
  };
}


/**
 * Los nombres sueltos, juntos por el proveedor al que apuntan.
 *
 * Acá está la parte difícil de la homologación, y no es el cruce: es
 * que el mismo proveedor llega escrito por TRES manos distintas —la
 * planilla del reservador, Proyeccion y el Plan— y la lista de
 * pendientes los muestra como tres problemas separados. Resolver uno
 * no resuelve los otros dos, así que hay que buscar el mismo
 * proveedor tres veces y acertarle tres veces al mismo nombre de SAP.
 *
 * Esto da vuelta la lista: una fila por PROVEEDOR, con todos sus
 * nombres colgando y una sola decisión para los tres.
 *
 * El ancla es SAP siempre que se pueda:
 *
 *   1. Si el nombre ya cruza por parecido, el grupo es ese proveedor
 *      de SAP. Confirmarlo lo deja fijo.
 *   2. Si no cruza, pero se parece a alguno de SAP lo bastante como
 *      para proponerlo —0,5, bajo el umbral que basta para cruzar
 *      solo—, el grupo es ese proveedor y el panel muestra cuánto se
 *      parece. La decisión sigue siendo de quien mira.
 *   3. Y si no hay ningún SAP al que parecerse, los nombres se juntan
 *      entre ellos por cómo se escriben. Ese grupo no tiene a quién
 *      asignarse todavía: es el que necesita la otra opción, la de
 *      agregarlo con su propio nombre hasta que SAP lo cree.
 */
function agruparPendientes_(lista, proveedoresSap) {
  // Para PROPONER un ancla basta un parecido mediano. Para cruzar
  // solo, en cambio, hace falta CONFIG.FUZZY_THRESHOLD: una cosa es
  // sugerirle algo a quien mira y otra decidirlo sin preguntar.
  const PROPONER = 0.5;

  const grupos = {};

  function grupo(clave, destino, enSap, score) {
    if (!grupos[clave]) {
      grupos[clave] = {
        clave: clave,
        destino: destino,
        enSap: enSap,
        score: score || 0,
        nombres: [],
        origenes: {},
        candidatos: [],
        ts: 0,
        tsProy: 0,
        planMes: 0,
        camiones: 0,
        camionesProy: 0
      };
    }

    const g = grupos[clave];

    // Gana el mejor parecido del grupo: si uno de los nombres cruza
    // exacto, es ese el que manda sobre la propuesta de otro.
    if ((score || 0) > g.score) { g.score = score || 0; }

    return g;
  }

  (lista || []).forEach(function(item) {
    const candidatos = item.candidatos || [];
    const mejor = candidatos.length ? candidatos[0] : null;

    let destino = '';
    let enSap = false;
    let score = 0;

    if (!item.sinPar) {
      // Ya cruza por parecido: su destino está decidido.
      destino = item.resuelto;
      enSap = true;
      score = mejor && normalizeKey_(mejor.proveedor) ===
        normalizeKey_(item.resuelto) ? mejor.score : 1;
    } else if (mejor && mejor.score >= PROPONER) {
      destino = mejor.proveedor;
      enSap = true;
      score = mejor.score;
    }

    // Sin ancla en SAP, se juntan entre ellos por cómo se escriben.
    const clave = enSap
      ? 'SAP||' + normalizeKey_(destino)
      : 'SUELTO||' + (proveedorComparable_(item.alias) ||
          normalizeKey_(item.alias));

    const g = grupo(clave, destino, enSap, score);

    g.nombres.push({
      alias: item.alias,
      origen: item.origen,
      metodo: item.metodo,
      sinPar: item.sinPar,
      resuelto: item.resuelto,
      ts: item.ts,
      tsProy: item.tsProy,
      planMes: item.planMes,
      camiones: item.camiones,
      camionesProy: item.camionesProy,
      dias: item.dias,
      ultima: item.ultima,
      score: candidatos.length ? candidatos[0].score : 0
    });

    String(item.origen || '').split(' y ').forEach(function(hoja) {
      if (hoja) { g.origenes[hoja] = true; }
    });

    g.ts += item.ts || 0;
    g.tsProy += item.tsProy || 0;
    g.planMes += item.planMes || 0;
    g.camiones += item.camiones || 0;
    g.camionesProy += item.camionesProy || 0;

    // Los candidatos del grupo son los de todos sus nombres, con el
    // mejor parecido de cada uno: el nombre más completo suele
    // encontrar al proveedor que el corto no encuentra.
    candidatos.forEach(function(c) {
      const ya = g.candidatos.filter(function(x) {
        return normalizeKey_(x.proveedor) === normalizeKey_(c.proveedor);
      })[0];

      if (!ya) {
        g.candidatos.push({ proveedor: c.proveedor, score: c.score });
      } else if (c.score > ya.score) {
        ya.score = c.score;
      }
    });
  });

  return Object.keys(grupos).map(function(clave) {
    const g = grupos[clave];

    g.candidatos.sort(function(a, b) { return b.score - a.score; });
    g.candidatos = g.candidatos.slice(0, 5);
    g.hojas = Object.keys(g.origenes).sort();
    g.cuantos = g.nombres.length;

    // Lo que hay que escribir si se acepta la propuesta: los nombres
    // que todavía no apuntan ahí. Un grupo donde todos ya cruzan es
    // una confirmación, no una corrección, y conviene decirlo.
    g.porEscribir = g.nombres.filter(function(n) {
      return n.sinPar ||
        normalizeKey_(n.resuelto) !== normalizeKey_(g.destino);
    }).length;

    g.ts = round_(g.ts, 2);
    g.tsProy = round_(g.tsProy, 2);
    g.planMes = round_(g.planMes, 2);
    g.score = round_(g.score, 3);

    delete g.origenes;

    return g;
  }).sort(function(a, b) {
    // Primero los que mueven más, y entre iguales los que juntan más
    // nombres: ahí una sola decisión arregla más cosas.
    return (b.ts + b.tsProy + b.planMes) -
      (a.ts + a.tsProy + a.planMes) ||
      b.cuantos - a.cuantos;
  });
}

/**
 * Asigna de una vez todos los nombres de un grupo.
 *
 * Es la operación que faltaba. Hasta ahora había que asignar nombre
 * por nombre, y como el mismo proveedor llega escrito distinto en la
 * planilla, en Proyeccion y en el Plan, resolver un proveedor eran
 * tres búsquedas y tres aciertos al mismo nombre de SAP.
 *
 * Con `sinSap` el destino no es un proveedor de SAP sino uno de los
 * propios nombres del grupo: se agrega primero como proveedor —ese es
 * el caso de "todavía no lo crean en SAP"— y los demás se le cuelgan.
 *
 * No se cae por uno: el que ya apunta a otro proveedor se informa y
 * se sigue con el resto. Abortar todo por un nombre dejaría el grupo
 * a medio escribir y sin decir cuál fue.
 */
function resolverGrupo(nombres, destino, sinSap) {
  exigirEdicion_('Asignar un grupo de nombres');

  const lista = (nombres || []).map(text_).filter(function(x) { return x; });
  const cabeza = text_(destino);

  if (!cabeza) {
    throw new Error('Falta el proveedor al que asignar el grupo.');
  }

  if (!lista.length) {
    throw new Error('No hay nombres que asignar.');
  }

  const resultado = {
    destino: cabeza,
    sinSap: !!sinSap,
    escritos: 0,
    yaEstaban: 0,
    conflictos: []
  };

  if (sinSap) {
    const puesto = declararProveedor(cabeza);

    if (puesto.escrito) { resultado.escritos++; }
  }

  lista.forEach(function(alias) {
    if (normalizeKey_(alias) === normalizeKey_(cabeza)) { return; }

    try {
      const r = asignarProveedor(alias, cabeza);

      if (r.escrito) { resultado.escritos++; } else { resultado.yaEstaban++; }
    } catch (error) {
      resultado.conflictos.push({
        alias: alias,
        motivo: String(error && error.message ? error.message : error)
      });
    }
  });

  return resultado;
}

/**
 * Proveedores escritos en la hoja que SAP todavía no tiene.
 *
 * No son un error: son el primer tiempo de la homologación. Un
 * proveedor empieza despachando y alguien lo agrega acá para que sus
 * camiones caigan sobre un proveedor en vez de quedar sueltos; el
 * nombre de SAP llega después, cuando lo creen.
 *
 * Cuentan los dos casos: la cabeza que junta varias formas de escribir
 * el mismo nombre y la que está sola. El volumen no sale de la lista de
 * pendientes —estos ya cruzan, por eso no están ahí— sino de lo que
 * movió el proveedor resuelto.
 */
function gruposProvisorios_(proveedoresSap, homologacion, volumen) {
  const enSap = {};

  (proveedoresSap || []).forEach(function(sap) {
    enSap[normalizeKey_(sap)] = true;
  });

  const porCabeza = {};

  function cabeza(nombre) {
    const clave = normalizeKey_(nombre);

    if (!clave || enSap[clave]) { return null; }

    if (!porCabeza[clave]) {
      porCabeza[clave] = { cabeza: nombre, alias: {} };
    }

    return porCabeza[clave];
  }

  // Toda cabeza escrita en la hoja que SAP todavía no tiene es un
  // grupo, aunque de ella no cuelgue ningún otro nombre.
  //
  // Eso último es el caso que faltaba, y es el más común: el proveedor
  // despacha, la planilla lo escribe de una sola forma y SAP no lo
  // tiene creado. Antes un grupo existía solo si tenía dos nombres, así
  // que el proveedor agregado a mano no salía en ninguna parte: cruzaba
  // bien —por eso desaparecía de la lista de pendientes— pero nadie
  // volvía a acordarse de apuntarlo a SAP el día que lo crearan.
  (homologacion.canonicos || []).forEach(cabeza);

  Object.keys(homologacion.porAlias || {}).forEach(function(claveAlias) {
    const g = cabeza(homologacion.porAlias[claveAlias]);

    // La identidad —cada nombre es alias de sí mismo— no cuenta como
    // nombre colgado: el grupo existe por su cabeza, no por ella.
    if (!g || normalizeKey_(g.cabeza) === claveAlias) { return; }

    g.alias[claveAlias] = true;
  });

  return Object.keys(porCabeza).map(function(clave) {
    const g = porCabeza[clave];
    const v = (volumen || {})[clave] || { ts: 0, tsProy: 0, planMes: 0 };

    return {
      cabeza: g.cabeza,
      alias: Object.keys(g.alias).sort(),
      cuantos: Object.keys(g.alias).length,
      ts: round_(v.ts, 2),
      tsProy: round_(v.tsProy, 2),
      planMes: round_(v.planMes, 2),
      candidatos: candidatosSap_(g.cabeza, proveedoresSap)
    };
  }).sort(function(a, b) {
    return (b.ts + b.tsProy + b.planMes) -
      (a.ts + a.tsProy + a.planMes) ||
      b.cuantos - a.cuantos;
  });
}

/**
 * Un proveedor de SAP y sus tres nombres.
 *
 * El panel cruza tres hojas escritas por manos distintas —la planilla
 * del reservador, Proyeccion y Plan— contra una sola lista: la de SAP.
 * Cada hoja escribe el mismo proveedor a su manera, y hasta ahora eso
 * solo se veía cuando FALLABA: la pestaña mostraba los nombres sueltos
 * y nada más.
 *
 * Esto da la vuelta la pregunta. En vez de «qué nombres no cruzan»,
 * arma «cada proveedor de SAP, y cómo lo escribe cada hoja». Los que
 * están bien también salen: para saber que un proveedor está completo
 * hay que poder verlo completo, con sus tres casillas llenas.
 *
 * El ancla es el nombre de SAP, y además el de los proveedores que
 * alguien escribió en la hoja Proveedores porque SAP todavía no los
 * tiene creados: esos llevan su fila igual, marcada «todavía sin SAP».
 * Un proveedor que despacha hoy y que SAP cargará la semana que viene
 * no puede ser una fila vacía en la tabla donde se mira si un proveedor
 * está completo.
 *
 * Los nombres que no cruzan con nada siguen yendo a la lista de sin
 * par, que es donde se asignan o se agregan.
 */
function buildHomologacionMapa_(
  proveedoresSap,
  rows,
  proyeccion,
  planDetails,
  homologacion
) {
  const porSap = {};

  function fila(sap) {
    const clave = normalizeKey_(sap);

    if (!porSap[clave]) {
      porSap[clave] = {
        sap: sap,
        planilla: {},
        proyeccion: {},
        plan: {},
        ingresos: false,
        sinSap: false,
        ts: 0,
        tsProy: 0,
        planMes: 0
      };
    }

    return porSap[clave];
  }

  // La lista de SAP manda: todas sus filas existen aunque ninguna hoja
  // las nombre. Un proveedor de SAP sin nada escrito en ninguna parte
  // también es una respuesta.
  const conocidos = {};

  (proveedoresSap || []).forEach(function(sap) {
    fila(sap);
    conocidos[normalizeKey_(sap)] = true;
  });

  // Y los que están escritos en la hoja esperando que SAP los cree.
  // Cuelgan de su propio nombre, así que ese nombre es el ancla
  // mientras no haya otro.
  (homologacion.canonicos || []).forEach(function(nombre) {
    const clave = normalizeKey_(nombre);

    if (!clave || conocidos[clave]) { return; }

    fila(nombre).sinSap = true;
    conocidos[clave] = true;
  });

  // 1) Lo que entró, por las dos fuentes.
  (rows || []).forEach(function(row) {
    const clave = normalizeKey_(row.proveedor);

    if (!clave || !conocidos[clave]) { return; }

    const f = fila(row.proveedor);

    f.ts += Number(row.ts) || 0;

    if (esEstimada_(row)) {
      const crudo = text_(row.proveedorRaw);

      if (crudo) { f.planilla[crudo] = true; }
    } else {
      f.ingresos = true;
    }
  });

  // 2) Lo comprometido.
  ((proyeccion || {}).porProveedor || []).forEach(function(item) {
    const clave = normalizeKey_(item.proveedor);

    if (!clave || !conocidos[clave]) { return; }

    const f = fila(item.proveedor);
    const crudo = text_(item.proveedorRaw);

    if (crudo) { f.proyeccion[crudo] = true; }

    f.tsProy += Number(item.ts) || 0;
  });

  // 3) El Plan. Su nombre cruza por la hoja Proveedores igual que los
  // otros dos; si no está escrito ahí, se prueba el parecido, que es
  // lo mismo que hace el cruce de precio.
  (planDetails || []).forEach(function(item) {
    const crudo = text_(item.proveedorPlan);

    if (!crudo) { return; }

    const cruce = resolveProveedor_(crudo, proveedoresSap, homologacion);
    const clave = normalizeKey_(cruce.proveedor);

    if (!clave || !conocidos[clave]) { return; }

    const f = fila(cruce.proveedor);

    f.plan[crudo] = true;
    f.planMes += Number(item.plan) || 0;
  });

  const lista = Object.keys(porSap).map(function(clave) {
    const f = porSap[clave];
    const planilla = Object.keys(f.planilla).sort();
    const proy = Object.keys(f.proyeccion).sort();
    const plan = Object.keys(f.plan).sort();

    // Cuántas de las tres hojas lo nombran. Es la cifra que dice de un
    // vistazo si el proveedor está completo.
    const hojas =
      (planilla.length ? 1 : 0) +
      (proy.length ? 1 : 0) +
      (plan.length ? 1 : 0);

    // Un nombre distinto del de SAP escrito en una hoja es una
    // equivalencia que alguien tuvo que resolver. Saber cuántas hay
    // dice qué tan lejos está esa hoja de escribir como SAP.
    const distintos = planilla.concat(proy).concat(plan)
      .filter(function(nombre) {
        return normalizeKey_(nombre) !== clave;
      });

    return {
      sap: f.sap,
      planilla: planilla,
      proyeccion: proy,
      plan: plan,
      ingresos: f.ingresos,
      // Escrito en la hoja, pero SAP todavía no lo tiene. Su fila vale
      // igual; lo que le falta es el nombre de SAP, no los datos.
      sinSap: f.sinSap,
      hojas: hojas,
      alias: distintos.filter(function(n, i, l) {
        return l.indexOf(n) === i;
      }),
      ts: round_(f.ts, 2),
      tsProy: round_(f.tsProy, 2),
      planMes: round_(f.planMes, 2),
      // Falta en estas hojas. Vacío quiere decir que está en las tres.
      faltaEn: [
        planilla.length ? '' : 'Libro',
        proy.length ? '' : 'Proyección',
        plan.length ? '' : 'Plan'
      ].filter(function(x) { return x; })
    };
  });

  // Primero el que mueve más —entre entregado, comprometido y plan—:
  // un proveedor sin plan que despacha 3.000 TS importa más que uno
  // que no aparece en ninguna parte.
  lista.sort(function(a, b) {
    return (b.ts + b.tsProy + b.planMes) - (a.ts + a.tsProy + a.planMes);
  });

  return {
    lista: lista,
    completos: lista.filter(function(x) { return x.hojas === 3; }).length,
    // Los que ninguna hoja nombra: están en SAP y nadie los escribe.
    // Un proveedor que todavía no está en SAP no cuenta acá: él no
    // sobra, le falta.
    huerfanos: lista.filter(function(x) {
      return x.hojas === 0 && !x.sinSap;
    }).length,
    // Los que esperan nombre de SAP.
    sinSap: lista.filter(function(x) { return x.sinSap; }).length
  };
}

/** Los mejores candidatos de SAP para un nombre, con su parecido. */
function candidatosSap_(nombre, proveedoresSap) {
  const limpio = proveedorComparable_(nombre);

  if (!limpio) { return []; }

  return (proveedoresSap || []).map(function(sap) {
    return {
      proveedor: sap,
      score: round_(
        proveedorSimilitud_(limpio, proveedorComparable_(sap)),
        3
      )
    };
  }).filter(function(x) {
    // Bajo 0,3 no es un candidato, es ruido: con veinte proveedores
    // en SAP siempre hay alguno que comparte una letra.
    return x.score >= 0.3;
  }).sort(function(a, b) {
    return b.score - a.score;
  }).slice(0, 5);
}

/**
 * Escribe una equivalencia en la hoja Proveedores.
 *
 * Se escriben las DOS celdas en la misma fila —SAP y alias— en vez de
 * apoyarse en el arrastre hacia abajo: una fila que depende de la de
 * arriba se rompe sola cuando alguien ordena o inserta.
 *
 * Devuelve la homologación recalculada para que el panel se refresque
 * sin volver a leer toda la planilla.
 */
function asignarProveedor(alias, proveedorSap) {
  exigirEdicion_('Escribir una equivalencia de proveedor');

  const nombreAlias = text_(alias);
  const nombreSap = text_(proveedorSap);

  if (!nombreAlias || !nombreSap) {
    throw new Error('Hacen falta el nombre de la planilla y el de SAP.');
  }

  const spreadsheet = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
  const sheet = spreadsheet.getSheetByName(CONFIG.SHEET_PROVEEDORES);

  if (!sheet) {
    throw new Error(
      'No existe la hoja "' + CONFIG.SHEET_PROVEEDORES +
      '". Corre "Preparar hoja de proveedores".'
    );
  }

  const columnas = columnasProveedores_(sheet);
  const previo = leerProveedores_(spreadsheet);
  const claveAlias = normalizeKey_(nombreAlias);
  const yaApunta = previo.porAlias[claveAlias];

  if (
    yaApunta &&
    normalizeKey_(yaApunta) !== normalizeKey_(nombreSap)
  ) {
    throw new Error(
      '"' + nombreAlias + '" ya está escrito apuntando a "' + yaApunta +
      '". Corrígelo en la hoja ' + CONFIG.SHEET_PROVEEDORES +
      ' antes de reasignarlo.'
    );
  }

  if (yaApunta) {
    return {
      escrito: false,
      motivo: 'Ya estaba escrito así.',
      alias: nombreAlias,
      sap: nombreSap
    };
  }

  const fila = escribirFilaProveedor_(
    sheet,
    columnas,
    nombreSap,
    nombreAlias,
    ''
  );

  return {
    escrito: true,
    alias: nombreAlias,
    sap: nombreSap,
    fila: fila
  };
}

/**
 * Escribe una fila en la hoja Proveedores.
 *
 * Las DOS celdas —SAP y alias— en la misma fila, nunca apoyándose en
 * el arrastre hacia abajo: una fila que depende de la de arriba se
 * rompe sola cuando alguien ordena o inserta.
 */
function escribirFilaProveedor_(sheet, columnas, sap, alias, nota) {
  const fila = sheet.getLastRow() + 1;

  sheet.getRange(fila, columnas.sap).setValue(sap);
  sheet.getRange(fila, columnas.alias).setValue(alias);

  if (columnas.origen) {
    sheet.getRange(fila, columnas.origen).setValue('Panel');
  }

  if (nota && columnas.notas) {
    sheet.getRange(fila, columnas.notas).setValue(nota);
  }

  if (columnas.actualizado) {
    sheet.getRange(fila, columnas.actualizado).setValue(new Date());
  }

  if (columnas.actualizadoPor) {
    sheet.getRange(fila, columnas.actualizadoPor).setValue(autorActual_());
  }

  return fila;
}

/**
 * Lo que se escribe en Notas al agregar un proveedor sin SAP.
 *
 * El prefijo va aparte porque hay que poder reconocer la nota después,
 * cuando el proveedor sí entre a SAP y la nota deje de ser verdad.
 */
const SIN_SAP_PREFIJO = 'Todavía no está en SAP';
const NOTA_SIN_SAP =
  SIN_SAP_PREFIJO + '. Se agregó desde el panel para que sus camiones ' +
  'no quedaran sueltos; cuando SAP lo cree, reapúntalo desde ' +
  '"Agrupados, esperando a SAP".';

/**
 * Agrega el proveedor de la planilla aunque SAP todavía no lo tenga.
 *
 * Es el agujero que quedaba. El selector solo ofrece proveedores de
 * SAP, y SAP no carga a un proveedor nuevo el mismo día que empieza a
 * despachar: hay días —a veces semanas— en que la planilla ya lo
 * nombra y en SAP no existe todavía. Mientras tanto no había nada que
 * elegir: el nombre se quedaba "solo en planilla", en el panel contaba
 * como un proveedor inventado más y su plan no tenía contra qué
 * compararse. La casilla quedaba vacía.
 *
 * Esto lo escribe como proveedor con su propio nombre, cabeza de su
 * grupo. Desde ahí cruza —la hoja Proveedores va antes que el
 * parecido—, sus camiones caen todos sobre un mismo proveedor y sus
 * otras formas de escribirse se le pueden colgar.
 *
 * No es una homologación a medias: es la primera mitad, y queda
 * anotada como tal. El proveedor aparece en "Agrupados, esperando a
 * SAP" con lo que mueve, y el día que SAP lo cree se reapunta ahí de
 * una vez, con grupo y todo.
 */
function declararProveedor(nombre) {
  exigirEdicion_('Agregar un proveedor');

  const limpio = text_(nombre);

  if (!limpio) {
    throw new Error('Hace falta el nombre del proveedor.');
  }

  const clave = normalizeKey_(limpio);

  if (isTotalText_(limpio) || clave === 'SIN PROVEEDOR') {
    throw new Error(
      '"' + limpio + '" no es un proveedor.'
    );
  }

  const spreadsheet = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
  const sheet = spreadsheet.getSheetByName(CONFIG.SHEET_PROVEEDORES);

  if (!sheet) {
    throw new Error(
      'No existe la hoja "' + CONFIG.SHEET_PROVEEDORES +
      '". Corre "Preparar hoja de proveedores".'
    );
  }

  const columnas = columnasProveedores_(sheet);
  const previo = leerProveedores_(spreadsheet);
  const yaApunta = previo.porAlias[clave];

  // Ya está escrito, pero colgado de otro proveedor. Agregarlo aparte
  // partiría en dos lo que alguien juntó a propósito, así que se dice
  // dónde está en vez de escribir una contradicción en la hoja.
  if (yaApunta && normalizeKey_(yaApunta) !== clave) {
    throw new Error(
      '"' + limpio + '" ya está escrito como forma de "' + yaApunta +
      '". Si no son el mismo proveedor, corrígelo en la hoja ' +
      CONFIG.SHEET_PROVEEDORES + ' antes de agregarlo aparte.'
    );
  }

  if (yaApunta) {
    return {
      escrito: false,
      motivo: 'Ya estaba agregado.',
      nombre: limpio
    };
  }

  const fila = escribirFilaProveedor_(
    sheet,
    columnas,
    limpio,
    limpio,
    NOTA_SIN_SAP
  );

  return {
    escrito: true,
    nombre: limpio,
    fila: fila
  };
}

/**
 * Pasa un grupo provisorio a su proveedor de SAP.
 *
 * La homologación tiene dos tiempos, porque el mundo los tiene. Un
 * proveedor empieza despachando y la planilla lo escribe de tres formas
 * antes de que alguien lo cree en SAP. Hasta ahora esas tres formas no
 * se podían juntar: el selector solo ofrecía proveedores de SAP, y ese
 * proveedor todavía no existía ahí. Quedaban tres filas sueltas y tres
 * proveedores inventados en el panel.
 *
 * El primer tiempo es agrupar: se elige uno de los nombres de la
 * planilla como cabeza y los demás cuelgan de él. Eso ya deja UN
 * proveedor en el panel en vez de tres, aunque SAP no sepa de él.
 *
 * El segundo tiempo es esto: el día que SAP lo crea, se reapunta la
 * cabeza al nombre de SAP y todo el grupo se va con ella. No hay que
 * volver a asignar alias por alias.
 *
 * Se escribe además una fila que manda la cabeza vieja al nombre de
 * SAP: las filas que traigan escrito ESE nombre también tienen que
 * llegar, y son justamente las que motivaron el grupo.
 */
function reasignarProveedor(actual, nuevo) {
  exigirEdicion_('Pasar un grupo a SAP');

  const cabeza = text_(actual);
  const destino = text_(nuevo);

  if (!cabeza || !destino) {
    throw new Error('Hacen falta el grupo y el proveedor de SAP.');
  }

  if (normalizeKey_(cabeza) === normalizeKey_(destino)) {
    throw new Error('El grupo ya se llama así.');
  }

  const spreadsheet = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
  const sheet = spreadsheet.getSheetByName(CONFIG.SHEET_PROVEEDORES);

  if (!sheet) {
    throw new Error(
      'No existe la hoja "' + CONFIG.SHEET_PROVEEDORES +
      '". Corre "Preparar hoja de proveedores".'
    );
  }

  const columnas = columnasProveedores_(sheet);
  const valores = sheet.getDataRange().getValues();
  const clave = normalizeKey_(cabeza);

  // Solo las celdas donde la cabeza está ESCRITA. Las de abajo la
  // heredan por arrastre y se van solas con ella.
  const filas = [];

  for (let i = 1; i < valores.length; i++) {
    if (normalizeKey_(text_(valores[i][columnas.sap - 1])) === clave) {
      filas.push(i + 1);
    }
  }

  if (!filas.length) {
    throw new Error(
      'En la hoja ' + CONFIG.SHEET_PROVEEDORES + ' no hay ninguna fila ' +
      'encabezada por "' + cabeza + '".'
    );
  }

  filas.forEach(function(fila) {
    sheet.getRange(fila, columnas.sap).setValue(destino);

    // La nota de "todavía no está en SAP" deja de ser verdad en este
    // mismo momento. Una nota vieja que dice lo contrario de la fila
    // confunde más que no tener nota.
    if (
      columnas.notas &&
      text_(valores[fila - 1][columnas.notas - 1])
        .indexOf(SIN_SAP_PREFIJO) === 0
    ) {
      sheet.getRange(fila, columnas.notas).setValue('');
    }

    if (columnas.actualizado) {
      sheet.getRange(fila, columnas.actualizado).setValue(new Date());
    }

    if (columnas.actualizadoPor) {
      sheet.getRange(fila, columnas.actualizadoPor).setValue(autorActual_());
    }
  });

  // Y la cabeza vieja, ahora como alias del nombre de SAP.
  const yaEstaba = valores.some(function(fila, i) {
    return i > 0 &&
      normalizeKey_(text_(fila[columnas.alias - 1])) === clave;
  });

  if (!yaEstaba) {
    escribirFilaProveedor_(sheet, columnas, destino, cabeza, '');
  }

  return {
    escrito: true,
    grupo: cabeza,
    sap: destino,
    filas: filas.length + (yaEstaba ? 0 : 1)
  };
}

function resolveProveedor_(rawName, candidates, homologacion) {
  const cleaned = proveedorComparable_(rawName);

  if (!cleaned) {
    return {
      proveedor: 'SIN PROVEEDOR',
      method: 'Sin nombre',
      score: 0
    };
  }

  // La hoja Proveedores va primero y sin umbral. "LLASA" no se parece
  // a "LAMINADORA LOS ANGELES" por ninguna medida, así que si el
  // parecido decidiera aquí, escribir la equivalencia no serviría de
  // nada.
  const aMano = homologarProveedor_(rawName, homologacion);

  if (aMano) {
    return {
      proveedor: aMano,
      method: 'Homologado a mano',
      score: 1
    };
  }

  let best = null;

  candidatosDelCruce_(candidates, homologacion).forEach(function(candidate) {
    const score = proveedorSimilitud_(
      cleaned,
      proveedorComparable_(candidate)
    );

    if (!best || score > best.score) {
      best = { proveedor: candidate, score: score };
    }
  });

  if (best && best.score >= CONFIG.FUZZY_THRESHOLD) {
    return {
      proveedor: best.proveedor,
      method: best.score === 1
        ? 'Coincidencia exacta'
        : 'Coincidencia aproximada',
      score: round_(best.score, 3)
    };
  }

  return {
    proveedor: text_(rawName),
    method: 'Solo en planilla',
    score: 0
  };
}

/**
 * Contra qué se compara un nombre: SAP, y lo agregado a mano.
 *
 * Esto era el agujero de abajo del agujero. Se podía agregar un
 * proveedor que SAP no tiene, pero el parecido seguía buscando SOLO en
 * SAP, así que las otras formas de escribir ese mismo nombre no
 * llegaban a él: "AITUE NITENS" en el Plan y "Aitue nitens" en la
 * planilla quedaban sueltos aunque "AITUE NITENS SPA" ya estuviera
 * agregado. Había que homologar a mano cada forma, una por una, para un
 * proveedor que ya estaba resuelto.
 *
 * Con sus nombres en la lista, agregar el proveedor UNA vez junta
 * también sus variantes, igual que pasa con los de SAP.
 *
 * Los de SAP van primero a propósito: cuando dos candidatos empatan
 * —"MADEEX" escrito en la hoja y "MADEEX S.A." en SAP son el mismo
 * nombre comparable— gana el de SAP, que es el ancla de verdad.
 */
function candidatosDelCruce_(candidates, homologacion) {
  const lista = candidates || [];

  if (!homologacion || !(homologacion.canonicos || []).length) {
    return lista;
  }

  // Memo por identidad de la lista: resolveProveedor_ se llama una vez
  // por fila y rehacer esto en cada una es pagar dos veces lo mismo.
  // Si alguien llama con otra lista, se rehace.
  if (homologacion.cruceDe !== lista) {
    const vistos = {};

    lista.forEach(function(nombre) {
      vistos[normalizeKey_(nombre)] = true;
    });

    homologacion.cruceDe = lista;
    homologacion.cruce = lista.concat(
      homologacion.canonicos.filter(function(nombre) {
        const clave = normalizeKey_(nombre);

        if (!clave || vistos[clave]) { return false; }

        vistos[clave] = true;
        return true;
      })
    );
  }

  return homologacion.cruce;
}

function proveedorComparable_(value) {
  const stopWords = {
    SA: true, SPA: true, LTDA: true, LIMITADA: true,
    EIRL: true, CIA: true, COMPANIA: true,
    // "PROMASA S.A." queda como "PROMASA S A": sin descartar las
    // letras sueltas, el parecido contra "PROMASA SPA" cae a 0,47 y
    // dos escrituras del mismo nombre no cruzan.
    S: true, A: true, I: true, R: true, L: true,
    SOCIEDAD: true, SOC: true, EMPRESA: true,
    EMPRESAS: true, SERV: true, SERVICIO: true,
    SERVICIOS: true, AGRICOLA: true, FORESTAL: true,
    COMERCIAL: true, INDUSTRIAL: true,
    INDUSTRIAS: true, INMOBILIARIA: true, INV: true,
    INVERSIONES: true, ASERRADERO: true,
    ASERRADEROS: true, E: true, Y: true, DE: true,
    DEL: true, LA: true, EL: true, LOS: true,
    LAS: true
  };

  return normalizeKey_(value)
    .split(' ')
    .filter(function(token) {
      return token && !stopWords[token];
    })
    .join(' ')
    .trim();
}

function proveedorSimilitud_(a, b) {
  if (!a || !b) {
    return 0;
  }

  if (a === b) {
    return 1;
  }

  const tokensA = uniqueTokens_(a);
  const tokensB = uniqueTokens_(b);

  const intersection = tokensA.filter(function(token) {
    return tokensB.indexOf(token) !== -1;
  }).length;

  const union = uniqueTokens_(
    tokensA.concat(tokensB).join(' ')
  ).length;

  const jaccard = union ? intersection / union : 0;

  const edit =
    1 - levenshtein_(a, b) / Math.max(a.length, b.length);

  return Math.max(jaccard, 0.55 * jaccard + 0.45 * edit);
}

function levenshtein_(a, b) {
  const matrix = [];

  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i];
  }

  for (let j = 0; j <= a.length; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      matrix[i][j] =
        b.charAt(i - 1) === a.charAt(j - 1)
          ? matrix[i - 1][j - 1]
          : Math.min(
              matrix[i - 1][j - 1] + 1,
              matrix[i][j - 1] + 1,
              matrix[i - 1][j] + 1
            );
    }
  }

  return matrix[b.length][a.length];
}

/* =====================================================================
 * PLAN MENSUAL (OPCIONAL)
 * ===================================================================== */

/**
 * Hoja Plan con estructura:
 *   Suministro | Proveedor | Precio | <mes>
 *
 * "Suministro" puede aparecer solo en la primera fila del grupo y se
 * arrastra hacia abajo. El precio es unitario por TS para la combinación
 * proveedor/material y la columna del mes contiene el volumen planificado.
 */
function readPlan_(spreadsheet, month) {
  const sheet = spreadsheet.getSheetByName(CONFIG.SHEET_PLAN);

  if (!sheet || sheet.getLastRow() < 2) {
    return {
      rows: [],
      details: [],
      invalidRows: [],
      sheetName: sheet ? sheet.getName() : CONFIG.SHEET_PLAN,
      monthLabel: '',
      totalPlan: 0,
      plannedCost: 0,
      weightedPrice: null
    };
  }

  const range = sheet.getDataRange();
  const values = range.getValues();
  const displayed = range.getDisplayValues();

  let headerRowIndex = -1;
  let suministroColumn = -1;
  let proveedorColumn = -1;
  let precioColumn = -1;

  for (
    let rowIndex = 0;
    rowIndex < Math.min(values.length, 20);
    rowIndex++
  ) {
    const map = buildHeaderMap_(values[rowIndex]);

    if (
      map['suministro'] !== undefined &&
      map['proveedor'] !== undefined &&
      map['precio'] !== undefined
    ) {
      headerRowIndex = rowIndex;
      suministroColumn = map['suministro'];
      proveedorColumn = map['proveedor'];
      precioColumn = map['precio'];
      break;
    }
  }

  if (headerRowIndex === -1) {
    return {
      rows: [],
      details: [],
      invalidRows: [{
        row: 1,
        reason:
          'Se esperaban las columnas Suministro, Proveedor y Precio.'
      }],
      sheetName: sheet.getName(),
      monthLabel: '',
      totalPlan: 0,
      plannedCost: 0,
      weightedPrice: null
    };
  }

  const monthColumn = findPlanMonthColumn_(
    values[headerRowIndex],
    displayed[headerRowIndex],
    month
  );

  if (monthColumn === -1) {
    return {
      rows: [],
      details: [],
      invalidRows: [{
        row: headerRowIndex + 1,
        reason: 'No existe una columna para el mes ' + month.prefix + '.'
      }],
      sheetName: sheet.getName(),
      monthLabel: '',
      totalPlan: 0,
      plannedCost: 0,
      weightedPrice: null
    };
  }

  const monthLabel =
    text_(displayed[headerRowIndex][monthColumn]) ||
    text_(values[headerRowIndex][monthColumn]);

  const details = [];
  const invalidRows = [];
  let currentSupplyRaw = '';
  let currentSubproducto = '';

  for (
    let rowIndex = headerRowIndex + 1;
    rowIndex < values.length;
    rowIndex++
  ) {
    const supplyCell = text_(
      displayed[rowIndex][suministroColumn] !== ''
        ? displayed[rowIndex][suministroColumn]
        : values[rowIndex][suministroColumn]
    );

    if (supplyCell) {
      currentSupplyRaw = supplyCell;
      currentSubproducto = resolvePlanSubproducto_(supplyCell);
    }

    const proveedorPlan = text_(
      displayed[rowIndex][proveedorColumn] !== ''
        ? displayed[rowIndex][proveedorColumn]
        : values[rowIndex][proveedorColumn]
    );

    const rawPrice =
      displayed[rowIndex][precioColumn] !== ''
        ? displayed[rowIndex][precioColumn]
        : values[rowIndex][precioColumn];

    const rawPlan =
      displayed[rowIndex][monthColumn] !== ''
        ? displayed[rowIndex][monthColumn]
        : values[rowIndex][monthColumn];

    const hasContent =
      supplyCell ||
      proveedorPlan ||
      text_(rawPrice) ||
      text_(rawPlan);

    if (!hasContent) {
      continue;
    }

    if (!currentSubproducto) {
      invalidRows.push({
        row: rowIndex + 1,
        reason:
          'Suministro no reconocido: ' +
          (currentSupplyRaw || '(vacío)')
      });
      continue;
    }

    if (!proveedorPlan) {
      invalidRows.push({
        row: rowIndex + 1,
        reason:
          'Fila de ' + currentSubproducto + ' sin proveedor.'
      });
      continue;
    }

    const precio = parseOptionalNumber_(rawPrice);
    const planValue = parseOptionalNumber_(rawPlan);
    const planTs = planValue === null ? 0 : planValue;

    const planKey =
      currentSubproducto +
      '||' +
      priceProviderComparable_(proveedorPlan);

    details.push({
      row: rowIndex + 1,
      planKey: planKey,
      subproducto: currentSubproducto,
      suministroRaw: currentSupplyRaw,
      proveedorPlan: proveedorPlan,
      proveedorPlanKey: priceProviderComparable_(proveedorPlan),
      precio: precio,
      plan: planTs,
      planCost:
        precio !== null
          ? precio * planTs
          : null
    });
  }

  const aggregate = {};

  details.forEach(function(item) {
    if (!aggregate[item.subproducto]) {
      aggregate[item.subproducto] = {
        subproducto: item.subproducto,
        plan: 0,
        pricedPlanTs: 0,
        planCost: 0,
        suppliers: 0
      };
    }

    const target = aggregate[item.subproducto];
    target.plan += Number(item.plan) || 0;
    target.suppliers++;

    if (item.precio !== null && item.plan > 0) {
      target.pricedPlanTs += item.plan;
      target.planCost += item.precio * item.plan;
    }
  });

  const rows = Object.keys(aggregate).map(function(key) {
    const item = aggregate[key];

    return {
      subproducto: item.subproducto,
      plan: item.plan,
      pricedPlanTs: item.pricedPlanTs,
      planCost: item.planCost,
      suppliers: item.suppliers,
      weightedPrice:
        item.pricedPlanTs > 0
          ? item.planCost / item.pricedPlanTs
          : null
    };
  });

  const totalPlan = rows.reduce(function(total, item) {
    return total + (Number(item.plan) || 0);
  }, 0);

  const pricedPlanTs = rows.reduce(function(total, item) {
    return total + (Number(item.pricedPlanTs) || 0);
  }, 0);

  const plannedCost = rows.reduce(function(total, item) {
    return total + (Number(item.planCost) || 0);
  }, 0);

  return {
    rows: rows,
    details: details,
    invalidRows: invalidRows,
    sheetName: sheet.getName(),
    monthLabel: monthLabel,
    totalPlan: totalPlan,
    pricedPlanTs: pricedPlanTs,
    plannedCost: plannedCost,
    weightedPrice:
      pricedPlanTs > 0
        ? plannedCost / pricedPlanTs
        : null
  };
}

/**
 * El plan de TODOS los meses de la ventana, no solo el vigente.
 *
 * readPlan_ busca una sola columna —la del mes en curso— porque es lo
 * único que necesita el prorrateo diario. Para comparar meses hace
 * falta la fila entera, así que esto recorre todas las columnas de mes
 * que caigan dentro de la historia.
 *
 * Se devuelve indexado por planKey (el mismo "subproducto||proveedor
 * normalizado" que ya llevan las filas operativas), para que el
 * navegador pueda cruzar ingreso contra plan sin volver a normalizar
 * nombres por su cuenta. Solo eso: el nombre del proveedor del plan no
 * viaja, porque en pantalla se muestra el de Ingresos.
 */
/**
 * Los camiones escritos en una celda.
 *
 * La hoja los trae como número o como texto, y el texto puede venir
 * con el punto de los miles y la coma decimal. Lo que no parezca un
 * número vale cero: una celda con una nota adentro no son camiones.
 */
function camionesDeCelda_(crudo, mostrado) {
  if (typeof crudo === 'number') {
    return isFinite(crudo) ? crudo : 0;
  }

  const texto = text_(mostrado !== '' && mostrado !== undefined
    ? mostrado
    : crudo);

  if (!/^-?\d{1,3}(\.\d{3})*(,\d+)?$|^-?\d+([.,]\d+)?$/.test(texto)) {
    return 0;
  }

  const n = parseOptionalNumber_(texto);

  return n === null || !isFinite(n) ? 0 : n;
}

function readPlanMeses_(spreadsheet, desde, hasta) {
  const vacio = { meses: [], porMes: {} };
  const sheet = spreadsheet.getSheetByName(CONFIG.SHEET_PLAN);

  if (!sheet || sheet.getLastRow() < 2) {
    return vacio;
  }

  const range = sheet.getDataRange();
  const values = range.getValues();
  const displayed = range.getDisplayValues();

  let headerRowIndex = -1;
  let suministroColumn = -1;
  let proveedorColumn = -1;

  for (
    let rowIndex = 0;
    rowIndex < Math.min(values.length, 20);
    rowIndex++
  ) {
    const map = buildHeaderMap_(values[rowIndex]);

    if (
      map['suministro'] !== undefined &&
      map['proveedor'] !== undefined &&
      map['precio'] !== undefined
    ) {
      headerRowIndex = rowIndex;
      suministroColumn = map['suministro'];
      proveedorColumn = map['proveedor'];
      break;
    }
  }

  if (headerRowIndex === -1) {
    return vacio;
  }

  const header = values[headerRowIndex];
  const shown = displayed[headerRowIndex] || [];
  const columnas = [];
  const vistos = {};

  for (
    let columnIndex = 0;
    columnIndex < header.length;
    columnIndex++
  ) {
    let prefijo = '';

    if (header[columnIndex] instanceof Date) {
      prefijo = Utilities.formatDate(
        header[columnIndex],
        CONFIG.TIMEZONE,
        'yyyy-MM'
      );
    }

    if (!prefijo) {
      prefijo = parseMonthHeader_(
        shown[columnIndex] || header[columnIndex]
      );
    }

    // Fuera de la ventana de historia no sirve de nada: el panel no
    // tiene ingresos con los que compararlo.
    if (!prefijo || prefijo < desde || prefijo > hasta) {
      continue;
    }

    // Dos columnas para el mismo mes: manda la primera, como en el
    // resto de la hoja.
    if (vistos[prefijo]) {
      continue;
    }

    vistos[prefijo] = true;
    columnas.push({ prefijo: prefijo, columna: columnIndex });
  }

  if (!columnas.length) {
    return vacio;
  }

  const porMes = {};

  columnas.forEach(function(item) {
    porMes[item.prefijo] = { total: 0, sub: {}, planKeys: {} };
  });

  let currentSubproducto = '';

  for (
    let rowIndex = headerRowIndex + 1;
    rowIndex < values.length;
    rowIndex++
  ) {
    const supplyCell = text_(
      displayed[rowIndex][suministroColumn] !== ''
        ? displayed[rowIndex][suministroColumn]
        : values[rowIndex][suministroColumn]
    );

    // "Suministro" se arrastra hacia abajo dentro del grupo.
    if (supplyCell) {
      currentSubproducto = resolvePlanSubproducto_(supplyCell);
    }

    const proveedorPlan = text_(
      displayed[rowIndex][proveedorColumn] !== ''
        ? displayed[rowIndex][proveedorColumn]
        : values[rowIndex][proveedorColumn]
    );

    if (!currentSubproducto || !proveedorPlan) {
      continue;
    }

    const planKey =
      currentSubproducto +
      '||' +
      priceProviderComparable_(proveedorPlan);

    columnas.forEach(function(item) {
      const crudo =
        displayed[rowIndex][item.columna] !== ''
          ? displayed[rowIndex][item.columna]
          : values[rowIndex][item.columna];

      const cantidad = parseOptionalNumber_(crudo);

      if (cantidad === null || !cantidad) {
        return;
      }

      const mes = porMes[item.prefijo];

      mes.total += cantidad;
      mes.sub[currentSubproducto] =
        (mes.sub[currentSubproducto] || 0) + cantidad;
      mes.planKeys[planKey] =
        (mes.planKeys[planKey] || 0) + cantidad;
    });
  }

  return {
    meses: columnas.map(function(item) { return item.prefijo; }).sort(),
    porMes: porMes
  };
}

/* =====================================================================
 * PROYECCIÓN SEMANAL
 *
 * La hoja "Proyeccion" es el compromiso de camiones que cada
 * proveedor dice que va a mandar. Su forma:
 *
 *   A  material, en celdas combinadas ("Astilla Verde o 3000039")
 *   B  proveedor
 *   C… "Dia 1", "Dia 2", … con CAMIONES, no toneladas
 *
 * "Dia N" es el N-ésimo día HÁBIL del mes en curso: no hay fecha en
 * ninguna celda, así que el anclaje vive acá. Cambiarlo cambia a qué
 * semana cae cada columna.
 *
 * Los camiones se convierten con el factor del material de la columna
 * A, que es el mismo criterio que usa el complemento de la planilla:
 * un camión de nitens no pesa lo que uno de pino con corteza.
 * ===================================================================== */

/**
 * Proyección por día hábil, ya convertida a TS.
 *
 * Devuelve porFecha —lo que el gráfico semanal necesita— y también el
 * detalle por proveedor, para poder decir quién compone cada semana.
 */
function readProyeccion_(
  spreadsheet,
  month,
  workdayKeys,
  proveedoresSap,
  homologacion
) {
  const vacio = {
    porFecha: {},
    porProveedor: [],
    sinCruce: [],
    total: 0,
    dias: 0,
    columnas: 0,
    primeraFilaEsEncabezado: false,
    missingSheet: true
  };

  const sheet = spreadsheet.getSheetByName(CONFIG.SHEET_PROYECCION);

  if (!sheet || sheet.getLastRow() < 1) {
    return vacio;
  }

  const range = sheet.getDataRange();
  const values = range.getValues();
  const displayed = range.getDisplayValues();

  if (!values.length) {
    return vacio;
  }

  // Los días hábiles del mes en curso, en orden. "Dia 1" es el
  // primero de esta lista.
  const habiles = (workdayKeys || []).filter(function(key) {
    return key >= month.startKey && key <= month.endKey;
  });

  // La fila 1 lleva las etiquetas "Dia N" en C en adelante. No hay
  // fila de encabezado aparte: esa misma fila ya trae un proveedor en
  // B, así que se usa para el mapeo y también se lee como dato.
  const cabecera = displayed[0] || [];
  const diaDeColumna = {};
  const sobrantes = {};
  let columnas = 0;

  for (let c = 2; c < cabecera.length; c++) {
    const m = normalizeKey_(cabecera[c]).match(/^DIA\s*(\d+)$/);

    if (!m) { continue; }

    const indice = Number(m[1]) - 1;

    if (indice >= 0 && indice < habiles.length) {
      diaDeColumna[c] = habiles[indice];
    } else if (indice >= 0) {
      // La hoja tiene 23 columnas y un mes puede tener 20 días
      // hábiles: "Dia 21" no cae en ninguna fecha. Se anota para
      // poder avisar, porque escribir ahí y que se pierda en
      // silencio es peor que no poder escribir.
      sobrantes[c] = 'Dia ' + m[1];
    }

    columnas++;
  }

  if (!columnas) {
    return Object.assign({}, vacio, { missingSheet: false });
  }

  const porFecha = {};
  const porProveedor = {};
  const sobranteUsado = {};
  let total = 0;
  let camionesSobrantes = 0;
  let material = '';

  for (let r = 0; r < values.length; r++) {
    // La columna A viene combinada por grupo de material: solo la
    // primera fila del grupo trae el valor, igual que en la hoja Plan.
    const celdaMaterial = text_(
      displayed[r][0] !== '' ? displayed[r][0] : values[r][0]
    );

    if (celdaMaterial) {
      material = resolvePlanSubproducto_(celdaMaterial);
    }

    const proveedorRaw = text_(
      displayed[r][1] !== '' ? displayed[r][1] : values[r][1]
    );

    if (!material || !proveedorRaw || isTotalText_(proveedorRaw)) {
      continue;
    }

    // Esta hoja la escribe la misma mano que la planilla: "Madeex",
    // "Guivar", "La Orilla". Cruza por el mismo camino —la hoja
    // Proveedores primero, el parecido después— para que un camión
    // proyectado y uno recibido caigan sobre el mismo proveedor.
    const cruce = resolveProveedor_(
      proveedorRaw,
      proveedoresSap,
      homologacion
    );
    const proveedor = cruce.proveedor;

    const factor = factorDe_(material);

    // La fila 1 es la que lleva las etiquetas "Dia N": ahí no hay
    // camiones que leer, por mucho que esa misma fila traiga un
    // proveedor en la columna B.
    if (r === 0) { continue; }

    Object.keys(diaDeColumna).forEach(function(clave) {
      const c = Number(clave);
      const camiones = camionesDeCelda_(values[r][c], displayed[r][c]);

      if (!camiones) { return; }

      const fecha = diaDeColumna[c];
      const ts = camiones * factor;

      if (!porFecha[fecha]) {
        porFecha[fecha] = { ts: 0, camiones: 0 };
      }

      porFecha[fecha].ts += ts;
      porFecha[fecha].camiones += camiones;

      const clv = proveedor + '||' + material;

      if (!porProveedor[clv]) {
        porProveedor[clv] = {
          proveedor: proveedor,
          proveedorRaw: proveedorRaw,
          matchMethod: cruce.method,
          subproducto: material,
          ts: 0,
          camiones: 0,
          // Qué se comprometió cada día, no solo el total del mes: sin
          // esto no se puede preguntar qué prometió este proveedor la
          // semana pasada, que es la pregunta de la reunión.
          porFecha: {}
        };
      }

      porProveedor[clv].ts += ts;
      porProveedor[clv].camiones += camiones;

      const dia = porProveedor[clv].porFecha;

      if (!dia[fecha]) { dia[fecha] = { ts: 0, camiones: 0 }; }

      dia[fecha].ts += ts;
      dia[fecha].camiones += camiones;

      total += ts;
    });

    // Lo escrito en columnas que este mes no existen.
    Object.keys(sobrantes).forEach(function(clave) {
      const c = Number(clave);
      const camiones = camionesDeCelda_(values[r][c], displayed[r][c]);

      if (!camiones) { return; }

      camionesSobrantes += camiones;
      sobranteUsado[sobrantes[c]] = true;
    });
  }

  const lista = Object.keys(porProveedor).map(function(k) {
    const item = porProveedor[k];

    item.ts = round_(item.ts, 2);

    Object.keys(item.porFecha).forEach(function(f) {
      item.porFecha[f].ts = round_(item.porFecha[f].ts, 2);
    });

    return item;
  }).sort(function(a, b) { return b.ts - a.ts; });

  // Los que no cruzaron con nadie: sus camiones sí entran al total del
  // día —lo comprometido es lo comprometido— pero no se le pueden
  // cargar a ningún proveedor, así que no hay con qué compararlos
  // contra su plan. Se agrupan por nombre escrito para poder decirlo.
  const sinCruce = {};

  lista.forEach(function(item) {
    if (item.matchMethod !== 'Solo en planilla') { return; }

    const clave = normalizeKey_(item.proveedorRaw);

    if (!sinCruce[clave]) {
      sinCruce[clave] = { alias: item.proveedorRaw, ts: 0, camiones: 0 };
    }

    sinCruce[clave].ts += item.ts;
    sinCruce[clave].camiones += item.camiones;
  });

  return {
    porFecha: porFecha,
    porProveedor: lista,
    sinCruce: Object.keys(sinCruce).map(function(k) {
      return {
        alias: sinCruce[k].alias,
        ts: round_(sinCruce[k].ts, 2),
        camiones: sinCruce[k].camiones
      };
    }).sort(function(a, b) { return b.camiones - a.camiones; }),
    total: round_(total, 2),
    dias: Object.keys(porFecha).length,
    columnas: columnas,
    // Camiones escritos en columnas que este mes no tienen día
    // hábil. No entran a ninguna fecha, así que se dicen.
    camionesSobrantes: camionesSobrantes,
    columnasSobrantes: Object.keys(sobranteUsado).sort(),
    diasHabiles: habiles.length,
    // La fila 1 hace de encabezado y de dato a la vez: su proveedor no
    // puede tener proyección sin pisar las etiquetas. Se avisa, porque
    // es una fila que se pierde en silencio.
    primeraFilaEsEncabezado: !!text_(
      displayed[0][1] !== '' ? displayed[0][1] : values[0][1]
    ),
    filaEncabezado: text_(
      displayed[0][1] !== '' ? displayed[0][1] : values[0][1]
    ),
    missingSheet: false
  };
}

function resolvePlanSubproducto_(value) {
  const raw = text_(value);
  const key = normalizeKey_(raw);

  const codes = Object.keys(CONFIG.MATERIAL_MAP);

  for (let index = 0; index < codes.length; index++) {
    const code = codes[index];

    if (key.indexOf(code) !== -1) {
      return CONFIG.MATERIAL_MAP[code];
    }
  }

  return canonicalSubproducto_(raw);
}

function findPlanMonthColumn_(
  header,
  displayedHeader,
  month
) {
  for (
    let columnIndex = 0;
    columnIndex < header.length;
    columnIndex++
  ) {
    const raw = header[columnIndex];

    if (
      raw instanceof Date &&
      Utilities.formatDate(
        raw,
        CONFIG.TIMEZONE,
        'yyyy-MM'
      ) === month.prefix
    ) {
      return columnIndex;
    }

    if (
      parseMonthHeader_(
        displayedHeader[columnIndex] || raw
      ) === month.prefix
    ) {
      return columnIndex;
    }
  }

  return -1;
}

function parseMonthHeader_(value) {
  const text = normalizeKey_(value);

  let match = text.match(/^(\d{4})[-/](\d{1,2})/);

  if (match) {
    return (
      String(match[1]) +
      '-' +
      String(match[2]).padStart(2, '0')
    );
  }

  match = text.match(
    /^(ENE|FEB|MAR|ABR|MAY|JUN|JUL|AGO|SEP|OCT|NOV|DIC)[A-Z]*[- ](\d{4})/
  );

  if (!match) {
    return '';
  }

  const months = {
    ENE: 1, FEB: 2, MAR: 3, ABR: 4, MAY: 5, JUN: 6,
    JUL: 7, AGO: 8, SEP: 9, OCT: 10, NOV: 11, DIC: 12
  };

  return (
    String(match[2]) +
    '-' +
    String(months[match[1]]).padStart(2, '0')
  );
}


/* =====================================================================
 * PRECIOS Y VALORIZACIÓN · PLAN ↔ INGRESOS/PLANILLA
 * ===================================================================== */

/**
 * Normalización específica de proveedores para precios.
 * A diferencia del cruce operativo, conserva palabras como FORESTAL,
 * ASERRADERO, INDUSTRIA y MADERERA porque ayudan a distinguir empresas
 * con nombres parecidos. Solo elimina formas jurídicas y unifica algunas
 * abreviaturas frecuentes.
 */
function priceProviderComparable_(value) {
  const legalWords = {
    SA: true,
    SPA: true,
    LTDA: true,
    LIMITADA: true,
    EIRL: true,
    S: true,
    A: true,
    E: true,
    I: true,
    R: true,
    L: true,
    SOC: true,
    SOCIEDAD: true
  };

  return normalizeKey_(value)
    .replace(/\bBIOBIO\b/g, 'BIO BIO')
    .replace(/\bASERRADEROS\b/g, 'ASERRADERO')
    .replace(/\bFOR\b/g, 'FORESTAL')
    .replace(/\bIND\b/g, 'INDUSTRIA')
    .replace(/\bINDUST\b/g, 'INDUSTRIA')
    .replace(/\bINMOB\b/g, 'INMOBILIARIA')
    .replace(/\bSERV\b/g, 'SERVICIOS')
    .split(' ')
    .filter(function(token) {
      return token && !legalWords[token];
    })
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function priceProviderSimilarity_(a, b) {
  if (!a || !b) {
    return 0;
  }

  if (a === b) {
    return 1;
  }

  const tokensA = uniqueTokens_(a);
  const tokensB = uniqueTokens_(b);

  if (!tokensA.length || !tokensB.length) {
    return 0;
  }

  const intersection = tokensA.filter(function(token) {
    return tokensB.indexOf(token) !== -1;
  }).length;

  const shorter = Math.min(tokensA.length, tokensB.length);
  const longer = Math.max(tokensA.length, tokensB.length);

  const shortCoverage = shorter
    ? intersection / shorter
    : 0;

  const longCoverage = longer
    ? intersection / longer
    : 0;

  const edit =
    1 - levenshtein_(a, b) / Math.max(a.length, b.length);

  let score =
    0.62 * shortCoverage +
    0.23 * longCoverage +
    0.15 * Math.max(0, edit);

  if (
    intersection >= 2 &&
    shortCoverage === 1
  ) {
    const extraTokens = longer - shorter;
    score = Math.max(
      score,
      Math.max(0.78, 0.94 - extraTokens * 0.04)
    );
  }

  return Math.min(1, score);
}

function resolvePlanPrice_(
  proveedor,
  subproducto,
  planDetails,
  homologacion
) {
  const raw = text_(proveedor);

  if (
    !raw ||
    normalizeKey_(raw) === 'SIN PROVEEDOR'
  ) {
    return {
      detail: null,
      method: 'Sin proveedor',
      score: 0,
      secondScore: 0
    };
  }

  const comparable = priceProviderComparable_(raw);

  const candidates = (planDetails || []).filter(function(item) {
    return (
      item.subproducto === subproducto &&
      item.precio !== null &&
      item.precio !== undefined &&
      isFinite(Number(item.precio))
    );
  });

  if (!candidates.length) {
    return {
      detail: null,
      method: 'Sin precio para material',
      score: 0,
      secondScore: 0
    };
  }

  // Antes del parecido: si la hoja Proveedores lleva el nombre
  // operativo y el del Plan al mismo proveedor SAP, están cruzados y
  // no hay nada que estimar. Es el caso que el parecido nunca iba a
  // resolver: en SAP "LAMINADORA LOS ANGELES" y en el Plan "LLASA".
  const canonicoFila = homologarProveedor_(raw, homologacion);

  if (canonicoFila) {
    const aMano = candidates.filter(function(item) {
      const canonicoPlan = homologarProveedor_(
        item.proveedorPlan,
        homologacion
      );

      return (
        canonicoPlan &&
        normalizeKey_(canonicoPlan) === normalizeKey_(canonicoFila)
      );
    });

    if (aMano.length) {
      const precios = uniqueSorted_(
        aMano.map(function(item) {
          return String(item.precio);
        })
      );

      // Dos filas del Plan homologadas al mismo proveedor y material
      // pero con precios distintos: eso no lo arregla la hoja de
      // equivalencias, hay que corregir el Plan. Mejor sin precio que
      // con uno elegido al azar.
      if (precios.length > 1) {
        return {
          detail: null,
          method: 'Precio duplicado en el Plan',
          score: 1,
          secondScore: 1
        };
      }

      return {
        detail: aMano[0],
        method: 'Precio homologado a mano',
        score: 1,
        secondScore: 0
      };
    }
  }

  const ranked = candidates.map(function(item) {
    const candidateKey =
      item.proveedorPlanKey ||
      priceProviderComparable_(item.proveedorPlan);

    return {
      detail: item,
      score: priceProviderSimilarity_(
        comparable,
        candidateKey
      )
    };
  }).sort(function(a, b) {
    return b.score - a.score;
  });

  const best = ranked[0];
  const second = ranked[1] || { score: 0 };

  if (!best || best.score < CONFIG.PRICE_MATCH_THRESHOLD) {
    return {
      detail: null,
      method: 'Proveedor sin precio homologado',
      score: best ? round_(best.score, 3) : 0,
      secondScore: round_(second.score || 0, 3)
    };
  }

  if (
    second.score >= CONFIG.PRICE_MATCH_THRESHOLD &&
    best.score - second.score < CONFIG.PRICE_MATCH_MARGIN
  ) {
    return {
      detail: null,
      method: 'Precio ambiguo',
      score: round_(best.score, 3),
      secondScore: round_(second.score, 3)
    };
  }

  return {
    detail: best.detail,
    method:
      best.score === 1
        ? 'Precio exacto'
        : 'Precio homologado',
    score: round_(best.score, 3),
    secondScore: round_(second.score || 0, 3)
  };
}

function applyPlanPricing_(rows, planDetails, homologacion) {
  const output = [];
  const unmatched = {};
  let pricedTs = 0;
  let unpricedTs = 0;
  let estimatedCost = 0;

  (rows || []).forEach(function(row) {
    const match = resolvePlanPrice_(
      row.proveedor,
      row.subproducto,
      planDetails,
      homologacion
    );

    const detail = match.detail;
    const precio = detail
      ? Number(detail.precio)
      : null;

    const ts = Number(row.ts) || 0;
    const hasPrice =
      precio !== null &&
      isFinite(precio);

    if (hasPrice) {
      pricedTs += ts;
      estimatedCost += ts * precio;
    } else {
      unpricedTs += ts;

      const unmatchedKey =
        row.subproducto +
        ' | ' +
        (row.proveedor || 'SIN PROVEEDOR') +
        ' | ' +
        match.method;

      unmatched[unmatchedKey] =
        (unmatched[unmatchedKey] || 0) + ts;
    }

    const enriched = Object.assign({}, row, {
      planKey: detail ? detail.planKey : '',
      planProveedor: detail ? detail.proveedorPlan : '',
      precioUnitario: hasPrice ? precio : null,
      costoEstimado: hasPrice ? ts * precio : null,
      precioMatchMethod: match.method
    });

    output.push(enriched);
  });

  const totalTs = pricedTs + unpricedTs;

  return {
    rows: output,
    stats: {
      totalTs: totalTs,
      pricedTs: pricedTs,
      unpricedTs: unpricedTs,
      coverage: totalTs > 0 ? pricedTs / totalTs : 0,
      estimatedCost: estimatedCost,
      weightedPrice:
        pricedTs > 0
          ? estimatedCost / pricedTs
          : null,
      unmatched: Object.keys(unmatched)
        .map(function(key) {
          return {
            key: key,
            ts: unmatched[key]
          };
        })
        .sort(function(a, b) {
          return b.ts - a.ts;
        })
    }
  };
}


/** La fila "Total" de una tabla: se reconoce y no se cuenta. */
function isTotalText_(value) {
  const key = normalizeKey_(value);
  return /^TOTAL\b/.test(key);
}

/* =====================================================================
 * EL LIBRO DE CAMIONES
 *
 * El registro en vivo. Lo escribe la portería de la planta en una
 * planilla que NO es de este proyecto —es de otra área, no se puede
 * tocar, y cambia de archivo todos los meses—, con una fila por
 * camión: su guía, el proveedor, el producto, el destino y la hora en
 * que llegó.
 *
 * Reemplaza al correo del reservador por dos razones. Se ve EN VIVO:
 * la fila existe cuando el camión entra, no al día siguiente. Y trae
 * la GUÍA, que es exactamente el mismo número que SAP escribe en su
 * columna "Nº Guia".
 *
 * Esa guía cambia el complemento de raíz. Antes se decidía por día
 * completo y hubo que inventarle excepciones —el proveedor que SAP no
 * conoce, el día cargado a medias— porque no había forma de saber si
 * un camión concreto ya estaba en SAP. Ahora sí la hay: si la guía
 * está en SAP, ese camión ya está contado con su peso real; si no
 * está, se complementa con el factor del material. Camión por camión,
 * sin reglas de día y sin excepciones.
 * ===================================================================== */

const MESES_LARGOS = Object.freeze([
  'ENERO', 'FEBRERO', 'MARZO', 'ABRIL', 'MAYO', 'JUNIO',
  'JULIO', 'AGOSTO', 'SEPTIEMBRE', 'OCTUBRE', 'NOVIEMBRE', 'DICIEMBRE'
]);

/** El nombre del mes de una clave 'yyyy-MM'. */
function nombreDelMes_(mes) {
  return MESES_LARGOS[Number(String(mes).split('-')[1]) - 1] || '';
}

/**
 * La guía, comparable entre las dos fuentes.
 *
 * SAP la escribe como número y el libro como texto; una puede traer
 * ceros a la izquierda y la otra no. Se comparan solo los dígitos.
 */
function normalizaGuia_(valor) {
  const texto = text_(valor);

  if (!texto) { return ''; }

  const digitos = texto.replace(/\D/g, '').replace(/^0+/, '');

  return digitos || normalizeKey_(texto);
}

/** El id de un archivo, venga pegado el enlace entero o solo el id. */
function idDeEnlace_(valor) {
  const texto = text_(valor);
  const m = texto.match(/[-\w]{25,}/);

  return m ? m[0] : '';
}

/**
 * La hoja Fuentes: qué libro de camiones usar cada mes.
 *
 * Existe porque el libro es ajeno y cambia de archivo cada mes. Acá se
 * puede fijar a mano el de un mes —pegando su enlace— y queda a la
 * vista cuál está usando el panel, en vez de depender de que el nombre
 * del archivo siga el mismo patrón para siempre.
 */
function leerFuentes_(spreadsheet) {
  const hoja = spreadsheet.getSheetByName(CONFIG.SHEET_FUENTES);

  if (!hoja || hoja.getLastRow() < 2) { return {}; }

  const valores = hoja.getDataRange().getValues();
  const mapa = buildHeaderMap_(valores[0]);

  const cMes = mapa['mes'];
  const cLibro = mapa['libro de camiones'] !== undefined
    ? mapa['libro de camiones']
    : mapa['libro'];
  const cHoja = mapa['hoja'];

  if (cMes === undefined || cLibro === undefined) { return {}; }

  const porMes = {};

  for (let i = 1; i < valores.length; i++) {
    const id = idDeEnlace_(valores[i][cLibro]);

    if (!id) { continue; }

    const mes = claveDeMes_(valores[i][cMes]);

    if (!mes) { continue; }

    porMes[mes] = {
      id: id,
      hoja: cHoja !== undefined ? text_(valores[i][cHoja]) : '',
      aMano: true
    };
  }

  return porMes;
}

/**
 * 'yyyy-MM' desde lo que alguien escriba en la columna Mes: una
 * fecha, '2026-11', 'NOVIEMBRE 2026' o 'nov-2026'.
 */
function claveDeMes_(valor) {
  if (valor instanceof Date && !isNaN(valor.getTime())) {
    return Utilities.formatDate(valor, CONFIG.TIMEZONE, 'yyyy-MM');
  }

  const texto = normalizeKey_(valor);

  let m = texto.match(/(\d{4})[-/](\d{1,2})/);

  if (m) {
    return m[1] + '-' + ('0' + m[2]).slice(-2);
  }

  m = texto.match(/([A-Z]+)[^A-Z0-9]*(\d{4})/);

  if (!m) { return ''; }

  for (let i = 0; i < MESES_LARGOS.length; i++) {
    if (MESES_LARGOS[i].indexOf(m[1]) === 0 && m[1].length >= 3) {
      return m[2] + '-' + ('0' + (i + 1)).slice(-2);
    }
  }

  return '';
}

/**
 * Busca el libro del mes en Drive, por su nombre.
 *
 * El archivo se llama "CAMIONES INGRESO <MES> AÑO <AAAA>". Buscarlo
 * cada vez que se abre el panel sería caro, así que el id encontrado
 * se guarda en el caché del script por unas horas: dentro del mes el
 * archivo no cambia.
 */
function buscarLibroEnDrive_(mes) {
  const nombre = nombreDelMes_(mes);
  const anio = String(mes).slice(0, 4);

  if (!nombre) { return null; }

  const cache = CacheService.getScriptCache();
  const llave = 'libro-camiones-' + mes;
  const guardado = cache.get(llave);

  if (guardado) {
    return { id: guardado, nombre: '', deCache: true };
  }

  let mejor = null;

  try {
    const archivos = DriveApp.searchFiles(
      "title contains '" + CONFIG.CAMIONES.PATRON +
      "' and trashed = false"
    );

    while (archivos.hasNext()) {
      const archivo = archivos.next();
      const clave = normalizeKey_(archivo.getName());

      if (
        clave.indexOf(nombre) === -1 ||
        clave.indexOf(anio) === -1
      ) {
        continue;
      }

      if (!mejor || archivo.getLastUpdated() > mejor.getLastUpdated()) {
        mejor = archivo;
      }
    }
  } catch (error) {
    return null;
  }

  if (!mejor) { return null; }

  cache.put(llave, mejor.getId(), 6 * 3600);

  return { id: mejor.getId(), nombre: mejor.getName(), deCache: false };
}

/** La hoja del libro que trae los camiones de ese mes. */
function hojaDeCamiones_(libro, mes, nombrePedido) {
  const hojas = libro.getSheets();

  if (nombrePedido) {
    const pedida = libro.getSheetByName(nombrePedido);

    if (pedida) { return pedida; }
  }

  const nombre = nombreDelMes_(mes);
  let conEncabezado = null;

  for (let i = 0; i < hojas.length; i++) {
    const hoja = hojas[i];

    if (hoja.getLastRow() < 2 || hoja.getLastColumn() < 5) { continue; }

    const encabezado = hoja
      .getRange(1, 1, 1, Math.min(hoja.getLastColumn(), 40))
      .getValues()[0];

    const mapa = buildHeaderMap_(encabezado);

    // Se reconoce por los rótulos, no por el nombre de la pestaña:
    // el nombre lo escribe una persona y puede venir como sea.
    if (
      mapa['guia'] === undefined ||
      mapa['proveedor'] === undefined ||
      mapa['producto'] === undefined
    ) {
      continue;
    }

    if (!conEncabezado) { conEncabezado = hoja; }

    if (normalizeKey_(hoja.getName()).indexOf(nombre) !== -1) {
      return hoja;
    }
  }

  return conEncabezado;
}

/**
 * Los camiones de uno o más meses, ya cruzados contra los proveedores
 * de SAP.
 *
 * Se leen el mes en curso y el anterior, no toda la historia: SAP se
 * atrasa días, no meses, y un mes cerrado ya está entero en SAP. Leer
 * seis libros ajenos en cada carga del panel sería pagar mucho por
 * nada.
 */
function readCamiones_(
  spreadsheet,
  meses,
  proveedoresSap,
  homologacion,
  timezone
) {
  const salida = {
    rows: [],
    libros: [],
    faltan: [],
    sinGuia: 0,
    otrosProductos: 0,
    enCurso: 0,
    repetidas: 0,
    // Filas con la hora de cierre anterior a la de llegada.
    horasDudosas: 0,
    demora: null,
    primeraFecha: '',
    ultimaFecha: ''
  };

  // La demora del mes, sobre los camiones que ya cerraron.
  const patios = [];
  const flujos = [];

  const aMano = leerFuentes_(spreadsheet);
  const vistas = {};

  (meses || []).forEach(function(mes) {
    const fuente = aMano[mes] || buscarLibroEnDrive_(mes);

    if (!fuente || !fuente.id) {
      salida.faltan.push(mes);
      return;
    }

    let libro;

    try {
      libro = SpreadsheetApp.openById(fuente.id);
    } catch (error) {
      salida.faltan.push(mes);
      return;
    }

    const hoja = hojaDeCamiones_(libro, mes, fuente.hoja);

    if (!hoja) {
      salida.faltan.push(mes);
      return;
    }

    const alto = hoja.getLastRow();
    const ancho = Math.min(
      hoja.getLastColumn(),
      CONFIG.CAMIONES.COLUMNAS_MAX
    );

    if (alto < 2 || ancho < 5) { return; }

    const rango = hoja.getRange(1, 1, alto, ancho);
    const valores = rango.getValues();
    const mostrados = rango.getDisplayValues();
    const mapa = buildHeaderMap_(valores[0]);

    function col(nombres) {
      for (let i = 0; i < nombres.length; i++) {
        if (mapa[nombres[i]] !== undefined) { return mapa[nombres[i]]; }
      }

      return -1;
    }

    const cFecha = col(['fecha']);
    const cGuia = col(['guia', 'n guia', 'nº guia']);
    const cProveedor = col(['proveedor']);
    const cProducto = col(['producto', 'material']);
    const cDestino = col(['destino']);
    const cEstado = col(['estado']);
    const cLlegada = col(['hora llegada', 'llegada']);
    // La columna que se llama "HORA" y nada más es la del cierre: se
    // escribe cuando el camión termina y se va.
    const cCierre = col(['hora']);
    const cReserva = col(['hora reserva', 'reserva']);

    if (cFecha < 0 || cGuia < 0 || cProveedor < 0 || cProducto < 0) {
      salida.faltan.push(mes);
      return;
    }

    salida.libros.push({
      mes: mes,
      id: fuente.id,
      nombre: libro.getName(),
      hoja: hoja.getName(),
      url: libro.getUrl(),
      aMano: !!fuente.aMano,
      filas: alto - 1
    });

    for (let r = 1; r < valores.length; r++) {
      const fecha = toDateKey_(
        valores[r][cFecha],
        mostrados[r][cFecha],
        timezone
      );

      if (!fecha) { continue; }

      const crudo = text_(valores[r][cProveedor]);
      const producto = text_(valores[r][cProducto]);

      // Fila de un día todavía sin camión: la fecha está escrita de
      // antemano y el resto en blanco.
      if (!crudo && !producto) { continue; }

      const subproducto = canonicalSubproducto_(producto);

      if (!subproducto) {
        salida.otrosProductos++;
        continue;
      }

      const guia = normalizaGuia_(valores[r][cGuia]);

      if (!guia) {
        // Astilla de proceso sin guía: no se puede cruzar contra SAP,
        // así que no se complementa. Se cuenta para poder decirlo.
        salida.sinGuia++;
        continue;
      }

      const cruce = resolveProveedor_(crudo, proveedoresSap, homologacion);
      const llave = guia + '||' + normalizeKey_(cruce.proveedor);

      // La misma guía del mismo proveedor dos veces es la misma
      // guía: un camión no entra dos veces.
      if (vistas[llave]) {
        salida.repetidas++;
        continue;
      }

      vistas[llave] = true;

      const estado = normalizeKey_(
        cEstado >= 0 ? valores[r][cEstado] : ''
      );
      const llegada = cLlegada >= 0 ? text_(mostrados[r][cLlegada]) : '';
      const cierre = cCierre >= 0 ? text_(mostrados[r][cCierre]) : '';
      const reserva = cReserva >= 0 ? text_(mostrados[r][cReserva]) : '';

      // El camión está en patio mientras el libro no lo cierre, y
      // cerrarlo son dos cosas: la hora y el "OK". Se escriben en ese
      // orden —primero la hora—, así que mirar solo el estado va un
      // paso atrás, y mirar solo la hora deja afuera al que cerraron
      // sin anotarla. Con las dos basta que esté una.
      //
      // Lo que pase entremedio no lo anota nadie, así que el panel no
      // lo afirma: entró, y eso es lo que se cuenta.
      const enCurso = estado.indexOf('OK') !== 0 &&
        minutosDeHora_(cierre) < 0;

      if (enCurso) { salida.enCurso++; }

      const tramos = tramosDelCamion_(
        { llegada: llegada, cierre: cierre, reserva: reserva },
        -1
      );

      if (tramos.inconsistente) { salida.horasDudosas++; }

      if (!tramos.abierto && !tramos.inconsistente) {
        if (tramos.patio !== null) { patios.push(tramos.patio); }
        if (tramos.flujo !== null) { flujos.push(tramos.flujo); }
      }

      salida.rows.push({
        fecha: fecha,
        source: 'CAMIONES',
        guia: guia,
        subproducto: subproducto,
        subproductoRaw: producto,
        proveedor: cruce.proveedor,
        proveedorRaw: crudo,
        matchMethod: cruce.method,
        destino: cDestino >= 0 ? text_(valores[r][cDestino]) : '',
        camiones: 1,
        ts: factorDe_(subproducto),
        enCurso: enCurso,
        llegada: llegada,
        cierre: cierre,
        reserva: reserva,
        predio: '',
        rol: ''
      });

      if (!salida.primeraFecha || fecha < salida.primeraFecha) {
        salida.primeraFecha = fecha;
      }

      if (fecha > salida.ultimaFecha) { salida.ultimaFecha = fecha; }
    }
  });

  salida.demora = {
    patio: estadisticaDeMinutos_(patios),
    flujo: estadisticaDeMinutos_(flujos)
  };

  return salida;
}

/**
 * Qué camiones del libro NO están todavía en SAP.
 *
 * La llave es la guía MÁS el proveedor: el número de guía es la
 * correlativa de cada proveedor, así que dos proveedores distintos
 * pueden tener la guía 1312 y no son el mismo camión.
 *
 * Cuando el número está en SAP pero a nombre de otro proveedor hay dos
 * explicaciones —son camiones distintos, o es el mismo con el nombre
 * escrito de otra forma— y no se puede saber cuál. No se complementa:
 * contar un camión dos veces infla el ingreso y rompe el plan, que es
 * peor que mostrar uno de menos. Se cuenta aparte y el panel lo dice,
 * porque se arregla homologando ese nombre.
 */
function complementarCamiones_(ingresosRows, camionesRows) {
  const porGuiaYProveedor = {};
  const porGuia = {};

  (ingresosRows || []).forEach(function(row) {
    const guia = normalizaGuia_(row.guia);

    if (!guia) { return; }

    porGuia[guia] = true;
    porGuiaYProveedor[guia + '||' + normalizeKey_(row.proveedor)] = true;
  });

  const rows = [];
  const dudosos = {};
  let yaEnSap = 0;
  let porNumero = 0;

  (camionesRows || []).forEach(function(row) {
    const llave = row.guia + '||' + normalizeKey_(row.proveedor);

    if (porGuiaYProveedor[llave]) {
      yaEnSap++;
      return;
    }

    if (porGuia[row.guia]) {
      porNumero++;
      dudosos[row.proveedorRaw] = true;
      return;
    }

    rows.push(row);
  });

  return {
    rows: rows,
    yaEnSap: yaEnSap,
    porNumero: porNumero,
    dudosos: Object.keys(dudosos).sort(),
    camiones: rows.length,
    ts: round_(rows.reduce(function(total, row) {
      return total + (Number(row.ts) || 0);
    }, 0), 2)
  };
}

/**
 * Lo que de verdad pesa un camión, según SAP.
 *
 * Los factores con que se estima —15,2 el nitens, 10,7 el corteza, 11
 * el pino verde— son un acuerdo, no una medición, y el aserrín entró a
 * proceso sin que nadie dijera el suyo. SAP sí los mide: cada guía
 * cargada trae su peso real.
 *
 * Se cuentan guías distintas y no filas: la misma guía puede venir
 * partida en dos posiciones, y contarla dos veces bajaría el promedio
 * a la mitad.
 *
 * Esto no cambia ninguna cifra. Solo deja dicho cuánto se aparta el
 * factor configurado de la balanza, que es el número que hay que ir a
 * corregir en CONFIG.
 */
function factoresObservados_(ingresosRows) {
  const porSub = {};

  (ingresosRows || []).forEach(function(row) {
    const sub = text_(row.subproducto);
    const guia = normalizaGuia_(row.guia);

    if (!sub || !guia) { return; }

    if (!porSub[sub]) { porSub[sub] = { ts: 0, guias: {} }; }

    porSub[sub].ts += Number(row.ts) || 0;
    porSub[sub].guias[guia] = true;
  });

  return Object.keys(porSub).map(function(sub) {
    const camiones = Object.keys(porSub[sub].guias).length;
    const observado = camiones ? porSub[sub].ts / camiones : 0;
    const usado = factorDe_(sub);

    return {
      subproducto: sub,
      camiones: camiones,
      observado: round_(observado, 2),
      usado: usado,
      desvio: usado ? round_(observado / usado - 1, 3) : 0
    };
  }).filter(function(x) {
    // Con tres camiones el promedio dice cualquier cosa.
    return x.camiones >= 10;
  }).sort(function(a, b) {
    return Math.abs(b.desvio) - Math.abs(a.desvio);
  });
}

/** El mes en curso y el anterior, como claves 'yyyy-MM'. */
function mesesDelLibro_(month) {
  const meses = [month.prefix];
  const d = new Date(Date.UTC(month.year, month.month - 2, 1));

  meses.push(
    d.getUTCFullYear() + '-' + ('0' + (d.getUTCMonth() + 1)).slice(-2)
  );

  return meses;
}


const FUENTES_HEADERS = Object.freeze([
  'Mes',
  'Libro de camiones',
  'Hoja',
  'Encontrado',
  'Notas'
]);

/**
 * Crea o repara la hoja Fuentes y deja escrito el libro del mes.
 *
 * El libro de camiones es de otra área y cambia de archivo cada mes.
 * El panel lo busca solo por el nombre, pero esa búsqueda depende de
 * que el archivo se siga llamando parecido. Esta hoja es el respaldo y
 * también la ventana: se ve cuál está usando el panel y se puede fijar
 * otro pegando su enlace.
 */
function instalarFuentes() {
  const spreadsheet = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);

  let sheet = spreadsheet.getSheetByName(CONFIG.SHEET_FUENTES);

  if (!sheet) {
    sheet = spreadsheet.insertSheet(CONFIG.SHEET_FUENTES);
  }

  sheet
    .getRange(1, 1, 1, FUENTES_HEADERS.length)
    .setValues([FUENTES_HEADERS])
    .setBackground('#121C17')
    .setFontColor('#B5793F')
    .setFontWeight('bold');

  sheet.setFrozenRows(1);

  [110, 420, 180, 140, 380].forEach(function(ancho, indice) {
    sheet.setColumnWidth(indice + 1, ancho);
  });

  const encontrado = buscarLibroDelMes();

  try {
    SpreadsheetApp.getUi().alert(
      'Hoja "' + CONFIG.SHEET_FUENTES + '" lista.\n\n' +
      encontrado.mensaje + '\n\n' +
      'Cada mes aparece un libro nuevo. El panel lo busca solo por su ' +
      'nombre; si algún mes no lo encuentra, pega acá el enlace del ' +
      'archivo en la fila de ese mes y listo.'
    );
  } catch (ignoredUi) {}

  return encontrado;
}

/**
 * Busca el libro del mes en Drive y lo deja escrito en Fuentes.
 *
 * Se salta el caché a propósito: esto es justamente lo que hay que
 * correr cuando el libro cambió de nombre o apareció el del mes nuevo.
 */
function buscarLibroDelMes() {
  const spreadsheet = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
  const timezone =
    spreadsheet.getSpreadsheetTimeZone() || CONFIG.TIMEZONE;
  const mes = getCurrentMonthWindow_(timezone).prefix;

  CacheService.getScriptCache().remove('libro-camiones-' + mes);

  const hallado = buscarLibroEnDrive_(mes);

  if (!hallado) {
    return {
      mes: mes,
      encontrado: false,
      mensaje: 'No encontré ningún archivo con "' +
        CONFIG.CAMIONES.PATRON + '" en el nombre para ' +
        nombreDelMes_(mes) + ' ' + mes.slice(0, 4) + '. ' +
        'Pega el enlace del libro en la hoja ' + CONFIG.SHEET_FUENTES +
        ', en la fila de ese mes.'
    };
  }

  const libro = SpreadsheetApp.openById(hallado.id);
  const hoja = hojaDeCamiones_(libro, mes, '');

  escribirFuente_(spreadsheet, mes, {
    id: hallado.id,
    nombre: libro.getName(),
    url: libro.getUrl(),
    hoja: hoja ? hoja.getName() : ''
  });

  return {
    mes: mes,
    encontrado: true,
    id: hallado.id,
    nombre: libro.getName(),
    hoja: hoja ? hoja.getName() : '',
    mensaje: 'Libro de ' + nombreDelMes_(mes) + ': "' + libro.getName() +
      '"' + (hoja ? ', pestaña "' + hoja.getName() + '"' : '') + '.'
  };
}

/** Escribe (o actualiza) la fila de un mes en la hoja Fuentes. */
function escribirFuente_(spreadsheet, mes, libro) {
  let sheet = spreadsheet.getSheetByName(CONFIG.SHEET_FUENTES);

  if (!sheet) {
    sheet = spreadsheet.insertSheet(CONFIG.SHEET_FUENTES);

    sheet
      .getRange(1, 1, 1, FUENTES_HEADERS.length)
      .setValues([FUENTES_HEADERS]);
  }

  const valores = sheet.getDataRange().getValues();
  let fila = 0;

  for (let i = 1; i < valores.length; i++) {
    if (claveDeMes_(valores[i][0]) === mes) { fila = i + 1; break; }
  }

  if (!fila) { fila = Math.max(sheet.getLastRow(), 1) + 1; }

  sheet.getRange(fila, 1, 1, FUENTES_HEADERS.length).setValues([[
    nombreDelMes_(mes) + ' ' + mes.slice(0, 4),
    libro.url || libro.id,
    libro.hoja || '',
    new Date(),
    libro.nombre || ''
  ]]);

  return fila;
}


/* =====================================================================
 * EL DÍA EN CURSO
 *
 * El libro de camiones se escribe mientras pasa el día, así que por
 * primera vez se puede responder lo que antes había que esperar al
 * correo de la noche: qué entró hoy, camión por camión, y cómo va a
 * cerrar el día si sigue a este ritmo.
 *
 * La planta recibe entre las 08:30 y las 23:00. Esa jornada es lo que
 * convierte "llevamos 14 camiones" en "vamos a cerrar con 22": sin
 * saber cuánto falta para cerrar, el número de media mañana no dice
 * nada.
 * ===================================================================== */

/** Minutos desde medianoche de un 'HH:MM'. -1 si no se entiende. */
function minutosDeHora_(valor) {
  const m = String(valor === null || valor === undefined ? '' : valor)
    .trim()
    .match(/^(\d{1,2})\D{1,3}(\d{2})(?!\d)/);

  if (!m) { return -1; }

  const hora = Number(m[1]);
  const minuto = Number(m[2]);

  if (hora > 23 || minuto > 59) { return -1; }

  return hora * 60 + minuto;
}

/**
 * Los tramos del camión, en minutos.
 *
 * El libro anota cuatro horas y tres sirven para medir: la que se le
 * reservó, la de llegada y la del cierre. Con esas:
 *
 *   agenda = llegada − reserva   negativo es llegar antes de su hora
 *   patio  = cierre  − llegada   lo que estuvo adentro
 *   flujo  = cierre  − reserva   desde que tenía hora hasta que salió
 *
 * El flujo puede ser negativo y no es un error: el camión llegó antes
 * de su hora y alcanzó a salir antes también.
 *
 * Sin cierre el camión sigue adentro. Se mide contra la hora de ahora
 * y queda marcado como abierto, que es distinto de un tramo cerrado:
 * a ese todavía le falta. Con `ahora` en −1 no se mide, que es lo que
 * conviene para el mes entero, donde "ahora" no significa nada.
 *
 * Un cierre anterior a la llegada no es un camión que salió antes de
 * entrar: es la hora escrita al revés. No se arregla ni se recorta a
 * cero —eso sería inventar el dato—: se marca y no entra en ninguna
 * cuenta.
 */
function tramosDelCamion_(fila, ahora) {
  const reserva = minutosDeHora_(fila.reserva);
  const llegada = minutosDeHora_(fila.llegada);
  const cierre = minutosDeHora_(fila.cierre);
  const abierto = cierre < 0;
  const hasta = abierto ? (ahora >= 0 ? ahora : -1) : cierre;

  const salida = {
    abierto: abierto,
    inconsistente: false,
    agenda: null,
    patio: null,
    flujo: null
  };

  if (llegada >= 0 && reserva >= 0) { salida.agenda = llegada - reserva; }

  if (hasta < 0) { return salida; }

  if (llegada >= 0) {
    if (hasta < llegada) {
      salida.inconsistente = true;
      return salida;
    }

    salida.patio = hasta - llegada;
  }

  if (reserva >= 0) { salida.flujo = hasta - reserva; }

  return salida;
}

/**
 * Mediana, p90 y máximo de una lista de minutos.
 *
 * La mediana y no el promedio: un camión que esperó siete horas y
 * media —y hay uno así— mueve el promedio y no mueve la mediana, y lo
 * que se quiere saber es cuánto demora un camión normal. El p90 y el
 * máximo van al lado para que el caso raro no desaparezca.
 */
function estadisticaDeMinutos_(valores) {
  const lista = (valores || []).filter(function(x) {
    return typeof x === 'number' && isFinite(x);
  }).sort(function(a, b) { return a - b; });

  if (!lista.length) {
    return { n: 0, mediana: null, p90: null, max: null };
  }

  const medio = Math.floor(lista.length / 2);

  return {
    n: lista.length,
    mediana: lista.length % 2
      ? lista[medio]
      : Math.round((lista[medio - 1] + lista[medio]) / 2),
    p90: lista[Math.min(lista.length - 1, Math.ceil(lista.length * 0.9) - 1)],
    max: lista[lista.length - 1]
  };
}

/** La hora de ahora en la planta, en minutos. */
function ahoraEnMinutos_(timezone) {
  return minutosDeHora_(
    Utilities.formatDate(
      new Date(),
      timezone || CONFIG.TIMEZONE,
      'HH:mm'
    )
  );
}

/**
 * Lo que entró hoy, y con qué va a cerrar el día.
 *
 * La proyección es una regla de tres sobre la jornada: si en las
 * primeras horas entraron N camiones, al cierre entrarán los que da
 * ese mismo ritmo. No pretende ser un pronóstico —los camiones no
 * llegan parejo— y por eso se dice "a este ritmo" y no "van a entrar".
 *
 * Antes de hora y media no se proyecta: con dos camiones a las nueve
 * de la mañana, la regla de tres dice cualquier cosa.
 */
function resumenDelDia_(
  camionesRows,
  ingresosRows,
  hoy,
  timezone,
  ahoraFijo
) {
  const enSap = {};

  (ingresosRows || []).forEach(function(row) {
    const guia = normalizaGuia_(row.guia);

    if (guia) {
      enSap[guia + '||' + normalizeKey_(row.proveedor)] = true;
    }
  });

  // La hora de ahora, salvo cuando se está rehaciendo un día que ya
  // terminó: ahí "ahora" no significa nada —son las dos de la mañana
  // del día siguiente— y al camión sin hora de cierre no se le puede
  // medir el patio contra ella. Con −1 no se mide y se dice.
  const ahora = typeof ahoraFijo === 'number'
    ? ahoraFijo
    : ahoraEnMinutos_(timezone);

  const filas = (camionesRows || []).filter(function(row) {
    return row.fecha === hoy;
  }).map(function(row) {
    const tramos = tramosDelCamion_(row, ahora);

    return {
      hora: row.llegada || '',
      cierre: row.cierre || '',
      reserva: row.reserva || '',
      minutos: minutosDeHora_(row.llegada),
      // Cuánto lleva: en patio, y desde que tenía hora reservada. Si
      // sigue adentro se mide contra la hora de ahora y se dice.
      agenda: tramos.agenda,
      patio: tramos.patio,
      flujo: tramos.flujo,
      abierto: tramos.abierto,
      horaDudosa: tramos.inconsistente,
      guia: row.guia,
      proveedor: row.proveedor,
      proveedorRaw: row.proveedorRaw,
      subproducto: row.subproducto,
      destino: row.destino,
      ts: row.ts,
      enCurso: !!row.enCurso,
      // Ya cargado en SAP con su peso real. Hoy casi nunca pasa —SAP
      // va días atrás— pero cuando pasa conviene verlo.
      enSap: !!enSap[row.guia + '||' + normalizeKey_(row.proveedor)]
    };
  }).sort(function(a, b) {
    return (b.minutos || 0) - (a.minutos || 0);
  });

  const porSub = {};

  filas.forEach(function(fila) {
    if (!porSub[fila.subproducto]) {
      porSub[fila.subproducto] = {
        camiones: 0, ts: 0, enCurso: 0, patios: []
      };
    }

    porSub[fila.subproducto].camiones++;
    porSub[fila.subproducto].ts += Number(fila.ts) || 0;

    if (fila.enCurso) { porSub[fila.subproducto].enCurso++; }

    if (!fila.abierto && !fila.horaDudosa && fila.patio !== null) {
      porSub[fila.subproducto].patios.push(fila.patio);
    }
  });

  // La demora se mide sobre los que ya cerraron: al que sigue en
  // patio todavía le falta, y meterlo en la mediana la tiraría para
  // abajo justo cuando más interesa saberla.
  const cerrados = filas.filter(function(f) {
    return !f.abierto && !f.horaDudosa;
  });

  const abiertos = filas.filter(function(f) {
    return f.abierto && f.patio !== null;
  }).sort(function(a, b) { return b.patio - a.patio; });

  const demora = {
    patio: estadisticaDeMinutos_(cerrados.map(function(f) {
      return f.patio;
    })),
    flujo: estadisticaDeMinutos_(cerrados.map(function(f) {
      return f.flujo;
    })),
    horasDudosas: filas.filter(function(f) { return f.horaDudosa; }).length,
    // El que lleva más rato adentro ahora mismo. Es el único número
    // de aquí que se puede ir a buscar al patio.
    masLargo: abiertos.length
      ? {
          minutos: abiertos[0].patio,
          proveedor: abiertos[0].proveedor,
          guia: abiertos[0].guia,
          subproducto: abiertos[0].subproducto
        }
      : null
  };

  const desde = minutosDeHora_(CONFIG.JORNADA.DESDE);
  const hasta = minutosDeHora_(CONFIG.JORNADA.HASTA);
  const jornada = Math.max(1, hasta - desde);
  const transcurridos = Math.max(0, Math.min(jornada, ahora - desde));

  // Antes de hora y media, o después de cerrar, no hay regla de tres
  // que valga: en el primer caso porque no hay con qué, en el segundo
  // porque el día ya está.
  const alRitmo = transcurridos >= 90 && transcurridos < jornada;
  const factor = alRitmo ? jornada / transcurridos : 1;

  // Y la otra forma de proyectar: contra cómo cae un día normal en vez
  // de contra una recta. A las 11 de la mañana ya pasó bastante más
  // que un quinto del día, y la recta no lo sabe.
  const perfil = perfilHorario_(camionesRows, hoy);
  const parte = parteDelDia_(perfil, ahora);

  const porPerfil = parte !== null &&
    parte >= CONFIG.PERFIL.MINIMA_PARTE &&
    transcurridos > 0 &&
    transcurridos < jornada
      ? filas.length / parte
      : null;

  const subproductos = Object.keys(porSub).sort().map(function(sub) {
    return {
      subproducto: sub,
      camiones: porSub[sub].camiones,
      // Los que de esos siguen en patio ahora. Cada tarjeta de arriba
      // muestra su propia cifra repartida por material, y esta es la
      // que le toca a "en patio".
      enCurso: porSub[sub].enCurso,
      ts: round_(porSub[sub].ts, 2),
      camionesCierre: Math.round(porSub[sub].camiones * factor),
      tsCierre: round_(porSub[sub].ts * factor, 2),
      patio: estadisticaDeMinutos_(porSub[sub].patios).mediana
    };
  });

  const camiones = filas.length;
  const ts = filas.reduce(function(total, fila) {
    return total + (Number(fila.ts) || 0);
  }, 0);

  // Cómo va cayendo el día hora por hora, al lado de cómo cae uno
  // normal. Es lo que explica por qué la proyección sube o baja: no
  // es lo mismo ir corto a las nueve que ir corto a las seis.
  const horas = {};

  filas.forEach(function(fila) {
    const minutos = minutosDeHora_(fila.hora);

    if (minutos < 0) { return; }

    const h = Math.floor(minutos / 60);

    if (!horas[h]) { horas[h] = { camiones: 0, ts: 0, patios: [] }; }

    horas[h].camiones++;
    horas[h].ts += Number(fila.ts) || 0;

    if (!fila.abierto && !fila.horaDudosa && fila.patio !== null) {
      horas[h].patios.push(fila.patio);
    }
  });

  const conDato = Object.keys(horas).map(Number);
  const primeraHora = Math.min.apply(
    null, [Math.floor(desde / 60)].concat(conDato)
  );
  const ultimaHora = Math.max.apply(
    null, [Math.floor(hasta / 60)].concat(conDato)
  );

  const porHora = [];

  for (let h = primeraHora; h <= ultimaHora; h++) {
    const dato = horas[h] || { camiones: 0, ts: 0, patios: [] };
    const suParte = perfil.horas[h] ? perfil.horas[h].parte : 0;

    porHora.push({
      hora: h,
      camiones: dato.camiones,
      ts: round_(dato.ts, 2),
      patio: estadisticaDeMinutos_(dato.patios).mediana,
      // Qué parte del día trae esta hora normalmente.
      parte: suParte,
      // Y cuántos camiones serían, en un día del tamaño que se
      // proyecta. Sin proyección no hay con qué comparar.
      esperado: porPerfil === null ? null : round_(porPerfil * suParte, 1),
      // Si esta hora ya pasó: la que está corriendo no se juzga.
      corrida: (h + 1) * 60 <= ahora
    });
  }

  return {
    fecha: hoy,
    fechaLabel: formatDateKey_(hoy),
    filas: filas,
    camiones: camiones,
    ts: round_(ts, 2),
    enCurso: filas.filter(function(f) { return f.enCurso; }).length,
    enSap: filas.filter(function(f) { return f.enSap; }).length,
    demora: demora,
    // En qué se va el tiempo: cuántos salen rápido y cuántos se quedan.
    demoraTramos: tramosDeDemora_(cerrados.map(function(f) {
      return f.patio;
    })),
    perfil: perfil,
    porHora: porHora,
    porSubproducto: subproductos,
    jornada: {
      desde: CONFIG.JORNADA.DESDE,
      hasta: CONFIG.JORNADA.HASTA,
      minutos: jornada,
      transcurridos: transcurridos,
      parte: round_(transcurridos / jornada, 4),
      abierta: transcurridos > 0 && transcurridos < jornada
    },
    cierre: {
      alRitmo: alRitmo,
      camiones: Math.round(camiones * factor),
      ts: round_(ts * factor, 2),
      // Cuántos faltarían por entrar de aquí al cierre.
      faltan: Math.max(0, Math.round(camiones * factor) - camiones),
      // Lo mismo, contra la forma del día. Es el número bueno cuando
      // hay con qué calcularlo; la recta queda al lado para poder ver
      // cuánto se equivocaba.
      perfil: {
        hay: porPerfil !== null,
        parte: parte,
        dias: perfil.dias,
        camiones: porPerfil === null ? null : Math.round(porPerfil),
        ts: porPerfil === null ? null : round_(ts / parte, 2),
        faltan: porPerfil === null
          ? null
          : Math.max(0, Math.round(porPerfil) - camiones)
      }
    }
  };
}

/**
 * Cuántos camiones hacen falta para cumplir el plan de cada material.
 *
 * El plan está en toneladas y la planta se maneja en camiones, así que
 * la pregunta de todos los días —«¿cuántos camiones tengo que pedir?»—
 * obligaba a dividir de cabeza. Esto lo deja escrito: lo que falta del
 * plan, en camiones, y repartido en los días hábiles que quedan.
 *
 * El ritmo que el plan pedía desde el primer día va al lado a
 * propósito: sin él no se sabe si el número de hoy es el de siempre o
 * uno que se disparó porque el mes viene atrasado.
 */
function camionesDelPlan_(planDetails, rows, month, workdays) {
  const porSub = {};

  SUBPRODUCTOS_OBJETIVO.forEach(function(sub) {
    porSub[sub] = { planTs: 0, tsMes: 0, filas: 0 };
  });

  (planDetails || []).forEach(function(item) {
    if (!porSub[item.subproducto]) { return; }

    // Las filas se cuentan aunque no traigan toneladas. Un material
    // escrito en el Plan con la celda del mes en blanco no es lo mismo
    // que uno que no está en el Plan: el primero es un plan que falta
    // llenar, y mostrarlo en cero diría que su compromiso es cero.
    porSub[item.subproducto].filas++;
    porSub[item.subproducto].planTs += Number(item.plan) || 0;
  });

  (rows || []).forEach(function(row) {
    if (String(row.fecha).slice(0, 7) !== month.prefix) { return; }
    if (!porSub[row.subproducto]) { return; }

    porSub[row.subproducto].tsMes += Number(row.ts) || 0;
  });

  const dias = Math.max(0, workdays.remaining || 0);

  return SUBPRODUCTOS_OBJETIVO.map(function(sub) {
    const item = porSub[sub];
    const factor = factorDe_(sub);
    const camionesPlan = factor ? item.planTs / factor : 0;
    const camionesMes = factor ? item.tsMes / factor : 0;
    const faltan = Math.max(0, camionesPlan - camionesMes);

    return {
      subproducto: sub,
      factor: factor,
      // Está escrito en el Plan, pero sin toneladas para este mes.
      sinPlan: item.filas > 0 && item.planTs <= 0,
      filasPlan: item.filas,
      planTs: round_(item.planTs, 2),
      tsMes: round_(item.tsMes, 2),
      camionesPlan: Math.round(camionesPlan),
      camionesMes: Math.round(camionesMes),
      faltan: Math.round(faltan),
      diasRestantes: dias,
      // El número que se iba a buscar: camiones por día hábil de aquí
      // al cierre del mes.
      porDia: dias ? round_(faltan / dias, 1) : 0,
      // Y el que el plan pedía desde el principio.
      porDiaPlan: workdays.total
        ? round_(camionesPlan / workdays.total, 1)
        : 0,
      cumple: camionesPlan > 0
        ? round_(camionesMes / camionesPlan, 4)
        : null
    };
  }).filter(function(x) {
    return x.planTs > 0 || x.camionesMes > 0 || x.filasPlan > 0;
  });
}

/* =====================================================================
 * EL ARCHIVO DEL DÍA
 *
 * El panel de "Hoy" se vacía solo a medianoche: muestra las filas cuya
 * fecha es la de hoy en la planta, y a las doce esa fecha es otra. Lo
 * que se vio ayer no se pierde —sigue en el libro de la portería—,
 * pero ese libro es ajeno y cambia de archivo cada mes: a fin de año no
 * queda nada propio con qué mirar atrás.
 *
 * Esto deja la copia. Un archivo de Excel por día, dentro de una
 * carpeta por mes, en una carpeta de Drive nuestra. Lo que el panel
 * mostró en pantalla queda escrito con las horas y los tramos de cada
 * camión, y la demora de un martes de marzo se puede ir a buscar dos
 * años después.
 * ===================================================================== */

const ARCHIVO_COLUMNAS = Object.freeze([
  'Fecha',
  'Llegó',
  'Salió',
  'Reservada',
  'Agenda (min)',
  'En patio (min)',
  'Desde la reserva (min)',
  'Guía',
  'Proveedor',
  'Como lo escribe la portería',
  'Material',
  'Destino',
  'TS',
  'Estado',
  'Observación'
]);

/**
 * Lo mismo que queda en el registro, dicho en pantalla.
 *
 * Desde el menú de la planilla hay alguien mirando y conviene el
 * cartel; desde un disparador no hay nadie y getUi() revienta. Por eso
 * el try: el aviso es un extra, no el resultado.
 */
function avisarEnPantalla_(mensaje) {
  try {
    SpreadsheetApp.getUi().alert(mensaje);
  } catch (sinPantalla) {}
}

/** El día anterior a una clave 'yyyy-MM-dd'. */
function diaAnterior_(clave) {
  const p = String(clave).split('-');
  const d = new Date(Date.UTC(Number(p[0]), Number(p[1]) - 1, Number(p[2])));

  d.setUTCDate(d.getUTCDate() - 1);

  return d.getUTCFullYear() + '-' +
    ('0' + (d.getUTCMonth() + 1)).slice(-2) + '-' +
    ('0' + d.getUTCDate()).slice(-2);
}

/**
 * La carpeta del mes, dentro de la carpeta del registro.
 *
 * El nombre empieza por la clave del mes —"2026-11 NOVIEMBRE"— para
 * que Drive las ordene por fecha. Con solo el nombre del mes quedarían
 * en orden alfabético, ABRIL antes que ENERO, que no le sirve a nadie.
 */
function carpetaDelMes_(mesPrefijo) {
  const id = idDeEnlace_(CONFIG.ARCHIVO.CARPETA);

  if (!id) {
    throw new Error(
      'CONFIG.ARCHIVO.CARPETA no trae el enlace de ninguna carpeta de ' +
      'Drive.'
    );
  }

  const raiz = DriveApp.getFolderById(id);
  const nombre = mesPrefijo + ' ' + nombreDelMes_(mesPrefijo);
  const hallada = raiz.getFoldersByName(nombre);

  return hallada.hasNext() ? hallada.next() : raiz.createFolder(nombre);
}

/**
 * Lo que hace falta para escribir uno o varios días de un mes.
 *
 * Se lee una vez y sirve para todo el mes: abrir el libro ajeno una vez
 * por día sería pagar veinte veces lo mismo.
 */
function contextoDeArchivo_(mesPrefijo) {
  const spreadsheet = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
  const timezone =
    spreadsheet.getSpreadsheetTimeZone() || CONFIG.TIMEZONE;
  const homologacion = leerProveedores_(spreadsheet);

  const ingresos = readIngresos_(
    spreadsheet,
    timezone,
    mesPrefijo + '-01',
    homologacion
  );

  const camiones = readCamiones_(
    spreadsheet,
    [mesPrefijo],
    ingresos.proveedores,
    homologacion,
    timezone
  );

  return {
    mes: mesPrefijo,
    timezone: timezone,
    ingresos: ingresos.rows,
    camiones: camiones.rows,
    carpeta: carpetaDelMes_(mesPrefijo),
    hoy: Utilities.formatDate(new Date(), timezone, 'yyyy-MM-dd')
  };
}

/** Un cero y un vacío no son lo mismo: el vacío es "no se midió". */
function celdaDeMinutos_(valor) {
  return valor === null || valor === undefined ? '' : valor;
}

/** Una fila por camión, con sus horas y sus tramos. */
function filasDelDia_(resumen) {
  return (resumen.filas || []).map(function(f) {
    return [
      resumen.fecha,
      f.hora || '',
      f.abierto ? '' : (f.cierre || ''),
      f.reserva || '',
      celdaDeMinutos_(f.agenda),
      celdaDeMinutos_(f.patio),
      celdaDeMinutos_(f.flujo),
      f.guia,
      f.proveedor,
      // Solo cuando la portería lo escribe distinto: repetir el mismo
      // nombre en dos columnas no informa nada.
      normalizeKey_(f.proveedor) === normalizeKey_(f.proveedorRaw)
        ? ''
        : f.proveedorRaw,
      f.subproducto,
      f.destino || '',
      f.ts,
      f.enSap ? 'EN INGRESOS' : (f.enCurso ? 'EN PATIO' : 'SALIÓ'),
      f.horaDudosa ? 'hora al revés' : ''
    ];
  });
}

/** El mismo resumen que muestran las tarjetas, en una hoja aparte. */
function filasDelResumen_(resumen) {
  const demora = resumen.demora || {};
  const patio = demora.patio || {};
  const flujo = demora.flujo || {};

  const filas = [
    ['Material', 'Camiones', 'TS', 'En patio mediana (min)']
  ];

  (resumen.porSubproducto || []).forEach(function(s) {
    filas.push([
      s.subproducto,
      s.camiones,
      s.ts,
      celdaDeMinutos_(s.patio)
    ]);
  });

  filas.push(['Total', resumen.camiones, resumen.ts, '']);
  filas.push(['', '', '', '']);
  filas.push(['La demora del día', '', '', '']);
  filas.push(['Camiones medidos', patio.n || 0, '', '']);
  filas.push(['En patio mediana (min)', celdaDeMinutos_(patio.mediana),
              '', '']);
  filas.push(['En patio p90 (min)', celdaDeMinutos_(patio.p90), '', '']);
  filas.push(['En patio el más largo (min)', celdaDeMinutos_(patio.max),
              '', '']);
  filas.push(['Desde la reserva mediana (min)',
              celdaDeMinutos_(flujo.mediana), '', '']);
  filas.push(['Sin cerrar', resumen.enCurso, '', '']);
  filas.push(['Horas escritas al revés', demora.horasDudosas || 0,
              '', '']);

  return filas;
}

/**
 * El libro, convertido a un archivo de Excel.
 *
 * Apps Script no sabe escribir .xlsx; lo que sabe es crear una hoja de
 * cálculo y pedirle a Drive que la convierta. De ahí el rodeo de la
 * hoja temporal, que se bota apenas sale el archivo.
 */
function exportarXlsx_(idLibro, nombre) {
  const respuesta = UrlFetchApp.fetch(
    'https://docs.google.com/spreadsheets/d/' + idLibro +
      '/export?format=xlsx',
    {
      headers: { Authorization: 'Bearer ' + ScriptApp.getOAuthToken() },
      muteHttpExceptions: true
    }
  );

  if (respuesta.getResponseCode() !== 200) {
    throw new Error(
      'Drive no convirtió la hoja a Excel (código ' +
      respuesta.getResponseCode() + ').'
    );
  }

  return respuesta.getBlob().setName(nombre);
}

/** Escribe un día en la carpeta del mes y devuelve qué quedó. */
function escribirDiaEnDrive_(ctx, fecha) {
  const resumen = resumenDelDia_(
    ctx.camiones,
    ctx.ingresos,
    fecha,
    ctx.timezone,
    // El día de hoy todavía corre y al que está en patio se le puede
    // medir contra la hora de ahora. Un día ya cerrado no.
    fecha === ctx.hoy ? undefined : -1
  );

  // Un domingo sin camiones no necesita un archivo vacío.
  if (!resumen.filas.length) {
    return { fecha: fecha, camiones: 0, archivo: '', url: '' };
  }

  const nombre = CONFIG.ARCHIVO.PREFIJO + ' ' + fecha;
  const temporal = SpreadsheetApp.create(nombre);

  try {
    const detalle = temporal.getSheets()[0].setName('Camiones');
    const filas = filasDelDia_(resumen);

    detalle
      .getRange(1, 1, 1, ARCHIVO_COLUMNAS.length)
      .setValues([ARCHIVO_COLUMNAS])
      .setFontWeight('bold');

    detalle
      .getRange(2, 1, filas.length, ARCHIVO_COLUMNAS.length)
      .setValues(filas);

    detalle.setFrozenRows(1);

    const resumenFilas = filasDelResumen_(resumen);
    const hoja = temporal.insertSheet('Resumen');

    hoja.getRange(1, 1, resumenFilas.length, 4).setValues(resumenFilas);
    hoja.getRange(1, 1, 1, 4).setFontWeight('bold');

    SpreadsheetApp.flush();

    const blob = exportarXlsx_(temporal.getId(), nombre + '.xlsx');
    const previos = ctx.carpeta.getFilesByName(nombre + '.xlsx');

    // Rehacer un día ya archivado lo reemplaza. Si se corrigió algo,
    // lo que tiene que quedar guardado es lo corregido, no las dos
    // versiones una al lado de la otra.
    while (previos.hasNext()) { previos.next().setTrashed(true); }

    const archivo = ctx.carpeta.createFile(blob);

    return {
      fecha: fecha,
      camiones: resumen.filas.length,
      archivo: archivo.getName(),
      url: archivo.getUrl()
    };
  } finally {
    DriveApp.getFileById(temporal.getId()).setTrashed(true);
  }
}

/**
 * Guarda un día en Drive. Sin fecha, el de ayer.
 */
function archivarDia(fechaClave) {
  const fecha = text_(fechaClave) ||
    diaAnterior_(
      Utilities.formatDate(new Date(), CONFIG.TIMEZONE, 'yyyy-MM-dd')
    );

  const hecho = escribirDiaEnDrive_(
    contextoDeArchivo_(fecha.slice(0, 7)),
    fecha
  );

  const mensaje = hecho.camiones
    ? 'Guardado: ' + hecho.archivo + '\n\n' + hecho.camiones +
      ' camiones\n' + hecho.url
    : 'El ' + fecha + ' no trae camiones de proceso, así que no se ' +
      'escribió ningún archivo.';

  Logger.log(mensaje);
  avisarEnPantalla_(mensaje);

  return hecho;
}

/**
 * Qué días guarda la corrida de la noche: el que termina y el anterior.
 *
 * El de ayer se rehace porque la portería a veces cierra una fila al
 * otro día, y porque el disparador puede caer a las 23:15 —Apps Script
 * no deja fijar el minuto exacto— y dejar afuera al último camión.
 * Reescribir cuesta lo mismo que no hacerlo, y el archivo de ayer
 * queda completo a más tardar esta noche.
 */
function diasDelCierre_(hoy) {
  return [hoy, diaAnterior_(hoy)];
}

/**
 * Guarda el día de hoy, tal como va hasta este minuto.
 *
 * Existe porque `archivarDia` sin fecha guarda el de AYER —es lo que
 * necesita el disparador de la noche— y desde el menú eso sorprende:
 * uno aprieta a las once de la mañana del 23 y le aparece un archivo
 * del 22. Esto guarda el día que está corriendo, con los camiones que
 * lleven entrados y los que estén en patio en este momento.
 *
 * Se puede apretar las veces que sea: reemplaza el archivo del día, no
 * lo duplica, y a las 23:45 se vuelve a escribir solo con el día ya
 * completo.
 */
function archivarHoy() {
  return archivarDia(
    Utilities.formatDate(new Date(), CONFIG.TIMEZONE, 'yyyy-MM-dd')
  );
}

/**
 * A qué hora llegan los camiones en un día normal.
 *
 * El día no es parejo: hay una punta en la mañana, baja al mediodía y
 * vuelve a subir. Por eso la regla de tres de "lleva 20 a las 11, a
 * este ritmo cierra con 60" miente: a las 11 ya pasó la mitad de la
 * mañana, no un tercio del día.
 *
 * Esto mira los días anteriores del libro y arma la forma: qué parte
 * del día entra en cada hora. Después, saber qué parte del día
 * típico ya pasó convierte lo que va entrado en un cierre.
 *
 * Se promedian las PARTES de cada día, no los camiones: así un martes
 * de cuarenta camiones y un sábado de diez pesan lo mismo en la forma.
 * Lo que pesa es cómo se reparte el día, no cuánto trajo.
 */
function perfilHorario_(camionesRows, hoy) {
  const porDia = {};

  (camionesRows || []).forEach(function(row) {
    if (!row.fecha || row.fecha >= hoy) { return; }

    const minutos = minutosDeHora_(row.llegada);

    if (minutos < 0) { return; }

    const hora = Math.floor(minutos / 60);

    if (!porDia[row.fecha]) { porDia[row.fecha] = { total: 0, horas: {} }; }

    porDia[row.fecha].total++;
    porDia[row.fecha].horas[hora] = (porDia[row.fecha].horas[hora] || 0) + 1;
  });

  const dias = Object.keys(porDia).filter(function(fecha) {
    return porDia[fecha].total >= CONFIG.PERFIL.MINIMO_CAMIONES;
  }).sort();

  const horas = [];
  let acumulado = 0;

  for (let h = 0; h < 24; h++) {
    let suma = 0;

    dias.forEach(function(fecha) {
      suma += (porDia[fecha].horas[h] || 0) / porDia[fecha].total;
    });

    const parte = dias.length ? suma / dias.length : 0;

    acumulado += parte;

    horas.push({
      hora: h,
      parte: round_(parte, 4),
      acumulado: round_(Math.min(1, acumulado), 4)
    });
  }

  // Las horas que concentran el movimiento. No es curiosidad: es a qué
  // hora conviene tener gente en la romana.
  const punta = horas.slice().sort(function(a, b) {
    return b.parte - a.parte;
  }).slice(0, CONFIG.PERFIL.HORAS_PUNTA).filter(function(x) {
    return x.parte > 0;
  });

  return {
    dias: dias.length,
    desde: dias[0] || '',
    hasta: dias[dias.length - 1] || '',
    horas: horas,
    punta: punta.map(function(x) { return x.hora; }).sort(function(a, b) {
      return a - b;
    }),
    parteEnPunta: round_(punta.reduce(function(t, x) {
      return t + x.parte;
    }, 0), 4)
  };
}

/**
 * Qué parte del día típico ya pasó a esta hora.
 *
 * Dentro de la hora en curso se reparte parejo: no hay con qué afinar
 * más, y para una proyección que se mira cada media hora sobra.
 */
function parteDelDia_(perfil, minutos) {
  if (!perfil || !perfil.dias || minutos < 0) { return null; }

  const hora = Math.floor(minutos / 60);
  const dentro = (minutos % 60) / 60;
  let acumulado = 0;

  for (let h = 0; h <= hora && h < 24; h++) {
    const parte = perfil.horas[h] ? perfil.horas[h].parte : 0;

    acumulado += h === hora ? parte * dentro : parte;
  }

  return round_(Math.min(1, acumulado), 4);
}

/**
 * En qué tramos cae la demora. El último es abierto a propósito: lo
 * que importa de un camión de cinco horas no es que sean cinco.
 */
const TRAMOS_DEMORA = Object.freeze([
  { hasta: 15, nombre: 'hasta 15′' },
  { hasta: 30, nombre: '15 a 30′' },
  { hasta: 60, nombre: '30′ a 1h' },
  { hasta: 120, nombre: '1 a 2h' },
  { hasta: null, nombre: 'más de 2h' }
]);

function tramosDeDemora_(valores) {
  const lista = (valores || []).filter(function(x) {
    return typeof x === 'number' && isFinite(x);
  });

  // Arranca en −1 para que un camión de cero minutos caiga en el
  // primer tramo y no se pierda entre dos.
  let desde = -1;

  return TRAMOS_DEMORA.map(function(tramo) {
    const camiones = lista.filter(function(v) {
      return v > desde && (tramo.hasta === null || v <= tramo.hasta);
    }).length;

    if (tramo.hasta !== null) { desde = tramo.hasta; }

    return {
      nombre: tramo.nombre,
      camiones: camiones,
      parte: lista.length ? round_(camiones / lista.length, 4) : 0
    };
  });
}

/**
 * Cuál es el día que terminó, visto desde la hora en que se pregunta.
 *
 * El disparador sale a las 23:45, pero Apps Script no promete el
 * minuto: puede salir 23:59 y, si la lectura se demora, la fecha ya
 * cambió cuando se calcula. Sin esto guardaría el día recién
 * empezado —vacío— y dejaría sin archivo el que se quería guardar.
 *
 * El corte es el mediodía, que es de sobra: una corrida nocturna nunca
 * cae en la mañana, y una que sí caiga ahí —a mano, al día
 * siguiente— también quiere el día anterior.
 */
function diaQueTermina_(fecha, hora) {
  return String(hora) < '12:00' ? diaAnterior_(fecha) : fecha;
}

/**
 * Lo que corre el disparador cada noche, al cerrar la jornada.
 */
function archivarCierreDelDia() {
  const ahora = Utilities.formatDate(
    new Date(),
    CONFIG.TIMEZONE,
    'yyyy-MM-dd HH:mm'
  );

  const cierra = diaQueTermina_(ahora.slice(0, 10), ahora.slice(11));

  return diasDelCierre_(cierra).map(function(fecha) {
    return archivarDia(fecha);
  });
}

/**
 * Guarda todos los días de un mes. Sin mes, el que corre.
 *
 * Es la forma de rehacer lo que haya que rehacer: cada día reemplaza
 * al archivo anterior del mismo día, así que correrlo dos veces no
 * duplica nada.
 */
function archivarMes(mesPrefijo) {
  const mes = text_(mesPrefijo) ||
    Utilities.formatDate(new Date(), CONFIG.TIMEZONE, 'yyyy-MM');

  const ctx = contextoDeArchivo_(mes);
  const dias = {};

  ctx.camiones.forEach(function(row) {
    if (String(row.fecha).slice(0, 7) === mes && row.fecha <= ctx.hoy) {
      dias[row.fecha] = true;
    }
  });

  const hechos = Object.keys(dias).sort().map(function(fecha) {
    return escribirDiaEnDrive_(ctx, fecha);
  });

  const mensaje = hechos.length
    ? 'Guardados ' + hechos.length + ' días de ' + mes + ':\n\n' +
      hechos.map(function(h) {
        return h.fecha + ' · ' + h.camiones + ' camiones';
      }).join('\n')
    : 'El libro de ' + mes + ' no trae ningún día con camiones de ' +
      'proceso.';

  Logger.log(mensaje);
  avisarEnPantalla_(mensaje);

  return hechos;
}

function instalarArchivoDiario() {
  eliminarArchivoDiario();

  ScriptApp
    .newTrigger('archivarCierreDelDia')
    .timeBased()
    .everyDays(1)
    .atHour(CONFIG.ARCHIVO.HORA)
    .nearMinute(CONFIG.ARCHIVO.MINUTO)
    .inTimezone(CONFIG.TIMEZONE)
    .create();

  const mensaje = 'Listo. Cada día alrededor de las ' +
    CONFIG.ARCHIVO.HORA + ':' +
    (CONFIG.ARCHIVO.MINUTO < 10 ? '0' : '') + CONFIG.ARCHIVO.MINUTO +
    ' se guarda en Drive el día que termina, y de paso se rehace el ' +
    'anterior por si la portería cerró una fila tarde.\n\n' +
    'Apps Script no deja fijar el minuto exacto: la ventana real es de ' +
    'unos quince minutos a cada lado.';

  Logger.log(mensaje);
  avisarEnPantalla_(mensaje);

  return mensaje;
}

function eliminarArchivoDiario() {
  let borrados = 0;

  ScriptApp.getProjectTriggers().forEach(function(trigger) {
    if (trigger.getHandlerFunction() === 'archivarCierreDelDia') {
      ScriptApp.deleteTrigger(trigger);
      borrados++;
    }
  });

  return borrados;
}

/* =====================================================================
 * QUÉ MATERIAL ES, Y SI VA A PROCESO
 * ===================================================================== */
/** El material en corto, para un cartel que se lee de una pasada. */
function subCorto_(subproducto) {
  const corto = {
    'ASTILLA EUCALYPTUS NITENS': 'nitens',
    'AST. PINO VERDE C/ CORTEZA': 'c/corteza',
    'ASTILLA PINO VERDE': 'pino verde',
    'ASERRÍN PINO VERDE': 'aserrín'
  };

  return corto[text_(subproducto)] || text_(subproducto);
}

/**
 * Toneladas secas por camión del material. Si el subproducto no está
 * en la tabla se usa el factor general, que es lo que había antes.
 */
function factorDe_(subproducto) {
  const clave = text_(subproducto);
  const tabla = CONFIG.FACTOR_POR_MATERIAL || {};

  return tabla[clave] || CONFIG.FACTOR_CAMION;
}

/**
 * ¿Este aserrín entra a proceso?
 *
 * El de pino verde sí; el combustible no —ese va a NEOMAS y no es
 * materia prima del tablero—.
 *
 * No se exige que diga "verde", y esa es la parte que importa: el
 * libro de la portería escribe "ASERRÍN PINO VERDE" pero SAP lo llama
 * "ASERRIN (TS)" a secas. Pedir la palabra dejaba fuera justo al lado
 * que trae el peso real. Lo que sí se descarta es la especie escrita:
 * un aserrín de álamo o de eucalipto no es este.
 */
function aserrinDeProceso_(key) {
  return key.indexOf('COMBUSTIBLE') === -1 &&
    key.indexOf('ALAMO') === -1 &&
    key.indexOf('EUCA') === -1 &&
    key.indexOf('NITENS') === -1;
}

function canonicalSubproducto_(value) {
  const key = normalizeKey_(value)
    .replace(/\//g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  if (!key || key.indexOf('TOTAL') === 0) {
    return '';
  }

  // El aserrín de pino verde entra a proceso igual que la astilla.
  if (/^(ASERRIN|ASERRINES)\b/.test(key)) {
    return aserrinDeProceso_(key) ? 'ASERRÍN PINO VERDE' : '';
  }

  if (!/^(AST|ASTILLA|ASTILLAS)\b/.test(key)) {
    return '';
  }

  if (key.indexOf('NITENS') !== -1) {
    return 'ASTILLA EUCALYPTUS NITENS';
  }

  if (key.indexOf('PINO VERDE') !== -1) {
    if (key.indexOf('COMBUSTIBLE') !== -1) {
      return '';
    }

    // "S/CORTEZA" queda como pino verde a secas.
    if (
      /\bS CORTEZA\b/.test(key) ||
      key.indexOf('SIN CORTEZA') !== -1
    ) {
      return 'ASTILLA PINO VERDE';
    }

    if (key.indexOf('CORTEZA') !== -1) {
      return 'AST. PINO VERDE C/ CORTEZA';
    }

    return 'ASTILLA PINO VERDE';
  }

  return '';
}

/* =====================================================================
 * HOJA DE DESTINO
 * ===================================================================== */

/* =====================================================================
 * DÍAS HÁBILES
 * ===================================================================== */

/**
 * Días hábiles.
 *
 * Devuelve DOS cosas que conviene no confundir:
 *
 *   total / elapsed / remaining  son del MES VIGENTE. Es lo que usa el
 *                                prorrateo del plan, que solo tiene
 *                                sentido dentro del mes.
 *   workdayKeys                  cubre TODA la ventana de historia. Es
 *                                el eje de los gráficos.
 *
 * Antes workdayKeys era también del mes: al pedir "el año", las tablas
 * mostraban nueve meses y el gráfico acumulado seguía dibujando solo
 * septiembre, sin decir por qué.
 */
function buildWorkdaysInfo_(
  timezone,
  month,
  lastActualDate,
  latestReportDate,
  historyStart
) {
  const todayKey = Utilities.formatDate(
    new Date(),
    timezone || CONFIG.TIMEZONE,
    'yyyy-MM-dd'
  );

  let referenceDate = latestReportDate || '';

  if (lastActualDate && lastActualDate > referenceDate) {
    referenceDate = lastActualDate;
  }

  if (!referenceDate || referenceDate > todayKey) {
    referenceDate = todayKey;
  }

  if (referenceDate > month.endKey) {
    referenceDate = month.endKey;
  }

  if (referenceDate < month.startKey) {
    referenceDate = month.startKey;
  }

  const holidays = {};

  CONFIG.FERIADOS.forEach(function(key) {
    holidays[key] = true;
  });

  // Del primer día de la historia al último del mes vigente.
  const desde = historyStart && historyStart < month.startKey
    ? historyStart
    : month.startKey;

  const partes = desde.split('-');
  const workdayKeys = [];

  let total = 0;
  let elapsed = 0;

  const cursor = new Date(
    Date.UTC(Number(partes[0]), Number(partes[1]) - 1, Number(partes[2]))
  );

  const fin = new Date(
    Date.UTC(
      month.year,
      month.month - 1,
      Number(month.endKey.split('-')[2])
    )
  );

  while (cursor.getTime() <= fin.getTime()) {
    const key = buildDateKey_(
      cursor.getUTCFullYear(),
      cursor.getUTCMonth() + 1,
      cursor.getUTCDate()
    );

    const esHabil =
      CONFIG.WORKDAYS.indexOf(cursor.getUTCDay()) !== -1 &&
      !holidays[key];

    if (esHabil) {
      workdayKeys.push(key);

      // El conteo del plan mira solo el mes vigente.
      if (key >= month.startKey) {
        total++;

        if (key <= referenceDate) {
          elapsed++;
        }
      }
    }

    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }

  return {
    todayKey: todayKey,
    referenceDate: referenceDate,
    referenceDateLabel: formatDateKey_(referenceDate),
    total: total,
    elapsed: elapsed,
    remaining: Math.max(0, total - elapsed),
    fraction: total ? round_(elapsed / total, 6) : 0,
    workdayKeys: workdayKeys
  };
}

/* =====================================================================
 * UTILIDADES
 * ===================================================================== */

function getCurrentMonthWindow_(timezone) {
  const prefix = Utilities.formatDate(
    new Date(),
    timezone || CONFIG.TIMEZONE,
    'yyyy-MM'
  );

  const parts = prefix.split('-');
  const year = Number(parts[0]);
  const month = Number(parts[1]);

  const lastDay = new Date(
    Date.UTC(year, month, 0)
  ).getUTCDate();

  const monthNames = [
    '', 'enero', 'febrero', 'marzo', 'abril', 'mayo',
    'junio', 'julio', 'agosto', 'septiembre',
    'octubre', 'noviembre', 'diciembre'
  ];

  return {
    prefix: prefix,
    year: year,
    month: month,
    startKey: buildDateKey_(year, month, 1),
    endKey: buildDateKey_(year, month, lastDay),
    label: monthNames[month] + ' de ' + year
  };
}

function buildHeaderMap_(headerRow) {
  const map = {};

  headerRow.forEach(function(value, index) {
    map[normalizeHeader_(value)] = index;
  });

  return map;
}

function toDateKey_(rawValue, displayValue, timezone) {
  if (
    rawValue instanceof Date &&
    !isNaN(rawValue.getTime())
  ) {
    return Utilities.formatDate(
      rawValue,
      timezone || CONFIG.TIMEZONE,
      'yyyy-MM-dd'
    );
  }

  const parsed =
    parseDateText_(displayValue) ||
    parseDateText_(rawValue);

  if (parsed) {
    return parsed;
  }

  if (
    typeof rawValue === 'number' &&
    isFinite(rawValue)
  ) {
    const date = new Date(
      Date.UTC(1899, 11, 30) +
      Math.round(rawValue * 86400000)
    );

    return buildDateKey_(
      date.getUTCFullYear(),
      date.getUTCMonth() + 1,
      date.getUTCDate()
    );
  }

  return '';
}

function parseDateText_(value) {
  const text = String(value || '').trim();

  if (!text) {
    return '';
  }

  let match = text.match(
    /^(\d{4})[-/](\d{1,2})[-/](\d{1,2})(?:[T\s].*)?$/
  );

  if (match) {
    return buildDateKey_(
      Number(match[1]),
      Number(match[2]),
      Number(match[3])
    );
  }

  match = text.match(
    /^(\d{1,2})[\/.\-](\d{1,2})[\/.\-](\d{4})(?:\s.*)?$/
  );

  if (match) {
    return buildDateKey_(
      Number(match[3]),
      Number(match[2]),
      Number(match[1])
    );
  }

  return '';
}

function buildDateKey_(year, month, day) {
  const date = new Date(Date.UTC(year, month - 1, day));

  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return '';
  }

  return [
    String(year).padStart(4, '0'),
    String(month).padStart(2, '0'),
    String(day).padStart(2, '0')
  ].join('-');
}

function dateKeyToLocalDate_(dateKey) {
  const parts = String(dateKey || '').split('-');

  if (parts.length !== 3) {
    return '';
  }

  return new Date(
    Number(parts[0]),
    Number(parts[1]) - 1,
    Number(parts[2])
  );
}

function formatDateKey_(dateKey) {
  const match = String(dateKey || '').match(
    /^(\d{4})-(\d{2})-(\d{2})$/
  );

  return match
    ? [match[3], match[2], match[1]].join('/')
    : 'Sin fecha';
}

function normalizeHeader_(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[._-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeKey_(value) {
  return String(value || '')
    .trim()
    .toUpperCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\w\s/-]/g, ' ')
    .replace(/_/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function text_(value) {
  return String(
    value === null || value === undefined ? '' : value
  )
    .trim()
    .replace(/\s+/g, ' ');
}

function toNumber_(rawValue, displayValue) {
  if (
    typeof rawValue === 'number' &&
    isFinite(rawValue)
  ) {
    return rawValue;
  }

  let value = String(
    displayValue !== null &&
    displayValue !== undefined &&
    displayValue !== ''
      ? displayValue
      : rawValue || ''
  )
    .trim()
    .replace(/\s/g, '');

  if (!value) {
    return 0;
  }

  if (/^-?\d{1,3}(\.\d{3})+(,\d+)?$/.test(value)) {
    value = value.replace(/\./g, '').replace(',', '.');
  } else if (/^-?\d+,\d+$/.test(value)) {
    value = value.replace(',', '.');
  } else {
    value = value.replace(/,/g, '');
  }

  const number = Number(value);

  return isFinite(number) ? number : 0;
}

function parseOptionalNumber_(value) {
  const text = String(value || '')
    .replace(/\s/g, '')
    .replace(/[^\d,.\-]/g, '');

  if (!text) {
    return null;
  }

  const number = toNumber_(text, text);

  return isFinite(number) ? number : null;
}

function uniqueSorted_(values) {
  const found = {};
  const output = [];

  values.forEach(function(value) {
    const display = text_(value);

    if (!display) {
      return;
    }

    const key = normalizeKey_(display);

    if (!found[key]) {
      found[key] = true;
      output.push(display);
    }
  });

  return output.sort(function(a, b) {
    return a.localeCompare(b, 'es', {
      sensitivity: 'base',
      numeric: true
    });
  });
}

function uniqueTokens_(value) {
  return uniqueSorted_(
    String(value || '').split(' ').filter(Boolean)
  );
}

function round_(value, decimals) {
  const factor = Math.pow(10, decimals);
  return Math.round(value * factor) / factor;
}

/* =====================================================================
 * MAPEO DE ASERRADEROS (HOJA "Mapeos")
 *
 * Una fila por aserradero. Tú pones nombre y, para ubicarlo, o bien la
 * coordenada o bien la dirección.
 *
 * La coordenada manda. Un aserradero rural rara vez tiene dirección
 * que un geocodificador resuelva bien ("Camino a Nacimiento s/n"
 * termina en el centro de la comuna, o en otra), así que pegar el par
 * que entrega Google Maps es más exacto y no depende de un servicio.
 *
 * El estado ES el motivo: "Cerrado" cuando se cerró carga, y
 * cualquiera de los otros cuando no. Todo nace en "Por visitar".
 * Solo "Cerrado" pide cargas, y las exige mayores que cero.
 * ===================================================================== */

const MAPEOS_HEADERS = Object.freeze([
  'ID',
  'Nombre',
  'Dirección',
  'Comuna',
  'Coordenadas',
  'Estado',
  'Cargas',
  'Contacto',
  'Teléfono',
  'Latitud',
  'Longitud',
  'Última actualización',
  'Actualizado por',
  'Notas'
]);

const ESTADO_INICIAL = 'Por visitar';
const ESTADO_CERRADO = 'Cerrado';

/**
 * El orden importa: así se ven en el filtro y en la leyenda del mapa.
 * Del primero al último es el recorrido natural de una gestión.
 */
const ESTADOS_MAPEO = Object.freeze([
  { nombre: 'Por visitar', color: '#9DB0A3', cierra: false },
  { nombre: 'En negociación', color: '#6FCB8C', cierra: false },
  { nombre: 'Cerrado', color: '#B5793F', cierra: true },
  { nombre: 'Sin stock', color: '#9A7BB5', cierra: false },
  { nombre: 'Precio fuera de mercado', color: '#D9573F', cierra: false },
  { nombre: 'Comprometido con otro', color: '#6B8CB0', cierra: false },
  { nombre: 'No hubo contacto', color: '#4E5D57', cierra: false }
]);

/**
 * Chile continental, con holgura. Sirve para dos cosas: rechazar una
 * coordenada que quedó mal pegada, y detectar el error clásico de
 * invertir latitud y longitud —que no da error, solo pone el pin en
 * medio del Atlántico—.
 */
const LIMITES_CL = Object.freeze({
  latMin: -56.5, latMax: -17.0,
  lngMin: -76.0, lngMax: -66.0
});

function nombresEstados_() {
  return ESTADOS_MAPEO.map(function(item) {
    return item.nombre;
  });
}

/**
 * Resuelve las columnas por nombre de encabezado, en base 1.
 *
 * Antes estaban fijas por posición, así que agregar o mover una
 * columna en la hoja rompía la escritura en silencio. Ahora la hoja se
 * puede reordenar sin tocar el código.
 */
function columnasMapeos_(sheet) {
  const encabezados = sheet
    .getRange(1, 1, 1, Math.max(sheet.getLastColumn(), 1))
    .getValues()[0];

  const mapa = buildHeaderMap_(encabezados);

  function col(nombre, obligatoria) {
    const indice = mapa[normalizeHeader_(nombre)];

    if (indice === undefined) {
      if (obligatoria) {
        throw new Error(
          'A la hoja "' + CONFIG.SHEET_MAPEOS + '" le falta la columna "' +
          nombre + '". Corre "Preparar hoja de mapeos".'
        );
      }

      return 0;
    }

    return indice + 1;
  }

  return {
    id: col('ID', true),
    nombre: col('Nombre', true),
    direccion: col('Dirección', true),
    comuna: col('Comuna', false),
    coordenadas: col('Coordenadas', false),
    estado: col('Estado', true),
    cargas: col('Cargas', true),
    contacto: col('Contacto', false),
    telefono: col('Teléfono', false),
    lat: col('Latitud', true),
    lng: col('Longitud', true),
    actualizado: col('Última actualización', false),
    autor: col('Actualizado por', false),
    notas: col('Notas', false)
  };
}

function valorEn_(fila, columna) {
  return columna ? fila[columna - 1] : '';
}

/**
 * Entiende lo que la gente pega de verdad:
 *   -37.0331, -72.4015
 *   -37.0331 -72.4015
 *   37°02'00.0"S 72°24'05.0"W
 *
 * Si el par no cae en Chile pero el par invertido sí, lo corrige y lo
 * dice. Es el error más común y el más difícil de notar: no falla,
 * solo deja el pin en el mar.
 */
function parseCoordenadas_(texto) {
  const crudo = text_(texto);

  if (!crudo) {
    return null;
  }

  let lat = null;
  let lng = null;
  let metodo = '';

  // Grados, minutos y segundos, como los comparte Google Maps.
  const gms = crudo.match(
    /(\d{1,3})\s*°\s*(\d{1,2})\s*['′]\s*([\d.,]+)\s*["″]?\s*([NSns])[,\s]+(\d{1,3})\s*°\s*(\d{1,2})\s*['′]\s*([\d.,]+)\s*["″]?\s*([EWOewo])/
  );

  if (gms) {
    function aDecimal(g, m, s, hemisferio) {
      const valor =
        Number(g) +
        Number(m) / 60 +
        Number(String(s).replace(',', '.')) / 3600;

      return /[SsWwOo]/.test(hemisferio) ? -valor : valor;
    }

    lat = aDecimal(gms[1], gms[2], gms[3], gms[4]);
    lng = aDecimal(gms[5], gms[6], gms[7], gms[8]);
    metodo = 'Coordenada pegada (GMS)';
  } else {
    // Par decimal. Se admite coma decimal, pero solo si el separador
    // entre ambos números es otra cosa: "-37,03 -72,40".
    let limpio = crudo.replace(/[()\[\]]/g, ' ').trim();

    if (/^-?\d{1,3},\d+\s+-?\d{1,3},\d+$/.test(limpio)) {
      limpio = limpio.replace(/,/g, '.');
    }

    const par = limpio.match(
      /^\s*(-?\d{1,3}(?:\.\d+)?)\s*[,;\s]\s*(-?\d{1,3}(?:\.\d+)?)\s*$/
    );

    if (!par) {
      return null;
    }

    lat = Number(par[1]);
    lng = Number(par[2]);
    metodo = 'Coordenada pegada';
  }

  if (!isFinite(lat) || !isFinite(lng)) {
    return null;
  }

  function dentro(la, lo) {
    return la >= LIMITES_CL.latMin && la <= LIMITES_CL.latMax &&
           lo >= LIMITES_CL.lngMin && lo <= LIMITES_CL.lngMax;
  }

  if (dentro(lat, lng)) {
    return { lat: lat, lng: lng, metodo: metodo, invertida: false };
  }

  if (dentro(lng, lat)) {
    return {
      lat: lng,
      lng: lat,
      metodo: metodo + ', invertida',
      invertida: true
    };
  }

  return {
    lat: null,
    lng: null,
    metodo: metodo,
    fuera: true,
    crudo: crudo
  };
}

/**
 * Crea o repara la hoja: encabezados, validación de Estado, formatos y
 * relleno de los estados vacíos. Se puede correr las veces que sea.
 */
function instalarMapeos() {
  const spreadsheet = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);

  let sheet = spreadsheet.getSheetByName(CONFIG.SHEET_MAPEOS);

  if (!sheet) {
    sheet = spreadsheet.insertSheet(CONFIG.SHEET_MAPEOS);
  }

  // Si la hoja viene del esquema anterior (sin "Coordenadas"), se
  // conserva lo escrito y solo se agrega la columna que falta.
  const anchoActual = sheet.getLastColumn();

  const encabezadosActuales = anchoActual
    ? sheet.getRange(1, 1, 1, anchoActual).getValues()[0].map(text_)
    : [];

  const faltaCoordenadas =
    encabezadosActuales.length &&
    encabezadosActuales.indexOf('Coordenadas') === -1 &&
    encabezadosActuales.indexOf('Comuna') !== -1;

  if (faltaCoordenadas) {
    const trasComuna = encabezadosActuales.indexOf('Comuna') + 1;
    sheet.insertColumnAfter(trasComuna);
    sheet.getRange(1, trasComuna + 1).setValue('Coordenadas');
  }

  sheet
    .getRange(1, 1, 1, MAPEOS_HEADERS.length)
    .setValues([MAPEOS_HEADERS])
    .setBackground('#121C17')
    .setFontColor('#B5793F')
    .setFontWeight('bold');

  sheet.setFrozenRows(1);

  const anchos = [
    90, 250, 280, 130, 190, 180, 85, 165, 125, 105, 105, 160, 200, 280
  ];

  anchos.forEach(function(ancho, indice) {
    sheet.setColumnWidth(indice + 1, ancho);
  });

  const columnas = columnasMapeos_(sheet);
  const ultima = sheet.getLastRow();

  if (ultima < 2) {
    SpreadsheetApp.getUi().alert(
      'Hoja "' + CONFIG.SHEET_MAPEOS + '" lista.\n\n' +
      'Agrega una fila por aserradero. Para ubicarlo en el mapa basta ' +
      'con pegar la coordenada en "Coordenadas" (en Google Maps: clic ' +
      'derecho sobre el punto y copiar). Si no la tienes, escribe la ' +
      'dirección y la comuna.\n\n' +
      'El estado se rellena solo en "' + ESTADO_INICIAL + '".'
    );
    return;
  }

  const filas = ultima - 1;

  sheet
    .getRange(2, columnas.estado, filas, 1)
    .setDataValidation(
      SpreadsheetApp.newDataValidation()
        .requireValueInList(nombresEstados_(), true)
        .setAllowInvalid(false)
        .setHelpText(
          'Solo "' + ESTADO_CERRADO + '" lleva cargas. ' +
          'Los demás estados son el motivo por el que no se cerró.'
        )
        .build()
    );

  sheet.getRange(2, columnas.cargas, filas, 1).setNumberFormat('#,##0');
  sheet.getRange(2, columnas.lat, filas, 1).setNumberFormat('0.000000');
  sheet.getRange(2, columnas.lng, filas, 1).setNumberFormat('0.000000');
  sheet.getRange(2, columnas.coordenadas, filas, 1).setNumberFormat('@');

  if (columnas.actualizado) {
    sheet
      .getRange(2, columnas.actualizado, filas, 1)
      .setNumberFormat('dd/MM/yyyy HH:mm');
  }

  const rango = sheet.getRange(2, 1, filas, MAPEOS_HEADERS.length);
  const valores = rango.getValues();

  let maximo = 0;

  valores.forEach(function(fila) {
    const numero = Number(
      String(valorEn_(fila, columnas.id) || '').replace(/\D/g, '')
    );

    if (numero > maximo) {
      maximo = numero;
    }
  });

  let sinEstado = 0;
  let sinId = 0;

  valores.forEach(function(fila) {
    if (
      !text_(valorEn_(fila, columnas.nombre)) &&
      !text_(valorEn_(fila, columnas.direccion))
    ) {
      return;
    }

    if (!text_(valorEn_(fila, columnas.id))) {
      maximo++;
      fila[columnas.id - 1] = 'MAP-' + String(maximo).padStart(4, '0');
      sinId++;
    }

    if (!text_(valorEn_(fila, columnas.estado))) {
      fila[columnas.estado - 1] = ESTADO_INICIAL;
      sinEstado++;
    }
  });

  rango.setValues(valores);

  SpreadsheetApp.getUi().alert(
    'Hoja "' + CONFIG.SHEET_MAPEOS + '" lista.\n\n' +
    'Aserraderos: ' + filas + '\n' +
    'IDs asignados: ' + sinId + '\n' +
    'Estados puestos en "' + ESTADO_INICIAL + '": ' + sinEstado +
    (faltaCoordenadas ? '\nSe agregó la columna "Coordenadas".' : '') +
    '\n\nAhora corre "Ubicar en el mapa".'
  );
}

/**
 * Deja a cada aserradero con latitud y longitud, en este orden:
 *   1. La coordenada pegada, si la hay. Es exacta y no cuesta nada.
 *   2. La dirección, geocodificada. Solo si no hay coordenada.
 *
 * Nunca pisa una fila que ya tiene latitud.
 */
function ubicarMapeos() {
  const spreadsheet = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
  const sheet = spreadsheet.getSheetByName(CONFIG.SHEET_MAPEOS);

  if (!sheet || sheet.getLastRow() < 2) {
    SpreadsheetApp.getUi().alert(
      'No hay nada que ubicar. Corre primero ' +
      '"Preparar hoja de mapeos".'
    );
    return;
  }

  const columnas = columnasMapeos_(sheet);
  const filas = sheet.getLastRow() - 1;
  const rango = sheet.getRange(2, 1, filas, MAPEOS_HEADERS.length);
  const valores = rango.getValues();

  let porCoordenada = 0;
  let porDireccion = 0;
  let invertidas = 0;
  const problemas = [];

  let geocoder = null;

  valores.forEach(function(fila) {
    const nombre =
      text_(valorEn_(fila, columnas.nombre)) ||
      text_(valorEn_(fila, columnas.direccion));

    if (!nombre || Number(valorEn_(fila, columnas.lat))) {
      return;
    }

    // 1) Coordenada pegada.
    const pegada = parseCoordenadas_(
      valorEn_(fila, columnas.coordenadas)
    );

    if (pegada) {
      if (pegada.fuera) {
        problemas.push(
          nombre + ': la coordenada "' + pegada.crudo +
          '" no cae en Chile'
        );
        return;
      }

      fila[columnas.lat - 1] = pegada.lat;
      fila[columnas.lng - 1] = pegada.lng;
      porCoordenada++;

      if (pegada.invertida) {
        invertidas++;
      }

      return;
    }

    // 2) Dirección.
    const direccion = text_(valorEn_(fila, columnas.direccion));

    if (!direccion) {
      problemas.push(nombre + ': sin coordenada ni dirección');
      return;
    }

    if (!geocoder) {
      geocoder = Maps.newGeocoder().setRegion('cl');
    }

    const comuna = text_(valorEn_(fila, columnas.comuna));

    try {
      const respuesta = geocoder.geocode(
        [direccion, comuna, 'Chile'].filter(Boolean).join(', ')
      );

      if (
        respuesta.status === 'OK' &&
        respuesta.results &&
        respuesta.results.length
      ) {
        const punto = respuesta.results[0].geometry.location;
        fila[columnas.lat - 1] = punto.lat;
        fila[columnas.lng - 1] = punto.lng;
        porDireccion++;
      } else {
        problemas.push(nombre + ': la dirección no se pudo ubicar');
      }
    } catch (error) {
      problemas.push(
        nombre + ': ' + String(error.message || error)
      );
    }

    Utilities.sleep(220);
  });

  rango.setValues(valores);

  const lineas = [
    'Ubicación terminada.',
    '',
    'Por coordenada pegada: ' + porCoordenada,
    'Por dirección (geocodificadas): ' + porDireccion
  ];

  if (invertidas) {
    lineas.push(
      'Coordenadas invertidas y corregidas: ' + invertidas
    );
  }

  if (problemas.length) {
    lineas.push('');
    lineas.push('Quedaron sin ubicar:');

    problemas.slice(0, 15).forEach(function(item) {
      lineas.push('  - ' + item);
    });

    lineas.push('');
    lineas.push(
      'Lo más rápido: en Google Maps, clic derecho sobre el punto, ' +
      'copiar el par y pegarlo en la columna "Coordenadas". ' +
      'También puedes fijarlo con un clic desde el mapa del dashboard.'
    );
  }

  SpreadsheetApp.getUi().alert(lineas.join('\n'));
}

/**
 * Lo que consume el mapa. Devuelve también los aserraderos sin
 * coordenadas, para poder mostrarlos aparte en vez de perderlos.
 */
function getMapeos() {
  const spreadsheet = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
  const sheet = spreadsheet.getSheetByName(CONFIG.SHEET_MAPEOS);

  const base = {
    estados: ESTADOS_MAPEO.map(function(item) {
      return {
        nombre: item.nombre,
        color: item.color,
        cierra: item.cierra
      };
    }),
    estadoInicial: ESTADO_INICIAL,
    estadoCerrado: ESTADO_CERRADO,
    rows: [],
    sinUbicar: 0,
    missingSheet: !sheet
  };

  if (!sheet || sheet.getLastRow() < 2) {
    return base;
  }

  const columnas = columnasMapeos_(sheet);

  const valores = sheet
    .getRange(2, 1, sheet.getLastRow() - 1, MAPEOS_HEADERS.length)
    .getValues();

  const timezone =
    spreadsheet.getSpreadsheetTimeZone() || CONFIG.TIMEZONE;

  valores.forEach(function(fila) {
    const nombre = text_(valorEn_(fila, columnas.nombre));
    const direccion = text_(valorEn_(fila, columnas.direccion));

    if (!nombre && !direccion) {
      return;
    }

    let lat = Number(valorEn_(fila, columnas.lat));
    let lng = Number(valorEn_(fila, columnas.lng));
    let ubicado = isFinite(lat) && isFinite(lng) && lat !== 0;

    // Si alguien pegó la coordenada y no corrió "Ubicar en el mapa",
    // igual se dibuja: no tiene por qué acordarse de un paso extra.
    if (!ubicado) {
      const pegada = parseCoordenadas_(
        valorEn_(fila, columnas.coordenadas)
      );

      if (pegada && !pegada.fuera) {
        lat = pegada.lat;
        lng = pegada.lng;
        ubicado = true;
      }
    }

    if (!ubicado) {
      base.sinUbicar++;
    }

    const fecha = valorEn_(fila, columnas.actualizado);

    base.rows.push({
      id: text_(valorEn_(fila, columnas.id)),
      nombre: nombre || direccion,
      direccion: direccion,
      comuna: text_(valorEn_(fila, columnas.comuna)),
      estado: text_(valorEn_(fila, columnas.estado)) || ESTADO_INICIAL,
      cargas: toNumber_(valorEn_(fila, columnas.cargas), ''),
      contacto: text_(valorEn_(fila, columnas.contacto)),
      telefono: text_(valorEn_(fila, columnas.telefono)),
      lat: ubicado ? lat : null,
      lng: ubicado ? lng : null,
      actualizado: fecha instanceof Date
        ? Utilities.formatDate(fecha, timezone, 'dd/MM/yyyy HH:mm')
        : '',
      actualizadoPor: text_(valorEn_(fila, columnas.autor)),
      notas: text_(valorEn_(fila, columnas.notas))
    });
  });

  return base;
}

/** Ubica la fila de un aserradero por ID. Devuelve -1 si no está. */
function filaDeMapeo_(sheet, columnas, id) {
  const filas = sheet.getLastRow() - 1;

  if (filas < 1) {
    return -1;
  }

  const ids = sheet.getRange(2, columnas.id, filas, 1).getValues();

  for (let indice = 0; indice < ids.length; indice++) {
    if (text_(ids[indice][0]) === id) {
      return indice + 2;
    }
  }

  return -1;
}

function autorActual_() {
  try {
    return Session.getActiveUser().getEmail() || '';
  } catch (ignored) {
    return '';
  }
}

/**
 * Guarda el resultado de una visita.
 *
 * "Cerrado" sin cargas es el error que hay que atajar: sería una
 * gestión cerrada que no suma tonelaje. Se rechaza antes de escribir.
 */
function guardarMapeo(payload) {
  exigirEdicion_('Guardar una visita');

  payload = payload || {};

  const id = text_(payload.id);
  const estado = text_(payload.estado);

  if (!id) {
    throw new Error('Falta el identificador del aserradero.');
  }

  if (nombresEstados_().indexOf(estado) === -1) {
    throw new Error('Estado desconocido: ' + estado);
  }

  const cierra = estado === ESTADO_CERRADO;
  const cargas = cierra ? Number(payload.cargas) : '';

  if (cierra && (!isFinite(cargas) || cargas <= 0)) {
    throw new Error(
      'Un aserradero en "' + ESTADO_CERRADO +
      '" necesita cuántas cargas se cerraron.'
    );
  }

  const lock = LockService.getScriptLock();
  lock.waitLock(15000);

  try {
    const spreadsheet = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
    const sheet = spreadsheet.getSheetByName(CONFIG.SHEET_MAPEOS);

    if (!sheet) {
      throw new Error(
        'No existe la hoja "' + CONFIG.SHEET_MAPEOS + '".'
      );
    }

    const columnas = columnasMapeos_(sheet);
    const objetivo = filaDeMapeo_(sheet, columnas, id);

    if (objetivo === -1) {
      throw new Error('No se encontró el aserradero ' + id + '.');
    }

    sheet.getRange(objetivo, columnas.estado).setValue(estado);
    sheet.getRange(objetivo, columnas.cargas).setValue(cargas);

    if (columnas.actualizado) {
      sheet.getRange(objetivo, columnas.actualizado).setValue(new Date());
    }

    if (columnas.autor) {
      sheet.getRange(objetivo, columnas.autor).setValue(autorActual_());
    }

    if (columnas.notas) {
      sheet
        .getRange(objetivo, columnas.notas)
        .setValue(text_(payload.notas));
    }

    return getMapeos();
  } finally {
    lock.releaseLock();
  }
}

/**
 * Fija la posición desde el mapa del dashboard, con un clic.
 * Es la salida para el aserradero cuya dirección no existe en ningún
 * callejero pero que sabes exactamente dónde está.
 */
function guardarUbicacion(payload) {
  exigirEdicion_('Mover un aserradero en el mapa');

  payload = payload || {};

  const id = text_(payload.id);
  const lat = Number(payload.lat);
  const lng = Number(payload.lng);

  if (!id) {
    throw new Error('Falta el identificador del aserradero.');
  }

  if (!isFinite(lat) || !isFinite(lng)) {
    throw new Error('La coordenada no es válida.');
  }

  if (
    lat < LIMITES_CL.latMin || lat > LIMITES_CL.latMax ||
    lng < LIMITES_CL.lngMin || lng > LIMITES_CL.lngMax
  ) {
    throw new Error('Ese punto queda fuera de Chile.');
  }

  const lock = LockService.getScriptLock();
  lock.waitLock(15000);

  try {
    const spreadsheet = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
    const sheet = spreadsheet.getSheetByName(CONFIG.SHEET_MAPEOS);

    if (!sheet) {
      throw new Error(
        'No existe la hoja "' + CONFIG.SHEET_MAPEOS + '".'
      );
    }

    const columnas = columnasMapeos_(sheet);
    const objetivo = filaDeMapeo_(sheet, columnas, id);

    if (objetivo === -1) {
      throw new Error('No se encontró el aserradero ' + id + '.');
    }

    const redondear = function(valor) {
      return Math.round(valor * 1000000) / 1000000;
    };

    sheet.getRange(objetivo, columnas.lat).setValue(redondear(lat));
    sheet.getRange(objetivo, columnas.lng).setValue(redondear(lng));

    if (columnas.coordenadas) {
      sheet
        .getRange(objetivo, columnas.coordenadas)
        .setValue(redondear(lat) + ', ' + redondear(lng));
    }

    if (columnas.actualizado) {
      sheet.getRange(objetivo, columnas.actualizado).setValue(new Date());
    }

    if (columnas.autor) {
      sheet.getRange(objetivo, columnas.autor).setValue(autorActual_());
    }

    return getMapeos();
  } finally {
    lock.releaseLock();
  }
}

/** Alta rápida desde el mapa, sin pasar por la hoja. */
function agregarMapeo(payload) {
  exigirEdicion_('Agregar un aserradero');

  payload = payload || {};

  const nombre = text_(payload.nombre);
  const direccion = text_(payload.direccion);
  const coordenadas = text_(payload.coordenadas);

  if (!nombre) {
    throw new Error('El nombre es obligatorio.');
  }

  if (!direccion && !coordenadas) {
    throw new Error(
      'Hace falta la coordenada o la dirección para poder ubicarlo.'
    );
  }

  const lock = LockService.getScriptLock();
  lock.waitLock(15000);

  try {
    const spreadsheet = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
    const sheet = spreadsheet.getSheetByName(CONFIG.SHEET_MAPEOS);

    if (!sheet) {
      throw new Error(
        'No existe la hoja "' + CONFIG.SHEET_MAPEOS +
        '". Corre "Preparar hoja de mapeos".'
      );
    }

    const columnas = columnasMapeos_(sheet);

    let maximo = 0;

    if (sheet.getLastRow() > 1) {
      sheet
        .getRange(2, columnas.id, sheet.getLastRow() - 1, 1)
        .getValues()
        .forEach(function(fila) {
          const numero = Number(
            String(fila[0] || '').replace(/\D/g, '')
          );

          if (numero > maximo) {
            maximo = numero;
          }
        });
    }

    const comuna = text_(payload.comuna);

    let lat = '';
    let lng = '';

    const pegada = parseCoordenadas_(coordenadas);

    if (pegada && !pegada.fuera) {
      lat = pegada.lat;
      lng = pegada.lng;
    } else if (direccion) {
      try {
        const respuesta = Maps.newGeocoder()
          .setRegion('cl')
          .geocode(
            [direccion, comuna, 'Chile'].filter(Boolean).join(', ')
          );

        if (
          respuesta.status === 'OK' &&
          respuesta.results &&
          respuesta.results.length
        ) {
          lat = respuesta.results[0].geometry.location.lat;
          lng = respuesta.results[0].geometry.location.lng;
        }
      } catch (ignored) {}
    }

    const nueva = [];

    nueva[columnas.id - 1] = 'MAP-' + String(maximo + 1).padStart(4, '0');
    nueva[columnas.nombre - 1] = nombre;
    nueva[columnas.direccion - 1] = direccion;
    nueva[columnas.estado - 1] = ESTADO_INICIAL;
    nueva[columnas.cargas - 1] = '';
    nueva[columnas.lat - 1] = lat;
    nueva[columnas.lng - 1] = lng;

    if (columnas.comuna) { nueva[columnas.comuna - 1] = comuna; }
    if (columnas.coordenadas) {
      nueva[columnas.coordenadas - 1] = coordenadas;
    }
    if (columnas.contacto) {
      nueva[columnas.contacto - 1] = text_(payload.contacto);
    }
    if (columnas.telefono) {
      nueva[columnas.telefono - 1] = text_(payload.telefono);
    }
    if (columnas.actualizado) {
      nueva[columnas.actualizado - 1] = new Date();
    }
    if (columnas.autor) { nueva[columnas.autor - 1] = autorActual_(); }

    for (let i = 0; i < MAPEOS_HEADERS.length; i++) {
      if (nueva[i] === undefined) { nueva[i] = ''; }
    }

    sheet.appendRow(nueva);

    return getMapeos();
  } finally {
    lock.releaseLock();
  }
}

/* =====================================================================
 * RUTAS DE VISITA (HOJA "Rutas")
 *
 * Una ruta es un día de terreno: varios aserraderos en orden, con una
 * fecha y una hora de partida. Al guardarla con fecha, queda agendada
 * en el calendario del usuario como un solo bloque.
 *
 * SOBRE LA ESTIMACIÓN DE TIEMPO
 * Apps Script no trae un servicio de ruteo sin API key, así que el
 * tiempo se calcula con distancia en línea recta (haversine) corregida
 * por un factor de camino. Es un APROXIMADO y la pantalla lo dice: en
 * caminos forestales el factor real varía harto. Sirve para saber si el
 * día alcanza, no para prometer una hora de llegada.
 * ===================================================================== */

const RUTAS_HEADERS = Object.freeze([
  'ID',
  'Nombre',
  'Fecha',
  'Hora inicio',
  'Paradas',
  'N° paradas',
  'Kilómetros',
  'Minutos viaje',
  'Minutos visita',
  'Duración total',
  'Hora término',
  'Evento calendario',
  'Estado',
  'Creado por',
  'Actualizado',
  'Notas'
]);

const RUTA_CONFIG = Object.freeze({
  // Desde dónde parte y a dónde vuelve el recorrido.
  ORIGEN: Object.freeze({
    nombre: 'Planta Cabrero',
    lat: -37.0333,
    lng: -72.4000
  }),

  // Velocidad promedio de camino rural, en km/h.
  VELOCIDAD_KMH: 55,

  // La línea recta subestima: los caminos forestales dan vueltas.
  // 1.35 es un factor conservador para la zona.
  FACTOR_CAMINO: 1.35,

  // Cuánto dura estar en cada aserradero.
  MINUTOS_VISITA: 45,

  HORA_INICIO: '08:30',

  // Sobre este total, la ruta no cabe en una jornada.
  MINUTOS_JORNADA: 9 * 60
});

/* =====================================================================
 * APUNTES DE REUNIÓN
 *
 * Una fila por reunión. El acuerdo que no queda escrito se convierte en
 * "me parece que quedamos en" tres semanas después, y ahí ya no hay
 * conversación posible.
 * ===================================================================== */

const APUNTES_HEADERS = Object.freeze([
  'ID',
  'Fecha',
  'Semana',
  'Tema',
  'Asunto',
  'Participantes',
  'Apuntes',
  'Acuerdos',
  'Responsable',
  'Compromiso',
  'Estado',
  'Creado por',
  'Actualizado'
]);

const ESTADOS_APUNTE = Object.freeze([
  'Abierto', 'En curso', 'Cerrado'
]);

const TEMAS_APUNTE = Object.freeze([
  'Reunión semanal',
  'Proveedor',
  'Precio',
  'Plan',
  'Terreno',
  'Interno',
  'Otro'
]);

function columnasApuntes_(sheet) {
  const ancho = sheet.getLastColumn();

  const encabezados = ancho
    ? sheet.getRange(1, 1, 1, ancho).getValues()[0].map(normalizeHeader_)
    : [];

  function col(nombre, obligatoria) {
    const indice = encabezados.indexOf(normalizeHeader_(nombre));

    if (indice === -1) {
      if (obligatoria) {
        throw new Error(
          'A la hoja "' + CONFIG.SHEET_APUNTES + '" le falta la columna "' +
          nombre + '". Corre "Preparar hoja de apuntes" para repararla.'
        );
      }
      return 0;
    }

    return indice + 1;
  }

  return {
    id: col('ID', true),
    fecha: col('Fecha', true),
    semana: col('Semana', false),
    tema: col('Tema', true),
    asunto: col('Asunto', true),
    participantes: col('Participantes', false),
    apuntes: col('Apuntes', false),
    acuerdos: col('Acuerdos', false),
    responsable: col('Responsable', false),
    compromiso: col('Compromiso', false),
    estado: col('Estado', false),
    creadoPor: col('Creado por', false),
    actualizado: col('Actualizado', false)
  };
}

/**
 * Semana ISO, en formato 2026-S34. Es lo que permite agrupar "la
 * reunión de esta semana" sin depender de qué día se hizo.
 */
function semanaDe_(dateKey) {
  const fecha = dateKeyToLocalDate_(dateKey);

  if (!fecha) { return ''; }

  // ISO 8601: el jueves de esa semana decide a qué año pertenece.
  const jueves = new Date(fecha.getTime());
  const dia = (fecha.getUTCDay() + 6) % 7;

  jueves.setUTCDate(fecha.getUTCDate() - dia + 3);

  const primerJueves = new Date(
    Date.UTC(jueves.getUTCFullYear(), 0, 4)
  );

  const diaPrimero = (primerJueves.getUTCDay() + 6) % 7;

  primerJueves.setUTCDate(primerJueves.getUTCDate() - diaPrimero + 3);

  const semana = 1 + Math.round(
    (jueves.getTime() - primerJueves.getTime()) / (7 * 24 * 3600 * 1000)
  );

  return jueves.getUTCFullYear() + '-S' +
    (semana < 10 ? '0' + semana : String(semana));
}

function instalarApuntes() {
  const spreadsheet = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);

  let sheet = spreadsheet.getSheetByName(CONFIG.SHEET_APUNTES);

  if (!sheet) {
    sheet = spreadsheet.insertSheet(CONFIG.SHEET_APUNTES);
  }

  sheet
    .getRange(1, 1, 1, APUNTES_HEADERS.length)
    .setValues([APUNTES_HEADERS])
    .setBackground('#121C17')
    .setFontColor('#B5793F')
    .setFontWeight('bold');

  sheet.setFrozenRows(1);

  [90, 105, 90, 130, 260, 190, 420, 340, 150, 110, 100, 190, 150]
    .forEach(function(ancho, indice) {
      sheet.setColumnWidth(indice + 1, ancho);
    });

  const columnas = columnasApuntes_(sheet);
  const filas = Math.max(sheet.getMaxRows() - 1, 1);

  sheet.getRange(2, columnas.fecha, filas, 1)
    .setNumberFormat('dd/MM/yyyy');

  if (columnas.compromiso) {
    sheet.getRange(2, columnas.compromiso, filas, 1)
      .setNumberFormat('dd/MM/yyyy');
  }

  if (columnas.tema) {
    sheet.getRange(2, columnas.tema, filas, 1)
      .setDataValidation(
        SpreadsheetApp.newDataValidation()
          .requireValueInList(TEMAS_APUNTE.slice(), true)
          .setAllowInvalid(true)
          .build()
      );
  }

  if (columnas.estado) {
    sheet.getRange(2, columnas.estado, filas, 1)
      .setDataValidation(
        SpreadsheetApp.newDataValidation()
          .requireValueInList(ESTADOS_APUNTE.slice(), true)
          .setAllowInvalid(false)
          .build()
      );
  }

  // El texto largo se lee mucho mejor envuelto que en una línea de
  // cuatrocientos caracteres que hay que arrastrar.
  [columnas.apuntes, columnas.acuerdos].forEach(function(col) {
    if (col) {
      sheet.getRange(2, col, filas, 1)
        .setWrap(true)
        .setVerticalAlignment('top');
    }
  });

  SpreadsheetApp.getUi().alert(
    'Hoja "' + CONFIG.SHEET_APUNTES + '" lista.\n\n' +
    'Una fila por reunión, con fecha, tema y asunto. La semana se ' +
    'calcula sola a partir de la fecha, así que las reuniones quedan ' +
    'agrupadas aunque una se corra de día.\n\n' +
    'Se escribe desde el dashboard, en la sección "Apuntes de reunión", ' +
    'o directamente aquí.'
  );
}

function filaDeApunte_(sheet, columnas, id) {
  const ultima = sheet.getLastRow();

  if (ultima < 2) { return 0; }

  const ids = sheet
    .getRange(2, columnas.id, ultima - 1, 1)
    .getValues();

  for (let i = 0; i < ids.length; i++) {
    if (text_(ids[i][0]) === text_(id)) {
      return i + 2;
    }
  }

  return 0;
}

function getApuntes() {
  const spreadsheet = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
  const sheet = spreadsheet.getSheetByName(CONFIG.SHEET_APUNTES);

  const timezone =
    spreadsheet.getSpreadsheetTimeZone() || CONFIG.TIMEZONE;

  if (!sheet || sheet.getLastRow() < 2) {
    return {
      rows: [],
      temas: TEMAS_APUNTE.slice(),
      estados: ESTADOS_APUNTE.slice(),
      missingSheet: !sheet
    };
  }

  const columnas = columnasApuntes_(sheet);
  const range = sheet.getDataRange();
  const valores = range.getValues();
  const vistos = range.getDisplayValues();

  const rows = [];

  for (let i = 1; i < valores.length; i++) {
    const fila = valores[i];
    const visto = vistos[i] || [];

    const id = text_(valorEn_(fila, columnas.id));
    const asunto = text_(valorEn_(fila, columnas.asunto));

    if (!id && !asunto) { continue; }

    const fecha = toDateKey_(
      valorEn_(fila, columnas.fecha),
      valorEn_(visto, columnas.fecha),
      timezone
    );

    rows.push({
      id: id,
      fecha: fecha,
      fechaLabel: fecha ? formatDateKey_(fecha) : '',
      semana: text_(valorEn_(fila, columnas.semana)) ||
        (fecha ? semanaDe_(fecha) : ''),
      tema: text_(valorEn_(fila, columnas.tema)),
      asunto: asunto,
      participantes: text_(valorEn_(fila, columnas.participantes)),
      apuntes: String(valorEn_(fila, columnas.apuntes) || ''),
      acuerdos: String(valorEn_(fila, columnas.acuerdos) || ''),
      responsable: text_(valorEn_(fila, columnas.responsable)),
      compromiso: toDateKey_(
        valorEn_(fila, columnas.compromiso),
        valorEn_(visto, columnas.compromiso),
        timezone
      ),
      estado: text_(valorEn_(fila, columnas.estado)) || 'Abierto',
      creadoPor: text_(valorEn_(fila, columnas.creadoPor)),
      actualizado: text_(valorEn_(visto, columnas.actualizado))
    });
  }

  rows.sort(function(a, b) {
    return String(b.fecha || '').localeCompare(String(a.fecha || ''));
  });

  return {
    rows: rows,
    temas: TEMAS_APUNTE.slice(),
    estados: ESTADOS_APUNTE.slice(),
    missingSheet: false
  };
}

/**
 * Crea o actualiza un apunte. Sin id, es nuevo.
 */
function guardarApunte(payload) {
  exigirEdicion_('Guardar un apunte');

  const datos = payload || {};

  const asunto = text_(datos.asunto);

  if (!asunto) {
    throw new Error('El asunto es obligatorio: es lo que se lee después.');
  }

  const fecha = text_(datos.fecha);

  if (!fecha || !/^\d{4}-\d{2}-\d{2}$/.test(fecha)) {
    throw new Error('Falta la fecha de la reunión.');
  }

  const estado = text_(datos.estado) || 'Abierto';

  if (ESTADOS_APUNTE.indexOf(estado) === -1) {
    throw new Error(
      'Estado no reconocido: "' + estado + '". Usa ' +
      ESTADOS_APUNTE.join(', ') + '.'
    );
  }

  const spreadsheet = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
  const sheet = spreadsheet.getSheetByName(CONFIG.SHEET_APUNTES);

  if (!sheet) {
    throw new Error(
      'Falta la hoja "' + CONFIG.SHEET_APUNTES + '". Corre ' +
      '"Preparar hoja de apuntes" en el menú.'
    );
  }

  const bloqueo = LockService.getDocumentLock();

  if (!bloqueo.tryLock(20000)) {
    throw new Error('La hoja está ocupada. Intenta de nuevo.');
  }

  try {
    const columnas = columnasApuntes_(sheet);
    const timezone =
      spreadsheet.getSpreadsheetTimeZone() || CONFIG.TIMEZONE;

    let id = text_(datos.id);
    let fila = id ? filaDeApunte_(sheet, columnas, id) : 0;

    if (!fila) {
      id = id || 'APU-' + Utilities.formatDate(
        new Date(), timezone, 'yyyyMMdd-HHmmss'
      );

      fila = Math.max(sheet.getLastRow(), 1) + 1;
      sheet.getRange(fila, columnas.id).setValue(id);
    }

    function poner(col, valor) {
      if (col) { sheet.getRange(fila, col).setValue(valor); }
    }

    sheet.getRange(fila, columnas.fecha)
      .setValue(dateKeyToLocalDate_(fecha));

    poner(columnas.semana, semanaDe_(fecha));
    poner(columnas.tema, text_(datos.tema) || 'Reunión semanal');
    poner(columnas.asunto, asunto);
    poner(columnas.participantes, text_(datos.participantes));
    poner(columnas.apuntes, String(datos.apuntes || ''));
    poner(columnas.acuerdos, String(datos.acuerdos || ''));
    poner(columnas.responsable, text_(datos.responsable));

    const compromiso = text_(datos.compromiso);

    if (columnas.compromiso) {
      sheet.getRange(fila, columnas.compromiso).setValue(
        /^\d{4}-\d{2}-\d{2}$/.test(compromiso)
          ? dateKeyToLocalDate_(compromiso)
          : ''
      );
    }

    poner(columnas.estado, estado);

    if (columnas.creadoPor &&
        !text_(sheet.getRange(fila, columnas.creadoPor).getValue())) {
      sheet.getRange(fila, columnas.creadoPor).setValue(autorActual_());
    }

    poner(
      columnas.actualizado,
      Utilities.formatDate(new Date(), timezone, 'dd/MM/yyyy HH:mm')
    );

    SpreadsheetApp.flush();
  } finally {
    bloqueo.releaseLock();
  }

  return getApuntes();
}

function eliminarApunte(id) {
  exigirEdicion_('Borrar un apunte');

  const clave = text_(id);

  if (!clave) {
    throw new Error('Falta el identificador del apunte.');
  }

  const spreadsheet = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
  const sheet = spreadsheet.getSheetByName(CONFIG.SHEET_APUNTES);

  if (!sheet) {
    throw new Error('Falta la hoja "' + CONFIG.SHEET_APUNTES + '".');
  }

  const bloqueo = LockService.getDocumentLock();

  if (!bloqueo.tryLock(20000)) {
    throw new Error('La hoja está ocupada. Intenta de nuevo.');
  }

  try {
    const columnas = columnasApuntes_(sheet);
    const fila = filaDeApunte_(sheet, columnas, clave);

    if (!fila) {
      throw new Error('No encontré ese apunte en la hoja.');
    }

    sheet.deleteRow(fila);
    SpreadsheetApp.flush();
  } finally {
    bloqueo.releaseLock();
  }

  return getApuntes();
}

function columnasRutas_(sheet) {
  const encabezados = sheet
    .getRange(1, 1, 1, Math.max(sheet.getLastColumn(), 1))
    .getValues()[0];

  const mapa = buildHeaderMap_(encabezados);

  function col(nombre, obligatoria) {
    const indice = mapa[normalizeHeader_(nombre)];

    if (indice === undefined) {
      if (obligatoria) {
        throw new Error(
          'A la hoja "' + CONFIG.SHEET_RUTAS + '" le falta la columna "' +
          nombre + '". Corre "Preparar hoja de rutas".'
        );
      }

      return 0;
    }

    return indice + 1;
  }

  return {
    id: col('ID', true),
    nombre: col('Nombre', true),
    fecha: col('Fecha', true),
    hora: col('Hora inicio', true),
    paradas: col('Paradas', true),
    cuantas: col('N° paradas', false),
    km: col('Kilómetros', false),
    minutosViaje: col('Minutos viaje', false),
    minutosVisita: col('Minutos visita', false),
    duracion: col('Duración total', false),
    termino: col('Hora término', false),
    evento: col('Evento calendario', true),
    estado: col('Estado', false),
    autor: col('Creado por', false),
    actualizado: col('Actualizado', false),
    notas: col('Notas', false)
  };
}

function instalarRutas() {
  const spreadsheet = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);

  let sheet = spreadsheet.getSheetByName(CONFIG.SHEET_RUTAS);

  if (!sheet) {
    sheet = spreadsheet.insertSheet(CONFIG.SHEET_RUTAS);
  }

  sheet
    .getRange(1, 1, 1, RUTAS_HEADERS.length)
    .setValues([RUTAS_HEADERS])
    .setBackground('#175239')
    .setFontColor('#C9903F')
    .setFontWeight('bold');

  sheet.setFrozenRows(1);

  const anchos = [
    90, 220, 105, 95, 280, 90, 100, 110, 110, 110, 105, 260, 110, 200, 150, 260
  ];

  anchos.forEach(function(ancho, indice) {
    sheet.setColumnWidth(indice + 1, ancho);
  });

  if (sheet.getLastRow() > 1) {
    const filas = sheet.getLastRow() - 1;
    const columnas = columnasRutas_(sheet);

    sheet.getRange(2, columnas.fecha, filas, 1)
      .setNumberFormat('dd/MM/yyyy');

    if (columnas.actualizado) {
      sheet.getRange(2, columnas.actualizado, filas, 1)
        .setNumberFormat('dd/MM/yyyy HH:mm');
    }
  }

  SpreadsheetApp.getUi().alert(
    'Hoja "' + CONFIG.SHEET_RUTAS + '" lista.\n\n' +
    'Las rutas se arman desde el dashboard: pestaña Mapeos › ' +
    '"Armar ruta". Esta hoja es el registro; no hace falta editarla ' +
    'a mano.'
  );
}

/* --- Estimación de tiempo ------------------------------------------ */

function haversineKm_(a, b) {
  const R = 6371;
  const rad = Math.PI / 180;

  const dLat = (b.lat - a.lat) * rad;
  const dLng = (b.lng - a.lng) * rad;

  const s =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(a.lat * rad) * Math.cos(b.lat * rad) *
    Math.sin(dLng / 2) * Math.sin(dLng / 2);

  return R * 2 * Math.atan2(Math.sqrt(s), Math.sqrt(1 - s));
}

/**
 * Devuelve el itinerario completo: cuánto se viaja hasta cada parada,
 * a qué hora se llega y cuándo se vuelve al origen.
 *
 * Es un aproximado por línea recta corregida. No es ruteo.
 */
function estimarRuta_(paradas, horaInicio) {
  // Ojo: Number(null) es 0 y isFinite(0) es true, así que un filtro
  // ingenuo deja pasar las paradas sin coordenada como si estuvieran
  // en el golfo de Guinea, y mete un tramo de 10.000 km en la ruta.
  function tieneCoordenada(valor) {
    return valor !== null && valor !== undefined && valor !== '' &&
      isFinite(Number(valor));
  }

  const conPunto = (paradas || []).filter(function(p) {
    return tieneCoordenada(p.lat) && tieneCoordenada(p.lng);
  });

  const base = {
    km: 0,
    minutosViaje: 0,
    minutosVisita: 0,
    minutosTotal: 0,
    tramos: [],
    sinUbicar: (paradas || []).length - conPunto.length,
    excedeJornada: false
  };

  if (!conPunto.length) {
    return base;
  }

  const minutosInicio = horaAMinutos_(horaInicio) ;
  let reloj = minutosInicio;
  let anterior = RUTA_CONFIG.ORIGEN;

  conPunto.forEach(function(parada) {
    const km = haversineKm_(anterior, parada) * RUTA_CONFIG.FACTOR_CAMINO;
    const viaje = Math.round(km / RUTA_CONFIG.VELOCIDAD_KMH * 60);

    reloj += viaje;

    base.tramos.push({
      id: parada.id,
      nombre: parada.nombre,
      desde: anterior.nombre,
      km: round_(km, 1),
      minutosViaje: viaje,
      llegada: minutosAHora_(reloj),
      salida: minutosAHora_(reloj + RUTA_CONFIG.MINUTOS_VISITA)
    });

    reloj += RUTA_CONFIG.MINUTOS_VISITA;

    base.km += km;
    base.minutosViaje += viaje;
    base.minutosVisita += RUTA_CONFIG.MINUTOS_VISITA;

    anterior = parada;
  });

  // El regreso también es parte del día.
  const kmVuelta =
    haversineKm_(anterior, RUTA_CONFIG.ORIGEN) * RUTA_CONFIG.FACTOR_CAMINO;
  const viajeVuelta = Math.round(
    kmVuelta / RUTA_CONFIG.VELOCIDAD_KMH * 60
  );

  reloj += viajeVuelta;

  base.tramos.push({
    id: '',
    nombre: 'Regreso a ' + RUTA_CONFIG.ORIGEN.nombre,
    desde: anterior.nombre,
    km: round_(kmVuelta, 1),
    minutosViaje: viajeVuelta,
    llegada: minutosAHora_(reloj),
    salida: ''
  });

  base.km = round_(base.km + kmVuelta, 1);
  base.minutosViaje += viajeVuelta;
  base.minutosTotal = base.minutosViaje + base.minutosVisita;
  base.horaTermino = minutosAHora_(reloj);
  base.excedeJornada = base.minutosTotal > RUTA_CONFIG.MINUTOS_JORNADA;

  return base;
}

function horaAMinutos_(texto) {
  const m = String(texto || RUTA_CONFIG.HORA_INICIO).match(
    /^(\d{1,2}):(\d{2})$/
  );

  return m ? Number(m[1]) * 60 + Number(m[2]) : 8 * 60 + 30;
}

function minutosAHora_(minutos) {
  const total = Math.max(0, Math.round(minutos));
  const h = Math.floor(total / 60) % 24;

  return String(h).padStart(2, '0') + ':' +
    String(total % 60).padStart(2, '0');
}

function duracionLegible_(minutos) {
  const total = Math.max(0, Math.round(minutos));
  const h = Math.floor(total / 60);
  const m = total % 60;

  if (!h) { return m + ' min'; }

  return h + ' h' + (m ? ' ' + m + ' min' : '');
}

/* --- Lectura -------------------------------------------------------- */

function getRutas() {
  const spreadsheet = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
  const sheet = spreadsheet.getSheetByName(CONFIG.SHEET_RUTAS);

  const base = {
    rows: [],
    missingSheet: !sheet,
    origen: RUTA_CONFIG.ORIGEN.nombre,
    minutosVisita: RUTA_CONFIG.MINUTOS_VISITA,
    velocidad: RUTA_CONFIG.VELOCIDAD_KMH,
    factorCamino: RUTA_CONFIG.FACTOR_CAMINO,
    horaInicio: RUTA_CONFIG.HORA_INICIO,
    minutosJornada: RUTA_CONFIG.MINUTOS_JORNADA
  };

  if (!sheet || sheet.getLastRow() < 2) {
    return base;
  }

  const columnas = columnasRutas_(sheet);
  const timezone =
    spreadsheet.getSpreadsheetTimeZone() || CONFIG.TIMEZONE;

  const valores = sheet
    .getRange(2, 1, sheet.getLastRow() - 1, RUTAS_HEADERS.length)
    .getValues();

  valores.forEach(function(fila) {
    const id = text_(valorEn_(fila, columnas.id));

    if (!id) {
      return;
    }

    const fecha = valorEn_(fila, columnas.fecha);
    const actualizado = valorEn_(fila, columnas.actualizado);

    base.rows.push({
      id: id,
      nombre: text_(valorEn_(fila, columnas.nombre)),
      fecha: fecha instanceof Date
        ? Utilities.formatDate(fecha, timezone, 'yyyy-MM-dd')
        : text_(fecha),
      hora: text_(valorEn_(fila, columnas.hora)) ||
        RUTA_CONFIG.HORA_INICIO,
      paradas: text_(valorEn_(fila, columnas.paradas))
        .split(/\s*,\s*/)
        .filter(Boolean),
      km: toNumber_(valorEn_(fila, columnas.km), ''),
      minutosViaje: toNumber_(valorEn_(fila, columnas.minutosViaje), ''),
      minutosVisita: toNumber_(valorEn_(fila, columnas.minutosVisita), ''),
      minutosTotal: toNumber_(valorEn_(fila, columnas.duracion), ''),
      horaTermino: text_(valorEn_(fila, columnas.termino)),
      eventoId: text_(valorEn_(fila, columnas.evento)),
      estado: text_(valorEn_(fila, columnas.estado)),
      autor: text_(valorEn_(fila, columnas.autor)),
      actualizado: actualizado instanceof Date
        ? Utilities.formatDate(actualizado, timezone, 'dd/MM/yyyy HH:mm')
        : '',
      notas: text_(valorEn_(fila, columnas.notas))
    });
  });

  return base;
}

/* --- Guardar y agendar ---------------------------------------------- */

/**
 * Guarda la ruta y, si tiene fecha, la deja en el calendario.
 *
 * Si la ruta ya tenía evento, se actualiza el mismo en vez de crear
 * otro: agendar dos veces la misma ruta llenaría el día de duplicados.
 */
function guardarRuta(payload) {
  exigirEdicion_('Guardar una ruta');

  payload = payload || {};

  const nombre = text_(payload.nombre);
  const paradas = (payload.paradas || [])
    .map(text_)
    .filter(Boolean);

  if (!nombre) {
    throw new Error('La ruta necesita un nombre.');
  }

  if (!paradas.length) {
    throw new Error('La ruta necesita al menos un aserradero.');
  }

  const fecha = text_(payload.fecha);

  if (fecha && !/^\d{4}-\d{2}-\d{2}$/.test(fecha)) {
    throw new Error('La fecha no es válida.');
  }

  const hora = text_(payload.hora) || RUTA_CONFIG.HORA_INICIO;

  if (!/^\d{1,2}:\d{2}$/.test(hora)) {
    throw new Error('La hora de inicio no es válida.');
  }

  const lock = LockService.getScriptLock();
  lock.waitLock(20000);

  try {
    const spreadsheet = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
    const sheet = spreadsheet.getSheetByName(CONFIG.SHEET_RUTAS);

    if (!sheet) {
      throw new Error(
        'No existe la hoja "' + CONFIG.SHEET_RUTAS +
        '". Corre "Preparar hoja de rutas".'
      );
    }

    const columnas = columnasRutas_(sheet);

    // Las paradas se resuelven contra Mapeos para tener coordenadas y
    // nombres frescos, no los que se guardaron alguna vez.
    const mapeos = getMapeos();
    const porId = {};

    (mapeos.rows || []).forEach(function(m) { porId[m.id] = m; });

    const detalle = paradas
      .map(function(id) { return porId[id]; })
      .filter(Boolean);

    if (!detalle.length) {
      throw new Error(
        'Ninguna de las paradas existe en la hoja de mapeos.'
      );
    }

    const estimacion = estimarRuta_(detalle, hora);

    let objetivo = -1;
    let id = text_(payload.id);

    if (sheet.getLastRow() > 1) {
      const ids = sheet
        .getRange(2, columnas.id, sheet.getLastRow() - 1, 1)
        .getValues();

      let maximo = 0;

      ids.forEach(function(f, indice) {
        const actual = text_(f[0]);

        if (id && actual === id) {
          objetivo = indice + 2;
        }

        const numero = Number(String(actual).replace(/\D/g, ''));

        if (numero > maximo) { maximo = numero; }
      });

      if (!id) {
        id = 'RUT-' + String(maximo + 1).padStart(3, '0');
      }
    } else if (!id) {
      id = 'RUT-001';
    }

    if (objetivo === -1) {
      objetivo = Math.max(2, sheet.getLastRow() + 1);
    }

    // Evento previo, para actualizar en vez de duplicar.
    const eventoPrevio = columnas.evento && objetivo <= sheet.getLastRow()
      ? text_(sheet.getRange(objetivo, columnas.evento).getValue())
      : '';

    const agenda = fecha
      ? sincronizarEvento_(
          eventoPrevio, id, nombre, fecha, hora, detalle, estimacion,
          text_(payload.notas)
        )
      : { eventoId: '', estado: 'Sin fecha', mensaje: '' };

    let autor = '';

    try {
      autor = Session.getActiveUser().getEmail() || '';
    } catch (ignored) {}

    const fila = [];

    fila[columnas.id - 1] = id;
    fila[columnas.nombre - 1] = nombre;
    fila[columnas.fecha - 1] = fecha ? dateKeyToLocalDate_(fecha) : '';
    fila[columnas.hora - 1] = hora;
    fila[columnas.paradas - 1] = detalle.map(function(d) {
      return d.id;
    }).join(', ');
    fila[columnas.evento - 1] = agenda.eventoId;

    if (columnas.cuantas) { fila[columnas.cuantas - 1] = detalle.length; }
    if (columnas.km) { fila[columnas.km - 1] = estimacion.km; }
    if (columnas.minutosViaje) {
      fila[columnas.minutosViaje - 1] = estimacion.minutosViaje;
    }
    if (columnas.minutosVisita) {
      fila[columnas.minutosVisita - 1] = estimacion.minutosVisita;
    }
    if (columnas.duracion) {
      fila[columnas.duracion - 1] = estimacion.minutosTotal;
    }
    if (columnas.termino) {
      fila[columnas.termino - 1] = estimacion.horaTermino || '';
    }
    if (columnas.estado) { fila[columnas.estado - 1] = agenda.estado; }
    if (columnas.autor) { fila[columnas.autor - 1] = autor; }
    if (columnas.actualizado) {
      fila[columnas.actualizado - 1] = new Date();
    }
    if (columnas.notas) {
      fila[columnas.notas - 1] = text_(payload.notas);
    }

    for (let i = 0; i < RUTAS_HEADERS.length; i++) {
      if (fila[i] === undefined) { fila[i] = ''; }
    }

    sheet
      .getRange(objetivo, 1, 1, RUTAS_HEADERS.length)
      .setValues([fila]);

    const salida = getRutas();
    salida.ultimoId = id;
    salida.mensajeAgenda = agenda.mensaje;

    return salida;
  } finally {
    lock.releaseLock();
  }
}

/**
 * Crea o actualiza el bloque en el calendario del usuario.
 * Un solo evento por ruta: el itinerario va en la descripción, así el
 * día no queda partido en cinco eventos de media hora.
 */
function sincronizarEvento_(
  eventoPrevio, id, nombre, fecha, hora, detalle, estimacion, notas
) {
  const partes = fecha.split('-');
  const minutos = horaAMinutos_(hora);

  const inicio = new Date(
    Number(partes[0]), Number(partes[1]) - 1, Number(partes[2]),
    Math.floor(minutos / 60), minutos % 60
  );

  const fin = new Date(
    inicio.getTime() + Math.max(30, estimacion.minutosTotal) * 60000
  );

  const titulo =
    nombre + ' · ' + detalle.length +
    (detalle.length === 1 ? ' aserradero' : ' aserraderos');

  const lineas = [
    'Ruta de visita a aserraderos · ' + id,
    '',
    'Salida de ' + RUTA_CONFIG.ORIGEN.nombre + ' a las ' + hora + '.',
    'Duración estimada: ' + duracionLegible_(estimacion.minutosTotal) +
      ' (' + estimacion.km + ' km aprox.).',
    '',
    'Itinerario estimado:'
  ];

  estimacion.tramos.forEach(function(t, indice) {
    if (!t.id) {
      lineas.push('  · ' + t.llegada + '  ' + t.nombre +
        '  (' + t.km + ' km)');
      return;
    }

    const parada = detalle.filter(function(d) {
      return d.id === t.id;
    })[0] || {};

    lineas.push(
      '  ' + (indice + 1) + '. ' + t.llegada + '–' + t.salida + '  ' +
      t.nombre + '  (' + t.km + ' km)'
    );

    if (parada.direccion) {
      lineas.push('      ' + parada.direccion +
        (parada.comuna ? ', ' + parada.comuna : ''));
    }

    if (parada.contacto || parada.telefono) {
      lineas.push('      ' +
        [parada.contacto, parada.telefono].filter(Boolean).join(' · '));
    }
  });

  if (notas) {
    lineas.push('');
    lineas.push('Notas: ' + notas);
  }

  lineas.push('');
  lineas.push(
    'Tiempos aproximados: distancia en línea recta × ' +
    RUTA_CONFIG.FACTOR_CAMINO + ' a ' + RUTA_CONFIG.VELOCIDAD_KMH +
    ' km/h, con ' + RUTA_CONFIG.MINUTOS_VISITA +
    ' min por visita. No es ruteo real.'
  );

  const descripcion = lineas.join('\n');
  const primera = detalle[0] || {};

  const lugar = [primera.direccion, primera.comuna]
    .filter(Boolean)
    .join(', ');

  try {
    const calendario = CalendarApp.getDefaultCalendar();

    if (eventoPrevio) {
      try {
        const existente = calendario.getEventById(eventoPrevio);

        if (existente) {
          existente.setTitle(titulo);
          existente.setTime(inicio, fin);
          existente.setDescription(descripcion);

          if (lugar) { existente.setLocation(lugar); }

          return {
            eventoId: eventoPrevio,
            estado: 'Agendada',
            mensaje: 'Se actualizó el evento del calendario.'
          };
        }
      } catch (ignorado) {
        // El evento pudo borrarse a mano: se crea uno nuevo.
      }
    }

    const nuevo = calendario.createEvent(titulo, inicio, fin, {
      description: descripcion,
      location: lugar
    });

    return {
      eventoId: nuevo.getId(),
      estado: 'Agendada',
      mensaje: 'Agendada en tu calendario.'
    };
  } catch (error) {
    // Guardar la ruta no puede fallar porque el calendario no responda.
    return {
      eventoId: eventoPrevio,
      estado: 'Sin agendar',
      mensaje:
        'La ruta se guardó, pero no se pudo escribir en el calendario: ' +
        String(error.message || error)
    };
  }
}

/** Borra la ruta y su evento. */
function eliminarRuta(id) {
  exigirEdicion_('Borrar una ruta');

  const objetivoId = text_(id);

  if (!objetivoId) {
    throw new Error('Falta el identificador de la ruta.');
  }

  const lock = LockService.getScriptLock();
  lock.waitLock(15000);

  try {
    const spreadsheet = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
    const sheet = spreadsheet.getSheetByName(CONFIG.SHEET_RUTAS);

    if (!sheet || sheet.getLastRow() < 2) {
      throw new Error('No hay rutas guardadas.');
    }

    const columnas = columnasRutas_(sheet);
    const filas = sheet.getLastRow() - 1;
    const ids = sheet.getRange(2, columnas.id, filas, 1).getValues();

    let objetivo = -1;

    for (let i = 0; i < ids.length; i++) {
      if (text_(ids[i][0]) === objetivoId) {
        objetivo = i + 2;
        break;
      }
    }

    if (objetivo === -1) {
      throw new Error('No se encontró la ruta ' + objetivoId + '.');
    }

    const eventoId = text_(
      sheet.getRange(objetivo, columnas.evento).getValue()
    );

    if (eventoId) {
      try {
        const evento = CalendarApp.getDefaultCalendar()
          .getEventById(eventoId);

        if (evento) { evento.deleteEvent(); }
      } catch (ignorado) {}
    }

    sheet.deleteRow(objetivo);

    return getRutas();
  } finally {
    lock.releaseLock();
  }
}
