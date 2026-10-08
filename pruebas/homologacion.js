/**
 * La homologación en dos tiempos.
 *
 * El caso que manda acá es el del proveedor que empieza a despachar
 * antes de que SAP lo tenga cargado: la planilla ya lo nombra, el
 * selector no tiene a quién asignarlo, y mientras nadie pueda escribir
 * nada ese nombre cuenta como un proveedor inventado más —uno por cada
 * forma en que la planilla lo escriba— y su plan no tiene contra qué
 * compararse.
 *
 * Primer tiempo: se agrega con su propio nombre. Segundo: el día que
 * SAP lo crea, se reapunta y se lleva el grupo entero.
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

/** Una constante del archivo, tal como está escrita. */
function recortarConst(nombre) {
  const m = src.match(
    new RegExp('const ' + nombre + '\\s*=[\\s\\S]*?;\\n')
  );

  if (!m) { throw new Error('falta const ' + nombre); }

  return m[0];
}

const CONFIG = {
  SPREADSHEET_ID: 'libro',
  SHEET_PROVEEDORES: 'Proveedores',
  FUZZY_THRESHOLD: 0.72
};

eval([
  recortarConst('SIN_SAP_PREFIJO'),
  recortarConst('NOTA_SIN_SAP')
].concat([
  'declararProveedor', 'asignarProveedor', 'reasignarProveedor',
  'escribirFilaProveedor_', 'leerProveedores_', 'columnasProveedores_',
  'buildHomologacionPendiente_', 'buildHomologacionMapa_',
  'agruparPendientes_', 'resolverGrupo',
  'gruposProvisorios_', 'candidatosSap_', 'resolveProveedor_',
  'homologarProveedor_', 'proveedorComparable_', 'proveedorSimilitud_',
  'candidatosDelCruce_', 'uniqueTokens_', 'levenshtein_',
  'uniqueSorted_', 'isTotalText_',
  'autorActual_', 'normalizeHeader_', 'normalizeKey_', 'text_',
  'round_'
].map(recortar)).join('\n'));

let fallos = 0;
function ok(c, t, extra) {
  console.log((c ? 'OK   ' : 'MAL  ') + t);
  if (!c) { fallos++; if (extra !== undefined) console.log('     ' + JSON.stringify(extra)); }
}

/* ---------------------------------------------------------------------
 * La hoja Proveedores, en memoria.
 * ------------------------------------------------------------------ */
const CABECERA = [
  'Proveedor SAP', 'Alias', 'Origen', 'Notas',
  'Actualizado', 'Actualizado por'
];

function hojaFalsa(filas) {
  const datos = filas.map(function(f) { return f.slice(); });

  function ancho() {
    return datos.reduce(function(m, f) {
      return Math.max(m, f.length);
    }, 0);
  }

  function celda(fila, columna) {
    const f = datos[fila - 1] || [];
    const v = f[columna - 1];

    return v === undefined ? '' : v;
  }

  const hoja = {
    datos: datos,
    getName: function() { return 'Proveedores'; },
    getLastRow: function() { return datos.length; },
    getLastColumn: function() { return ancho(); },
    getRange: function(fila, columna, alto, anchoPedido) {
      const altoReal = alto || 1;
      const anchoReal = anchoPedido || 1;

      return {
        setValue: function(valor) {
          while (datos.length < fila) { datos.push([]); }

          const f = datos[fila - 1];

          while (f.length < columna) { f.push(''); }

          f[columna - 1] = valor;
          return this;
        },
        getValues: function() {
          const salida = [];

          for (let r = 0; r < altoReal; r++) {
            const f = [];

            for (let c = 0; c < anchoReal; c++) {
              f.push(celda(fila + r, columna + c));
            }

            salida.push(f);
          }

          return salida;
        }
      };
    },
    getDataRange: function() {
      return hoja.getRange(1, 1, datos.length, ancho());
    }
  };

  return hoja;
}

let HOJA = null;

const SpreadsheetApp = {
  openById: function() {
    return {
      getSheetByName: function(nombre) {
        return nombre === 'Proveedores' ? HOJA : null;
      }
    };
  }
};

function homologacion() {
  return leerProveedores_(SpreadsheetApp.openById());
}

/* ---------------------------------------------------------------------
 * El escenario: AITUE nos entrega nitens y SAP no lo tiene cargado.
 * ------------------------------------------------------------------ */
const SAP = [
  'LAMINADORA LOS ANGELES S.A.',
  'PROMASA SPA.'
];

function filasPlanilla(proveedorResuelto, crudo, metodo) {
  return [{
    fecha: '2026-10-06',
    source: 'PLANILLA',
    subproducto: 'ASTILLA EUCALYPTUS NITENS',
    proveedor: proveedorResuelto,
    proveedorRaw: crudo,
    matchMethod: metodo,
    camiones: 2,
    ts: 30.4
  }];
}

// --- 1. Antes de agregarlo: el nombre queda suelto --------------------
HOJA = hojaFalsa([CABECERA]);

const antes = buildHomologacionPendiente_(
  filasPlanilla('AITUE NITENS SPA', 'Aitue nitens', 'Solo en planilla'),
  SAP,
  homologacion(),
  { porProveedor: [] },
  []
);

ok(antes.sinPar === 1 && antes.lista[0].alias === 'Aitue nitens',
   'el nombre que SAP no tiene entra como sin par', antes.lista);
ok((antes.provisorios || []).length === 0,
   'y todavía no es grupo de nada', antes.provisorios);

const mapaAntes = buildHomologacionMapa_(
  SAP,
  filasPlanilla('AITUE NITENS SPA', 'Aitue nitens', 'Solo en planilla'),
  { porProveedor: [] },
  [],
  homologacion()
);

ok(mapaAntes.lista.length === 2,
   'el mapa solo tiene los dos de SAP: el proveedor no aparece en ninguna fila',
   mapaAntes.lista.map(function(x) { return x.sap; }));

// --- 2. Se agrega con su propio nombre --------------------------------
const puesto = declararProveedor('AITUE NITENS SPA');

ok(puesto.escrito === true && puesto.nombre === 'AITUE NITENS SPA',
   'se puede agregar aunque no esté en SAP', puesto);
ok(HOJA.datos.length === 2 &&
   HOJA.datos[1][0] === 'AITUE NITENS SPA' &&
   HOJA.datos[1][1] === 'AITUE NITENS SPA',
   'queda escrito en las dos celdas, cabeza de su propio grupo',
   HOJA.datos[1]);
ok(String(HOJA.datos[1][3]).indexOf('Todavía no está en SAP') === 0,
   'con la nota que dice que falta SAP', HOJA.datos[1][3]);
ok(HOJA.datos[1][2] === 'Panel', 'y de dónde salió', HOJA.datos[1][2]);

// --- 3. Desde ahí cruza, y cruza por la hoja --------------------------
const cruce = resolveProveedor_(
  'AITUE NITENS SPA', SAP, homologacion()
);

ok(cruce.method === 'Homologado a mano' &&
   cruce.proveedor === 'AITUE NITENS SPA',
   'el nombre ya cruza, y no por parecido', cruce);

// Y lo que importa de verdad: sus OTRAS formas llegan solas.
const variante = resolveProveedor_('Aitue nitens', SAP, homologacion());

ok(variante.proveedor === 'AITUE NITENS SPA',
   'las otras formas de escribirlo caen solas en el proveedor agregado',
   variante);

const ajeno = resolveProveedor_('FORESTAL EL BOSQUE', SAP, homologacion());

ok(ajeno.method === 'Solo en planilla',
   'y un proveedor distinto no se cuela por el camino nuevo', ajeno);

const despues = buildHomologacionPendiente_(
  filasPlanilla('AITUE NITENS SPA', 'AITUE NITENS SPA', 'Homologado a mano'),
  SAP,
  homologacion(),
  { porProveedor: [] },
  []
);

ok(despues.sinPar === 0,
   'y sale de la lista de pendientes', despues.lista);
ok((despues.provisorios || []).length === 1 &&
   despues.provisorios[0].cabeza === 'AITUE NITENS SPA',
   'pero no desaparece: queda esperando a SAP', despues.provisorios);
ok(despues.provisorios[0].cuantos === 0,
   'solo, sin más nombres colgando todavía',
   despues.provisorios[0].cuantos);
ok(despues.provisorios[0].ts === 30.4,
   'con lo que de verdad entró, no en cero',
   despues.provisorios[0].ts);

// --- 4. Y tiene fila en el mapa, marcada ------------------------------
const mapa = buildHomologacionMapa_(
  SAP,
  filasPlanilla('AITUE NITENS SPA', 'Aitue nitens', 'Homologado a mano'),
  { porProveedor: [{
      proveedor: 'AITUE NITENS SPA',
      proveedorRaw: 'Aitue',
      ts: 45.6
  }] },
  [{ proveedorPlan: 'AITUE NITENS', plan: 500 }],
  homologacion()
);

const suya = mapa.lista.filter(function(x) {
  return x.sap === 'AITUE NITENS SPA';
})[0];

ok(!!suya, 'el proveedor sin SAP tiene su fila en el mapa',
   mapa.lista.map(function(x) { return x.sap; }));
ok(suya && suya.sinSap === true,
   'marcada como que todavía no está en SAP', suya);
ok(suya && suya.planilla.length === 1 && suya.proyeccion.length === 1 &&
   suya.plan.length === 1 && suya.hojas === 3,
   'y agrupa las tres hojas igual que un proveedor de SAP', suya);
ok(suya && suya.ts === 30.4 && suya.tsProy === 45.6 && suya.planMes === 500,
   'con sus tres cifras', suya);
ok(mapa.sinSap === 1 && mapa.huerfanos === 2,
   'cuenta aparte: no es un huérfano de SAP, le falta SAP',
   { sinSap: mapa.sinSap, huerfanos: mapa.huerfanos });

// --- 5. Agregarlo dos veces no escribe dos filas ----------------------
const otraVez = declararProveedor('AITUE NITENS SPA');

ok(otraVez.escrito === false && HOJA.datos.length === 2,
   'agregarlo de nuevo no duplica la fila', otraVez);

// --- 6. Un nombre que ya cuelga de otro no se parte en dos ------------
asignarProveedor('Aitue', 'AITUE NITENS SPA');

let choque = '';

try {
  declararProveedor('Aitue');
} catch (e) {
  choque = String(e.message || e);
}

ok(/AITUE NITENS SPA/.test(choque),
   'un nombre ya agrupado no se agrega aparte: dice de quién cuelga',
   choque);

// --- 7. Ahora son dos nombres en el grupo -----------------------------
const conAlias = gruposProvisorios_(SAP, homologacion(), {
  'AITUE NITENS SPA': { ts: 30.4, tsProy: 0, planMes: 0 }
});

ok(conAlias.length === 1 && conAlias[0].cuantos === 1 &&
   conAlias[0].alias[0] === 'AITUE',
   'el alias cuelga de la cabeza', conAlias);

// --- 8. Una fila de totales no es un proveedor ------------------------
let total = '';

try {
  declararProveedor('Total ASTILLA PINO VERDE');
} catch (e) {
  total = String(e.message || e);
}

ok(/no es un proveedor/.test(total),
   'una fila de totales no se puede agregar', total);

// --- 9. El día que SAP lo crea: se reapunta y se lleva todo ----------
const SAP_CON_AITUE = SAP.concat(['AGRICOLA Y FORESTAL AITUE LTDA']);
const pasado = reasignarProveedor(
  'AITUE NITENS SPA', 'AGRICOLA Y FORESTAL AITUE LTDA'
);

ok(pasado.escrito === true && pasado.filas === 2,
   'la cabeza y su propia fila se van al nombre de SAP', pasado);

const yaEnSap = homologacion();

ok(yaEnSap.porAlias['AITUE NITENS SPA'] === 'AGRICOLA Y FORESTAL AITUE LTDA' &&
   yaEnSap.porAlias['AITUE'] === 'AGRICOLA Y FORESTAL AITUE LTDA',
   'y el grupo entero se va con ella, alias incluido',
   yaEnSap.porAlias);
ok(HOJA.datos[1][3] === '',
   'la nota de "todavía no está en SAP" se borra: ya no es verdad',
   HOJA.datos[1][3]);
ok(gruposProvisorios_(SAP_CON_AITUE, yaEnSap, {}).length === 0,
   'y deja de estar esperando a SAP',
   gruposProvisorios_(SAP_CON_AITUE, yaEnSap, {}));

const mapaFinal = buildHomologacionMapa_(
  SAP_CON_AITUE,
  filasPlanilla(
    'AGRICOLA Y FORESTAL AITUE LTDA', 'Aitue nitens', 'Homologado a mano'
  ),
  { porProveedor: [] },
  [],
  yaEnSap
);

ok(mapaFinal.sinSap === 0,
   'el mapa ya no lo marca sin SAP', mapaFinal.sinSap);
ok(mapaFinal.lista.filter(function(x) {
     return x.sap === 'AGRICOLA Y FORESTAL AITUE LTDA';
   })[0].planilla.length === 1,
   'y sus camiones de la planilla llegaron al proveedor de SAP');

// --- 10. Un proveedor que sí está en SAP no espera a nadie -----------
HOJA = hojaFalsa([
  CABECERA,
  ['PROMASA SPA.', 'Promasa', 'Panel', '', '', '']
]);

ok(gruposProvisorios_(SAP, homologacion(), {}).length === 0,
   'una cabeza que ya está en SAP no sale como pendiente',
   gruposProvisorios_(SAP, homologacion(), {}));

/* ---------------------------------------------------------------------
 * UN PROVEEDOR, SUS TRES NOMBRES, UNA SOLA DECISIÓN
 *
 * Lo difícil de homologar no es el cruce: es que el mismo proveedor
 * llega escrito por tres manos —planilla, Proyección y Plan— y la
 * lista los muestra como tres problemas sueltos.
 * ------------------------------------------------------------------ */
const SAP3 = ['LAMINADORA LOS ANGELES S.A.', 'PROMASA SPA.'];

HOJA = hojaFalsa([CABECERA]);

const tresManos = buildHomologacionPendiente_(
  // La planilla escribe un nombre que cruza por parecido.
  [{
    fecha: '2026-10-06', source: 'PLANILLA',
    subproducto: 'ASTILLA PINO VERDE',
    proveedor: 'LAMINADORA LOS ANGELES S.A.',
    proveedorRaw: 'LAMINADORA ANGELES DEL SUR',
    matchMethod: 'Coincidencia aproximada', camiones: 3, ts: 33
  }],
  SAP3,
  homologacion(),
  // Proyección escribe otro que no cruza, pero se le parece.
  { porProveedor: [{
      proveedor: 'LAMINADORA LOS ANGELE',
      proveedorRaw: 'LAMINADORA LOS ANGELE',
      matchMethod: 'Solo en planilla', ts: 44, camiones: 4
  }] },
  // Y el Plan, un tercero.
  [{ proveedorPlan: 'LAMINADORA LOS ANGELE', plan: 900 }]
);

const grupos = tresManos.grupos || [];
const laminadora = grupos.filter(function(g) {
  return normalizeKey_(g.destino) ===
    normalizeKey_('LAMINADORA LOS ANGELES S.A.');
})[0];

ok(grupos.length === 1,
   'los tres nombres son UN grupo, no tres problemas',
   grupos.map(function(g) { return g.destino + ':' + g.cuantos; }));
ok(!!laminadora && laminadora.enSap === true,
   'anclado en el proveedor de SAP', laminadora);
ok(laminadora && laminadora.cuantos === 2,
   'con los nombres distintos que lo escriben',
   laminadora && laminadora.nombres.map(function(n) { return n.alias; }));
ok(laminadora &&
   laminadora.hojas.join(' ') === 'Plan Planilla Proyección',
   'y dice de qué hojas viene cada uno',
   laminadora && laminadora.hojas);
ok(laminadora && laminadora.porEscribir === 1,
   'uno hay que escribirlo; el otro ya cruza y solo se confirma',
   laminadora && laminadora.porEscribir);
ok(laminadora && laminadora.ts === 33 && laminadora.tsProy === 44 &&
   laminadora.planMes === 900,
   'el grupo suma lo de las tres hojas', laminadora);
ok(laminadora && laminadora.candidatos.length &&
   laminadora.candidatos[0].proveedor === 'LAMINADORA LOS ANGELES S.A.',
   'y propone el de SAP al que se parecen',
   laminadora && laminadora.candidatos[0]);

// --- Sin ningún SAP al que parecerse, se juntan entre ellos ---------
const sueltos = buildHomologacionPendiente_(
  [{
    fecha: '2026-10-06', source: 'PLANILLA',
    subproducto: 'ASTILLA EUCALYPTUS NITENS',
    proveedor: 'Aitue nitens', proveedorRaw: 'Aitue nitens',
    matchMethod: 'Solo en planilla', camiones: 2, ts: 30.4
  }],
  SAP3,
  homologacion(),
  { porProveedor: [{
      proveedor: 'AITUE NITENS SPA', proveedorRaw: 'AITUE NITENS SPA',
      matchMethod: 'Solo en planilla', ts: 45.6, camiones: 3
  }] },
  []
);

const suelto = (sueltos.grupos || [])[0];

ok((sueltos.grupos || []).length === 1 && suelto.cuantos === 2,
   'dos formas del mismo nombre que SAP no tiene son un solo grupo',
   (sueltos.grupos || []).map(function(g) { return g.cuantos; }));
ok(suelto && suelto.enSap === false && !suelto.destino,
   'sin ancla en SAP: ese es el grupo que necesita la otra opción',
   suelto);

// --- Resolver el grupo de una vez ------------------------------------
HOJA = hojaFalsa([CABECERA]);

const resuelto = resolverGrupo(
  ['LAMINADORA ANGELES DEL SUR', 'LAMINADORA LOS ANGELE'],
  'LAMINADORA LOS ANGELES S.A.'
);

ok(resuelto.escritos === 2 && !resuelto.conflictos.length,
   'una sola acción escribe los dos nombres', resuelto);

const tras = homologacion();

ok(tras.porAlias[normalizeKey_('LAMINADORA ANGELES DEL SUR')] ===
     'LAMINADORA LOS ANGELES S.A.' &&
   tras.porAlias[normalizeKey_('LAMINADORA LOS ANGELE')] ===
     'LAMINADORA LOS ANGELES S.A.',
   'y los dos quedan apuntando al proveedor de SAP',
   tras.porAlias);

// Repetirlo no duplica filas, y el que apunta a otro se informa sin
// tumbar al resto.
asignarProveedor('OTRO NOMBRE', 'PROMASA SPA.');

const otraVuelta = resolverGrupo(
  ['LAMINADORA ANGELES DEL SUR', 'OTRO NOMBRE', 'TERCERO'],
  'LAMINADORA LOS ANGELES S.A.'
);

ok(otraVuelta.yaEstaban === 1 && otraVuelta.escritos === 1 &&
   otraVuelta.conflictos.length === 1 &&
   otraVuelta.conflictos[0].alias === 'OTRO NOMBRE',
   'no se cae por uno: dice cuál choca y escribe el resto',
   otraVuelta);

// --- Y el grupo que no está en SAP, bajo su propio nombre -----------
HOJA = hojaFalsa([CABECERA]);

const sinSap = resolverGrupo(
  ['Aitue nitens', 'AITUE NITENS SPA'],
  'AITUE NITENS SPA',
  true
);

const trasSinSap = homologacion();

ok(sinSap.escritos === 2 && sinSap.sinSap === true,
   'se agrega la cabeza y se le cuelga el resto, en una sola acción',
   sinSap);
ok(trasSinSap.porAlias[normalizeKey_('Aitue nitens')] ===
     'AITUE NITENS SPA' &&
   trasSinSap.canonicos.indexOf('AITUE NITENS SPA') !== -1,
   'con la cabeza declarada como proveedor', trasSinSap.porAlias);
ok(String(HOJA.datos[1][3]).indexOf('Todavía no está en SAP') === 0,
   'y con la nota de que todavía falta SAP', HOJA.datos[1][3]);

console.log(fallos ? '\n' + fallos + ' FALLOS' : '\nTodo OK');
process.exitCode = fallos ? 1 : 0;
