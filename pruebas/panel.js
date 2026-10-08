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
function celdaN(t) { return '<td class="number">' + t + '</td>'; }
function vacio(t) { return '<p>' + t + '</p>'; }
var HOMO_MAPA_FILTRO = '';
var HOMO_ALCANCE = 'mes';
var HOMO_SIN_SAP = '__SIN_SAP__';
var DATA = {};

eval([
  'normalizaNombre', 'celdaNombres', 'homoMapa',
  'dibujarHomoMapa', 'homoProvisorios', 'homoTabla'
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

console.log(fallos ? '\n' + fallos + ' FALLOS' : '\nTodo OK');
process.exitCode = fallos ? 1 : 0;
