/**
 * La planilla admite un día en cero.
 *
 * La tabla del reservador puede llegar así: la fecha, un cero y la fila
 * Total, sin una sola línea de detalle. Las columnas van en el mismo
 * orden de siempre, pero no hay nada que sumar.
 *
 * Antes eso reventaba con «no se encontraron filas», el correo quedaba
 * marcado como error y el día desaparecía del panel. Un día que el
 * reservador reportó en cero no es un día que falta: es un día sin
 * despacho, y no es lo mismo que uno que nadie cargó.
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

const CONFIG = {
  MATERIAL_MAP: {
    '3000039': 'ASTILLA PINO VERDE',
    '3009002': 'AST. PINO VERDE C/ CORTEZA',
    '3009003': 'ASTILLA EUCALYPTUS NITENS'
  },
  TIMEZONE: 'America/Santiago'
};
const SUBPRODUCTOS_OBJETIVO = Object.values(CONFIG.MATERIAL_MAP);

eval([
  'parsePlanillaEmail_', 'parseGridRows_', 'parseAttachments_',
  'parsePlanillaText_', 'buildParsedReport_', 'canonicalSubproducto_',
  'extractHtmlTableRows_', 'cleanHtmlCell_', 'htmlToText_',
  'decodeHtmlEntities_',
  'parseDateText_', 'extractSpanishDateKey_', 'parseOptionalNumber_',
  'isTotalGridRow_', 'isTotalText_', 'normalizeKey_', 'text_',
  'toNumber_', 'buildDateKey_', 'round_'
].map(recortar).join('\n'));

let fallos = 0;
function ok(c, t, extra) {
  console.log((c ? 'OK   ' : 'MAL  ') + t);
  if (!c) { fallos++; if (extra !== undefined) console.log('     ' + JSON.stringify(extra)); }
}

// El encabezado real de la planilla, en su orden de siempre.
const CABECERA = [
  'FECHA', 'CUMPLIMIENTO SUBPRODUCTOS', 'PROVEEDORES', 'PRODUCTOS', 'productos'
];

// --- 1. El día en cero, tal como llega --------------------------------
const enCero = parseGridRows_([
  CABECERA,
  ['25/09/2026', '', '', '', '0'],
  ['', 'Total', '', '', '0']
]);

ok(enCero.reconocida === true,
   'la tabla del día en cero SÍ se reconoce: es el mismo orden');
ok(enCero.rows.length === 0, 'y no trae filas de detalle', enCero.rows);
ok(enCero.fecha === '2026-09-25', 'pero sí la fecha', enCero.fecha);

// --- 2. Una tabla que no es la planilla no se reconoce ----------------
const ajena = parseGridRows_([
  ['Nombre', 'Cargo', 'Anexo'],
  ['Fabian Agurto', 'Jefe de planta', '2231']
]);

ok(ajena.reconocida === false,
   'una tabla cualquiera del correo no se hace pasar por planilla');

// --- 3. El día normal sigue leyéndose igual ---------------------------
const normal = parseGridRows_([
  CABECERA,
  ['24/09/2026', 'ASTILLA PINO VERDE', 'PROMASA SPA.', 'TABLEROS', '3'],
  ['', '', 'LAMINADORA LOS ANGELES S.A.', 'TABLEROS', '2'],
  ['', 'Total', '', '', '5']
]);

ok(normal.reconocida === true && normal.rows.length === 2,
   'un día con despachos trae sus filas', normal.rows.length);
ok(normal.rows[0].proveedor === 'PROMASA SPA.' && normal.rows[0].camiones === 3,
   'con su proveedor y sus camiones', normal.rows[0]);
ok(normal.rows[1].subproducto === 'ASTILLA PINO VERDE',
   'y el subproducto se arrastra hacia abajo', normal.rows[1]);

// --- 4. El correo completo, de punta a punta --------------------------
function correo(html, asunto) {
  return {
    getSubject: function() { return asunto; },
    getBody: function() { return html; },
    getPlainBody: function() { return htmlToText_(html); },
    getAttachments: function() { return []; }
  };
}

function tablaHtml(filas) {
  return '<table>' + filas.map(function(f) {
    return '<tr>' + f.map(function(c) {
      return '<td>' + c + '</td>';
    }).join('') + '</tr>';
  }).join('') + '</table>';
}

// El asunto y el cuerpo reales del 25 de septiembre.
const ASUNTO = 'PLANILLA CUMPLIMIENTO SUBPRODUCTOS, "VIERNES 25 DE SEPTIEMBRE DE 2026.".';
const CUERPO =
  '<p>Se&ntilde;or<br>Fabian Agurto:</p>' +
  '<p>Estimado, le envi&oacute;: ' + ASUNTO + '</p>' +
  tablaHtml([
    CABECERA,
    ['25/09/2026', '', '', '', '0'],
    ['', 'Total', '', '', '0']
  ]);

let leido = null;
let reventó = '';

try {
  leido = parsePlanillaEmail_(correo(CUERPO, ASUNTO), CONFIG.TIMEZONE);
} catch (e) {
  reventó = String(e.message || e);
}

ok(!reventó, 'el correo del 25 ya no revienta', reventó);
ok(leido && leido.sinDespacho === true,
   'se lee como día sin despacho', leido);
ok(leido && leido.fecha === '2026-09-25', 'con su fecha', leido && leido.fecha);
ok(leido && leido.rows.length === 0, 'y sin filas que sumar');
ok(leido && leido.method === 'Tabla HTML del correo',
   'diciendo de dónde salió', leido && leido.method);

// --- 5. Sin fecha en ninguna parte, sigue siendo un error -------------
let sinFecha = '';

try {
  parsePlanillaEmail_(
    correo(tablaHtml([CABECERA, ['', '', '', '', '0']]), 'CUMPLIMIENTO SUBPRODUCTOS'),
    CONFIG.TIMEZONE
  );
} catch (e) {
  sinFecha = String(e.message || e);
}

ok(/fecha/i.test(sinFecha),
   'una tabla vacía y sin fecha sigue siendo un error, no un día en cero',
   sinFecha);

// --- 6. Un correo sin tabla tampoco se inventa un día -----------------
let sinTabla = '';

try {
  parsePlanillaEmail_(
    correo('<p>Estimado, mañana no habrá despacho.</p>',
           'CUMPLIMIENTO SUBPRODUCTOS 25 DE SEPTIEMBRE DE 2026'),
    CONFIG.TIMEZONE
  );
} catch (e) {
  sinTabla = String(e.message || e);
}

ok(!!sinTabla,
   'un correo sin planilla no pasa como día sin despacho', sinTabla);

// --- 7. El día normal, por el mismo camino ----------------------------
const normalCorreo = parsePlanillaEmail_(
  correo(
    tablaHtml([
      CABECERA,
      ['24/09/2026', 'ASTILLA PINO VERDE', 'PROMASA SPA.', 'TABLEROS', '3'],
      ['', 'Total', '', '', '3']
    ]),
    'PLANILLA CUMPLIMIENTO SUB-PRODUCTOS JUEVES 24 DE SEPTIEMBRE DE 2026'
  ),
  CONFIG.TIMEZONE
);

ok(!normalCorreo.sinDespacho && normalCorreo.rows.length === 1,
   'un día con despachos no se marca sin despacho', normalCorreo);

console.log(fallos ? '\n' + fallos + ' FALLOS' : '\nTodo OK');
process.exitCode = fallos ? 1 : 0;
