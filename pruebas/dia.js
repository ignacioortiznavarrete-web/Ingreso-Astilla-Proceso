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
  'tramosDelCamion_', 'estadisticaDeMinutos_',
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

// Lo que escribe la portería de verdad, sacado del libro de noviembre.
ok(minutosDeHora_('08.53') === 533 && minutosDeHora_('21.46') === 1306,
   'el punto en vez de los dos puntos no rompe nada');
ok(minutosDeHora_('18;35') === 1115 && minutosDeHora_('9:;40') === 580,
   'ni el punto y coma, ni los dos signos juntos');
ok(minutosDeHora_('0.3646') === -1,
   'pero un número no se cuela como hora', minutosDeHora_('0.3646'));
ok(minutosDeHora_('8:46:00') === 526,
   'y con segundos se lee igual', minutosDeHora_('8:46:00'));

/* ---------------------------------------------------------------------
 * Los tramos del camión
 * ------------------------------------------------------------------ */
const normal = tramosDelCamion_(
  { reserva: '8:40', llegada: '8:45', cierre: '9:05' }, 540
);

ok(normal.agenda === 5 && normal.patio === 20 && normal.flujo === 25,
   'reservado 8:40, llegó 8:45 y cerró 9:05: 5 tarde, 20 en patio, ' +
   '25 de flujo', normal);
ok(normal.abierto === false && normal.inconsistente === false,
   'y es un tramo cerrado', normal);

const temprano_ = tramosDelCamion_(
  { reserva: '8:49', llegada: '8:43', cierre: '8:46' }, 540
);

ok(temprano_.agenda === -6 && temprano_.patio === 3 &&
   temprano_.flujo === -3,
   'llegó antes de su hora y salió antes: el flujo es negativo y no ' +
   'es un error', temprano_);

const adentro = tramosDelCamion_(
  { reserva: '13:50', llegada: '13:55', cierre: '' }, 840
);

ok(adentro.abierto === true && adentro.patio === 5 && adentro.flujo === 10,
   'sin hora de cierre sigue adentro: se mide contra la hora de ahora',
   adentro);

const delMes = tramosDelCamion_(
  { reserva: '13:50', llegada: '13:55', cierre: '' }, -1
);

ok(delMes.abierto === true && delMes.patio === null &&
   delMes.flujo === null,
   'y sin "ahora" no se mide: para el mes entero no significa nada',
   delMes);

const alReves = tramosDelCamion_(
  { reserva: '8:04', llegada: '18:35', cierre: '8:04' }, 540
);

ok(alReves.inconsistente === true && alReves.patio === null &&
   alReves.flujo === null,
   'cerrar antes de llegar es la hora escrita al revés: se marca y no ' +
   'se mide', alReves);

const sinReserva = tramosDelCamion_(
  { reserva: '', llegada: '8:45', cierre: '9:05' }, 540
);

ok(sinReserva.patio === 20 && sinReserva.flujo === null &&
   sinReserva.agenda === null,
   'sin reserva se mide el patio igual, y el flujo no se inventa',
   sinReserva);

/* ---------------------------------------------------------------------
 * La mediana, no el promedio
 * ------------------------------------------------------------------ */
// Seis camiones normales y el de la fila 1822 del libro, que llegó
// 13:30 y cerró 21:06. El promedio de esto es 78 minutos; la mediana,
// 15. Lo que demora un camión es 15.
const est = estadisticaDeMinutos_([10, 15, 20, 20, 10, 12, 456]);

ok(est.n === 7 && est.mediana === 15,
   'un camión de siete horas y media no mueve la mediana', est);
ok(est.max === 456, 'pero el caso raro no desaparece: queda en el máximo',
   est.max);
ok(estadisticaDeMinutos_([]).mediana === null &&
   estadisticaDeMinutos_([]).n === 0,
   'sin datos no hay mediana, y se dice con null');
ok(estadisticaDeMinutos_([null, undefined, 'tarde', 12]).n === 1,
   'lo que no es número no entra',
   estadisticaDeMinutos_([null, undefined, 'tarde', 12]));

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

// Cada camión con su hora reservada y su hora de cierre, que es de
// donde sale la demora.
const DIA = [
  camion('8:45', '1001', 'PROMASA S.A.', 'ASTILLA PINO VERDE',
         { reserva: '8:40', cierre: '9:05' }),
  camion('9:30', '1002', 'BIOMASA SUR', 'ASTILLA PINO VERDE',
         { reserva: '9:40', cierre: '9:50' }),
  camion('10:15', '1003', 'FORESTAL AITUE LTDA', 'ASTILLA EUCALYPTUS NITENS',
         { reserva: '10:00', cierre: '11:00' }),
  camion('11:00', '1004', 'PROMASA S.A.', 'AST. PINO VERDE C/ CORTEZA',
         { reserva: '11:00', cierre: '11:10' }),
  camion('12:20', '1005', 'BIOMASA SUR', 'ASTILLA PINO VERDE',
         { reserva: '12:00', cierre: '12:30' }),
  camion('13:40', '1006', 'LAMINADORA LOS ANGELES', 'ASERRÍN PINO VERDE',
         { reserva: '13:30', cierre: '13:55' }),
  // Llegó recién y el libro todavía no lo cierra.
  camion('13:55', '1007', 'PROMASA S.A.', 'ASTILLA PINO VERDE',
         { enCurso: true, reserva: '13:50', cierre: '' }),
  // De ayer: no es de hoy y no entra.
  camion('16:00', '0999', 'PROMASA S.A.', 'ASTILLA PINO VERDE',
         { fecha: '2026-11-16', reserva: '15:50', cierre: '16:20' })
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
ok(dia.enCurso === 1, 'los que siguen en patio se cuentan', dia.enCurso);
ok(dia.filas.filter(function(f) { return f.guia === '1001'; })[0].enSap
   === true,
   'y el que SAP ya cargó queda marcado');
ok(dia.demora.patio.n === 6 && dia.demora.patio.mediana === 18,
   'la demora en patio sale de los seis que cerraron, no de los siete',
   dia.demora.patio);
ok(dia.demora.patio.max === 45,
   'y el más largo del día queda a la vista', dia.demora.patio.max);
ok(dia.demora.flujo.mediana === 25,
   'el flujo desde la hora reservada se mide aparte',
   dia.demora.flujo);
ok(dia.demora.masLargo && dia.demora.masLargo.guia === '1007' &&
   dia.demora.masLargo.minutos === 5,
   'y el que lleva más rato adentro ahora se puede ir a buscar',
   dia.demora.masLargo);

const f1002 = dia.filas.filter(function(f) {
  return f.guia === '1002';
})[0];

ok(f1002.agenda === -10 && f1002.patio === 20 && f1002.flujo === 10,
   'cada fila trae sus tres tramos', f1002);

const f1004 = dia.filas.filter(function(f) {
  return f.guia === '1004';
})[0];

ok(f1004.agenda === 0, 'y el que llegó a su hora dice cero, no nada',
   f1004.agenda);

const f1007 = dia.filas.filter(function(f) {
  return f.guia === '1007';
})[0];

ok(f1007.abierto === true && f1007.patio === 5,
   'el que sigue adentro dice cuánto lleva, no cuánto demoró', f1007);
ok(dia.porSubproducto.filter(function(s) {
  return s.subproducto === 'ASTILLA EUCALYPTUS NITENS';
})[0].patio === 45,
   'y cada material su propia mediana',
   dia.porSubproducto.map(function(s) { return [s.subproducto, s.patio]; }));
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
