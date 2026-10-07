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
  'columnasPorForma_', 'columnasDesdeFila_', 'celdaSoloNumero_',
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

/* =====================================================================
 * LA PLANILLA SIN FILA DE ENCABEZADOS
 *
 * Así llegó la del martes 6 de octubre: sin rótulos, empezando directo
 * por la fecha y el total del día. El orden de las columnas es el
 * mismo de siempre. Buscando el rótulo "PROVEEDORES" la tabla salía
 * vacía y el día se perdía, así que ahora se reconoce por la forma.
 * ===================================================================== */

// Tal como se ve en el correo, con el detalle completo.
const SIN_CABECERA = [
  ['06/10/2026', 'Total', '', '', '0'],
  ['', 'ASERRÍN COMBUSTIBLE', 'COMERCIAL EL CHACAY LTDA.', 'NEOMAS', '2'],
  ['', 'Total ASERRÍN COMBUSTIBLE', '', '', '2'],
  ['', 'ASERRÍN PINO VERDE', 'ALTO LONQUEN', 'TABLEROS', '1'],
  ['', '', 'ASERRADEROS LOS CASTAÑOS LTDA.', 'TABLEROS', '3'],
  ['', '', 'BIOMASA SUR', 'TABLEROS', '1'],
  ['', '', 'LAMINADORA LOS ANGELES S.A.', 'TABLEROS', '1'],
  ['', 'Total ASERRÍN PINO VERDE', '', '', '6'],
  ['', 'ASTILLA PINO VERDE', 'PROMASA SPA.', 'TABLEROS', '4'],
  ['', '', 'ALTO LONQUEN', 'TABLEROS', '2'],
  ['', 'Total ASTILLA PINO VERDE', '', '', '6'],
  ['', 'ASTILLA EUCALYPTUS NITENS', 'AGRICOLA Y FORESTAL AITUE', 'TABLEROS', '1'],
  ['', 'Total ASTILLA EUCALYPTUS NITENS', '', '', '1']
];

// --- 8. Se lee aunque no haya encabezados -----------------------------
const sinCabecera = parseGridRows_(SIN_CABECERA);

ok(sinCabecera.reconocida === true,
   'la planilla sin encabezados se reconoce igual');
ok(sinCabecera.fecha === '2026-10-06',
   'con la fecha de la primera columna', sinCabecera.fecha);
ok(sinCabecera.rows.length === 3,
   'y solo las filas de astilla de proceso', sinCabecera.rows);

const porProveedor = {};
sinCabecera.rows.forEach(function(r) { porProveedor[r.proveedor] = r; });

ok(!!porProveedor['PROMASA SPA.'] &&
   porProveedor['PROMASA SPA.'].camiones === 4 &&
   porProveedor['PROMASA SPA.'].subproducto === 'ASTILLA PINO VERDE' &&
   porProveedor['PROMASA SPA.'].destino === 'TABLEROS',
   'cada columna en su lugar: proveedor, destino y camiones',
   porProveedor['PROMASA SPA.']);
ok(!!porProveedor['ALTO LONQUEN'] &&
   porProveedor['ALTO LONQUEN'].subproducto === 'ASTILLA PINO VERDE' &&
   porProveedor['ALTO LONQUEN'].camiones === 2,
   'el subproducto se arrastra hacia abajo también acá',
   porProveedor['ALTO LONQUEN']);
ok(!!porProveedor['AGRICOLA Y FORESTAL AITUE'] &&
   porProveedor['AGRICOLA Y FORESTAL AITUE'].subproducto ===
     'ASTILLA EUCALYPTUS NITENS',
   'y el nitens se lee como nitens',
   porProveedor['AGRICOLA Y FORESTAL AITUE']);
ok(!porProveedor['COMERCIAL EL CHACAY LTDA.'] &&
   !porProveedor['BIOMASA SUR'],
   'el aserrín no entra: no es astilla de proceso',
   Object.keys(porProveedor));

// --- 9. El correo completo del 6 de octubre ---------------------------
const SEIS = parsePlanillaEmail_(
  correo(
    '<p>Se&ntilde;or<br>Fabian Agurto:</p>' +
    '<p>Estimado, le env&iacute;o la planilla.</p>' +
    tablaHtml(SIN_CABECERA),
    'PLANILLA CUMPLIMIENTO SUB-PRODUCTOS MARTES 06 DE OCTUBRE DE 2026'
  ),
  CONFIG.TIMEZONE
);

ok(SEIS.fecha === '2026-10-06' && SEIS.rows.length === 3,
   'el correo del 6 de octubre entra completo', SEIS);
ok(SEIS.method === 'Tabla HTML del correo',
   'por la tabla del cuerpo', SEIS.method);
ok(!SEIS.sinDespacho, 'y no se marca sin despacho');

// --- 10. La tabla no tiene que ser la primera del correo --------------
const conFirma = parseGridRows_(
  [
    ['Fabian Agurto', 'Jefe de planta', 'anexo 2231'],
    ['Reservador Horario', 'Informes', 'anexo 2240']
  ].concat(SIN_CABECERA)
);

ok(conFirma.reconocida === true &&
   conFirma.fecha === '2026-10-06' &&
   conFirma.rows.length === 3,
   'una tabla antes de la planilla no la tapa', conFirma.rows.length);

// --- 11. La guardia: tres condiciones, no una ------------------------
ok(parseGridRows_([
     ['Nombre', 'Cargo', 'Anexo', 'Correo', 'Interno'],
     ['Fabian Agurto', 'Jefe de planta', 'planta', 'si', '2231']
   ]).reconocida === false,
   'sin fecha no es planilla');

ok(parseGridRows_([
     ['06/10/2026', 'Reunión de turno', 'Sala 2', 'Planta', '3'],
     ['', 'Entrega de EPP', 'Bodega', 'Planta', '1']
   ]).reconocida === false,
   'con fecha y números, pero sin ninguna fila Total, tampoco');

ok(parseGridRows_([
     ['06/10/2026', 'Total', 'Turno A'],
     ['', 'Total turno', 'Turno B']
   ]).reconocida === false,
   'con fecha y Total, pero sin columna de números, tampoco');

ok(parseGridRows_([
     ['Planilla enviada el 06/10/2026'],
     ['Total de correos: 1']
   ]).reconocida === false,
   'una fecha suelta en un párrafo no abre la tabla');

// --- 11b. Si mañana le cambian los rótulos, la forma salva el día ----
const otroRotulo = parseGridRows_(
  [['FECHA', 'SUBPRODUCTO', 'PROVEEDOR / RAZÓN SOCIAL', 'DESTINO', 'CAMIONES']]
    .concat(SIN_CABECERA)
);

ok(otroRotulo.reconocida === true &&
   otroRotulo.fecha === '2026-10-06' &&
   otroRotulo.rows.length === 3,
   'un encabezado con otros rótulos ya no tira la tabla entera',
   otroRotulo.rows.length);

// --- 12. Un día en cero sin encabezados sigue siendo día sin despacho -
const ceroSinCabecera = parsePlanillaEmail_(
  correo(
    tablaHtml([['06/10/2026', 'Total', '', '', '0']]),
    'PLANILLA CUMPLIMIENTO SUB-PRODUCTOS MARTES 06 DE OCTUBRE DE 2026'
  ),
  CONFIG.TIMEZONE
);

ok(ceroSinCabecera.sinDespacho === true &&
   ceroSinCabecera.fecha === '2026-10-06' &&
   ceroSinCabecera.rows.length === 0,
   'el día en cero se lee sin encabezados igual que con ellos',
   ceroSinCabecera);

// --- 13. El número tiene que ser un número ---------------------------
ok(celdaSoloNumero_('3') && celdaSoloNumero_(3) && celdaSoloNumero_(' 12 '),
   'una celda con el número solo sí es número');
ok(!celdaSoloNumero_('COMERCIAL EL CHACAY LTDA.') &&
   !celdaSoloNumero_('TABLEROS') &&
   !celdaSoloNumero_(''),
   'un nombre con punto final no se hace pasar por número');

console.log(fallos ? '\n' + fallos + ' FALLOS' : '\nTodo OK');
process.exitCode = fallos ? 1 : 0;
