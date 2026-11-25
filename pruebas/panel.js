/**
 * El panel por dentro: la pestaña Homologación.
 *
 * Esta prueba no mira el servidor sino el dibujo. Recorta de Index.html
 * las funciones que arman las tablas y las corre con un DOM de
 * mentira: así se sabe que el panel muestra el proveedor que todavía
 * no está en SAP, que el filtro no lo confunde con un huérfano y que
 * el selector ofrece agregarlo.
 */
const fs = require('fs');
const path = require('path');

const src = fs.readFileSync(
  path.join(__dirname, '..', 'Index.html'), 'utf8'
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

// --- DOM mínimo -----------------------------------------------------
const CAJAS = {};
function caja(id) {
  if (!CAJAS[id]) {
    CAJAS[id] = {
      id: id, innerHTML: '', textContent: '', hidden: false,
      clases: {},
      classList: {
        toggle: function(n, on) { CAJAS[id].clases[n] = !!on; },
        add: function(n) { CAJAS[id].clases[n] = true; },
        contains: function(n) { return !!CAJAS[id].clases[n]; }
      }
    };
  }
  return CAJAS[id];
}
const document = {
  getElementById: caja,
  hidden: false,
  activeElement: null,
  body: caja('body')
};

var HOMO_OCUPADO = false;
var VIVO = { cada: 3 * 60 * 1000, ultima: 0, fallo: false };

// --- Ayudantes del panel, tal como están ----------------------------
function setText(id, t) { caja(id).textContent = String(t); }
function esc(v) {
  return String(v === null || v === undefined ? '' : v)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
function formatQuantity(n) { return String(Math.round(n * 10) / 10); }
function formatInteger(n) { return String(Math.round(n)); }
function formatPercent(n) { return Math.round(n * 100) + '%'; }
function formatDateKey(k) { return String(k || '—'); }
function shortProvider(n) { return String(n || ''); }
function shortProduct(n) {
  if (n === 'ASTILLA EUCALYPTUS NITENS') { return 'Eucalyptus Nitens'; }
  if (n === 'ASTILLA PINO VERDE') { return 'Pino verde'; }
  return String(n || '');
}
function celdaN(t) { return '<td class="number">' + t + '</td>'; }
function colorProducto(n) { return 'var(--sub-' + String(n || '') + ')'; }
function vacio(t) { return '<p>' + t + '</p>'; }
var HOMO_MAPA_FILTRO = '';
var HOMO_ALCANCE = 'mes';
var HOMO_SIN_SAP = '__SIN_SAP__';
var DATA = {};

var SIN_SAP_PREFIJO = '__SIN_SAP__||';

eval([
  'normalizaNombre', 'celdaNombres', 'homoMapa',
  'dibujarHomoMapa', 'homoProvisorios', 'homoTabla',
  'dibujarDescuadres', 'esDelMes', 'homoGrupos', 'sellosDeHoja',
  'dibujarHomoGrupos', 'marcarVivo', 'puedeRefrescar', 'esEstimado',
  'marcarPermisos', 'camionesPorMaterial', 'subMinimo', 'porMaterial',
  'repartir'
].map(recortar).join('\n'));

// --- Datos como los manda el servidor -------------------------------
DATA = {
  month: { startKey: '2026-10-01', endKey: '2026-10-31' },
  source: { homologacion: {
    mapa: {
      lista: [
        { sap: 'PROMASA SPA.', planilla: ['Promasa'], proyeccion: ['Promasa'],
          plan: ['PROMASA'], ingresos: true, sinSap: false, hojas: 3,
          alias: ['Promasa'], ts: 120, tsProy: 90, planMes: 800, faltaEn: [] },
        { sap: 'AITUE NITENS SPA', planilla: ['Aitue nitens'],
          proyeccion: [], plan: [], ingresos: false, sinSap: true, hojas: 1,
          alias: ['Aitue nitens'], ts: 30.4, tsProy: 0, planMes: 0,
          faltaEn: ['Proyección', 'Plan'] },
        { sap: 'LAMINADORA LOS ANGELES S.A.', planilla: [], proyeccion: [],
          plan: [], ingresos: true, sinSap: false, hojas: 0, alias: [],
          ts: 0, tsProy: 0, planMes: 0,
          faltaEn: ['Planilla', 'Proyección', 'Plan'] }
      ],
      completos: 1, huerfanos: 1, sinSap: 1
    }
  } }
};

let fallos = 0;
function ok(c, t, extra) {
  console.log((c ? 'OK   ' : 'MAL  ') + t);
  if (!c) { fallos++; if (extra !== undefined) console.log('     ' + extra); }
}

// 1. El mapa
dibujarHomoMapa();
const cuerpo = caja('homoMapaBody').innerHTML;

ok(cuerpo.indexOf('AITUE NITENS SPA') !== -1,
   'el proveedor sin SAP sale en el mapa');
ok(cuerpo.indexOf('homo-sin-sap') !== -1,
   'con su fila marcada');
ok(cuerpo.indexOf('todavía no está en SAP · falta en Proyección, Plan') !== -1,
   'y diciendo qué le falta', cuerpo.slice(0, 400));
ok(caja('homoMapaNota').innerHTML.indexOf('1</b> todavía no está en SAP') !== -1,
   'la nota lo cuenta', caja('homoMapaNota').innerHTML);
ok((cuerpo.match(/<tr/g) || []).length === 3, 'las tres filas');

// 2. El filtro nuevo
HOMO_MAPA_FILTRO = 'sinSap';
dibujarHomoMapa();
ok((caja('homoMapaBody').innerHTML.match(/<tr/g) || []).length === 1,
   'el filtro deja solo el que espera a SAP');

HOMO_MAPA_FILTRO = 'huerfanos';
dibujarHomoMapa();
ok(caja('homoMapaBody').innerHTML.indexOf('LAMINADORA') !== -1 &&
   caja('homoMapaBody').innerHTML.indexOf('AITUE') === -1,
   'y el de huérfanos no confunde "le falta SAP" con "nadie lo nombra"');
HOMO_MAPA_FILTRO = '';

// 3. Los grupos esperando a SAP, uno solo y uno con alias
homoProvisorios({
  proveedoresSap: ['PROMASA SPA.'],
  provisorios: [
    { cabeza: 'AITUE NITENS SPA', alias: [], cuantos: 0,
      ts: 30.4, tsProy: 0, planMes: 0, candidatos: [] },
    { cabeza: 'MADEEX', alias: ['MADEX', 'MADEEX SA'], cuantos: 2,
      ts: 10, tsProy: 20, planMes: 300,
      candidatos: [{ proveedor: 'PROMASA SPA.', score: 0.4 }] }
  ]
});

const prov = caja('homoProvisorios').innerHTML;

ok(prov.indexOf('agregado con su propio nombre') !== -1,
   'el agregado a mano se explica solo', prov.slice(0, 300));
ok(prov.indexOf('solo este') !== -1, 'y no dice "0 nombres cuelgan"');
ok(prov.indexOf('2 nombres cuelgan') !== -1,
   'el grupo con alias sigue igual');
ok(prov.indexOf('Plan mes') !== -1 && prov.indexOf('>300<') !== -1,
   'y ahora se ve su plan del mes');
ok(caja('panelProvisorios').hidden === false, 'el panel se muestra');

// 4. La opción nueva del selector
homoTabla('homoSinPar', 'homoConteoSinPar', [{
  alias: 'Aitue nitens', metodo: 'Solo en planilla', sinPar: true,
  resuelto: 'Aitue nitens', ts: 30.4, camiones: 2, tsProy: 0,
  camionesProy: 0, planMes: 0, origen: 'Planilla', dias: 1,
  primera: '2026-10-06', ultima: '2026-10-06',
  subproductos: ['ASTILLA EUCALYPTUS NITENS'], candidatos: []
}], true, { proveedoresSap: ['PROMASA SPA.'], lista: [] });

const tabla = caja('homoSinPar').innerHTML;

ok(tabla.indexOf('No está en SAP todavía') !== -1 &&
   tabla.indexOf('value="__SIN_SAP__"') !== -1,
   'el selector ofrece agregarlo sin SAP', tabla.slice(0, 500));
ok(tabla.indexOf('Agregarlo así, con este mismo nombre') !== -1,
   'con un texto que se entiende');

/* ---------------------------------------------------------------------
 * La planilla y SAP que no cuentan lo mismo.
 * ------------------------------------------------------------------ */
DATA.source.descuadres = {
  faltan: [{
    fecha: '2026-10-06', fechaLabel: '06-10',
    proveedor: 'LAMINADORA LOS ANGELES S.A.',
    subproducto: 'ASTILLA PINO VERDE', ts: 22, camiones: 2
  }],
  difieren: [{
    fecha: '2026-10-05', fechaLabel: '05-10',
    proveedor: 'PROMASA SPA.', subproducto: 'ASTILLA PINO VERDE',
    camionesPlanilla: 2, camionesSap: 4, ts: 44, diferencia: -2
  }],
  ambiguos: 1,
  camionesFaltantes: 2
};

dibujarDescuadres();

const desc = caja('listaDescuadres').innerHTML;

ok(caja('panelDescuadres').hidden === false,
   'el panel de descuadres aparece cuando hay casos');
ok(caja('conteoDescuadres').textContent === '2 casos',
   'contando los dos tipos juntos', caja('conteoDescuadres').textContent);
ok(desc.indexOf('no quedó registrado') !== -1 &&
   desc.indexOf('LAMINADORA') !== -1,
   'el proveedor que la planilla no nombró', desc.slice(0, 500));
ok(desc.indexOf('anotó 2 de menos') !== -1,
   'y el que anotó de menos, con cuánto');
ok(caja('descuadresNota').innerHTML.indexOf('1</b> no se pueden') !== -1,
   'los casos que no se pueden afirmar se dicen, no se esconden',
   caja('descuadresNota').innerHTML);

// Fuera del mes: no se muestra, pero se dice.
DATA.source.descuadres = {
  faltan: [{
    fecha: '2026-09-15', fechaLabel: '15-09',
    proveedor: 'PROMASA SPA.', subproducto: 'ASTILLA PINO VERDE',
    ts: 22, camiones: 2
  }],
  difieren: [], ambiguos: 0, camionesFaltantes: 2
};

dibujarDescuadres();

ok(caja('panelDescuadres').hidden === true,
   'sin casos del mes, el panel no ocupa lugar');
ok(caja('descuadresNota').innerHTML.indexOf('1</b> caso más') !== -1,
   'pero el de otro mes queda dicho',
   caja('descuadresNota').innerHTML);

/* ---------------------------------------------------------------------
 * Un proveedor, sus nombres, una decisión.
 * ------------------------------------------------------------------ */
function nombre(alias, origen, ultima, extra) {
  return Object.assign({
    alias: alias, origen: origen, ultima: ultima || '2026-10-06',
    sinPar: true, resuelto: alias, metodo: 'Solo en planilla',
    ts: 10, tsProy: 0, planMes: 0, camiones: 1, camionesProy: 0,
    dias: 1, score: 0
  }, extra || {});
}

DATA.source.homologacion.revision = {
  proveedoresSap: ['LAMINADORA LOS ANGELES S.A.', 'PROMASA SPA.'],
  grupos: [
    {
      clave: 'SAP||LAMINADORA', destino: 'LAMINADORA LOS ANGELES S.A.',
      enSap: true, score: 0.735, cuantos: 2, porEscribir: 1,
      hojas: ['Plan', 'Planilla'], candidatos: [
        { proveedor: 'LAMINADORA LOS ANGELES S.A.', score: 0.735 },
        { proveedor: 'PROMASA SPA.', score: 0.31 }
      ],
      ts: 33, tsProy: 44, planMes: 900,
      nombres: [
        nombre('LAMINADORA ANGELES DEL SUR', 'Planilla', '2026-10-06', {
          sinPar: false, metodo: 'Coincidencia aproximada',
          resuelto: 'LAMINADORA LOS ANGELES S.A.', ts: 33
        }),
        nombre('LAMINADORA LOS ANGELE', 'Plan y Proyección', '', {
          ts: 0, tsProy: 44, planMes: 900
        })
      ]
    },
    {
      clave: 'SUELTO||AITUE NITENS', destino: '', enSap: false, score: 0,
      cuantos: 2, porEscribir: 2, hojas: ['Planilla', 'Proyección'],
      candidatos: [], ts: 30.4, tsProy: 45.6, planMes: 0,
      nombres: [
        nombre('Aitue nitens', 'Planilla', '2026-10-06', { ts: 30.4 }),
        nombre('AITUE NITENS SPA', 'Proyección', '', { ts: 0, tsProy: 45.6 })
      ]
    }
  ]
};

dibujarHomoGrupos(DATA.source.homologacion.revision);

const gr = caja('homoGrupos').innerHTML;

ok((gr.match(/data-homo-grupo=/g) || []).length === 2,
   'una fila por proveedor, no por nombre: cuatro nombres, dos botones',
   (gr.match(/data-homo-grupo=/g) || []).length);
ok(gr.indexOf('LAMINADORA LOS ANGELES S.A.') !== -1 &&
   gr.indexOf('se parece 74%') !== -1,
   'con el proveedor de SAP propuesto y cuánto se parece',
   gr.slice(0, 400));
ok(gr.indexOf('1 nombre por escribir') !== -1,
   'y cuántos nombres hay que escribir de verdad');
ok(gr.indexOf('Todavía no está en SAP') !== -1,
   'el grupo sin ancla se nombra como lo que es');
ok(caja('gruposNota').innerHTML.indexOf('1</b> no tiene') !== -1,
   'y se dice cuántos están así', caja('gruposNota').innerHTML);
ok(gr.indexOf('>Asignar los 2<') !== -1,
   'un botón que asigna el grupo entero');
ok(gr.indexOf('sello-hoja">Plan y Proyección') === -1 &&
   gr.indexOf('>Plan</span>') !== -1 && gr.indexOf('>Proyección</span>') !== -1,
   'cada nombre con sus hojas, una por sello');
ok(gr.indexOf('value="LAMINADORA LOS ANGELES S.A." selected') !== -1,
   'si el parecido alcanza para cruzar solo, viene elegido');
ok(gr.indexOf('value="__SIN_SAP__||Aitue nitens"') !== -1,
   'y siempre está la opción de dejar uno de sus nombres como proveedor',
   gr.slice(gr.indexOf('No está en SAP todavía'), gr.indexOf('No está en SAP todavía') + 200));

// El alcance del mes recorta los nombres y recalcula las cifras.
HOMO_ALCANCE = 'mes';
DATA.source.homologacion.revision.grupos[0].nombres[1] =
  nombre('LAMINADORA VIEJA', 'Planilla', '2026-08-03', { ts: 500 });

const recortado = homoGrupos()[0];

ok(recortado.cuantos === 1 && recortado.ts === 33,
   'un nombre de otro mes sale del grupo, y las cifras se rehacen',
   [recortado.cuantos, recortado.ts]);

/* ---------------------------------------------------------------------
 * EN VIVO
 *
 * El panel vuelve a leer solo cada pocos minutos, porque el libro de
 * camiones se escribe mientras está abierto. Lo que cuida esta prueba
 * son las guardas: que esa relectura no caiga encima de alguien que
 * está trabajando.
 * ------------------------------------------------------------------ */
const MINUTO = 60 * 1000;

VIVO.ultima = 0;
marcarVivo();
ok(caja('selloVivo').textContent === '',
   'antes de la primera carga no dice nada',
   caja('selloVivo').textContent);

VIVO.ultima = Date.now();
marcarVivo();
ok(caja('selloVivo').textContent === 'en vivo · recién',
   'recién leído lo dice', caja('selloVivo').textContent);

VIVO.ultima = Date.now() - 5 * MINUTO;
marcarVivo();
ok(caja('selloVivo').textContent === 'en vivo · hace 5 min',
   'y después dice cuánto hace', caja('selloVivo').textContent);

VIVO.ultima = Date.now() - 12 * MINUTO;
marcarVivo();
ok(caja('selloVivo').classList.contains('es-flojo'),
   'pasados diez minutos el sello se apaga: el dato ya no es de ahora');

VIVO.fallo = true;
marcarVivo();
ok(caja('selloVivo').textContent === 'sin conexión',
   'si la relectura falla se dice, en vez de borrar la pantalla',
   caja('selloVivo').textContent);
VIVO.fallo = false;

// --- Las guardas ------------------------------------------------------
VIVO.ultima = Date.now() - 4 * MINUTO;
ok(puedeRefrescar() === true,
   'pasados los minutos del intervalo, se relee');

VIVO.ultima = Date.now() - 30 * 1000;
ok(puedeRefrescar() === false,
   'pero no antes de tiempo: cada relectura cuesta cuota');

VIVO.ultima = Date.now() - 4 * MINUTO;
document.hidden = true;
ok(puedeRefrescar() === false,
   'con la pestaña escondida no se relee: nadie la está mirando');
document.hidden = false;

HOMO_OCUPADO = true;
ok(puedeRefrescar() === false,
   'ni encima de una asignación en curso');
HOMO_OCUPADO = false;

document.activeElement = { tagName: 'SELECT' };
ok(puedeRefrescar() === false,
   'ni con un selector abierto: redibujar se lo cerraría en la cara');
document.activeElement = null;

ok(puedeRefrescar() === true, 'y despejado todo, vuelve a leer');

// --- Qué fila es estimada --------------------------------------------
ok(esEstimado({ source: 'CAMIONES' }) === true &&
   esEstimado({ source: 'PLANILLA' }) === true &&
   esEstimado({ source: 'INGRESOS' }) === false,
   'lo real es SAP; el libro y la planilla son estimación');

/* ---------------------------------------------------------------------
 * SOLO LECTURA
 *
 * Compartido como aplicación web, el panel lo abre gente que no tiene
 * acceso a las hojas. Ven todo; lo que no pueden hacer no se les
 * ofrece. (La negativa de verdad está en el servidor: esconder un
 * botón no impide llamar a la función.)
 * ------------------------------------------------------------------ */
DATA.permisos = { quien: 'alguien@masisa.com', puedeEditar: false };
marcarPermisos();

ok(document.body.classList.contains('solo-lectura'),
   'sin permiso de escritura, el panel se marca de solo lectura');
ok(caja('selloLectura').hidden === false,
   'y se dice, en vez de dejar botones que no funcionan');
ok(/alguien@masisa\.com/.test(caja('selloLectura').title),
   'diciendo como quién lo está viendo', caja('selloLectura').title);

DATA.permisos = { quien: 'dueño@masisa.com', puedeEditar: true };
marcarPermisos();

ok(!document.body.classList.contains('solo-lectura') &&
   caja('selloLectura').hidden === true,
   'con permiso, el panel queda como siempre');

// Un panel servido por una versión vieja del servidor no manda
// permisos: ahí no se esconde nada, que es como funcionaba antes.
DATA.permisos = undefined;
marcarPermisos();

ok(!document.body.classList.contains('solo-lectura'),
   'sin el dato, se asume que puede: no se rompe lo que ya andaba');

/* ---------------------------------------------------------------------
 * Camiones por material: la cuenta que va en la tarjeta
 * ------------------------------------------------------------------ */
const FLOTA = [
  // Treinta de pino verde, y uno de ellos partido en dos líneas de SAP.
  { subproducto: 'ASTILLA PINO VERDE', guia: '1001',
    proveedor: 'PROMASA S.A.', camiones: 1 },
  { subproducto: 'ASTILLA PINO VERDE', guia: '1001',
    proveedor: 'PROMASA S.A.', camiones: null },
  { subproducto: 'ASTILLA PINO VERDE', guia: '1002',
    proveedor: 'BIOMASA SUR', camiones: 1 },
  // La misma guía a nombre de otro proveedor es otro camión: el
  // número es la correlativa de cada uno.
  { subproducto: 'ASTILLA PINO VERDE', guia: '1001',
    proveedor: 'BIOMASA SUR', camiones: 1 },
  { subproducto: 'ASERRÍN PINO VERDE', guia: '47209',
    proveedor: 'LAMINADORA LOS ANGELES', camiones: 1 },
  // De la planilla vieja: venía por día y sin guía, así que se suma
  // como viene.
  { subproducto: 'ASTILLA EUCALYPTUS NITENS', guia: '',
    proveedor: 'FORESTAL AITUE', camiones: 4 }
];

const flota = camionesPorMaterial(FLOTA);

ok(flota['ASTILLA PINO VERDE'] === 3,
   'una guía partida en dos líneas es un camión, y la misma guía de ' +
   'otro proveedor es otro', flota);
ok(flota['ASERRÍN PINO VERDE'] === 1,
   'el aserrín cuenta como cualquier otro material', flota);
ok(flota['ASTILLA EUCALYPTUS NITENS'] === 4,
   'y lo que no trae guía se suma como viene', flota);
ok(camionesPorMaterial([])['ASTILLA PINO VERDE'] === undefined,
   'sin filas no hay materiales que mostrar');

const lista = porMaterial([
  { subproducto: 'ASTILLA PINO VERDE', valor: '30' },
  { subproducto: 'ASERRÍN PINO VERDE', valor: null }
]);

ok(lista.indexOf('Pino verde') !== -1 && lista.indexOf('30') !== -1,
   'el desglose de la tarjeta nombra el material y su número', lista);
ok(lista.indexOf('Aserrín') === -1,
   'y el que no aporta a esa cifra no ocupa una fila en cero', lista);
ok(porMaterial([]) === '',
   'sin materiales no se dibuja la lista');

/* ---------------------------------------------------------------------
 * Repartir un total sin que la suma se despegue
 * ------------------------------------------------------------------ */
const reparto = repartir([1, 1, 1, 1], 71);

ok(reparto.reduce(function(t, x) { return t + x; }, 0) === 71,
   'el desglose suma exactamente lo que dice la cifra de arriba', reparto);
ok(reparto.join(',') === '18,18,18,17',
   'y lo que sobra al redondear se reparte, no se repite en todos',
   reparto);

const desparejo = repartir([21, 8, 7, 4], 81);

ok(desparejo.reduce(function(t, x) { return t + x; }, 0) === 81,
   'tambi\u00e9n con partes desparejas', desparejo);
ok(desparejo[0] > desparejo[1] && desparejo[1] > desparejo[2],
   'y respeta el orden de las partes', desparejo);
ok(repartir([0, 0], 10).join(',') === '0,0',
   'sin partes no se inventa un reparto');
ok(repartir([3, 2], 0).join(',') === '0,0',
   'y sin total tampoco');

console.log(fallos ? '\n' + fallos + ' FALLOS' : '\nTodo OK');
process.exitCode = fallos ? 1 : 0;
