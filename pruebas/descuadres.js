/**
 * Dónde la planilla y SAP no cuentan lo mismo.
 *
 * La planilla la escribe una persona a mano y a veces registra menos de
 * lo que entró. Donde SAP tiene el día cargado el panel usa SAP, así
 * que el error no mueve ninguna cifra… y por eso mismo nadie lo veía.
 *
 * Lo que esta prueba cuida es que la lista se pueda creer: que solo
 * hable de días que cubren las dos fuentes, que no confunda un camión
 * liviano con un camión que falta, y que se calle cuando el día trae un
 * nombre sin homologar que podría ser el proveedor que parece faltar.
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
  FACTOR_CAMION: 11,
  FACTOR_POR_MATERIAL: {
    'ASTILLA EUCALYPTUS NITENS': 15.2,
    'AST. PINO VERDE C/ CORTEZA': 10.7,
    'ASTILLA PINO VERDE': 11
  }
};

eval([
  'buildDescuadres_', 'pareceAlgunSuelto_', 'factorDe_',
  'proveedorComparable_', 'proveedorSimilitud_', 'uniqueTokens_',
  'levenshtein_', 'uniqueSorted_', 'normalizeKey_', 'text_', 'round_'
].map(recortar).join('\n'));

let fallos = 0;
function ok(c, t, extra) {
  console.log((c ? 'OK   ' : 'MAL  ') + t);
  if (!c) { fallos++; if (extra !== undefined) console.log('     ' + JSON.stringify(extra)); }
}

const VERDE = 'ASTILLA PINO VERDE';
const NITENS = 'ASTILLA EUCALYPTUS NITENS';

function sap(fecha, proveedor, ts, subproducto) {
  return {
    fecha: fecha, source: 'INGRESOS', proveedor: proveedor,
    subproducto: subproducto || VERDE, camiones: null, ts: ts
  };
}

function plan(fecha, proveedor, camiones, subproducto, metodo) {
  const sub = subproducto || VERDE;

  return {
    fecha: fecha, source: 'PLANILLA', proveedor: proveedor,
    proveedorRaw: proveedor, subproducto: sub,
    matchMethod: metodo || 'Coincidencia exacta',
    camiones: camiones,
    ts: camiones * (CONFIG.FACTOR_POR_MATERIAL[sub] || 11)
  };
}

// --- 1. El proveedor que la planilla no nombró ------------------------
const falta = buildDescuadres_(
  [
    sap('2026-10-06', 'PROMASA SPA.', 33),
    sap('2026-10-06', 'LAMINADORA LOS ANGELES S.A.', 22)
  ],
  [plan('2026-10-06', 'PROMASA SPA.', 3)]
);

ok(falta.faltan.length === 1 &&
   falta.faltan[0].proveedor === 'LAMINADORA LOS ANGELES S.A.',
   'el proveedor que SAP registró y la planilla no nombra',
   falta.faltan);
ok(falta.faltan[0].camiones === 2 && falta.faltan[0].ts === 22,
   'con sus camiones y sus TS', falta.faltan[0]);
ok(falta.difieren.length === 0,
   'y el que sí nombró, cuadrado, no molesta', falta.difieren);
ok(falta.camionesFaltantes === 2,
   'los camiones que no quedaron registrados se suman',
   falta.camionesFaltantes);

// --- 2. Las cantidades que no cuadran --------------------------------
const difiere = buildDescuadres_(
  [
    sap('2026-10-06', 'PROMASA SPA.', 44),
    sap('2026-10-06', 'BIOMASA SUR', 22)
  ],
  [
    plan('2026-10-06', 'PROMASA SPA.', 2),
    plan('2026-10-06', 'BIOMASA SUR', 3)
  ]
);

const menos = difiere.difieren.filter(function(x) {
  return x.proveedor === 'PROMASA SPA.';
})[0];
const mas = difiere.difieren.filter(function(x) {
  return x.proveedor === 'BIOMASA SUR';
})[0];

ok(difiere.difieren.length === 2, 'los dos descuadres salen',
   difiere.difieren);
ok(menos && menos.diferencia === -2 && menos.camionesSap === 4,
   'anotó 2 camiones de menos que los que SAP pesó', menos);
ok(mas && mas.diferencia === 1,
   'y el otro, uno de más', mas);
ok(difiere.faltan.length === 0,
   'ninguno falta: los dos están en las dos fuentes');

// --- 3. Un camión liviano no es un camión que falta ------------------
const liviano = buildDescuadres_(
  [sap('2026-10-06', 'PROMASA SPA.', 20.9)],
  [plan('2026-10-06', 'PROMASA SPA.', 2)]
);

ok(liviano.difieren.length === 0,
   'dos camiones que pesaron 20,9 TS en vez de 22 no son un descuadre',
   liviano.difieren);

const medio = buildDescuadres_(
  [sap('2026-10-06', 'PROMASA SPA.', 15.4)],
  [plan('2026-10-06', 'PROMASA SPA.', 2)]
);

ok(medio.difieren.length === 1,
   'pero 15,4 TS para dos camiones sí: 0,6 justo entra',
   medio.difieren);
ok(medio.difieren.length === 1 && medio.difieren[0].diferencia === 0.6,
   'y el umbral no lo decide el error del punto flotante: 15,4/11 ' +
   'da 1,4000000000000001',
   medio.difieren[0]);

// --- 4. Sin las dos fuentes no se compara nada -----------------------
const soloPlanilla = buildDescuadres_(
  [sap('2026-10-05', 'PROMASA SPA.', 22)],
  [plan('2026-10-06', 'PROMASA SPA.', 3)]
);

ok(soloPlanilla.faltan.length === 0 && soloPlanilla.difieren.length === 0,
   'un día que SAP no tiene cargado no se compara: la planilla es lo único que hay',
   soloPlanilla);

const soloSap = buildDescuadres_(
  [sap('2026-10-06', 'PROMASA SPA.', 22)],
  []
);

ok(soloSap.faltan.length === 0,
   'y un día sin planilla tampoco: no hay nada que revisar', soloSap);

// --- 5. El factor es el del material --------------------------------
const porMaterial = buildDescuadres_(
  [sap('2026-10-06', 'AITUE', 30.4, NITENS)],
  [
    plan('2026-10-06', 'AITUE', 2, NITENS),
    plan('2026-10-06', 'PROMASA SPA.', 1)
  ]
);

ok(porMaterial.difieren.length === 0,
   'dos camiones de nitens son 30,4 TS, no 22: el factor es del material',
   porMaterial.difieren);

// --- 6. Mientras haya un nombre sin homologar, no se acusa ----------
const dudoso = buildDescuadres_(
  [sap('2026-10-06', 'AGRICOLA Y FORESTAL AITUE LTDA', 30.4, NITENS)],
  [
    plan('2026-10-06', 'Aitue', 2, NITENS, 'Solo en planilla'),
    plan('2026-10-06', 'PROMASA SPA.', 1)
  ]
);

ok(dudoso.faltan.length === 0 && dudoso.ambiguos === 1,
   'un nombre sin homologar que se parece al que falta no se acusa: se cuenta aparte',
   dudoso);

const ajeno = buildDescuadres_(
  [sap('2026-10-06', 'LAMINADORA LOS ANGELES S.A.', 22)],
  [
    plan('2026-10-06', 'Madeex', 1, VERDE, 'Solo en planilla'),
    plan('2026-10-06', 'PROMASA SPA.', 1)
  ]
);

ok(ajeno.faltan.length === 1 && ajeno.ambiguos === 0,
   'pero un nombre suelto que no se parece en nada no tapa el caso',
   ajeno);

// --- 7. Una fila de cero TS no dice que el proveedor entró -----------
const enCero = buildDescuadres_(
  [
    sap('2026-10-06', 'PROMASA SPA.', 22),
    sap('2026-10-06', 'BIOMASA SUR', 0)
  ],
  [plan('2026-10-06', 'PROMASA SPA.', 2)]
);

ok(enCero.faltan.length === 0,
   'un ingreso de cero TS no se reclama como camión no registrado',
   enCero.faltan);

// --- 8. Lo más nuevo primero -----------------------------------------
const orden = buildDescuadres_(
  [
    sap('2026-10-01', 'LAMINADORA LOS ANGELES S.A.', 22),
    sap('2026-10-07', 'BIOMASA SUR', 22)
  ],
  [
    plan('2026-10-01', 'PROMASA SPA.', 1),
    plan('2026-10-07', 'PROMASA SPA.', 1)
  ]
);

ok(orden.faltan.length === 2 && orden.faltan[0].fecha === '2026-10-07',
   'lo más nuevo primero: el error de ayer todavía se puede conversar',
   orden.faltan.map(function(x) { return x.fecha; }));

console.log(fallos ? '\n' + fallos + ' FALLOS' : '\nTodo OK');
process.exitCode = fallos ? 1 : 0;
