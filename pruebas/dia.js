/**
 * El día en curso y el plan en camiones.
 *
 * Dos preguntas que antes había que hacer de cabeza:
 *
 *   - ¿Con cuánto va a cerrar el día? La planta recibe de 08:30 a
 *     23:00, así que "llevamos 14 camiones" significa cosas muy
 *     distintas a las diez de la mañana y a las ocho de la tarde.
 *   - ¿Cuántos camiones faltan para cumplir el plan? El plan está en
 *     toneladas y la planta se maneja en camiones.
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
  FACTOR_CAMION: 11,
  FACTOR_POR_MATERIAL: {
    'ASTILLA EUCALYPTUS NITENS': 15.2,
    'AST. PINO VERDE C/ CORTEZA': 10.7,
    'ASTILLA PINO VERDE': 11,
    'ASERRÍN PINO VERDE': 11
  }
};

// La hora de la planta, fija para que la prueba no cambie de
// resultado según cuándo se corra.
let AHORA = '14:00';

const Utilities = {
  formatDate: function() { return AHORA; }
};

eval([recortarConst('SUBPRODUCTOS_OBJETIVO')].concat([
  'resumenDelDia_', 'camionesDelPlan_', 'minutosDeHora_',
  'ahoraEnMinutos_', 'normalizaGuia_', 'factorDe_', 'formatDateKey_',
  'normalizeKey_', 'text_', 'round_'
].map(recortar)).join('\n'));

let fallos = 0;
function ok(c, t, extra) {
  console.log((c ? 'OK   ' : 'MAL  ') + t);
  if (!c) { fallos++; if (extra !== undefined) console.log('     ' + JSON.stringify(extra)); }
}

/* ---------------------------------------------------------------------
 * La hora
 * ------------------------------------------------------------------ */
ok(minutosDeHora_('8:43') === 523 && minutosDeHora_('08:43') === 523,
   'la hora se lee venga con cero adelante o sin él');
ok(minutosDeHora_('23:00') === 1380, 'y la del cierre también');
ok(minutosDeHora_('') === -1 && minutosDeHora_('25:00') === -1 &&
   minutosDeHora_('sin hora') === -1,
   'lo que no es una hora no se inventa');

/* ---------------------------------------------------------------------
 * El día en curso
 * ------------------------------------------------------------------ */
const HOY = '2026-11-17';

function camion(hora, guia, proveedor, subproducto, extra) {
  return Object.assign({
    fecha: HOY, source: 'CAMIONES', llegada: hora, guia: guia,
    proveedor: proveedor, proveedorRaw: proveedor,
    subproducto: subproducto, destino: 'TABLEROS',
    camiones: 1, ts: CONFIG.FACTOR_POR_MATERIAL[subproducto],
    enCurso: false
  }, extra || {});
}

const DIA = [
  camion('8:45', '1001', 'PROMASA S.A.', 'ASTILLA PINO VERDE'),
  camion('9:30', '1002', 'BIOMASA SUR', 'ASTILLA PINO VERDE'),
  camion('10:15', '1003', 'FORESTAL AITUE LTDA', 'ASTILLA EUCALYPTUS NITENS'),
  camion('11:00', '1004', 'PROMASA S.A.', 'AST. PINO VERDE C/ CORTEZA'),
  camion('12:20', '1005', 'BIOMASA SUR', 'ASTILLA PINO VERDE'),
  camion('13:40', '1006', 'LAMINADORA LOS ANGELES', 'ASERRÍN PINO VERDE'),
  // Llegó recién y todavía descarga.
  camion('13:55', '1007', 'PROMASA S.A.', 'ASTILLA PINO VERDE',
         { enCurso: true }),
  // De ayer: no es de hoy y no entra.
  camion('16:00', '0999', 'PROMASA S.A.', 'ASTILLA PINO VERDE',
         { fecha: '2026-11-16' })
];

// Una de las guías de hoy ya está cargada en SAP.
const EN_SAP = [{
  fecha: HOY, source: 'INGRESOS', guia: '1001',
  proveedor: 'PROMASA S.A.', ts: 11.4
}];

AHORA = '14:00';

const dia = resumenDelDia_(DIA, EN_SAP, HOY, CONFIG.TIMEZONE);

ok(dia.camiones === 7,
   'entran los camiones de hoy y nada más', dia.camiones);
ok(dia.filas[0].hora === '13:55' && dia.filas[6].hora === '8:45',
   'lo último arriba: es lo que se viene a mirar',
   dia.filas.map(function(f) { return f.hora; }));
ok(dia.enCurso === 1, 'los que todavía descargan se cuentan', dia.enCurso);
ok(dia.filas.filter(function(f) { return f.guia === '1001'; })[0].enSap
   === true,
   'y el que SAP ya cargó queda marcado');
ok(dia.porSubproducto.length === 4,
   'con el detalle de los cuatro materiales',
   dia.porSubproducto.map(function(s) { return s.subproducto; }));

// --- La proyección de cierre -----------------------------------------
// A las 14:00 llevan 330 minutos de los 870 de jornada (08:30 a 23:00)
// y 7 camiones: al mismo ritmo, 18 al cierre.
ok(dia.jornada.transcurridos === 330 && dia.jornada.minutos === 870,
   'la jornada va de 08:30 a 23:00 y lleva 330 minutos',
   dia.jornada);
ok(dia.cierre.alRitmo === true && dia.cierre.camiones === 18,
   'a este ritmo el día cierra con 18 camiones', dia.cierre);
ok(dia.cierre.faltan === 11,
   'y faltarían 11 por entrar', dia.cierre.faltan);

AHORA = '09:00';
const temprano = resumenDelDia_(DIA, EN_SAP, HOY, CONFIG.TIMEZONE);

ok(temprano.cierre.alRitmo === false &&
   temprano.cierre.camiones === 7,
   'a las nueve no se proyecta: con media hora corrida la regla de ' +
   'tres dice cualquier cosa',
   temprano.cierre);

AHORA = '07:00';
const antes = resumenDelDia_(DIA, EN_SAP, HOY, CONFIG.TIMEZONE);

ok(antes.jornada.transcurridos === 0 && antes.cierre.alRitmo === false,
   'antes de abrir, la jornada no ha corrido nada', antes.jornada);

AHORA = '23:30';
const cerrado = resumenDelDia_(DIA, EN_SAP, HOY, CONFIG.TIMEZONE);

ok(cerrado.cierre.alRitmo === false && cerrado.cierre.camiones === 7,
   'y cerrada la jornada ya no se proyecta: el día es el que fue',
   cerrado.cierre);

AHORA = '14:00';

const sinCamiones = resumenDelDia_([], [], HOY, CONFIG.TIMEZONE);

ok(sinCamiones.camiones === 0 && sinCamiones.cierre.camiones === 0,
   'un día sin camiones no proyecta camiones de la nada',
   sinCamiones.cierre);

/* ---------------------------------------------------------------------
 * El plan, en camiones
 * ------------------------------------------------------------------ */
const PLAN = [
  { subproducto: 'ASTILLA PINO VERDE', proveedorPlan: 'A', plan: 3000 },
  { subproducto: 'ASTILLA PINO VERDE', proveedorPlan: 'B', plan: 1620 },
  { subproducto: 'AST. PINO VERDE C/ CORTEZA', proveedorPlan: 'C', plan: 5350 },
  { subproducto: 'ASTILLA EUCALYPTUS NITENS', proveedorPlan: 'D', plan: 1824 }
];

// Lo que va entrando del mes.
const DEL_MES = [
  { fecha: '2026-11-05', subproducto: 'ASTILLA PINO VERDE', ts: 2310 },
  { fecha: '2026-11-10', subproducto: 'AST. PINO VERDE C/ CORTEZA', ts: 2568 },
  // De otro mes: no cuenta para este plan.
  { fecha: '2026-10-28', subproducto: 'ASTILLA PINO VERDE', ts: 5000 }
];

const MES = { prefix: '2026-11' };
const HABILES = { total: 20, elapsed: 10, remaining: 10 };

const plan = camionesDelPlan_(PLAN, DEL_MES, MES, HABILES);
const pino = plan.filter(function(x) {
  return x.subproducto === 'ASTILLA PINO VERDE';
})[0];
const corteza = plan.filter(function(x) {
  return x.subproducto === 'AST. PINO VERDE C/ CORTEZA';
})[0];
const nitens = plan.filter(function(x) {
  return x.subproducto === 'ASTILLA EUCALYPTUS NITENS';
})[0];

ok(pino.camionesPlan === 420 && pino.camionesMes === 210,
   'el plan en toneladas se convierte a camiones con su factor', pino);
ok(pino.faltan === 210 && pino.porDia === 21,
   'y lo que falta se reparte en los días hábiles que quedan: 21 al día',
   pino);
ok(corteza.porDia === 26,
   'cada material con su factor: el corteza pide 26 al día', corteza);
ok(nitens.camionesMes === 0 && nitens.porDia === 12,
   'y el nitens, que no ha entrado nada este mes, 12', nitens);
ok(pino.porDiaPlan === 21,
   'al lado va el ritmo que el plan pedía desde el principio',
   pino.porDiaPlan);

const sinDias = camionesDelPlan_(
  PLAN, DEL_MES, MES, { total: 20, elapsed: 20, remaining: 0 }
);

ok(sinDias[0].porDia === 0,
   'el último día hábil no se divide por cero', sinDias[0]);

const cumplido = camionesDelPlan_(
  PLAN,
  [{ fecha: '2026-11-05', subproducto: 'ASTILLA PINO VERDE', ts: 9000 }],
  MES,
  HABILES
);

const yaCumplio = cumplido.filter(function(x) {
  return x.subproducto === 'ASTILLA PINO VERDE';
})[0];

ok(yaCumplio.faltan === 0 && yaCumplio.porDia === 0,
   'y al que ya cumplió no le faltan camiones negativos',
   yaCumplio);

// --- Escrito en el Plan, pero sin toneladas este mes ------------------
//
// Así llegó el aserrín: once filas con su precio y la columna del mes
// en blanco. Mostrarlo en cero diría que su compromiso es cero, y no
// es eso: es que falta escribirlo.
const SIN_TONELADAS = PLAN.concat([
  { subproducto: 'ASERRÍN PINO VERDE', proveedorPlan: 'PROMASA SPA.',
    precio: 55400, plan: 0 },
  { subproducto: 'ASERRÍN PINO VERDE', proveedorPlan: 'BIOMASAS SUR SPA',
    precio: 58000, plan: 0 }
]);

const conAserrin = camionesDelPlan_(
  SIN_TONELADAS,
  DEL_MES.concat([
    { fecha: '2026-11-14', subproducto: 'ASERRÍN PINO VERDE', ts: 110 }
  ]),
  MES,
  HABILES
);

const aserrin = conAserrin.filter(function(x) {
  return x.subproducto === 'ASERRÍN PINO VERDE';
})[0];

ok(!!aserrin, 'el material aparece aunque su plan venga sin toneladas',
   conAserrin.map(function(x) { return x.subproducto; }));
ok(aserrin.sinPlan === true && aserrin.filasPlan === 2,
   'y queda dicho: está escrito, con dos filas, pero sin toneladas',
   aserrin);
ok(aserrin.camionesMes === 10 && aserrin.faltan === 0,
   'lo que entró se cuenta igual; lo que falta no se inventa', aserrin);

const noEstaEnElPlan = camionesDelPlan_(
  PLAN, DEL_MES, MES, HABILES
).filter(function(x) { return x.subproducto === 'ASERRÍN PINO VERDE'; })[0];

ok(!noEstaEnElPlan,
   'y el material que no está en el Plan ni entró no ocupa una fila',
   noEstaEnElPlan);

console.log(fallos ? '\n' + fallos + ' FALLOS' : '\nTodo OK');
process.exitCode = fallos ? 1 : 0;
