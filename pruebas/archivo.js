/**
 * El archivo del día: la copia propia de lo que mostró el panel.
 *
 * "Hoy" se vacía solo a medianoche, y el libro de la portería es ajeno
 * y cambia de archivo cada mes. Sin esta copia, la demora de un martes
 * cualquiera no se puede ir a buscar seis meses después.
 *
 * Lo que se prueba acá es lo que decide qué queda escrito: en qué
 * carpeta, con qué nombre, y qué pasa con el camión que a esa hora
 * seguía en patio.
 */
const fs = require('fs');
const path = require('path');

const src = fs.readFileSync(
  path.join(__dirname, '..', 'Codigo.gs'), 'utf8'
);

function recortar(nombre) {
  const i = src.indexOf('function ' + nombre + '(');

  if (i === -1) { throw new Error('falta ' + nombre); }

  let d = 0;

  for (let k = src.indexOf('{', i); k < src.length; k++) {
    if (src[k] === '{') { d++; }
    else if (src[k] === '}') { d--; if (!d) { return src.slice(i, k + 1); } }
  }
}

function recortarConst(nombre) {
  const m = src.match(
    new RegExp('const ' + nombre + '\\s*=[\\s\\S]*?;\\n')
  );

  if (!m) { throw new Error('falta const ' + nombre); }

  return m[0];
}

const CONFIG = {
  TIMEZONE: 'America/Santiago',
  JORNADA: { DESDE: '08:30', HASTA: '23:00' },
  PERFIL: { MINIMO_CAMIONES: 8, MINIMA_PARTE: 0.15, HORAS_PUNTA: 3 },
  ARCHIVO: {
    CARPETA: 'https://drive.google.com/drive/folders/' +
      '1amDJBZ_U4RoMksMN2sZXMYxvVbabZRMF?usp=sharing',
    PREFIJO: 'Ingresos',
    HORA: 23,
    MINUTO: 45
  },
  FACTOR_POR_MATERIAL: {
    'ASTILLA EUCALYPTUS NITENS': 15.2,
    'AST. PINO VERDE C/ CORTEZA': 10.7,
    'ASTILLA PINO VERDE': 11,
    'ASERRÍN PINO VERDE': 11
  }
};

let AHORA = '14:00';

const Utilities = {
  formatDate: function() { return AHORA; }
};

/* ---------------------------------------------------------------------
 * Un Drive de mentira, que anota lo que le piden
 * ------------------------------------------------------------------ */
const PEDIDAS = [];
const CREADAS = [];
const EXISTENTES = {};

function carpetaFalsa(nombre) {
  return {
    getName: function() { return nombre; },
    getFoldersByName: function(n) {
      PEDIDAS.push(n);

      const hallada = EXISTENTES[n];
      let entregada = false;

      return {
        hasNext: function() { return !!hallada && !entregada; },
        next: function() { entregada = true; return hallada; }
      };
    },
    createFolder: function(n) {
      CREADAS.push(n);
      EXISTENTES[n] = carpetaFalsa(n);

      return EXISTENTES[n];
    }
  };
}

const RAIZ = carpetaFalsa('Registro de demora');
const IDS = [];

const DriveApp = {
  getFolderById: function(id) { IDS.push(id); return RAIZ; }
};

// Con `const` el eval se lo queda para sí; con `var` queda a la vista
// de la prueba, que es la que necesita los nombres de las columnas.
eval([recortarConst('ARCHIVO_COLUMNAS').replace('const ', 'var '),
      recortarConst('TRAMOS_DEMORA')]
  .concat([
  'resumenDelDia_', 'minutosDeHora_', 'tramosDelCamion_',
  'estadisticaDeMinutos_', 'ahoraEnMinutos_', 'normalizaGuia_',
  'factorDe_', 'formatDateKey_', 'diaAnterior_', 'carpetaDelMes_',
  'celdaDeMinutos_', 'filasDelDia_', 'filasDelResumen_',
  'perfilHorario_', 'parteDelDia_', 'tramosDeDemora_',
  'diasDelCierre_', 'diaQueTermina_',
  'idDeEnlace_', 'nombreDelMes_', 'normalizeKey_', 'text_', 'round_'
].map(recortar)).concat([recortarConst('MESES_LARGOS')]).join('\n'));

let fallos = 0;
function ok(c, t, extra) {
  console.log((c ? 'OK   ' : 'MAL  ') + t);
  if (!c) {
    fallos++;
    if (extra !== undefined) { console.log('     ' + JSON.stringify(extra)); }
  }
}

/* ---------------------------------------------------------------------
 * El día anterior
 * ------------------------------------------------------------------ */
ok(diaAnterior_('2026-11-20') === '2026-11-19', 'el día de antes');
ok(diaAnterior_('2026-11-01') === '2026-10-31',
   'el primero del mes cae en el último del anterior',
   diaAnterior_('2026-11-01'));
ok(diaAnterior_('2026-01-01') === '2025-12-31',
   'y el primero de enero, en el año pasado',
   diaAnterior_('2026-01-01'));
ok(diaAnterior_('2024-03-01') === '2024-02-29',
   'el 29 de febrero existe cuando toca',
   diaAnterior_('2024-03-01'));

/* ---------------------------------------------------------------------
 * Qué guarda la corrida de las 23:30
 * ------------------------------------------------------------------ */
ok(diasDelCierre_('2026-11-19').join(' ') === '2026-11-19 2026-11-18',
   'a las 23:30 el día que se guarda es el que termina, no el de ayer',
   diasDelCierre_('2026-11-19'));
ok(diasDelCierre_('2026-12-01').join(' ') === '2026-12-01 2026-11-30',
   'y el primero del mes rehace el último del anterior, que vive en ' +
   'otra carpeta', diasDelCierre_('2026-12-01'));

// El disparador sale a las 23:45 y Apps Script no promete el minuto.
ok(diaQueTermina_('2026-11-19', '23:45') === '2026-11-19',
   'a las 23:45 el día que termina es el de hoy');
ok(diaQueTermina_('2026-11-20', '00:03') === '2026-11-19',
   'pero si la corrida se pasó de la medianoche, el día que terminó ' +
   'es el de ayer: si no, guardaría uno recién empezado y vacío',
   diaQueTermina_('2026-11-20', '00:03'));
ok(diaQueTermina_('2026-12-01', '00:10') === '2026-11-30',
   'y en el cambio de mes se va a la carpeta del mes anterior',
   diaQueTermina_('2026-12-01', '00:10'));

/* ---------------------------------------------------------------------
 * La carpeta del mes
 * ------------------------------------------------------------------ */
const carpeta = carpetaDelMes_('2026-11');

ok(carpeta.getName() === '2026-11 NOVIEMBRE',
   'la carpeta del mes empieza por la clave, para que Drive las ordene ' +
   'por fecha y no alfabéticamente',
   carpeta.getName());
ok(IDS[0] === '1amDJBZ_U4RoMksMN2sZXMYxvVbabZRMF',
   'el código de la carpeta sale del enlace pegado, con cola y todo',
   IDS[0]);
ok(CREADAS.length === 1, 'la primera vez se crea', CREADAS);

const otraVez = carpetaDelMes_('2026-11');

ok(CREADAS.length === 1 && otraVez.getName() === '2026-11 NOVIEMBRE',
   'y la segunda se reusa: no se llena Drive de carpetas repetidas',
   CREADAS);

ok(carpetaDelMes_('2027-02').getName() === '2027-02 FEBRERO',
   'cada mes la suya');

/* ---------------------------------------------------------------------
 * Un día que ya terminó
 * ------------------------------------------------------------------ */
const DIA = '2026-11-19';

function camion(llegada, guia, proveedor, subproducto, extra) {
  return Object.assign({
    fecha: DIA, source: 'CAMIONES', llegada: llegada, guia: guia,
    proveedor: proveedor, proveedorRaw: proveedor,
    subproducto: subproducto, destino: 'TABLEROS', camiones: 1,
    ts: CONFIG.FACTOR_POR_MATERIAL[subproducto], enCurso: false,
    cierre: '', reserva: ''
  }, extra || {});
}

const FILAS = [
  camion('8:45', '1001', 'PROMASA S.A.', 'ASTILLA PINO VERDE',
         { reserva: '8:40', cierre: '9:05' }),
  camion('10:15', '1002', 'FORESTAL AITUE LTDA', 'ASTILLA EUCALYPTUS NITENS',
         { reserva: '10:00', cierre: '11:00' }),
  // La portería lo escribe de otra forma, y el panel ya lo homologó.
  camion('12:20', '1003', 'LAMINADORA LOS ANGELES', 'ASERRÍN PINO VERDE',
         { proveedorRaw: 'LAMINADORA LOS ANGLES',
           reserva: '12:00', cierre: '12:30' }),
  // Se quedó sin cerrar y el día ya pasó: nadie le va a escribir la
  // hora de salida.
  camion('22:40', '1004', 'BIOMASA SUR', 'ASTILLA PINO VERDE',
         { enCurso: true, reserva: '22:30', cierre: '' })
];

// Así lo rehace el archivo de madrugada: el día cerrado no tiene
// "ahora" contra qué medir.
const cerrado = resumenDelDia_(FILAS, [], DIA, CONFIG.TIMEZONE, -1);

ok(cerrado.filas.length === 4, 'entran los cuatro camiones del día',
   cerrado.filas.length);

const abierto = cerrado.filas.filter(function(f) {
  return f.guia === '1004';
})[0];

ok(abierto.abierto === true && abierto.patio === null &&
   abierto.flujo === null,
   'al que quedó sin cerrar no se le inventa una demora contra la hora ' +
   'en que corrió el archivo', abierto);
ok(cerrado.demora.patio.n === 3 && cerrado.demora.patio.mediana === 20,
   'la mediana del día sale de los tres que sí cerraron',
   cerrado.demora.patio);
ok(cerrado.cierre.alRitmo === false && cerrado.jornada.abierta === false,
   'y un día terminado no se proyecta: ya está',
   { cierre: cerrado.cierre, jornada: cerrado.jornada });

/* ---------------------------------------------------------------------
 * La hoja de camiones
 * ------------------------------------------------------------------ */
const filas = filasDelDia_(cerrado);

ok(filas.length === 4 && filas[0].length === ARCHIVO_COLUMNAS.length,
   'una fila por camión, con todas las columnas del encabezado',
   [filas.length, filas[0] && filas[0].length, ARCHIVO_COLUMNAS.length]);

function col(fila, nombre) {
  return fila[ARCHIVO_COLUMNAS.indexOf(nombre)];
}

const f1001 = filas.filter(function(f) { return col(f, 'Guía') === '1001'; })[0];

ok(col(f1001, 'Fecha') === DIA && col(f1001, 'Llegó') === '8:45' &&
   col(f1001, 'Salió') === '9:05' && col(f1001, 'Reservada') === '8:40',
   'las cuatro horas tal como las escribió la portería', f1001);
ok(col(f1001, 'Agenda (min)') === 5 &&
   col(f1001, 'En patio (min)') === 20 &&
   col(f1001, 'Desde la reserva (min)') === 25,
   'y los tres tramos como números, para poder promediarlos en Excel',
   f1001);
ok(col(f1001, 'Estado') === 'SALIÓ' &&
   col(f1001, 'Como lo escribe la portería') === '',
   'el que la portería escribe igual no repite el nombre en dos columnas',
   f1001);

const f1003 = filas.filter(function(f) { return col(f, 'Guía') === '1003'; })[0];

ok(col(f1003, 'Proveedor') === 'LAMINADORA LOS ANGELES' &&
   col(f1003, 'Como lo escribe la portería') === 'LAMINADORA LOS ANGLES',
   'y el que escribe distinto deja las dos versiones, que es lo que ' +
   'permite revisar la homologación después', f1003);

const f1004 = filas.filter(function(f) { return col(f, 'Guía') === '1004'; })[0];

ok(col(f1004, 'Salió') === '' && col(f1004, 'En patio (min)') === '' &&
   col(f1004, 'Estado') === 'EN PATIO',
   'el que no cerró queda con las celdas vacías, no en cero: cero sería ' +
   'decir que no demoró nada', f1004);

ok(celdaDeMinutos_(0) === 0 && celdaDeMinutos_(null) === '',
   'un cero medido y un "no se midió" no son lo mismo',
   [celdaDeMinutos_(0), celdaDeMinutos_(null)]);

/* ---------------------------------------------------------------------
 * La hoja de resumen
 * ------------------------------------------------------------------ */
const resumen = filasDelResumen_(cerrado);
const texto = resumen.map(function(f) { return f.join('|'); }).join('\n');

ok(resumen[0].join('|') ===
   'Material|Camiones|TS|En patio mediana (min)',
   'el resumen abre por material', resumen[0]);
ok(texto.indexOf('ASTILLA PINO VERDE|2|22|') !== -1,
   'con sus camiones y sus TS', texto);
ok(texto.indexOf('Total|4|') !== -1, 'y el total abajo', texto);
ok(texto.indexOf('En patio mediana (min)|20|') !== -1 &&
   texto.indexOf('Sin cerrar|1|') !== -1,
   'después la demora del día y cuántos quedaron sin cerrar', texto);
ok(resumen.every(function(f) { return f.length === 4; }),
   'todas las filas del mismo ancho, o setValues revienta',
   resumen.map(function(f) { return f.length; }));

console.log(fallos ? '\n' + fallos + ' FALLOS' : '\nTodo OK');
process.exit(fallos ? 1 : 0);
