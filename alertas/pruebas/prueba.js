/**
 * El aviso completo contra hojas con la forma real: Ingresos de SAP,
 * InformeAstilla del reservador, Plan con una columna por mes y
 * Proveedores con los alias.
 *
 * Hoy es miércoles 16-09-2026. Días hábiles de septiembre hasta hoy:
 * 1,2,3,4,7,8,9,10,11,14,15,16.
 */
const { hoja, cargar } = require('./entorno');

let fallos = 0;
function ok(cond, texto, extra) {
  console.log((cond ? 'OK   ' : 'MAL  ') + texto);
  if (!cond) { fallos++; if (extra !== undefined) console.log('     ' + extra); }
}

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
    ['', 'TOTAL', '', 8200, 8800, 8900]
  ]),

  // Alias escritos a mano: el reservador escribe distinto que SAP.
  Proveedores: hoja('Proveedores', [
    ['Proveedor SAP', 'Alias', 'Origen'],
    ['ALFA SPA', 'ALFA S.A.', 'manual'],
    ['', 'ALFA', 'manual'],
    ['GAMMA SA', 'GAMA S.A.', 'manual']
  ]),

  // Ingresos: fechas como Date, cantidad con coma decimal, y un
  // material que no es astilla que hay que ignorar.
  Ingresos: hoja('Ingresos', [
    ['Soc.', 'Ce.', 'Material', 'Descripción material', 'Fecha contab.',
     'x', 'y', 'Texto posición', 'Cantidad', 'z', 'UM',
     'Proveedor', 'Descripción proveedor', 'Destino'],
    ['', '', '3009003', 'ASTILLA NITENS', new Date(Date.UTC(2026, 8, 16)),
     '', '', '', '200,5', '', 'TS', 'P1', 'ALFA SPA', 'TABLEROS'],
    ['', '', '3000039', 'ASTILLA PINO', new Date(Date.UTC(2026, 8, 10)),
     '', '', '', '150', '', 'TS', 'P2', 'BETA LTDA', 'TABLEROS'],
    ['', '', '3000039', 'ASTILLA PINO', new Date(Date.UTC(2026, 8, 3)),
     '', '', '', '120', '', 'TS', 'P3', 'DELTA SPA', 'TABLEROS'],
    // Aserrín: no es astilla de proceso, se ignora aunque sea de hoy.
    ['', '', '3009999', 'ASERRIN', new Date(Date.UTC(2026, 8, 16)),
     '', '', '', '999', '', 'TS', 'P4', 'OMEGA SPA', 'TABLEROS'],
    // Cantidad cero: no es un despacho.
    ['', '', '3000039', 'ASTILLA PINO', new Date(Date.UTC(2026, 8, 15)),
     '', '', '', '0', '', 'TS', 'P5', 'GAMMA SA', 'TABLEROS']
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
     'OMEGA SPA', 'TABLEROS', 3, 11, 33, '', '', '', '', '', 'ERROR: x', 'tabla']
  ])
};

const { ctx, enviados, registro } = cargar(hojas, '2026-09-16');

// --- 1. Los tramos -----------------------------------------------------
const aviso = ctx.construirAviso_();
const porTramo = aviso.tramos.map(t => t.filas.map(f => f.proveedor));

aviso.tramos.forEach(t => console.log('   ' + t.titulo + ': ' +
  (t.filas.map(f => f.proveedor + ' (' +
    (f.dias === null ? 'sin ingresos' : f.dias) + ' d, plan ' + f.plan +
    ', mes ' + Math.round(f.ingresado) + ')').join(' | ') || 'ninguno')));

// BETA: último 10-09 → hábiles 11,14,15,16 = 4 → tramo 3-4.
// GAMMA: cruza por alias con la planilla del 08-09 → 9,10,11,14,15,16 = 6.
// DELTA: 03-09 → 4,7,8,9,10,11,14,15,16 = 9 → tramo 7+.
// OMEGA: su única fila de planilla es ERROR y su ingreso es aserrín → sin ingresos.
// ALFA: despachó hoy → no sale.
ok(JSON.stringify(porTramo) ===
   JSON.stringify([['BETA LTDA'], ['GAMMA SA'], ['OMEGA SPA', 'DELTA SPA']]),
   'los tres tramos, excluyentes', JSON.stringify(porTramo));

const alfa = aviso.proveedores.filter(p => p.proveedor === 'ALFA SPA')[0];
ok(alfa && alfa.dias === 0, 'ALFA despachó hoy: 0 días');
ok(alfa && alfa.plan === 4000,
   'el alias junta "ALFA S.A." con "ALFA SPA": plan 4.000',
   alfa && alfa.plan);
ok(alfa && alfa.subproductos.length === 2, 'ALFA con sus dos subproductos');
ok(Math.round(alfa.ingresado) === 201, 'cantidad con coma decimal: 200,5',
   alfa && alfa.ingresado);

const gamma = aviso.proveedores.filter(p => p.proveedor === 'GAMMA SA')[0];
ok(gamma.fuente === 'PLANILLA' && gamma.ultimo === '2026-09-08',
   'GAMMA cruza por alias con la planilla', JSON.stringify(gamma));

const omega = aviso.proveedores.filter(p => p.proveedor === 'OMEGA SPA')[0];
ok(omega.dias === null, 'la fila ERROR de la planilla no cuenta como despacho');
ok(omega.ingresado === 0, 'el aserrín no es astilla de proceso');

ok(aviso.mes === 'SEP-2026', 'toma la columna del mes en curso', aviso.mes);

// --- 2. El correo ------------------------------------------------------
ctx.enviarAhora();
ok(enviados.length === 1, 'manda un correo');
ok(enviados[0].to === 'francisco.correa@masisa.com,jaime.rojas@masisa.com',
   'a los dos destinatarios', enviados[0].to);
ok(/· 4$/.test(enviados[0].subject), 'el asunto trae el total',
   enviados[0].subject);
ok(enviados[0].htmlBody.split('<table').length - 1 === 3,
   'tres tablas en el cuerpo');
require('fs').writeFileSync(__dirname + '/correo.html', enviados[0].htmlBody);

// --- 3. Sábado: no manda -----------------------------------------------
const sabado = cargar(hojas, '2026-09-19');
sabado.ctx.enviarAvisoSilencio();
ok(sabado.enviados.length === 0, 'sábado no manda');
ok(/no es día hábil/.test(sabado.registro.join(' ')), 'y lo deja dicho');

// --- 4. Nadie atrasado -------------------------------------------------
const alDia = JSON.parse(JSON.stringify({}));
const hojasAlDia = Object.assign({}, hojas, {
  Ingresos: hoja('Ingresos', [
    hojas.Ingresos.getDataRange().getValues()[0],
    ...['ALFA SPA', 'BETA LTDA', 'GAMMA SA', 'DELTA SPA', 'OMEGA SPA'].map(p =>
      ['', '', '3000039', 'ASTILLA PINO', new Date(Date.UTC(2026, 8, 16)),
       '', '', '', '100', '', 'TS', 'X', p, 'TABLEROS'])
  ])
});
const limpio = cargar(hojasAlDia, '2026-09-16');
limpio.ctx.enviarAhora();
ok(/Ningún proveedor del plan/.test(limpio.enviados[0].htmlBody),
   'si no hay nadie atrasado, el correo igual sale diciéndolo');

// --- 5. Sin columna del mes en el Plan ---------------------------------
const sinMes = cargar(Object.assign({}, hojas, {
  Plan: hoja('Plan', [
    ['Suministro', 'Proveedor', 'Precio', 'AGO-2026'],
    ['ASTILLA PINO VERDE', 'ALFA SPA', 41, 900]
  ])
}), '2026-09-16');
sinMes.ctx.enviarAhora();
ok(/no tiene una columna para este mes/.test(sinMes.enviados[0].htmlBody),
   'sin columna del mes, lo dice en vez de mandar tablas vacías');

// --- 6. Disparador -----------------------------------------------------
ctx.instalarAvisoDiario();
ok(ctx.eliminarAvisoDiario() === 1, 'instala y elimina un solo disparador');

console.log(fallos ? '\n' + fallos + ' FALLOS' : '\nTodo OK');
process.exitCode = fallos ? 1 : 0;
