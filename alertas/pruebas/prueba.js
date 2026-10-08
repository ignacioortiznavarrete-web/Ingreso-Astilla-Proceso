/**
 * El aviso completo contra hojas con la forma real: Ingresos de SAP,
 * InformeAstilla del reservador, Plan con una columna por mes y
 * Proveedores con los alias.
 *
 * Hoy es miércoles 16-09-2026. Días hábiles de septiembre hasta hoy:
 * 1,2,3,4,7,8,9,10,11,14,15,16 = 12, de 21 que tiene el mes (el 18 es
 * feriado y el 19 cae sábado).
 */
const { hoja, cargar } = require('./entorno');

let fallos = 0;
function ok(cond, texto, extra) {
  console.log((cond ? 'OK   ' : 'MAL  ') + texto);
  if (!cond) { fallos++; if (extra !== undefined) console.log('     ' + extra); }
}

function fila(material, fecha, cantidad, proveedor) {
  return ['', '', material, 'ASTILLA', fecha, '', '', '', cantidad, '',
          'TS', 'P', proveedor, 'TABLEROS'];
}

const CABECERA_INGRESOS = [
  'Soc.', 'Ce.', 'Material', 'Descripción material', 'Fecha contab.',
  'x', 'y', 'Texto posición', 'Cantidad', 'z', 'UM',
  'Proveedor', 'Descripción proveedor', 'Destino'
];

const hojas = {
  // El Plan: "Suministro" se arrastra, hay columna por mes y una fila TOTAL.
  Plan: hoja('Plan', [
    ['Suministro', 'Proveedor', 'Precio', 'AGO-2026', 'SEP-2026', 'OCT-2026'],
    ['ASTILLA EUCALYPTUS NITENS', 'ALFA SPA', 43, 2800, 3000, 3100],
    ['', 'BETA LTDA', 42, 1900, 2000, 2000],
    ['ASTILLA PINO VERDE', 'ALFA S.A.', 41, 900, 1000, 1000],
    ['', 'GAMMA SA', 44, 1400, 1500, 1500],
    ['', 'DELTA SPA', 40, 700, 800, 800],
    ['', 'OMEGA SPA', 39, 500, 500, 500],
    // Solo cruza por parecido con lo que escribe la planilla.
    ['', 'FORESTAL FATIMA LTDA.', 37, 400, 450, 450],
    // Plan chico y venía entregando mucho más: cumple su compromiso y
    // aun así se cayó a la mitad. Es el caso de la segunda señal.
    ['', 'KAPPA SPA', 36, 500, 60, 60],
    // Tiene plan en agosto y en octubre, pero no en septiembre: este
    // mes no tiene nada comprometido y no debe salir en el correo.
    ['', 'SIGMA SPA', 38, 600, '', 600],
    ['', 'TOTAL', '', 8700, 8860, 8960]
  ]),

  // Alias escritos a mano: el reservador escribe distinto que SAP.
  Proveedores: hoja('Proveedores', [
    ['Proveedor SAP', 'Alias', 'Origen'],
    ['ALFA SPA', 'ALFA S.A.', 'manual'],
    ['', 'ALFA', 'manual'],
    ['GAMMA SA', 'GAMA S.A.', 'manual']
    // OJO: FORESTAL FATIMA LTDA. NO tiene alias a propósito.
  ]),

  // Ingresos: fechas como Date, cantidad con coma decimal, y un
  // material que no es astilla que hay que ignorar.
  Ingresos: hoja('Ingresos', [
    CABECERA_INGRESOS,
    fila('3009003', new Date(Date.UTC(2026, 8, 16)), '200,5', 'ALFA SPA'),
    fila('3000039', new Date(Date.UTC(2026, 8, 10)), '150', 'BETA LTDA'),
    fila('3000039', new Date(Date.UTC(2026, 8, 3)), '120', 'DELTA SPA'),
    // Aserrín: no es astilla de proceso, se ignora aunque sea de hoy.
    fila('3009999', new Date(Date.UTC(2026, 8, 16)), '999', 'OMEGA SPA'),
    // Cantidad cero: no es un despacho.
    fila('3000039', new Date(Date.UTC(2026, 8, 15)), '0', 'GAMMA SA'),
    // FATIMA existe en SAP con su nombre largo; la planilla la
    // escribe "FATIMA" a secas.
    fila('3000039', new Date(Date.UTC(2026, 8, 1)), '60',
         'FORESTAL FATIMA LTDA.'),
    // KAPPA: tres meses fuertes y un septiembre de nada, pero despachó
    // anteayer, así que no está callada.
    fila('3000039', new Date(Date.UTC(2026, 5, 10)), '500', 'KAPPA SPA'),
    fila('3000039', new Date(Date.UTC(2026, 6, 10)), '500', 'KAPPA SPA'),
    fila('3000039', new Date(Date.UTC(2026, 7, 10)), '500', 'KAPPA SPA'),
    fila('3000039', new Date(Date.UTC(2026, 8, 15)), '60', 'KAPPA SPA'),
    // SIGMA despachó hace mucho: si entrara, caería en el tramo alto.
    fila('3000039', new Date(Date.UTC(2026, 7, 20)), '80', 'SIGMA SPA')
  ]),

  // La planilla del reservador: fecha ISO en texto, nombre distinto
  // al de SAP, y una fila con ERROR que no cuenta.
  InformeAstilla: hoja('InformeAstilla', [
    ['Fecha Informe', 'Fecha ISO', 'Subproducto Planilla', 'Subproducto',
     'Proveedor Planilla', 'Destino', 'Camiones', 'Factor', 'TS Estimadas',
     'Asunto', 'Message ID', 'Remitente', 'Fecha correo',
     'Fecha procesamiento', 'Estado', 'Método extracción'],
    ['08-09-2026', '2026-09-08', 'AST PINO', 'ASTILLA PINO VERDE',
     'GAMA S.A.', 'TABLEROS', 4, 11, 44, '', '', '', '', '', 'OK', 'tabla'],
    ['17-09-2026', '2026-09-17', 'AST PINO', 'ASTILLA PINO VERDE',
     'OMEGA SPA', 'TABLEROS', 3, 11, 33, '', '', '', '', '', 'ERROR: x', 'tabla'],
    // "FATIMA" a secas: sin parecido operativo, el correo la daba por
    // callada aunque acá dice que despachó ayer.
    ['15-09-2026', '2026-09-15', 'AST PINO', 'ASTILLA PINO VERDE',
     'FATIMA', 'TABLEROS', 2, 11, 22, '', '', '', '', '', 'OK', 'tabla'],
    // El MISMO día que BETA ya tiene cargado en SAP. Sumar las dos
    // fuentes contaría dos veces el mismo camión.
    ['10-09-2026', '2026-09-10', 'AST PINO', 'ASTILLA PINO VERDE',
     'BETA LTDA', 'TABLEROS', 14, 11, 154, '', '', '', '', '', 'OK', 'tabla']
  ])
};

const { ctx, enviados, registro } = cargar(hojas, '2026-09-16');

// --- 1. Los tres grupos ------------------------------------------------
const aviso = ctx.construirAviso_();
const porGrupo = aviso.grupos.map(g => g.filas.map(f => f.proveedor));

aviso.grupos.forEach(g => console.log('   ' + g.titulo + ': ' +
  (g.filas.map(f => f.proveedor + ' (' +
    (f.dias === null ? 'sin ingresos' : f.dias + ' d') +
    ', plan ' + Math.round(f.plan) + ', mes ' + Math.round(f.ingresado) +
    ', ritmo ' + Math.round((f.cumplimiento || 0) * 100) + '%)'
  ).join(' | ') || 'ninguno')));

ok(aviso.habiles.transcurridos === 12 && aviso.habiles.total === 21,
   'el mes va en el día hábil 12 de 21',
   JSON.stringify(aviso.habiles));

// OMEGA: su única fila de planilla es ERROR y su ingreso es aserrín.
ok(JSON.stringify(porGrupo[0]) === JSON.stringify(['OMEGA SPA']),
   'sin entregar: el que no tiene un solo ingreso en el mes',
   JSON.stringify(porGrupo[0]));

// BETA: último 10-09 → hábiles 11,14,15,16 = 4.
// GAMMA: cruza por alias con la planilla del 08-09 → 6.
// DELTA: 03-09 → 4,7,8,9,10,11,14,15,16 = 9. Primero el más callado.
ok(JSON.stringify(porGrupo[1]) ===
   JSON.stringify(['DELTA SPA', 'GAMMA SA', 'BETA LTDA']),
   'callados: entregaron, pero llevan días; el más callado primero',
   JSON.stringify(porGrupo[1]));

// ALFA despachó hoy y FATIMA ayer, así que no están callados; los dos
// van muy por debajo del ritmo que pide su plan. KAPPA cumple su plan
// chico pero se cayó contra sí misma.
ok(porGrupo[2].indexOf('ALFA SPA') === 0,
   'a la baja: primero el que más TS lleva de atraso',
   JSON.stringify(porGrupo[2]));
ok(porGrupo[2].length === 3 &&
   porGrupo[2].indexOf('KAPPA SPA') !== -1 &&
   porGrupo[2].indexOf('FORESTAL FATIMA LTDA.') !== -1,
   'y los tres que vienen cayendo', JSON.stringify(porGrupo[2]));

// Nadie en dos grupos a la vez.
const todos = porGrupo[0].concat(porGrupo[1]).concat(porGrupo[2]);
ok(todos.length === new Set(todos).size,
   'los grupos son excluyentes: nadie aparece dos veces',
   JSON.stringify(todos));

// --- 2. Las dos señales de "a la baja" --------------------------------
const alfa = aviso.proveedores.filter(p => p.proveedor === 'ALFA SPA')[0];

ok(alfa && alfa.plan === 4000,
   'el alias junta "ALFA S.A." con "ALFA SPA": plan 4.000',
   alfa && alfa.plan);
ok(alfa && alfa.subproductos.length === 2, 'ALFA con sus dos subproductos');
ok(Math.round(alfa.ingresado) === 201, 'cantidad con coma decimal: 200,5',
   alfa && alfa.ingresado);
ok(alfa && alfa.dias === 0, 'ALFA despachó hoy: 0 días de silencio');
ok(alfa && Math.round(alfa.ritmoPlan) === 2286,
   'a esta altura el plan de ALFA pedía 2.286 TS',
   alfa && Math.round(alfa.ritmoPlan));
ok(alfa && alfa.porPlan === true && !alfa.porSiMismo,
   'ALFA entra por el plan: despacha hoy, pero va en el 9% del ritmo',
   alfa && [alfa.porPlan, alfa.porSiMismo]);

const kappa = aviso.proveedores.filter(p => p.proveedor === 'KAPPA SPA')[0];

ok(kappa && !kappa.porPlan && kappa.porSiMismo === true,
   'KAPPA entra por sí misma: cumple su plan chico y entrega mucho ' +
   'menos por día que antes',
   kappa && [kappa.porPlan, kappa.porSiMismo,
             Math.round(kappa.cumplimiento * 100),
             Math.round(kappa.caida * 100)]);
ok(kappa && kappa.caida > 0.7,
   'la caída propia se mide en TS por día hábil, no por mes',
   kappa && kappa.caida);

// --- 3. El doble conteo que inflaba lo entregado ----------------------
const beta = aviso.proveedores.filter(p => p.proveedor === 'BETA LTDA')[0];

ok(beta && Math.round(beta.ingresado) === 150,
   'el día que está en SAP y en la planilla cuenta UNA vez: manda SAP',
   beta && beta.ingresado);
ok(beta && beta.dias === 4,
   'y el silencio se cuenta igual desde ese día', beta && beta.dias);

// --- 4. Lo que ya cuidaba la prueba vieja -----------------------------
const gamma = aviso.proveedores.filter(p => p.proveedor === 'GAMMA SA')[0];
ok(gamma.fuente === 'PLANILLA' && gamma.ultimo === '2026-09-08',
   'GAMMA cruza por alias con la planilla', JSON.stringify(gamma));

const omega = aviso.proveedores.filter(p => p.proveedor === 'OMEGA SPA')[0];
ok(omega.dias === null, 'la fila ERROR de la planilla no cuenta como despacho');
ok(omega.ingresado === 0, 'el aserrín no es astilla de proceso');

ok(aviso.mes === 'SEP-2026', 'toma la columna del mes en curso', aviso.mes);

// Sin plan este mes no hay nada que reclamar, aunque lleve semanas
// sin despachar: no está comprometido a nada.
const sigma = aviso.proveedores.filter(p => p.proveedor === 'SIGMA SPA')[0];
ok(!sigma, 'el que no tiene plan este mes no entra al correo',
   sigma && JSON.stringify(sigma));
ok(!/SIGMA/.test(JSON.stringify(porGrupo)), 'ni aparece en ningún grupo');

// La planilla escribe "FATIMA" y SAP "FORESTAL FATIMA LTDA.". Sin
// parecido operativo no cruzaban y el correo la acusaba de callada.
const fatima = aviso.proveedores.filter(p => /FATIMA/.test(p.proveedor))[0];
ok(fatima && fatima.ultimo === '2026-09-15' && fatima.fuente === 'PLANILLA',
   'la planilla que escribe el nombre corto cruza con el largo de SAP',
   fatima && [fatima.ultimo, fatima.fuente]);
ok(fatima && fatima.dias === 1, 'y su silencio se cuenta desde ese día',
   fatima && fatima.dias);
ok(porGrupo[1].indexOf('FORESTAL FATIMA LTDA.') === -1,
   'así que no sale entre los callados');

// --- 5. El correo ------------------------------------------------------
ctx.enviarAhora();
ok(enviados.length === 1, 'manda un correo');
ok(enviados[0].to === 'francisco.correa@masisa.com,jaime.rojas@masisa.com',
   'a los dos destinatarios', enviados[0].to);

const html = enviados[0].htmlBody;

ok(/1 sin entregar/.test(enviados[0].subject) &&
   /3 callados/.test(enviados[0].subject) &&
   /3 a la baja/.test(enviados[0].subject),
   'el asunto dice cuántos y de qué tipo', enviados[0].subject);
ok(/No han entregado este mes/.test(html) && /Callados/.test(html) &&
   /A la baja/.test(html), 'las tres secciones están en el cuerpo');
ok(/del ritmo que pide el plan/.test(html),
   'y se dice por qué entra cada uno a la baja');
ok(/menos por día<\/b> que en JUN, JUL y AGO/.test(html),
   'nombrando los meses con los que se compara',
   html.slice(html.indexOf('menos por d') - 60, html.indexOf('menos por d') + 60));
ok(enviados[0].body && /PROVEEDORES DEL PLAN EN RIESGO/.test(enviados[0].body),
   'y va con versión en texto', enviados[0].body && enviados[0].body.slice(0, 40));
ok(!/style="[^"]*(flex|grid|var\()/.test(html),
   'nada de CSS que Outlook no entienda');
ok(/bgcolor=/.test(html) && /cellpadding="0"/.test(html),
   'todo en tablas con atributos, que es lo que Outlook dibuja');

require('fs').writeFileSync(__dirname + '/correo.html', html);

// --- 6. Sábado: no manda -----------------------------------------------
const sabado = cargar(hojas, '2026-09-19');
sabado.ctx.enviarAvisoSilencio();
ok(sabado.enviados.length === 0, 'sábado no manda');
ok(/no es día hábil/.test(sabado.registro.join(' ')), 'y lo deja dicho');

// --- 7. El día 1 del mes nadie viene "a la baja" ----------------------
//
// El 1 de octubre el mes lleva un día hábil: el prorrateo diría que
// TODOS vienen atrasados, y un aviso que el primer día acusa a todo el
// mundo no se vuelve a leer. Hasta MINIMO_DIAS solo habla el silencio.
const octubre = cargar(hojas, '2026-10-01');
const avisoOct = octubre.ctx.construirAviso_();
const grupoOct = avisoOct.grupos.map(g => g.filas.map(f => f.proveedor));

ok(avisoOct.hayRitmo === false,
   'el 1 de octubre todavía no se habla de ritmo',
   avisoOct.habiles.transcurridos);
ok(grupoOct[2].length === 0,
   'así que nadie entra por tendencia', JSON.stringify(grupoOct[2]));
ok(JSON.stringify(grupoOct[0]) === JSON.stringify(['OMEGA SPA']),
   'y "sin entregar" queda solo con el que nunca despachó, no con ' +
   'todos los que aún no empiezan el mes',
   JSON.stringify(grupoOct[0]));
ok(grupoOct[1].indexOf('ALFA SPA') !== -1,
   'ALFA pasa a callada: 10 días hábiles desde el 16 de septiembre',
   JSON.stringify(grupoOct[1]));

// --- 8. Nadie en riesgo ------------------------------------------------
const hojasAlDia = Object.assign({}, hojas, {
  Ingresos: hoja('Ingresos', [CABECERA_INGRESOS].concat(
    ['ALFA SPA', 'BETA LTDA', 'GAMMA SA', 'DELTA SPA', 'OMEGA SPA',
     'FORESTAL FATIMA LTDA.', 'KAPPA SPA'].map(p =>
      fila('3000039', new Date(Date.UTC(2026, 8, 16)), '4000', p))
  )),
  InformeAstilla: hoja('InformeAstilla', [
    hojas.InformeAstilla.getDataRange().getValues()[0]
  ])
});
const limpio = cargar(hojasAlDia, '2026-09-16');
limpio.ctx.enviarAhora();
ok(/vienen al día/.test(limpio.enviados[0].htmlBody),
   'si no hay nadie en riesgo, el correo igual sale diciéndolo',
   limpio.enviados[0].htmlBody.indexOf('vienen al día'));
ok(/· ninguno$/.test(limpio.enviados[0].subject),
   'y el asunto lo dice sin abrirlo', limpio.enviados[0].subject);

// --- 9. Sin columna del mes en el Plan ---------------------------------
const sinMes = cargar(Object.assign({}, hojas, {
  Plan: hoja('Plan', [
    ['Suministro', 'Proveedor', 'Precio', 'AGO-2026'],
    ['ASTILLA PINO VERDE', 'ALFA SPA', 41, 900]
  ])
}), '2026-09-16');
sinMes.ctx.enviarAhora();
ok(/no tiene una columna para este mes/.test(sinMes.enviados[0].htmlBody),
   'sin columna del mes, lo dice en vez de mandar tablas vacías');

// --- 10. Disparador a las 9 -------------------------------------------
ctx.instalarAvisoDiario();
ok(ctx.eliminarAvisoDiario() === 1, 'instala y elimina un solo disparador');
ok(/a las 9:00/.test(registro.join(' ')),
   'y queda dicho a qué hora sale',
   registro.filter(r => /instalado/.test(r))[0]);

console.log(fallos ? '\n' + fallos + ' FALLOS' : '\nTodo OK');
process.exitCode = fallos ? 1 : 0;
