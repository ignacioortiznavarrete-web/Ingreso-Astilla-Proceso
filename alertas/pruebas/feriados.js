/**
 * Los feriados calculados, contra los de verdad.
 *
 * La lista escrita a mano se borró porque se acababa en silencio: al
 * pasar el último año escrito, el 18 de septiembre pasaba a contar
 * como día hábil y el plan a la fecha quedaba inflado sin que nadie
 * lo notara. Ahora se calculan, y esta prueba es la que responde si
 * el cálculo dice lo mismo que el calendario.
 *
 * Prueba las DOS copias del módulo —la del panel en Codigo.gs y la de
 * las alertas en alertas/Feriados.gs— y exige que den lo mismo. Son
 * dos proyectos de Apps Script distintos, así que el código está
 * duplicado a propósito; lo que no puede pasar es que se separen.
 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

let fallos = 0;
function ok(cond, texto, extra) {
  console.log((cond ? 'OK   ' : 'MAL  ') + texto);
  if (!cond) { fallos++; if (extra !== undefined) console.log('     ' + extra); }
}

const raiz = path.join(__dirname, '..', '..');

/** Recorta una función completa del archivo, contando llaves. */
function recortar(txt, firma) {
  const desde = txt.indexOf(firma);
  if (desde === -1) { throw new Error('no está ' + firma); }
  let nivel = 0;
  for (let i = desde; i < txt.length; i++) {
    if (txt[i] === '{') { nivel++; }
    if (txt[i] === '}') { nivel--; if (nivel === 0) { return txt.slice(desde, i + 1); } }
  }
  throw new Error('llaves sin cerrar en ' + firma);
}

/** El módulo del panel: el bloque de feriados más el ayudante de fechas. */
function moduloDelPanel() {
  const txt = fs.readFileSync(path.join(raiz, 'Codigo.gs'), 'utf8');
  const marca = txt.indexOf(' * FERIADOS DE CHILE, CALCULADOS');
  const ini = txt.lastIndexOf('/*', marca);
  const fin = txt.indexOf('const CONFIG = Object.freeze({');
  if (marca === -1 || ini === -1 || fin === -1 || fin < ini) {
    throw new Error('Codigo.gs cambió de forma');
  }
  return recortar(txt, 'function buildDateKey_(') + '\n' + txt.slice(ini, fin);
}

/** El módulo de las alertas: el archivo entero. */
function moduloDeAlertas() {
  return fs.readFileSync(path.join(raiz, 'alertas', 'Feriados.gs'), 'utf8');
}

/** Corre un módulo con un "hoy" fijo y devuelve sus funciones. */
function correr(fuente, hoy) {
  const real = Date;
  const ctx = {
    console,
    Date: class extends real {
      constructor(...a) { if (!a.length) { super(hoy + 'T12:00:00Z'); } else { super(...a); } }
      static now() { return new real(hoy + 'T12:00:00Z').getTime(); }
      static UTC(...a) { return real.UTC(...a); }
    }
  };
  vm.createContext(ctx);
  vm.runInContext(fuente, ctx, { filename: 'feriados' });

  // Un const del módulo no queda como propiedad del contexto —es la
  // misma regla de V8 por la que CONFIG.FERIADOS es un getter—, así que
  // para mirarlo hay que preguntarle adentro.
  ctx.extras = function() {
    return vm.runInContext('FERIADOS_EXTRA.slice()', ctx);
  };

  return ctx;
}

const PANEL = moduloDelPanel();
const ALERTAS = moduloDeAlertas();

// --- 1. Contra el calendario real -------------------------------------
// Las tres listas están tomadas del calendario oficial, no del código.
const REALES = {
  2024: [
    '2024-01-01', // Año Nuevo
    '2024-03-29', // Viernes Santo
    '2024-03-30', // Sábado Santo
    '2024-05-01', // Día del Trabajo
    '2024-05-21', // Glorias Navales
    '2024-06-20', // Pueblos Indígenas (solsticio de junio)
    '2024-06-29', // San Pedro y San Pablo (cae sábado, no se mueve)
    '2024-07-16', // Virgen del Carmen
    '2024-08-15', // Asunción
    '2024-09-18', // Independencia
    '2024-09-19', // Glorias del Ejército
    '2024-10-12', // Encuentro de Dos Mundos (cae sábado, no se mueve)
    '2024-10-31', // Iglesias Evangélicas (cae jueves, no se mueve)
    '2024-11-01', // Todos los Santos
    '2024-12-08', // Inmaculada Concepción
    '2024-12-25'  // Navidad
  ],
  2025: [
    '2025-01-01',
    '2025-04-18', // Viernes Santo
    '2025-04-19', // Sábado Santo
    '2025-05-01',
    '2025-05-21',
    '2025-06-20', // solsticio
    '2025-06-29', // cae domingo
    '2025-07-16',
    '2025-08-15',
    '2025-09-18',
    '2025-09-19',
    '2025-10-12', // cae domingo
    '2025-10-31', // cae viernes
    '2025-11-01',
    '2025-12-08',
    '2025-12-25'
  ],
  2026: [
    '2026-01-01',
    '2026-04-03', // Viernes Santo
    '2026-04-04', // Sábado Santo
    '2026-05-01',
    '2026-05-21',
    '2026-06-21', // solsticio
    '2026-06-29', // cae lunes
    '2026-07-16',
    '2026-08-15',
    '2026-09-18',
    '2026-09-19',
    '2026-10-12', // cae lunes
    '2026-10-31', // cae sábado
    '2026-11-01',
    '2026-12-08',
    '2026-12-25'
  ]
};

const panel = correr(PANEL, '2026-09-22');
const alertas = correr(ALERTAS, '2026-09-22');

Object.keys(REALES).forEach(function(anio) {
  const esperado = REALES[anio].join(' ');
  const calcP = panel.feriadosDe_(Number(anio)).slice().sort().join(' ');
  const calcA = alertas.feriadosDe_(Number(anio)).slice().sort().join(' ');
  ok(calcP === esperado, anio + ': los 16 feriados, uno por uno',
     'calculado: ' + calcP + '\n     real:      ' + esperado);
  ok(calcA === calcP, anio + ': las alertas calculan lo mismo que el panel', calcA);
});

// --- 2. Los traslados por ley -----------------------------------------
// Ley 19.973: San Pedro y Pablo y el 12 de octubre se corren a lunes
// si caen martes, miércoles o jueves, y al lunes siguiente si caen
// viernes.
const TRASLADOS = [
  [2022, '2022-06-27', '29-06-2022 cae miércoles → lunes 27'],
  [2023, '2023-06-26', '29-06-2023 cae jueves → lunes 26'],
  [2021, '2021-06-28', '29-06-2021 cae martes → lunes 28'],
  [2018, '2018-10-15', '12-10-2018 cae viernes → lunes 15'],
  [2019, '2019-10-12', '12-10-2019 cae sábado → se queda donde está'],
  [2024, '2024-06-29', '29-06-2024 cae sábado → se queda donde está']
];
TRASLADOS.forEach(function(caso) {
  const lista = panel.feriadosDe_(caso[0]);
  ok(lista.indexOf(caso[1]) !== -1, caso[2], lista.join(' '));
});

// Ley 20.299: el 31 de octubre se corre al viernes anterior si cae
// martes, y al siguiente si cae miércoles.
ok(panel.feriadosDe_(2023).indexOf('2023-10-27') !== -1,
   '31-10-2023 cae martes → viernes 27', panel.feriadosDe_(2023).join(' '));
ok(panel.feriadosDe_(2018).indexOf('2018-11-02') !== -1,
   '31-10-2018 cae miércoles → viernes 02-11', panel.feriadosDe_(2018).join(' '));

// --- 3. El solsticio de junio -----------------------------------------
// Ley 21.357: el feriado sigue al solsticio, no a una fecha fija.
const SOLSTICIOS = {
  2022: '2022-06-21', 2023: '2023-06-21', 2024: '2024-06-20',
  2025: '2025-06-20', 2026: '2026-06-21', 2027: '2027-06-21'
};
Object.keys(SOLSTICIOS).forEach(function(anio) {
  const clave = panel.claveDeFecha_(panel.solsticioJunio_(Number(anio)));
  ok(clave === SOLSTICIOS[anio], 'solsticio de ' + anio + ': ' + SOLSTICIOS[anio], clave);
});

// --- 4. La lista no se acaba ------------------------------------------
// Esto es lo que se rompía con la lista a mano: llegado el último año
// escrito, el 18 de septiembre pasaba a ser día hábil.
['2027-01-05', '2030-06-15', '2040-11-20', '2099-03-01'].forEach(function(hoy) {
  const anio = Number(hoy.slice(0, 4));
  const lista = correr(PANEL, hoy).feriadosDelPanel_();
  const cubre = [anio, anio + 1, anio + 2].every(function(a) {
    return lista.indexOf(a + '-09-18') !== -1 && lista.indexOf(a + '-12-25') !== -1;
  });
  ok(cubre, 'un ' + hoy + ' la lista sigue cubriendo hasta ' + (anio + 2),
     lista.slice(-4).join(' '));
});

// --- 5. La ventana y los agregados a mano ------------------------------
const hoy2026 = panel.feriadosDelPanel_();
ok(hoy2026[0].slice(0, 4) === '2024' && hoy2026[hoy2026.length - 1].slice(0, 4) === '2028',
   'la ventana va de dos años atrás a dos adelante',
   hoy2026[0] + ' … ' + hoy2026[hoy2026.length - 1]);
// El lunes 21-09-2026 estuvo en FERIADOS_EXTRA, heredado de la lista
// escrita a mano, y no es feriado: la Ley 20.215 corre el día solo
// cuando el 18 cae martes o el 19 cae viernes, y en 2026 caen viernes y
// sábado. Marcarlo costaba caro: ese lunes dejaba de ser hábil y su
// planilla se sumaba al jueves 17 —el hábil anterior, al otro lado del
// 18, 19 y 20—, así que dos días de despacho salían como uno.
ok(hoy2026.indexOf('2026-09-21') === -1,
   'el lunes 21-09-2026 es hábil: ninguna ley lo corre');
ok(alertas.feriadosDelPanel_().indexOf('2026-09-21') === -1,
   'y las alertas tampoco lo cuentan como feriado');

// FERIADOS_EXTRA es para lo que ninguna regla predice. Lo que las
// reglas YA dan no tiene por qué estar escrito: escribirlo de más es
// justamente lo que pasó con el 21-09.
const porRegla = {};

for (let a = 2024; a <= 2028; a++) {
  panel.feriadosDe_(a).forEach(function(f) { porRegla[f] = true; });
}

ok(panel.extras().every(function(f) { return !porRegla[f]; }),
   'nada de FERIADOS_EXTRA repite algo que la regla ya calcula',
   panel.extras());
ok(hoy2026.join() ===
   Object.keys(porRegla).concat(panel.extras())
     .filter(function(f, i, l) { return l.indexOf(f) === i; })
     .sort().join(),
   'la lista del panel es exactamente las reglas más FERIADOS_EXTRA');
ok(hoy2026.length === new Set(hoy2026).size, 'sin fechas repetidas');
ok(hoy2026.slice().sort().join() === hoy2026.join(), 'y vienen ordenadas');
ok(alertas.feriadosDelPanel_().join() === hoy2026.join(),
   'las alertas ven exactamente los mismos días que el panel');

// --- 6. Se calcula una vez ---------------------------------------------
ok(panel.feriadosDelPanel_() === hoy2026,
   'la segunda llamada devuelve lo ya calculado, no lo rehace');

console.log(fallos ? '\n' + fallos + ' FALLOS' : '\nTodo OK');
process.exitCode = fallos ? 1 : 0;
