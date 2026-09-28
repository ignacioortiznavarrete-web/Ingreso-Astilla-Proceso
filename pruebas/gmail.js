/**
 * La búsqueda de Gmail no puede perder un correo que la regla acepta.
 *
 * El prefiltro iba con la frase entera entre comillas
 * —subject:"PLANILLA CUMPLIMIENTO SUB-PRODUCTOS"— y perdía correos en
 * silencio: en la búsqueda de Gmail el guion no es una letra más, así
 * que un asunto real como "PLANILLA CUMPLIMIENTO SUB-PRODUCTOS VIERNES
 * 25 DE SEPTIEMBRE DE 2026" no volvía en los resultados y ese día
 * desaparecía del panel sin una sola señal.
 *
 * Lo que se comprueba acá es la relación entre las dos capas: el
 * prefiltro tiene que ser MÁS ANCHO que la regla, nunca más estrecho.
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

/** La configuración real, leída del archivo y no copiada a mano. */
function config() {
  const bloque = src.slice(
    src.indexOf('GMAIL_SUBJECTS:'),
    src.indexOf('GMAIL_PROCESSED_LABEL:')
  );
  const frases = (bloque.match(/'([^']+)'/g) || [])
    .map(function(x) { return x.slice(1, -1); })
    .filter(function(x) { return x.indexOf('@') === -1; });
  const correos = (bloque.match(/'[^']*@[^']*'/g) || [])
    .map(function(x) { return x.slice(1, -1); });

  return {
    GMAIL_LABEL: '',
    GMAIL_SUBJECTS: frases,
    GMAIL_ALLOWED_SENDERS: correos,
    GMAIL_SEARCH_DAYS: 120
  };
}

const CONFIG = config();

eval([
  'buildGmailQuery_', 'matchesSubject_', 'normalizeKey_', 'text_'
].map(recortar).join('\n'));

let fallos = 0;
function ok(c, t, extra) {
  console.log((c ? 'OK   ' : 'MAL  ') + t);
  if (!c) { fallos++; if (extra !== undefined) console.log('     ' + JSON.stringify(extra)); }
}

console.log('CONFIG.GMAIL_SUBJECTS: ' + JSON.stringify(CONFIG.GMAIL_SUBJECTS));

const query = buildGmailQuery_();
console.log('query: ' + query + '\n');

ok(CONFIG.GMAIL_SUBJECTS.length >= 1,
   'se leyeron las frases aceptadas del archivo', CONFIG.GMAIL_SUBJECTS);
ok(CONFIG.GMAIL_ALLOWED_SENDERS.length >= 1,
   'y el remitente', CONFIG.GMAIL_ALLOWED_SENDERS);

// --- Lo que rompía -----------------------------------------------------
const terminos = (query.match(/subject:\S+/g) || [])
  .map(function(x) { return x.replace('subject:', '').replace(/[()]/g, ''); });

ok(terminos.length > 0, 'la búsqueda filtra por asunto', terminos);
ok(terminos.every(function(x) { return x.indexOf('"') === -1; }),
   'sin comillas: una frase entrecomillada no es de fiar', terminos);
ok(terminos.every(function(x) { return x.indexOf('-') === -1; }),
   'y sin guiones: en Gmail el guion significa «no»', terminos);
ok(terminos.every(function(x) { return x.indexOf(' ') === -1; }),
   'cada término es UNA palabra', terminos);

// --- La propiedad que importa -----------------------------------------
// Todo asunto que la regla acepta tiene que traer alguna de las
// palabras que la búsqueda pide. Si no, Gmail no lo devuelve y nadie
// se entera.
const REALES = [
  'PLANILLA CUMPLIMIENTO SUB-PRODUCTOS VIERNES 25 DE SEPTIEMBRE DE 2026.',
  'PLANILLA CUMPLIMIENTO SUB-PRODUCTOS LUNES 28 DE SEPTIEMBRE DE 2026',
  'PLANILLA CUMPLIMIENTO SUBPRODUCTOS SABADO 26 DE SEPTIEMBRE DE 2026',
  'Planilla Cumplimiento Sub-Productos viernes 25 de septiembre de 2026',
  'PLANILLA CUMPLIMIENTO SUB PRODUCTOS 25-09-2026',
  'CUMPLIMIENTO SUBPRODUCTOS 25/09/2026',
  'CUMPLIMIENTO SUB-PRODUCTOS'
];

const aceptados = REALES.filter(matchesSubject_);

ok(aceptados.length === REALES.length,
   'la regla acepta las siete escrituras reales del asunto',
   REALES.filter(function(s) { return !matchesSubject_(s); }));

function loEncuentra(asunto) {
  // Gmail busca por palabras: parte el asunto donde no hay letras ni
  // números. Es la parte que importa para este prefiltro.
  const palabras = normalizeKey_(asunto).split(/[^A-Z0-9]+/);

  return terminos.some(function(t) {
    return palabras.indexOf(t) !== -1;
  });
}

const perdidos = aceptados.filter(function(s) { return !loEncuentra(s); });

ok(perdidos.length === 0,
   'y la búsqueda encuentra todos los que la regla acepta', perdidos);

// El caso exacto que se perdió
const ELCASO = 'PLANILLA CUMPLIMIENTO SUB-PRODUCTOS VIERNES 25 DE SEPTIEMBRE DE 2026.';
ok(matchesSubject_(ELCASO) && loEncuentra(ELCASO),
   'el correo del viernes 25 entra por las dos capas');

// --- Y sigue filtrando algo -------------------------------------------
const AJENOS = [
  'Re: PLANILLA CUMPLIMIENTO SUB-PRODUCTOS VIERNES 25',
  'Vacaciones de septiembre',
  'Reunión de coordinación'
];

ok(AJENOS.every(function(s) { return !matchesSubject_(s); }),
   'la regla sigue descartando respuestas y correos ajenos');
ok(!loEncuentra('Reunión de coordinación'),
   'y el prefiltro no se trae el buzón entero');

// --- El remitente sigue en la búsqueda --------------------------------
ok(query.indexOf('from:' + CONFIG.GMAIL_ALLOWED_SENDERS[0]) !== -1,
   'la búsqueda sigue acotada al remitente oficial', query);
ok(query.indexOf('newer_than:' + CONFIG.GMAIL_SEARCH_DAYS + 'd') !== -1,
   'y a la ventana de días', query);

// --- Si mañana se agrega otra frase, el prefiltro la sigue ------------
CONFIG.GMAIL_SUBJECTS = CONFIG.GMAIL_SUBJECTS.concat(['REPORTE DIARIO ASTILLA']);
const query2 = buildGmailQuery_();

ok(query2.indexOf('subject:REPORTE') !== -1,
   'el prefiltro sale de CONFIG: una frase nueva entra sola', query2);

console.log(fallos ? '\n' + fallos + ' FALLOS' : '\nTodo OK');
process.exitCode = fallos ? 1 : 0;
