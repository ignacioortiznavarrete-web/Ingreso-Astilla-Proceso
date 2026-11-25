/**
 * Que no falte ninguna función.
 *
 * Apps Script no avisa nada al guardar: un `nombre_ is not defined`
 * aparece recién cuando alguien aprieta el botón que lo usa, y puede
 * ser un botón que se usa una vez al mes.
 *
 * Esta prueba existe porque pasó: al sacar la importación por Gmail se
 * borró `camionesDeCelda_`, que parecía huérfana y la usaba la lectura
 * del Plan mes a mes. Se descubrió en producción.
 *
 * La convención del proyecto hace esto barato: las funciones internas
 * terminan en guion bajo, y nada de Apps Script lo hace. Así que todo
 * `loQueSea_(` que se llame tiene que tener su `function loQueSea_(`
 * en el mismo archivo.
 */
const fs = require('fs');
const path = require('path');

let fallos = 0;
function ok(c, t, extra) {
  console.log((c ? 'OK   ' : 'MAL  ') + t);
  if (!c) {
    fallos++;
    if (extra !== undefined) { console.log('     ' + JSON.stringify(extra)); }
  }
}

/**
 * El archivo sin comentarios ni literales.
 *
 * Hay que saltarse también las expresiones regulares: sin eso, un
 * /['"]/ abre una comilla que nunca cierra y se come medio archivo,
 * que es como esta misma prueba se inventó una función faltante la
 * primera vez que corrió.
 */
const ANTES_DE_REGEX = new Set(
  '(,=:[!&|?{};+-*%^~<>'.split('').concat(['\n'])
);

function soloCodigo(txt) {
  let fuera = '';
  let i = 0;
  let anterior = '';

  while (i < txt.length) {
    const dos = txt.slice(i, i + 2);

    if (dos === '//') {
      const fin = txt.indexOf('\n', i);
      i = fin === -1 ? txt.length : fin;
      continue;
    }

    if (dos === '/*') {
      const fin = txt.indexOf('*/', i);
      i = fin === -1 ? txt.length : fin + 2;
      continue;
    }

    const c = txt[i];

    if (c === '"' || c === "'" || c === '`') {
      i++;
      while (i < txt.length && txt[i] !== c) {
        i += txt[i] === '\\' ? 2 : 1;
      }
      i++;
      fuera += '""';
      anterior = '"';
      continue;
    }

    if (c === '/' && ANTES_DE_REGEX.has(anterior)) {
      i++;
      let dentro = false;

      while (i < txt.length) {
        if (txt[i] === '\\') { i += 2; continue; }
        if (txt[i] === '[') { dentro = true; }
        else if (txt[i] === ']') { dentro = false; }
        else if (txt[i] === '/' && !dentro) { break; }
        i++;
      }

      i++;
      fuera += '//';
      anterior = '/';
      continue;
    }

    fuera += c;

    if (!/\s/.test(c)) { anterior = c; }

    i++;
  }

  return fuera;
}

function revisar(ruta, etiqueta) {
  const codigo = soloCodigo(fs.readFileSync(ruta, 'utf8'));

  const definidas = new Set();
  let m;
  const reDef = /function\s+([A-Za-z0-9_$]+_)\s*\(/g;

  while ((m = reDef.exec(codigo))) { definidas.add(m[1]); }

  const faltan = {};
  const reUso = /(^|[^.\w$])([A-Za-z0-9_$]+_)\s*\(/g;

  while ((m = reUso.exec(codigo))) {
    const nombre = m[2];

    if (definidas.has(nombre)) { continue; }

    faltan[nombre] = (faltan[nombre] || 0) + 1;
  }

  const lista = Object.keys(faltan).sort();

  ok(lista.length === 0,
     etiqueta + ': no se llama a ninguna función que no exista',
     lista.map(function(n) { return n + ' (' + faltan[n] + ')'; }));

  return definidas.size;
}

const cuantas = revisar(
  path.join(__dirname, '..', 'Codigo.gs'), 'Codigo.gs'
);

ok(cuantas > 100,
   'y se revisaron todas: ' + cuantas + ' funciones internas', cuantas);

// El aviso son cuatro archivos que comparten un solo ámbito, así que
// se revisan juntos.
const alertas = ['Config.gs', 'Feriados.gs', 'Lectura.gs', 'Aviso.gs']
  .map(function(f) {
    return fs.readFileSync(
      path.join(__dirname, '..', 'alertas', f), 'utf8'
    );
  }).join('\n');

const juntos = path.join(
  require('os').tmpdir(), 'alertas-juntas-' + process.pid + '.gs'
);

fs.writeFileSync(juntos, alertas);
revisar(juntos, 'alertas/');
fs.unlinkSync(juntos);

console.log(fallos ? '\n' + fallos + ' FALLOS' : '\nTodo OK');
process.exitCode = fallos ? 1 : 0;
