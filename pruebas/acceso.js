/**
 * Por qué el panel no se ve y qué hacer al respecto.
 *
 * La planilla del panel es la única puerta que el panel no puede
 * esquivar: el libro de camiones que falta se anota y se sigue, pero
 * sin la planilla no hay nada que mostrar. Y el error que da Apps
 * Script —"No cuentas con el permiso necesario para acceder al
 * documento solicitado"— no dice qué documento ni qué hacer, así que
 * para quien abrió el link es una pantalla en blanco.
 *
 * Pasó: el panel andaba solo para la cuenta que lo implementó. Esta
 * prueba cuida que el aviso diga cuál de los dos casos es.
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

let fallos = 0;
function ok(c, t, extra) {
  console.log((c ? 'OK   ' : 'MAL  ') + t);
  if (!c) {
    fallos++;
    if (extra !== undefined) { console.log('     ' + JSON.stringify(extra)); }
  }
}

const CONFIG = { SPREADSHEET_ID: 'planilla-del-panel' };

// Quién mira y con qué cuenta corre el panel. En la aplicación web
// publicada con "Ejecutar como: yo" son dos cuentas distintas, y esa
// diferencia es justo la que hace que el panel sirva para gente que no
// tiene acceso a nada.
let MIRA = 'quien.mira@masisa.com';
let CORRE = 'dueno@masisa.com';

const Session = {
  getActiveUser: function() {
    return { getEmail: function() { return MIRA; } };
  },
  getEffectiveUser: function() {
    return { getEmail: function() { return CORRE; } };
  }
};

let ABRE = true;

const SpreadsheetApp = {
  openById: function(id) {
    if (!ABRE) {
      throw new Error(
        'No cuentas con el permiso necesario para acceder al ' +
        'documento solicitado.'
      );
    }

    return { id: id };
  }
};

eval([
  'abrirPanel_', 'explicarPermiso_', 'cuentaDelPanel_', 'autorActual_'
].map(recortar).join('\n'));

/* ------------------------------------------------------------------ */

ok(abrirPanel_().id === 'planilla-del-panel',
   'con acceso, abrirPanel_ devuelve la planilla del panel');

ABRE = false;

// El caso del link equivocado: el de prueba termina en /dev y corre
// con la cuenta de quien lo abre.
MIRA = 'quien.mira@masisa.com';
CORRE = 'quien.mira@masisa.com';

let dicho = '';

try { abrirPanel_(); } catch (error) { dicho = error.message; }

ok(dicho.indexOf('tu propia cuenta') !== -1 &&
   dicho.indexOf('/exec') !== -1,
   'corriendo con la cuenta de quien mira, el aviso manda al link ' +
   'de la implementación', dicho);

ok(dicho.indexOf('quien.mira@masisa.com') !== -1,
   'y le dice con qué cuenta está entrando', dicho);

ok(dicho.indexOf('permiso necesario para acceder') === -1,
   'sin repetir el error de Apps Script, que no explica nada', dicho);

// El otro caso: el panel corre con la cuenta del dueño y es esa la que
// perdió el acceso. Compartir otro link no cambiaría nada.
CORRE = 'dueno@masisa.com';

try { abrirPanel_(); } catch (error) { dicho = error.message; }

ok(dicho.indexOf('dueno@masisa.com') !== -1 &&
   dicho.indexOf('quien lo ') !== -1 &&
   dicho.indexOf('/exec') === -1,
   'corriendo con la cuenta del dueño, el aviso apunta al acceso de ' +
   'esa cuenta y no al link', dicho);

// Y cualquier otra falla se deja tal cual: cambiarla por un texto de
// permisos mandaría a revisar accesos a quien tiene otro problema.
ok(explicarPermiso_(new Error('Se excedió el tiempo de ejecución')) ===
   'Se excedió el tiempo de ejecución',
   'otra falla cualquiera pasa sin tocarse');

ok(explicarPermiso_('texto suelto sin Error') ===
   'texto suelto sin Error',
   'y aguanta que llegue un texto en vez de un Error');

// Sin permiso para saber quién mira, Session devuelve vacío: el aviso
// igual tiene que salir, sin el paréntesis del correo.
MIRA = '';
CORRE = '';

try { abrirPanel_(); } catch (error) { dicho = error.message; }

ok(dicho.indexOf('tu propia cuenta,') !== -1,
   'sin saber los correos, el aviso sale igual y sin paréntesis vacío',
   dicho);

console.log(fallos ? '\n' + fallos + ' FALLOS' : '\nTodo OK');
process.exitCode = fallos ? 1 : 0;
