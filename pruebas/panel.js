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
      classList: { toggle: function() {}, add: function() {} }
    };
  }
  return CAJAS[id];
}
const document = { getElementById: caja };

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
  'dibujarHomoGrupos'
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

console.log(fallos ? '\n' + fallos + ' FALLOS' : '\nTodo OK');
process.exitCode = fallos ? 1 : 0;
