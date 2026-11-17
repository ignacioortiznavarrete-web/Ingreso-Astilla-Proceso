/**
 * El libro de camiones: el registro en vivo.
 *
 * Una fila por camión, con su guía. La guía es la misma que SAP
 * escribe en "Nº Guia", y eso es lo que permite complementar camión
 * por camión en vez de por día: si la guía está en SAP, ese camión ya
 * está contado con su peso real; si no está, entra estimado.
 *
 * El libro es ajeno —lo escribe otra área, no se puede tocar y cambia
 * de archivo cada mes—, así que la prueba usa la forma REAL de su
 * hoja: los rótulos como vienen (con espacios de más, una columna sin
 * nombre), productos que no son astilla de proceso, filas de un día
 * todavía sin camión y camiones que llegaron y no terminan de
 * descargar.
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
  SPREADSHEET_ID: 'panel',
  SHEET_FUENTES: 'Fuentes',
  TIMEZONE: 'America/Santiago',
  FUZZY_THRESHOLD: 0.72,
  FACTOR_CAMION: 11,
  FACTOR_POR_MATERIAL: {
    'ASTILLA EUCALYPTUS NITENS': 15.2,
    'AST. PINO VERDE C/ CORTEZA': 10.7,
    'ASTILLA PINO VERDE': 11
  },
  CAMIONES: { PATRON: 'CAMIONES INGRESO', COLUMNAS_MAX: 24 }
};

eval([recortarConst('MESES_LARGOS')].concat([
  'readCamiones_', 'complementarCamiones_', 'mesesDelLibro_',
  'hojaDeCamiones_', 'buscarLibroEnDrive_', 'leerFuentes_',
  'normalizaGuia_', 'claveDeMes_', 'nombreDelMes_', 'idDeEnlace_',
  'canonicalSubproducto_', 'factorDe_', 'resolveProveedor_',
  'homologarProveedor_', 'candidatosDelCruce_', 'proveedorComparable_',
  'proveedorSimilitud_', 'uniqueTokens_', 'levenshtein_',
  'uniqueSorted_', 'buildHeaderMap_', 'normalizeHeader_',
  'toDateKey_', 'parseDateText_', 'buildDateKey_', 'normalizeKey_',
  'text_', 'round_'
].map(recortar)).join('\n'));

let fallos = 0;
function ok(c, t, extra) {
  console.log((c ? 'OK   ' : 'MAL  ') + t);
  if (!c) { fallos++; if (extra !== undefined) console.log('     ' + JSON.stringify(extra)); }
}

/* ---------------------------------------------------------------------
 * Apps Script de mentira
 * ------------------------------------------------------------------ */
const Utilities = {
  formatDate: function(d, tz, fmt) {
    const p = function(n) { return ('0' + n).slice(-2); };
    const y = d.getUTCFullYear();
    const m = p(d.getUTCMonth() + 1);

    return fmt === 'yyyy-MM' ? y + '-' + m : y + '-' + m + '-' + p(d.getUTCDate());
  }
};

const CacheService = {
  getScriptCache: function() {
    return {
      get: function() { return null; },
      put: function() {},
      remove: function() {}
    };
  }
};

let BUSQUEDAS = 0;

const DriveApp = {
  searchFiles: function() {
    BUSQUEDAS++;

    const encontrados = [{
      getId: function() { return 'libro-noviembre'; },
      getName: function() { return 'CAMIONES INGRESO NOVIEMBRE AÑO 2026..'; },
      getLastUpdated: function() { return new Date('2026-11-17'); }
    }];

    let i = 0;

    return {
      hasNext: function() { return i < encontrados.length; },
      next: function() { return encontrados[i++]; }
    };
  }
};

function hoja(nombre, filas) {
  const ancho = filas.reduce(function(m, f) {
    return Math.max(m, f.length);
  }, 0);

  const norm = filas.map(function(f) {
    const c = f.slice();

    while (c.length < ancho) { c.push(''); }

    return c;
  });

  function rango(r, c, nr, nc) {
    const corte = norm.slice(r - 1, r - 1 + nr).map(function(f) {
      return f.slice(c - 1, c - 1 + nc);
    });

    return {
      getValues: function() { return corte.map(function(f) { return f.slice(); }); },
      getDisplayValues: function() {
        return corte.map(function(f) {
          return f.map(function(v) {
            return v === null || v === undefined ? '' : String(v);
          });
        });
      }
    };
  }

  return {
    getName: function() { return nombre; },
    getLastRow: function() { return norm.length; },
    getLastColumn: function() { return ancho; },
    getRange: rango,
    getDataRange: function() { return rango(1, 1, norm.length, ancho); }
  };
}

function libro(nombre, hojas) {
  return {
    getName: function() { return nombre; },
    getUrl: function() { return 'https://docs.google.com/x'; },
    getSheets: function() { return hojas; },
    getSheetByName: function(n) {
      return hojas.filter(function(h) { return h.getName() === n; })[0] || null;
    }
  };
}

/* ---------------------------------------------------------------------
 * El libro, con la forma real de su hoja
 * ------------------------------------------------------------------ */
const CABECERA = [
  'ESTADO', 'HORA', 'SOBREPESO', 'CONDICION', 'FECHA', ' HORA LLEGADA',
  '  HORA. SOLICITADA', ' HORA RESERVA', 'NOMBRE CONDUCTORES', 'PATENTE',
  'CARRO', 'GUIA ', 'PROVEEDOR', '', 'TIPO\nDESCARGA', 'PRODUCTO',
  'DESTINO', 'OBSERVACIONES', 'FONO'
];

function camion(estado, fecha, guia, proveedor, producto, destino) {
  return [
    estado, '8:46', '', '', fecha, '8:43', '8:50', '8:49',
    'LUIS PEREZ PAREDES', 'FGYZ65', 'JK2695', guia, proveedor, '',
    'A', producto, destino || 'TABLEROS'
  ];
}

const FILAS = [
  CABECERA,
  camion('OK', '02-11-2026', '1312', 'LATSAGUE SAAVEDRA',
         'ASTILLA PINO VERDE'),
  camion('OK', '02-11-2026', '6132', 'ALSAL LTDA',
         'MR 2.44 SINIESTRADO', 'TABLERO MR'),
  camion('OK', '02-11-2026', '25104', 'COMERCIAL RIO CRUCES LTDA',
         'ASTILLA PINO COMBUSTIBLE', 'COGENERACIÓN'),
  camion('ok', '17-11-2026', '17696', 'BIOMASA SUR',
         'ASTILLA PINO VERDE'),
  // Llegó, tiene guía, y todavía no termina de descargar.
  camion('', '17-11-2026', '3500844', 'MASISA S.A. BIOCHIPER',
         'AST.  PINO VERDE C/ CORTEZA'),
  camion('', '17-11-2026', '32132', 'FORESTAL FORESOL SPA',
         'ASTILLA EUCALYPTUS NITENS'),
  // La misma guía del mismo proveedor, escrita dos veces.
  camion('ok', '17-11-2026', '17696', 'BIOMASA SUR',
         'ASTILLA PINO VERDE'),
  // Astilla sin guía: no se puede cruzar contra SAP.
  camion('OK', '17-11-2026', '', 'PROMASA S.A.', 'ASTILLA PINO VERDE'),
  // Ya está en SAP, con el mismo número y el mismo proveedor.
  camion('OK', '16-11-2026', '2733', 'ASERRADERO LIKE WOOD LTDA',
         'AST.  PINO VERDE C/ CORTEZA'),
  // Mismo número de guía, otro proveedor: no se puede afirmar nada.
  camion('OK', '16-11-2026', '2733', 'MADERAS DEL SUR DOS LTDA',
         'ASTILLA PINO VERDE'),
  // Un día escrito de antemano, sin camión todavía.
  ['', '', '', '', '17-11-2026']
];

const LIBRO = libro('CAMIONES INGRESO NOVIEMBRE AÑO 2026..', [
  hoja('NOVIEMBRE 2026', FILAS),
  hoja('ASERRABLES', [['Fecha', 'Trozos'], ['02-11-2026', 10]])
]);

let FUENTES = null;

const PANEL = {
  getName: function() { return 'Astilla Proceso'; },
  getSheetByName: function(n) { return n === 'Fuentes' ? FUENTES : null; }
};

const SpreadsheetApp = {
  openById: function(id) {
    return id === 'panel' ? PANEL : LIBRO;
  }
};

const SAP = [
  'LATSAGUE SAAVEDRA', 'ASERRADERO LIKE WOOD LTDA', 'PROMASA S.A.',
  'BIOMASA SUR'
];

const HOMO = { porAlias: {}, canonicos: [] };

// Lo que SAP ya tiene cargado, con su guía.
const INGRESOS = [
  { fecha: '2026-11-02', source: 'INGRESOS', guia: '1312',
    proveedor: 'LATSAGUE SAAVEDRA', ts: 11.2 },
  { fecha: '2026-11-16', source: 'INGRESOS', guia: '2733',
    proveedor: 'ASERRADERO LIKE WOOD LTDA', ts: 11.535 },
  { fecha: '2026-11-02', source: 'INGRESOS', guia: '',
    proveedor: 'PROMASA S.A.', ts: 10 }
];

// --- 1. Qué filas entran ----------------------------------------------
const leido = readCamiones_(
  PANEL, ['2026-11'], SAP, HOMO, CONFIG.TIMEZONE
);

const porGuia = {};
leido.rows.forEach(function(r) { porGuia[r.guia] = r; });

ok(leido.rows.length === 6,
   'entran solo los camiones de astilla de proceso, una vez cada uno',
   leido.rows.map(function(r) { return r.guia + ' ' + r.subproducto; }));
ok(leido.otrosProductos === 2,
   'el MR y la astilla combustible quedan fuera, y se cuentan',
   leido.otrosProductos);
ok(leido.sinGuia === 1,
   'la fila de astilla sin guía no se puede cruzar: se cuenta aparte',
   leido.sinGuia);
ok(leido.repetidas === 1,
   'la misma guía del mismo proveedor dos veces es un solo camión',
   leido.repetidas);
ok(leido.enCurso === 2,
   'los que llegaron y no terminan de descargar quedan marcados',
   leido.enCurso);

// --- 2. Cómo queda cada fila -------------------------------------------
const nitens = porGuia['32132'];

ok(!!nitens && nitens.subproducto === 'ASTILLA EUCALYPTUS NITENS' &&
   nitens.ts === 15.2 && nitens.camiones === 1,
   'un camión es un camión, y sus TS salen del factor del material',
   nitens);
ok(!!porGuia['3500844'] && porGuia['3500844'].ts === 10.7,
   'el pino con corteza pesa lo suyo, no el factor general',
   porGuia['3500844'] && porGuia['3500844'].ts);
ok(!!nitens && nitens.enCurso === true && nitens.fecha === '2026-11-17',
   'con su fecha y su estado', nitens);
ok(!!porGuia['17696'] &&
   porGuia['17696'].proveedor === 'BIOMASA SUR' &&
   porGuia['17696'].matchMethod === 'Coincidencia exacta',
   'y el proveedor cruzado contra SAP por el mismo camino de siempre',
   porGuia['17696']);
ok(leido.primeraFecha === '2026-11-02' && leido.ultimaFecha === '2026-11-17',
   'el libro dice hasta dónde alcanzó a ver',
   [leido.primeraFecha, leido.ultimaFecha]);
ok(leido.libros.length === 1 &&
   leido.libros[0].hoja === 'NOVIEMBRE 2026',
   'y de qué archivo y pestaña salió', leido.libros);

// --- 3. El cruce por guía ---------------------------------------------
const complemento = complementarCamiones_(INGRESOS, leido.rows);

const quedan = complemento.rows.map(function(r) { return r.guia; }).sort();

ok(JSON.stringify(quedan) ===
   JSON.stringify(['17696', '32132', '3500844']),
   'solo se complementan las guías que SAP no tiene',
   JSON.stringify(quedan));
ok(complemento.yaEnSap === 2,
   'las que ya están en SAP no se cuentan dos veces',
   complemento.yaEnSap);
ok(complemento.porNumero === 1 &&
   complemento.dudosos[0] === 'MADERAS DEL SUR DOS LTDA',
   'el mismo número a nombre de otro proveedor no se complementa: se dice',
   complemento);
ok(complemento.ts === round_(11 + 10.7 + 15.2, 2),
   'y las TS estimadas son la suma de sus factores', complemento.ts);

// --- 4. Un día que SAP carga después deja de complementarse ------------
const despues = complementarCamiones_(
  INGRESOS.concat([{
    fecha: '2026-11-17', source: 'INGRESOS', guia: '17696',
    proveedor: 'BIOMASA SUR', ts: 10.8
  }]),
  leido.rows
);

ok(despues.rows.length === 2 &&
   despues.rows.every(function(r) { return r.guia !== '17696'; }),
   'cuando SAP carga esa guía, el estimado desaparece solo',
   despues.rows.map(function(r) { return r.guia; }));

// --- 5. La guía, comparable entre las dos fuentes ---------------------
ok(normalizaGuia_(1312) === '1312' && normalizaGuia_(' 1312 ') === '1312',
   'la guía se compara igual venga número o texto');
ok(normalizaGuia_('0001312') === '1312',
   'y los ceros de la izquierda no la cambian');
ok(normalizaGuia_('') === '' && normalizaGuia_(null) === '',
   'sin guía no hay llave');

// --- 6. De qué libro y de qué mes -------------------------------------
ok(claveDeMes_('NOVIEMBRE 2026') === '2026-11' &&
   claveDeMes_('2026-11') === '2026-11' &&
   claveDeMes_('nov-2026') === '2026-11',
   'el mes se entiende escrito como sea',
   [claveDeMes_('NOVIEMBRE 2026'), claveDeMes_('2026-11'),
    claveDeMes_('nov-2026')]);
ok(JSON.stringify(mesesDelLibro_({ prefix: '2026-01', year: 2026, month: 1 }))
   === JSON.stringify(['2026-01', '2025-12']),
   'en enero el mes anterior es diciembre del año pasado');
ok(idDeEnlace_('https://docs.google.com/spreadsheets/d/' +
     '1dSHX2OLrEohBTD5PFhWz0AkvTW6Bo2U5stxYer527lE/edit?gid=0#gid=0') ===
   '1dSHX2OLrEohBTD5PFhWz0AkvTW6Bo2U5stxYer527lE',
   'del enlace pegado se saca el id');

ok(BUSQUEDAS === 1,
   'sin hoja Fuentes, el libro se busca en Drive por su nombre',
   BUSQUEDAS);

// Y con la hoja Fuentes escrita, manda lo que diga ahí.
FUENTES = hoja('Fuentes', [
  ['Mes', 'Libro de camiones', 'Hoja', 'Encontrado', 'Notas'],
  ['NOVIEMBRE 2026',
   'https://docs.google.com/spreadsheets/d/1aManoXXXXXXXXXXXXXXXXXXXXXXXXXXXX/edit',
   'NOVIEMBRE 2026', '', '']
]);

BUSQUEDAS = 0;

const aMano = readCamiones_(PANEL, ['2026-11'], SAP, HOMO, CONFIG.TIMEZONE);

ok(BUSQUEDAS === 0 && aMano.libros[0].aMano === true,
   'lo escrito a mano en Fuentes manda sobre la búsqueda',
   aMano.libros[0]);
ok(aMano.rows.length === leido.rows.length,
   'y lee lo mismo');

// --- 7. Un mes sin libro se dice, no revienta -------------------------
const sinLibro = readCamiones_(
  PANEL, ['2026-11', '2026-10'], SAP, HOMO, CONFIG.TIMEZONE
);

ok(sinLibro.faltan.length === 0 || sinLibro.rows.length > 0,
   'leer dos meses no revienta aunque uno no esté',
   sinLibro.faltan);

console.log(fallos ? '\n' + fallos + ' FALLOS' : '\nTodo OK');
process.exitCode = fallos ? 1 : 0;
