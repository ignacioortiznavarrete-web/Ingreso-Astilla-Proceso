/**
 * ASTILLA PROCESO · ALERTAS · EL AVISO DIARIO
 *
 * Proveedores con plan del mes que llevan días sin un ingreso, en
 * tres tablas por antigüedad.
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

function construirAviso_() {
  const planilla = abrirPlanilla_();
  const alias = leerAlias_(planilla);
  const plan = leerPlanDelMes_(planilla, alias);
  const despachos = leerUltimosDespachos_(planilla, alias);
  const hoy = hoyClave_();

  const proveedores = Object.keys(plan.porProveedor).map(function(clave) {
    const item = plan.porProveedor[clave];
    const visto = despachos[clave] || { ultimo: '', fuente: '', mes: 0 };

    return {
      proveedor: item.proveedor,
      subproductos: Object.keys(item.subproductos).sort(),
      plan: item.plan,
      ingresado: visto.mes,
      ultimo: visto.ultimo,
      fuente: visto.fuente,
      // Nunca despachó en la ventana: no es un número de días, es
      // otra categoría, y se trata aparte.
      dias: visto.ultimo ? diasHabilesDesde_(visto.ultimo, hoy) : null
    };
  });

  const tramos = CONFIG.TRAMOS.map(function(tramo) {
    const filas = proveedores.filter(function(item) {
      if (item.dias === null) { return !tramo.hasta; }
      if (item.dias < tramo.desde) { return false; }

      return !tramo.hasta || item.dias <= tramo.hasta;
    }).sort(function(a, b) {
      if (a.dias === null) { return -1; }
      if (b.dias === null) { return 1; }
      if (b.dias !== a.dias) { return b.dias - a.dias; }

      return (b.plan || 0) - (a.plan || 0);
    });

    return {
      titulo: tramo.hasta
        ? tramo.desde + ' a ' + tramo.hasta + ' días hábiles sin despachar'
        : tramo.desde + ' días hábiles o más sin despachar',
      esAlto: !tramo.hasta,
      esMedio: !!tramo.hasta && tramo.desde >= 5,
      filas: filas,
      plan: filas.reduce(function(t, x) { return t + (x.plan || 0); }, 0)
    };
  });

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
    tramos: tramos,
    proveedores: proveedores,
    sinPlan: !Object.keys(plan.porProveedor).length,
    mes: plan.etiqueta || mesActual_(),
    ultimoSap: ultimoSap,
    ultimaPlanilla: ultimaPlanilla,
    hoy: hoy,
    url: planilla.getUrl(),
    nombre: planilla.getName()
  };
}

/* --- Correo ---------------------------------------------------------- */

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

function celda_(contenido, alineado, tenue) {
  return '<td style="padding:7px 10px;border-bottom:1px solid #E6E3DC;' +
    'font-size:13px;text-align:' + (alineado || 'left') + ';' +
    'color:' + (tenue ? '#6B6A66' : '#22201C') + '">' +
    contenido + '</td>';
}

function th_(texto, alineado) {
  return '<th style="padding:7px 10px;border-bottom:2px solid #D8D4CB;' +
    'font-size:11px;letter-spacing:.04em;text-transform:uppercase;' +
    'color:#6B6A66;text-align:' + (alineado || 'left') + '">' +
    texto + '</th>';
}

/**
 * Todo en tablas y con estilos en línea: Outlook descarta las hojas
 * de estilo y casi todo lo que no sea tabla.
 */
function avisoHtml_(aviso) {
  const cabecera =
    '<div style="font-family:Arial,Helvetica,sans-serif;max-width:860px">' +
    '<h2 style="margin:0 0 4px;font-size:19px;color:#1E4634">' +
    'Proveedores del plan sin despachar</h2>' +
    '<p style="margin:0 0 18px;font-size:13px;color:#6B6A66">' +
    'Plan de <b>' + esc_(aviso.mes) + '</b> · último ingreso en SAP el <b>' +
    esc_(fechaLegible_(aviso.ultimoSap)) + '</b>, último dato de ' +
    'planilla el <b>' + esc_(fechaLegible_(aviso.ultimaPlanilla)) +
    '</b>. Los días son hábiles y se cuentan desde el último despacho ' +
    'registrado, sea de Ingresos o de la planilla.</p>';

  const pie =
    '<p style="margin:24px 0 0;font-size:12px;color:#6B6A66;' +
    'border-top:1px solid #E6E3DC;padding-top:10px">' +
    'Generado desde <a href="' + esc_(aviso.url) +
    '" style="color:#1E4634">' + esc_(aviso.nombre) + '</a>. ' +
    '«Ingresado en el mes» incluye lo estimado desde la planilla.' +
    '</p></div>';

  if (aviso.sinPlan) {
    return cabecera +
      '<p style="font-size:13px">La hoja <b>' + CONFIG.SHEET_PLAN +
      '</b> no tiene una columna para este mes, así que no hay contra ' +
      'qué comparar.</p>' + pie;
  }

  const conFilas = aviso.tramos.filter(function(t) { return t.filas.length; });

  if (!conFilas.length) {
    return cabecera +
      '<p style="font-size:14px;padding:14px;background:#EAF2ED;' +
      'border-left:3px solid #1E4634">Ningún proveedor del plan lleva ' +
      CONFIG.TRAMOS[0].desde + ' días hábiles o más sin despachar.</p>' +
      pie;
  }

  const bloques = aviso.tramos.map(function(tramo) {
    const color = tramo.esAlto ? '#9C3B2E'
      : tramo.esMedio ? '#C9903F' : '#6B6A66';

    const titulo = '<h3 style="margin:22px 0 6px;font-size:15px;color:' +
      color + '">' + esc_(tramo.titulo);

    if (!tramo.filas.length) {
      return titulo + '</h3><p style="margin:0;font-size:13px;' +
        'color:#6B6A66">Ninguno.</p>';
    }

    const filas = tramo.filas.map(function(item) {
      return '<tr>' +
        celda_('<b>' + esc_(item.proveedor) + '</b>') +
        celda_(esc_(item.subproductos.join(' · ')), 'left', true) +
        celda_(formatoTs_(item.plan), 'right') +
        celda_(formatoTs_(item.ingresado), 'right') +
        celda_(
          item.ultimo
            ? esc_(fechaLegible_(item.ultimo)) +
              (item.fuente === 'PLANILLA' ? ' (planilla)' : '')
            : '—',
          'left',
          !item.ultimo
        ) +
        celda_(
          '<b style="color:' + color + '">' +
          (item.dias === null ? 'sin ingresos' : item.dias) + '</b>',
          'right'
        ) +
        '</tr>';
    }).join('');

    return titulo + ' · ' + tramo.filas.length +
      (tramo.filas.length === 1 ? ' proveedor' : ' proveedores') +
      (tramo.plan > 0 ? ' · ' + formatoTs_(tramo.plan) + ' TS de plan' : '') +
      '</h3>' +
      '<table cellpadding="0" cellspacing="0" border="0" ' +
      'style="border-collapse:collapse;width:100%">' +
      '<tr>' + th_('Proveedor') + th_('Subproducto del plan') +
      th_('Plan del mes (TS)', 'right') +
      th_('Ingresado en el mes (TS)', 'right') +
      th_('Último despacho') + th_('Días', 'right') + '</tr>' +
      filas + '</table>';
  }).join('');

  return cabecera + bloques + pie;
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

  const total = aviso.tramos.reduce(function(suma, tramo) {
    return suma + tramo.filas.length;
  }, 0);

  const asunto = CONFIG.ASUNTO + ' · ' + fechaLegible_(hoy) +
    (total ? ' · ' + total : ' · ninguno');

  MailApp.sendEmail({
    to: CONFIG.PARA.join(','),
    subject: asunto,
    htmlBody: avisoHtml_(aviso),
    name: 'Control de astilla verde'
  });

  return {
    enviado: true,
    para: CONFIG.PARA.slice(),
    asunto: asunto,
    total: total,
    tramos: aviso.tramos.map(function(t) {
      return t.titulo + ': ' + t.filas.length;
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
    .inTimezone(CONFIG.TIMEZONE)
    .create();

  const mensaje = 'Aviso diario instalado. Sale cada día hábil ' +
    'alrededor de las ' + CONFIG.HORA + ':00 a: ' + CONFIG.PARA.join(', ');

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
    proveedoresEnElPlan: aviso.proveedores.length,
    ultimoIngresoSap: fechaLegible_(aviso.ultimoSap),
    ultimoDatoPlanilla: fechaLegible_(aviso.ultimaPlanilla),
    sinCruzar: aviso.proveedores.filter(function(p) {
      return p.dias === null;
    }).map(function(p) { return p.proveedor; }),
    tramos: aviso.tramos.map(function(t) {
      return t.titulo + ': ' + t.filas.map(function(f) {
        return f.proveedor + ' (' +
          (f.dias === null ? 'sin ingresos' : f.dias) + ')';
      }).join(', ');
    })
  };

  Logger.log(JSON.stringify(resumen, null, 2));

  return resumen;
}
