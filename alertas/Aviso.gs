/**
 * ASTILLA PROCESO · ALERTAS · EL AVISO DIARIO
 *
 * Los proveedores que tienen plan este mes y que están en riesgo de no
 * cumplirlo, en tres grupos excluyentes y en orden de gravedad:
 *
 *   1. No han entregado nada este mes.
 *   2. Están entregando pero llevan días hábiles sin un ingreso.
 *   3. Vienen a la baja: entregan, pero menos de lo que el plan pide a
 *      esta altura del mes, o menos de lo que ellos mismos entregaban.
 *
 * Solo entran los que tienen plan del mes. Una fila del Plan con la
 * celda del mes en blanco no compromete nada, así que ese proveedor no
 * aparece por mucho que lleve semanas sin despachar.
 *
 * QUIÉN LO EJECUTA: nadie tiene que abrir nada. El disparador horario
 * corre solo, con la autorización de quien apretó instalarAvisoDiario,
 * y el correo sale desde esa cuenta.
 *
 * Para instalarlo: abre este proyecto, elige `instalarAvisoDiario` en
 * el selector de funciones del editor y dale a Ejecutar. La primera
 * vez pide autorización. Para probar sin esperar a mañana, ejecuta
 * `enviarAhora`.
 */

/* --- Armado ---------------------------------------------------------- */

/** En qué tramo de silencio cae un proveedor. -1 si no está callado. */
function tramoDe_(dias) {
  if (dias === null) { return CONFIG.TRAMOS.length - 1; }

  for (let i = CONFIG.TRAMOS.length - 1; i >= 0; i--) {
    if (dias >= CONFIG.TRAMOS[i].desde) { return i; }
  }

  return -1;
}

function construirAviso_() {
  const planilla = abrirPlanilla_();

  // Los tres lectores tienen que cruzar por la MISMA clave, así que
  // el contexto —alias escritos y nombres reales de SAP— se arma una
  // vez y se les pasa a todos.
  const ctx = {
    alias: leerAlias_(planilla),
    sap: leerNombresSap_(planilla)
  };

  const plan = leerPlanDelMes_(planilla, ctx);
  const despachos = leerDespachos_(planilla, ctx);
  const hoy = hoyClave_();
  const mes = mesActual_();

  // El mes en días hábiles: los que ya pasaron y los que tiene en
  // total. De ahí sale el ritmo que el plan necesita a esta altura.
  const habiles = {
    transcurridos: diasHabilesEntre_(mes + '-01', hoy),
    total: diasHabilesEntre_(mes + '-01', finDeMes_(mes))
  };

  habiles.parte = habiles.total
    ? habiles.transcurridos / habiles.total
    : 0;

  // Los últimos meses cerrados de la ventana: el propio ritmo del
  // proveedor, contra el que se compara el de ahora.
  const cerrados = mesesDeLaVentana_().filter(function(m) {
    return m < mes;
  }).slice(-CONFIG.BAJA.MESES_BASE);

  const habilesCerrados = cerrados.reduce(function(total, m) {
    return total + diasHabilesEntre_(m + '-01', finDeMes_(m));
  }, 0);

  const proveedores = Object.keys(plan.porProveedor).map(function(clave) {
    const item = plan.porProveedor[clave];
    const visto = despachos[clave] ||
      { ultimo: '', fuente: '', mes: 0, porMes: {} };

    // Lo que el plan pide a esta altura del mes.
    const ritmoPlan = item.plan * habiles.parte;

    // Y lo que el proveedor venía entregando, por día hábil.
    const base = cerrados.reduce(function(total, m) {
      return total + (visto.porMes[m] || 0);
    }, 0);

    const basePorDia = habilesCerrados ? base / habilesCerrados : 0;
    const ahoraPorDia = habiles.transcurridos
      ? visto.mes / habiles.transcurridos
      : 0;

    return {
      proveedor: item.proveedor,
      subproductos: Object.keys(item.subproductos).sort(),
      plan: item.plan,
      ingresado: visto.mes,
      ultimo: visto.ultimo,
      fuente: visto.fuente,
      // Nunca despachó en la ventana: no es un número de días, es
      // otra categoría, y se trata aparte.
      dias: visto.ultimo ? diasHabilesDesde_(visto.ultimo, hoy) : null,
      // Lo que el plan pide a hoy, y qué parte de eso lleva.
      ritmoPlan: ritmoPlan,
      cumplimiento: ritmoPlan > 0 ? visto.mes / ritmoPlan : null,
      // Su propio ritmo, antes y ahora, en TS por día hábil.
      basePorDia: basePorDia,
      ahoraPorDia: ahoraPorDia,
      caida: basePorDia > 0 ? 1 - ahoraPorDia / basePorDia : null
    };
  });

  // Hablar de ritmo el día 1 del mes es acusar a todo el mundo: nadie
  // ha entregado nada todavía. Hasta que el mes lleve algunos días
  // hábiles, el único criterio es el silencio, que no depende del mes.
  const hayRitmo = habiles.transcurridos >= CONFIG.BAJA.MINIMO_DIAS;

  // Tres grupos EXCLUYENTES, en orden de gravedad. El que no ha
  // entregado nada también lleva días callado y también viene a la
  // baja; decirlo tres veces no agrega nada y hace el correo más
  // largo justo donde tiene que ser corto.
  const sinEntregar = [];
  const callados = [];
  const aLaBaja = [];

  proveedores.forEach(function(item) {
    const nada = !item.ingresado;

    // 1) Nada este mes. El que nunca despachó en toda la ventana entra
    //    siempre; el que entregó el mes pasado, solo cuando el mes ya
    //    lleva días hábiles encima.
    if (nada && (item.dias === null || hayRitmo)) {
      item.motivo = item.dias === null
        ? 'sin ingresos en la ventana'
        : 'nada en el mes';

      sinEntregar.push(item);
      return;
    }

    // 2) Entregando, pero callado desde hace días.
    if (item.dias !== null && item.dias >= CONFIG.TRAMOS[0].desde) {
      item.tramo = tramoDe_(item.dias);
      callados.push(item);
      return;
    }

    if (!hayRitmo || nada) { return; }

    // 3) Despachando y al día, pero el ritmo viene cayendo. Dos
    //    señales distintas y basta una: contra su plan, y contra sí
    //    mismo.
    const bajoPlan = item.cumplimiento !== null &&
      item.cumplimiento < CONFIG.BAJA.RITMO_PLAN;

    const cayendo = item.caida !== null &&
      item.caida >= CONFIG.BAJA.CAIDA_PROPIA;

    if (bajoPlan || cayendo) {
      item.porPlan = bajoPlan;
      item.porSiMismo = cayendo;
      aLaBaja.push(item);
    }
  });

  // En cada grupo, primero lo que más pesa. No es el mismo criterio en
  // los tres porque no es la misma pregunta: al que no entregó se le
  // mira el compromiso, al callado los días, y al que viene a la baja
  // cuántas TS lleva de atraso.
  sinEntregar.sort(function(a, b) {
    return (b.plan || 0) - (a.plan || 0);
  });

  callados.sort(function(a, b) {
    if (b.dias !== a.dias) { return b.dias - a.dias; }

    return (b.plan || 0) - (a.plan || 0);
  });

  aLaBaja.sort(function(a, b) {
    return (b.ritmoPlan - b.ingresado) - (a.ritmoPlan - a.ingresado);
  });

  function resumen(filas) {
    return {
      filas: filas,
      cuantos: filas.length,
      plan: filas.reduce(function(t, x) { return t + (x.plan || 0); }, 0),
      ingresado: filas.reduce(function(t, x) {
        return t + (x.ingresado || 0);
      }, 0),
      // TS de atraso contra el ritmo que el plan pide a hoy.
      atraso: filas.reduce(function(t, x) {
        return t + Math.max(0, x.ritmoPlan - x.ingresado);
      }, 0)
    };
  }

  // Hasta dónde llega cada fuente. Sin esto, un proveedor puede
  // parecer callado cuando lo que está atrasado es la carga.
  let ultimoSap = '';
  let ultimaPlanilla = '';

  Object.keys(despachos).forEach(function(clave) {
    const d = despachos[clave];

    if (d.fuente === 'SAP' && d.ultimo > ultimoSap) {
      ultimoSap = d.ultimo;
    }

    if (d.ultimo > ultimaPlanilla) { ultimaPlanilla = d.ultimo; }
  });

  return {
    grupos: [
      Object.assign({
        clave: 'sinEntregar',
        titulo: 'No han entregado este mes',
        rotulo: 'Sin entregar',
        nota: 'Tienen plan comprometido y el mes va sin un solo ' +
          'ingreso suyo. Es el grupo que más pesa: lo que no entró ' +
          'hasta hoy hay que repartirlo en los días que quedan.',
        color: 'ladrillo'
      }, resumen(sinEntregar)),
      Object.assign({
        clave: 'callados',
        titulo: 'Callados',
        rotulo: 'Callados',
        nota: 'Entregaron este mes, pero llevan ' +
          CONFIG.TRAMOS[0].desde + ' días hábiles o más sin un ' +
          'ingreso nuevo.',
        color: 'madera'
      }, resumen(callados)),
      Object.assign({
        clave: 'aLaBaja',
        titulo: 'A la baja',
        rotulo: 'A la baja',
        nota: 'Están despachando y al día, pero el ritmo viene ' +
          'cayendo: por debajo de lo que el plan pide a esta altura ' +
          'del mes, o por debajo de lo que ellos mismos entregaban.',
        color: 'pizarra'
      }, resumen(aLaBaja))
    ],
    proveedores: proveedores,
    sinPlan: !Object.keys(plan.porProveedor).length,
    mes: plan.etiqueta || mesActual_(),
    habiles: habiles,
    hayRitmo: hayRitmo,
    mesesBase: cerrados,
    planTotal: proveedores.reduce(function(t, x) {
      return t + (x.plan || 0);
    }, 0),
    ingresadoTotal: proveedores.reduce(function(t, x) {
      return t + (x.ingresado || 0);
    }, 0),
    ultimoSap: ultimoSap,
    ultimaPlanilla: ultimaPlanilla,
    hoy: hoy,
    url: planilla.getUrl(),
    nombre: planilla.getName()
  };
}

/* --- Formato --------------------------------------------------------- */

function esc_(valor) {
  return String(valor === null || valor === undefined ? '' : valor)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * Miles con punto, a mano: toLocaleString('es-CL') en Apps Script
 * puede caer a en-US según el ICU del runtime y escribir 1,260 donde
 * en esta planilla va 1.260.
 */
function formatoTs_(valor) {
  const n = Math.round(Number(valor) || 0);
  const signo = n < 0 ? '-' : '';
  const digitos = String(Math.abs(n));
  let salida = '';

  for (let i = 0; i < digitos.length; i++) {
    if (i > 0 && (digitos.length - i) % 3 === 0) { salida += '.'; }
    salida += digitos.charAt(i);
  }

  return signo + salida;
}

function porcentaje_(valor) {
  if (valor === null || valor === undefined || !isFinite(valor)) {
    return '—';
  }

  return Math.round(valor * 100) + '%';
}

/* --- Correo ----------------------------------------------------------
 *
 * Todo en tablas, con estilos en LÍNEA y con atributos de tabla
 * (bgcolor, width, align) además de las propiedades CSS: Outlook
 * descarta las hojas de estilo, ignora buena parte de CSS moderno y
 * renderiza con Word. Nada de flex, grid, posicionamiento ni
 * variables. Las dos familias son las que existen en cualquier
 * cliente: Georgia para los títulos y las cifras, Arial para el
 * texto, que es el reparto que usa el panel con Fraunces e Inter.
 * ------------------------------------------------------------------ */

const PALETA = Object.freeze({
  paper: '#FFFFFF',
  surface: '#F7F5F1',
  surface2: '#EDE9E2',
  rule: '#E1DBD1',
  ruleSoft: '#F0ECE6',
  ink: '#16201A',
  ink2: '#4B5A51',
  ink3: '#838E86',
  verde: '#14563A',
  verdeSoft: '#E7F1EB',
  madera: '#A96C2A',
  maderaSoft: '#FAF0E1',
  pizarra: '#4F6376',
  pizarraSoft: '#EDF1F4',
  ladrillo: '#A3382A',
  ladrilloSoft: '#FBEBE8'
});

const SANS = 'Arial,Helvetica,sans-serif';
const SERIF = 'Georgia,\'Times New Roman\',serif';

function colorDe_(nombre) {
  return PALETA[nombre] || PALETA.ink2;
}

function colorSuaveDe_(nombre) {
  return PALETA[nombre + 'Soft'] || PALETA.surface;
}

/**
 * El subproducto, corto. La hoja Plan escribe el nombre largo del
 * maestro y tres de esos en una celda hacen una columna más alta que
 * la fila entera.
 */
function subCorto_(nombre) {
  const clave = normalizeKey_(nombre);

  if (clave.indexOf('NITENS') !== -1) { return 'Nitens'; }

  if (clave.indexOf('PINO VERDE') !== -1) {
    return clave.indexOf('CORTEZA') !== -1
      ? 'Pino verde c/corteza'
      : 'Pino verde';
  }

  return text_(nombre);
}

/** Celda de datos. */
function celda_(contenido, alineado, tenue, enUnaLinea) {
  return '<td align="' + (alineado || 'left') +
    '" style="padding:8px 10px;border-bottom:1px solid ' + PALETA.ruleSoft +
    ';font-family:' + SANS + ';font-size:13px;line-height:1.35;' +
    'text-align:' + (alineado || 'left') + ';color:' +
    (tenue ? PALETA.ink3 : PALETA.ink) +
    (enUnaLinea ? ';white-space:nowrap' : '') + '">' + contenido + '</td>';
}

/** Celda de cifra: Georgia, que es la que alinea bien los números. */
function celdaN_(contenido, tenue) {
  return '<td align="right" style="padding:8px 10px;border-bottom:1px ' +
    'solid ' + PALETA.ruleSoft + ';font-family:' + SERIF + ';' +
    'font-size:14px;text-align:right;color:' +
    (tenue ? PALETA.ink3 : PALETA.ink) + '">' + contenido + '</td>';
}

function th_(texto, alineado) {
  return '<th align="' + (alineado || 'left') +
    '" style="padding:6px 10px;border-bottom:1px solid ' + PALETA.rule +
    ';font-family:' + SANS + ';font-size:10px;letter-spacing:.07em;' +
    'text-transform:uppercase;font-weight:bold;color:' + PALETA.ink3 +
    ';text-align:' + (alineado || 'left') + '">' + texto + '</th>';
}

/**
 * El proveedor con sus subproductos debajo, en chico.
 *
 * Van ahí y no en su propia columna a propósito: una columna menos es
 * lo que hace que la tabla entre en la pantalla de un teléfono, y el
 * subproducto es dato de apoyo, no la pregunta.
 */
function celdaProveedor_(item) {
  const subs = item.subproductos.map(subCorto_).join(' · ');

  return celda_(
    '<b>' + esc_(item.proveedor) + '</b>' +
    (subs
      ? '<div style="font-size:11px;color:' + PALETA.ink3 +
        ';padding-top:2px">' + esc_(subs) + '</div>'
      : '')
  );
}

/** Pastilla de texto corto, para los días y los motivos. */
function sello_(texto, color) {
  return '<span style="display:inline-block;padding:2px 7px;' +
    'font-family:' + SANS + ';font-size:11px;font-weight:bold;' +
    'border-radius:3px;background:' + colorSuaveDe_(color) + ';color:' +
    colorDe_(color) + ';white-space:nowrap">' + texto + '</span>';
}

/**
 * Barra de avance, en tabla: es la única forma que Outlook dibuja
 * igual. Se dibuja el trozo lleno y el resto, y si va al 100% o más se
 * omite el resto, porque una celda de ancho cero se ve como una raya.
 */
function barra_(parte, color, px) {
  const pintado = Math.max(0, Math.min(1, Number(parte) || 0));
  const ancho = Math.round(pintado * 100);
  const total = px || 70;

  const lleno = ancho > 0
    ? '<td height="6" width="' + ancho + '%" bgcolor="' + colorDe_(color) +
      '" style="height:6px;font-size:0;line-height:0;background:' +
      colorDe_(color) + '">&nbsp;</td>'
    : '';

  const vacio = ancho < 100
    ? '<td height="6" bgcolor="' + PALETA.surface2 +
      '" style="height:6px;font-size:0;line-height:0;background:' +
      PALETA.surface2 + '">&nbsp;</td>'
    : '';

  return '<table cellpadding="0" cellspacing="0" border="0" width="' +
    total + '" style="width:' + total + 'px;border-collapse:collapse;' +
    'table-layout:fixed"><tr>' + lleno + vacio + '</tr></table>';
}

/** Una de las tres tarjetas de arriba. */
function tarjeta_(grupo, ultima) {
  const cifra = '<div style="font-family:' + SERIF + ';font-size:26px;' +
    'line-height:1.1;color:' + colorDe_(grupo.color) + '">' +
    grupo.cuantos + '</div>';

  const rotulo = '<div style="font-family:' + SANS + ';font-size:10px;' +
    'letter-spacing:.07em;text-transform:uppercase;color:' + PALETA.ink2 +
    ';padding-top:3px">' + esc_(grupo.rotulo) + '</div>';

  const pie = '<div style="font-family:' + SANS + ';font-size:11px;' +
    'color:' + PALETA.ink3 + ';padding-top:4px">' +
    (grupo.cuantos
      ? formatoTs_(grupo.plan) + ' TS de plan'
      : 'ninguno') + '</div>';

  return '<td width="33%" valign="top" style="width:33%;padding:0 ' +
    (ultima ? '0' : '6px') + ' 0 0">' +
    '<table cellpadding="0" cellspacing="0" border="0" width="100%" ' +
    'style="border-collapse:collapse"><tr><td bgcolor="' +
    colorSuaveDe_(grupo.color) + '" style="padding:10px 12px;' +
    'border-left:3px solid ' + colorDe_(grupo.color) + ';background:' +
    colorSuaveDe_(grupo.color) + '">' +
    cifra + rotulo + pie +
    '</td></tr></table></td>';
}

/** El encabezado de una sección. */
function tituloSeccion_(grupo) {
  const cuenta = grupo.cuantos +
    (grupo.cuantos === 1 ? ' proveedor' : ' proveedores') +
    (grupo.plan > 0 ? ' · ' + formatoTs_(grupo.plan) + ' TS de plan' : '');

  return '<tr><td style="padding:26px 24px 0">' +
    '<table cellpadding="0" cellspacing="0" border="0" width="100%">' +
    '<tr><td style="border-left:3px solid ' + colorDe_(grupo.color) +
    ';padding-left:10px">' +
    '<div style="font-family:' + SERIF + ';font-size:17px;color:' +
    colorDe_(grupo.color) + '">' + esc_(grupo.titulo) + '</div>' +
    '<div style="font-family:' + SANS + ';font-size:11px;' +
    'letter-spacing:.05em;text-transform:uppercase;color:' + PALETA.ink3 +
    ';padding-top:2px">' + esc_(cuenta) + '</div>' +
    '</td></tr></table>' +
    '<p style="margin:8px 0 0;font-family:' + SANS + ';font-size:12px;' +
    'line-height:1.5;color:' + PALETA.ink2 + '">' + esc_(grupo.nota) +
    '</p></td></tr>';
}

function tabla_(encabezados, filas) {
  return '<tr><td style="padding:10px 24px 0">' +
    '<table cellpadding="0" cellspacing="0" border="0" width="100%" ' +
    'style="border-collapse:collapse;width:100%"><tr>' +
    encabezados.join('') + '</tr>' + filas.join('') + '</table>' +
    '</td></tr>';
}

/**
 * La última columna de las dos primeras tablas: cuánto lleva callado.
 *
 * Solo el número. "9 días hábiles" dentro de la pastilla ocupaba más
 * que la columna del proveedor y era lo que sacaba la tabla de la
 * pantalla de un teléfono; el encabezado ya dice que son hábiles.
 */
function celdaSilencio_(item, color) {
  return celda_(
    sello_(item.dias === null ? 'sin ingresos' : item.dias, color),
    'right'
  );
}

function filasSinEntregar_(grupo) {
  return grupo.filas.map(function(item) {
    return '<tr>' +
      celdaProveedor_(item) +
      celdaN_(formatoTs_(item.plan)) +
      celda_(
        item.ultimo
          ? esc_(fechaLegible_(item.ultimo)) +
            (item.fuente === 'PLANILLA'
              ? '<div style="font-size:11px;color:' + PALETA.ink3 +
                '">de la planilla</div>'
              : '')
          : '—',
        'left',
        !item.ultimo,
        true
      ) +
      celdaSilencio_(item, grupo.color) +
      '</tr>';
  });
}

function filasCallados_(grupo) {
  return grupo.filas.map(function(item) {
    // El tramo decide el color de la fila: el que lleva siete días no
    // es el mismo caso que el que lleva tres.
    const color = item.tramo >= CONFIG.TRAMOS.length - 1
      ? 'ladrillo'
      : (item.tramo >= 1 ? 'madera' : 'pizarra');

    return '<tr>' +
      celdaProveedor_(item) +
      celdaN_(formatoTs_(item.plan)) +
      celdaN_(formatoTs_(item.ingresado)) +
      celda_(
        esc_(fechaLegible_(item.ultimo)) +
        (item.fuente === 'PLANILLA'
          ? '<div style="font-size:11px;color:' + PALETA.ink3 +
            '">de la planilla</div>'
          : ''),
        'left', false, true
      ) +
      celdaSilencio_(item, color) +
      '</tr>';
  });
}

function filasALaBaja_(grupo, aviso) {
  return grupo.filas.map(function(item) {
    const razones = [];

    if (item.porPlan) {
      razones.push('va en <b>' + porcentaje_(item.cumplimiento) +
        '</b> del ritmo que pide el plan');
    }

    if (item.porSiMismo) {
      razones.push('entrega <b>' + porcentaje_(item.caida) +
        ' menos por día</b> que en ' + esc_(mesesLegibles_(aviso.mesesBase)));
    }

    // El color de la barra dice si ESE eje está bien. KAPPA puede ir
    // al 175% de su plan chico y estar acá por haberse caído contra sí
    // misma: pintarle la barra de alerta diría que va mal con el plan,
    // que no es verdad.
    const color = item.cumplimiento !== null &&
      item.cumplimiento >= CONFIG.BAJA.RITMO_PLAN
      ? 'verde'
      : grupo.color;

    const ritmo =
      '<table cellpadding="0" cellspacing="0" border="0">' +
      '<tr><td style="padding:0 7px 0 0">' +
      barra_(item.cumplimiento, color) +
      '</td><td style="font-family:' + SERIF + ';font-size:13px;color:' +
      PALETA.ink + '">' + porcentaje_(item.cumplimiento) +
      '</td></tr></table>';

    // La razón va BAJO el nombre y no en su propia columna: es texto
    // largo, y una columna de texto largo es la que saca la tabla de
    // la pantalla del teléfono. Además es lo que hay que leer de la
    // fila, así que va pegada al proveedor.
    return '<tr>' +
      celda_(
        '<b>' + esc_(item.proveedor) + '</b>' +
        '<div style="font-size:11px;line-height:1.45;color:' + PALETA.ink2 +
        ';padding-top:3px">' + razones.join('; ') + '</div>'
      ) +
      celdaN_(formatoTs_(item.plan)) +
      celdaN_(formatoTs_(item.ingresado)) +
      celda_(ritmo) +
      '</tr>';
  });
}

/** 'JUL y AGO' a partir de ['2026-07', '2026-08']. */
function mesesLegibles_(meses) {
  const nombres = [
    'ENE', 'FEB', 'MAR', 'ABR', 'MAY', 'JUN',
    'JUL', 'AGO', 'SEP', 'OCT', 'NOV', 'DIC'
  ];

  const cortos = (meses || []).map(function(m) {
    return nombres[Number(String(m).split('-')[1]) - 1] || m;
  });

  if (!cortos.length) { return 'los meses anteriores'; }
  if (cortos.length === 1) { return cortos[0]; }

  return cortos.slice(0, -1).join(', ') + ' y ' + cortos[cortos.length - 1];
}

function avisoHtml_(aviso) {
  const bloques = [];

  bloques.push(cabeceraHtml_(aviso));

  if (aviso.sinPlan) {
    bloques.push(recadoHtml_(
      'La hoja <b>' + esc_(CONFIG.SHEET_PLAN) + '</b> no tiene una ' +
      'columna para este mes, así que no hay contra qué comparar. ' +
      'Mientras no la tenga, este correo no puede decir nada.',
      'madera'
    ));

    return envolverHtml_(bloques.join(''), aviso);
  }

  const total = aviso.grupos.reduce(function(suma, g) {
    return suma + g.cuantos;
  }, 0);

  bloques.push(tarjetasHtml_(aviso));

  if (!total) {
    bloques.push(recadoHtml_(
      'Ningún proveedor del plan está sin entregar, callado ni a la ' +
      'baja. Los <b>' + aviso.proveedores.length + '</b> del plan de ' +
      esc_(aviso.mes) + ' vienen al día.',
      'verde'
    ));

    return envolverHtml_(bloques.join(''), aviso);
  }

  aviso.grupos.forEach(function(grupo) {
    if (!grupo.cuantos) { return; }

    bloques.push(tituloSeccion_(grupo));

    if (grupo.clave === 'sinEntregar') {
      bloques.push(tabla_(
        [
          th_('Proveedor'), th_('Plan del mes', 'right'),
          th_('Último despacho'), th_('Días hábiles', 'right')
        ],
        filasSinEntregar_(grupo)
      ));
      return;
    }

    if (grupo.clave === 'callados') {
      bloques.push(tabla_(
        [
          th_('Proveedor'), th_('Plan del mes', 'right'),
          th_('Entregado', 'right'), th_('Último despacho'),
          th_('Días hábiles', 'right')
        ],
        filasCallados_(grupo)
      ));
      return;
    }

    bloques.push(tabla_(
      [
        th_('Proveedor'), th_('Plan del mes', 'right'),
        th_('Entregado', 'right'), th_('Ritmo vs plan')
      ],
      filasALaBaja_(grupo, aviso)
    ));
  });

  return envolverHtml_(bloques.join(''), aviso);
}

function cabeceraHtml_(aviso) {
  const ritmo = aviso.habiles.total
    ? 'día hábil <b>' + aviso.habiles.transcurridos + '</b> de <b>' +
      aviso.habiles.total + '</b> · a esta altura el plan pide el <b>' +
      porcentaje_(aviso.habiles.parte) + '</b>'
    : '';

  const avance = aviso.planTotal
    ? '<div style="padding-top:12px">' +
      barra_(aviso.ingresadoTotal / aviso.planTotal, 'verde', 240) +
      '</div>' +
      '<div style="font-family:' + SANS + ';font-size:11px;color:' +
      PALETA.ink3 + ';padding-top:4px">' +
      formatoTs_(aviso.ingresadoTotal) + ' de ' +
      formatoTs_(aviso.planTotal) + ' TS del plan (' +
      porcentaje_(aviso.ingresadoTotal / aviso.planTotal) + ')</div>'
    : '';

  return '<tr><td style="padding:24px 24px 18px;border-bottom:1px solid ' +
    PALETA.rule + '">' +
    '<div style="font-family:' + SANS + ';font-size:10px;' +
    'letter-spacing:.14em;text-transform:uppercase;color:' + PALETA.ink3 +
    '">Astilla verde · control diario</div>' +
    '<h1 style="margin:6px 0 0;font-family:' + SERIF + ';font-size:23px;' +
    'font-weight:normal;line-height:1.2;color:' + PALETA.ink + '">' +
    'Proveedores del plan en riesgo</h1>' +
    '<p style="margin:8px 0 0;font-family:' + SANS + ';font-size:12px;' +
    'line-height:1.5;color:' + PALETA.ink2 + '">Plan de <b>' +
    esc_(aviso.mes) + '</b> · ' + ritmo + '</p>' +
    avance +
    '</td></tr>';
}

function tarjetasHtml_(aviso) {
  const celdas = aviso.grupos.map(function(grupo, i) {
    return tarjeta_(grupo, i === aviso.grupos.length - 1);
  });

  return '<tr><td style="padding:18px 24px 0">' +
    '<table cellpadding="0" cellspacing="0" border="0" width="100%" ' +
    'style="border-collapse:collapse;width:100%"><tr>' +
    celdas.join('') + '</tr></table></td></tr>';
}

function recadoHtml_(texto, color) {
  return '<tr><td style="padding:18px 24px 0">' +
    '<table cellpadding="0" cellspacing="0" border="0" width="100%" ' +
    'style="border-collapse:collapse"><tr><td bgcolor="' +
    colorSuaveDe_(color) + '" style="padding:14px 16px;border-left:3px ' +
    'solid ' + colorDe_(color) + ';background:' + colorSuaveDe_(color) +
    ';font-family:' + SANS + ';font-size:13px;line-height:1.5;color:' +
    PALETA.ink + '">' + texto + '</td></tr></table></td></tr>';
}

/**
 * El marco: fondo, tarjeta centrada y pie. El ancho máximo va en el
 * atributo y en el estilo porque Outlook hace caso al atributo y los
 * clientes de teléfono al estilo.
 */
function envolverHtml_(contenido, aviso) {
  const pie =
    '<tr><td style="padding:22px 24px 24px">' +
    '<table cellpadding="0" cellspacing="0" border="0" width="100%" ' +
    'style="border-collapse:collapse"><tr><td style="border-top:1px ' +
    'solid ' + PALETA.rule + ';padding-top:12px;font-family:' + SANS +
    ';font-size:11px;line-height:1.6;color:' + PALETA.ink3 + '">' +
    'Último ingreso cargado en SAP: <b>' +
    esc_(fechaLegible_(aviso.ultimoSap)) + '</b> · último dato de la ' +
    'planilla del reservador: <b>' +
    esc_(fechaLegible_(aviso.ultimaPlanilla)) + '</b>.<br>' +
    'Los días son <b>hábiles</b> y se cuentan desde el último despacho ' +
    'registrado, venga de SAP o de la planilla. «Entregado» toma SAP ' +
    'día por día y la planilla solo donde SAP todavía no cargó, para no ' +
    'contar dos veces el mismo camión.<br>' +
    'Generado desde <a href="' + esc_(aviso.url) + '" style="color:' +
    PALETA.verde + '">' + esc_(aviso.nombre) + '</a> el ' +
    esc_(fechaLegible_(aviso.hoy)) + '.' +
    '</td></tr></table></td></tr>';

  return '<table cellpadding="0" cellspacing="0" border="0" width="100%" ' +
    'bgcolor="' + PALETA.surface + '" style="width:100%;' +
    'border-collapse:collapse;background:' + PALETA.surface + '">' +
    '<tr><td align="center" style="padding:20px 10px">' +
    '<table cellpadding="0" cellspacing="0" border="0" width="680" ' +
    'bgcolor="' + PALETA.paper + '" style="width:100%;max-width:680px;' +
    'border-collapse:collapse;background:' + PALETA.paper + ';border:1px ' +
    'solid ' + PALETA.rule + '">' +
    contenido + pie +
    '</table></td></tr></table>';
}

/**
 * La versión en texto. No es un adorno: hay clientes y relojes que
 * muestran esto, y un correo sin alternativa de texto puntúa peor en
 * los filtros de correo no deseado.
 */
function avisoTexto_(aviso) {
  const lineas = [
    'PROVEEDORES DEL PLAN EN RIESGO',
    'Plan de ' + aviso.mes + ' · día hábil ' +
      aviso.habiles.transcurridos + ' de ' + aviso.habiles.total,
    ''
  ];

  if (aviso.sinPlan) {
    lineas.push(
      'La hoja ' + CONFIG.SHEET_PLAN + ' no tiene columna para este ' +
      'mes: no hay contra qué comparar.'
    );

    return lineas.join('\n');
  }

  const total = aviso.grupos.reduce(function(suma, g) {
    return suma + g.cuantos;
  }, 0);

  if (!total) {
    lineas.push(
      'Ninguno de los ' + aviso.proveedores.length + ' proveedores del ' +
      'plan está sin entregar, callado ni a la baja.'
    );

    return lineas.join('\n');
  }

  aviso.grupos.forEach(function(grupo) {
    if (!grupo.cuantos) { return; }

    lineas.push(grupo.titulo.toUpperCase() + ' (' + grupo.cuantos + ')');

    grupo.filas.forEach(function(item) {
      const cola = grupo.clave === 'aLaBaja'
        ? porcentaje_(item.cumplimiento) + ' del ritmo del plan'
        : (item.dias === null
            ? 'sin ingresos'
            : item.dias + ' días hábiles sin despachar');

      lineas.push('- ' + item.proveedor + ': plan ' +
        formatoTs_(item.plan) + ' TS, entregado ' +
        formatoTs_(item.ingresado) + ' TS, ' + cola);
    });

    lineas.push('');
  });

  lineas.push('Planilla: ' + aviso.url);

  return lineas.join('\n');
}

/* --- Envío ----------------------------------------------------------- */

/** Entrada del disparador diario. */
function enviarAvisoSilencio() {
  return enviar_(false);
}

/** Envío manual desde el editor: no espera a que sea día hábil. */
function enviarAhora() {
  const r = enviar_(true);

  Logger.log(JSON.stringify(r, null, 2));

  return r;
}

function enviar_(forzar) {
  const hoy = hoyClave_();

  if (!forzar && CONFIG.SOLO_HABILES && !esDiaHabil_(hoy)) {
    const salto = {
      enviado: false,
      motivo: 'Hoy no es día hábil: el conteo es el mismo del último ' +
        'día hábil y el correo saldría repetido.'
    };

    Logger.log(salto.motivo);

    return salto;
  }

  const aviso = construirAviso_();

  const total = aviso.grupos.reduce(function(suma, grupo) {
    return suma + grupo.cuantos;
  }, 0);

  // El asunto dice de una vez cuántos y de qué tipo: se lee desde la
  // lista de correo sin abrir nada.
  const detalle = aviso.grupos.filter(function(g) {
    return g.cuantos;
  }).map(function(g) {
    return g.cuantos + ' ' + g.rotulo.toLowerCase();
  }).join(' · ');

  const asunto = CONFIG.ASUNTO + ' · ' + fechaLegible_(hoy) +
    (total ? ' · ' + detalle : ' · ninguno');

  MailApp.sendEmail({
    to: CONFIG.PARA.join(','),
    subject: asunto,
    body: avisoTexto_(aviso),
    htmlBody: avisoHtml_(aviso),
    name: 'Control de astilla verde'
  });

  return {
    enviado: true,
    para: CONFIG.PARA.slice(),
    asunto: asunto,
    total: total,
    grupos: aviso.grupos.map(function(g) {
      return g.titulo + ': ' + g.cuantos;
    })
  };
}

/* --- Disparador ------------------------------------------------------ */

function instalarAvisoDiario() {
  eliminarAvisoDiario();

  ScriptApp
    .newTrigger('enviarAvisoSilencio')
    .timeBased()
    .everyDays(1)
    .atHour(CONFIG.HORA)
    .nearMinute(CONFIG.MINUTO)
    .inTimezone(CONFIG.TIMEZONE)
    .create();

  const mensaje = 'Aviso diario instalado. Sale cada día hábil a las ' +
    CONFIG.HORA + ':' + (CONFIG.MINUTO < 10 ? '0' : '') + CONFIG.MINUTO +
    ' (±15 min, que es lo más exacto que ofrece Apps Script) a: ' +
    CONFIG.PARA.join(', ');

  Logger.log(mensaje);

  return mensaje;
}

function eliminarAvisoDiario() {
  let removidos = 0;

  ScriptApp.getProjectTriggers().forEach(function(trigger) {
    if (trigger.getHandlerFunction() === 'enviarAvisoSilencio') {
      ScriptApp.deleteTrigger(trigger);
      removidos++;
    }
  });

  Logger.log('Disparadores eliminados: ' + removidos);

  return removidos;
}

/**
 * Comprueba que el script ve la planilla y cruza los nombres, sin
 * mandar nada. Es lo primero que conviene ejecutar al instalarlo.
 */
function probarSinEnviar() {
  const aviso = construirAviso_();

  const resumen = {
    planilla: aviso.nombre,
    mesDelPlan: aviso.mes,
    diasHabiles: aviso.habiles.transcurridos + ' de ' + aviso.habiles.total,
    proveedoresEnElPlan: aviso.proveedores.length,
    planTotal: Math.round(aviso.planTotal),
    ingresadoTotal: Math.round(aviso.ingresadoTotal),
    ultimoIngresoSap: fechaLegible_(aviso.ultimoSap),
    ultimoDatoPlanilla: fechaLegible_(aviso.ultimaPlanilla),
    // Los que no cruzan con ningún ingreso: o nunca despacharon, o su
    // nombre no está homologado y el correo los acusa de callados.
    sinCruzar: aviso.proveedores.filter(function(p) {
      return p.dias === null;
    }).map(function(p) { return p.proveedor; }),
    grupos: aviso.grupos.map(function(g) {
      return g.titulo + ': ' + (g.filas.map(function(f) {
        return f.proveedor + ' (' +
          (g.clave === 'aLaBaja'
            ? porcentaje_(f.cumplimiento)
            : (f.dias === null ? 'sin ingresos' : f.dias + ' d')) + ')';
      }).join(', ') || 'ninguno');
    })
  };

  Logger.log(JSON.stringify(resumen, null, 2));

  return resumen;
}
