/**
 * ASTILLA PROCESO · ALERTAS POR CORREO
 *
 * Archivo aparte a propósito: el panel no depende de esto. Si se
 * borra Alertas.gs del proyecto, el dashboard sigue funcionando igual
 * y el menú sale sin sus ítems —Codigo.gs lo agrega solo si existe—.
 *
 * Quién lo ejecuta: NADIE tiene que abrir la web. El disparador
 * horario de Apps Script corre con la autorización de quien lo
 * instaló desde el menú, aunque no haya nadie conectado, y el correo
 * sale desde esa cuenta. El "executeAs" del webapp es otra cosa: rige
 * para quien abre el dashboard, no para esto.
 */

// Aviso diario de proveedores del plan que dejaron de despachar.
//
// Los tramos son excluyentes a propósito: un proveedor aparece en
// una sola tabla, la de su antigüedad. Si fueran acumulativos, el
// que lleva ocho días saldría en las tres y el correo diría tres
// veces lo mismo.
//
// Se cuenta en días HÁBILES, no corridos: con días corridos, un
// proveedor que despachó el viernes aparecería todos los lunes con
// tres días de silencio sin que haya pasado nada.
const ALERTAS = Object.freeze({
  PARA: Object.freeze([
    'francisco.correa@masisa.com',
    'jaime.rojas@masisa.com'
  ]),
  ASUNTO: 'Astilla verde · proveedores sin despachar',
  TRAMOS: Object.freeze([
    Object.freeze({ desde: 3, hasta: 4 }),
    Object.freeze({ desde: 5, hasta: 6 }),
    Object.freeze({ desde: 7, hasta: 0 })
  ]),
  // Hora local del envío. El disparador diario de Apps Script corre
  // dentro de la franja de una hora que empieza acá.
  HORA: 7,
  // Sábado y domingo el número no cambia —no son días hábiles— y el
  // correo saldría idéntico al del viernes. Se salta.
  SOLO_HABILES: true
});

/* =====================================================================
 * AVISO DIARIO · PROVEEDORES DEL PLAN QUE DEJARON DE DESPACHAR
 *
 * Un proveedor con plan del mes y sin ingresos hace días es una
 * conversación pendiente, y hoy eso solo se ve si alguien abre el
 * panel. Esto lo manda por correo cada mañana.
 *
 * Se arma sobre getDashboardData() a propósito, en vez de volver a
 * leer las hojas: así el correo y el panel no pueden decir cosas
 * distintas el mismo día.
 * ===================================================================== */

/**
 * Los proveedores del Plan, con su último despacho y cuántos días
 * hábiles llevan sin uno.
 *
 * La unidad es el proveedor, no la fila del Plan: "no está
 * despachando" es algo que se resuelve con una llamada, y la llamada
 * es una sola aunque tenga tres subproductos comprometidos.
 */
function construirAvisoSilencio_(data) {
  const detalles = data.planDetails || [];

  if (!detalles.length) {
    return { tramos: [], proveedores: [], sinPlan: true };
  }

  const porProveedor = {};

  detalles.forEach(function(detalle) {
    const clave = detalle.proveedorPlanKey;

    if (!clave) { return; }

    if (!porProveedor[clave]) {
      porProveedor[clave] = {
        clave: clave,
        proveedor: detalle.proveedorPlan,
        subproductos: {},
        plan: 0,
        ingresado: 0,
        ultimo: '',
        fuenteUltimo: ''
      };
    }

    const item = porProveedor[clave];

    item.subproductos[detalle.subproducto] = true;
    item.plan += Number(detalle.plan) || 0;
  });

  // Las filas del Plan traen el nombre del Plan; las de ingreso, el de
  // Ingresos. El puente es planKey cuando el precio cruzó, y el nombre
  // comparable cuando no: una fila sin precio igual es un despacho.
  const claveDeDetalle = {};

  detalles.forEach(function(detalle) {
    claveDeDetalle[detalle.planKey] = detalle.proveedorPlanKey;
  });

  (data.rows || []).forEach(function(row) {
    const ts = Number(row.ts) || 0;

    if (ts <= 0) { return; }

    const clave =
      (row.planKey && claveDeDetalle[row.planKey]) ||
      priceProviderComparable_(row.proveedor);

    const item = porProveedor[clave];

    if (!item) { return; }

    if (row.fecha >= data.month.startKey) {
      item.ingresado += ts;
    }

    if (!item.ultimo || row.fecha > item.ultimo) {
      item.ultimo = row.fecha;
      item.fuenteUltimo = row.source;
    }
  });

  const hoy = (data.workdays || {}).todayKey || '';
  const habiles = ((data.workdays || {}).workdayKeys || []).filter(
    function(key) { return key <= hoy; }
  );

  const proveedores = Object.keys(porProveedor).map(function(clave) {
    const item = porProveedor[clave];

    item.subproductosLista = Object.keys(item.subproductos).sort();

    // Días hábiles transcurridos DESPUÉS del último despacho. Si
    // despachó hoy, son cero; si nunca despachó, no es un número:
    // es otra categoría, y se trata aparte.
    item.dias = item.ultimo
      ? habiles.filter(function(key) { return key > item.ultimo; }).length
      : null;

    return item;
  });

  const tramos = ALERTAS.TRAMOS.map(function(tramo) {
    const filas = proveedores.filter(function(item) {
      // Sin ingresos en toda la ventana: entra al tramo más alto, que
      // es donde corresponde, no en el de tres días.
      if (item.dias === null) {
        return !tramo.hasta;
      }

      if (item.dias < tramo.desde) { return false; }

      return !tramo.hasta || item.dias <= tramo.hasta;
    }).sort(function(a, b) {
      if (a.dias === null) { return -1; }
      if (b.dias === null) { return 1; }
      if (b.dias !== a.dias) { return b.dias - a.dias; }

      return (b.plan || 0) - (a.plan || 0);
    });

    return {
      desde: tramo.desde,
      hasta: tramo.hasta,
      titulo: tramo.hasta
        ? tramo.desde + ' a ' + tramo.hasta + ' días hábiles sin despachar'
        : tramo.desde + ' días hábiles o más sin despachar',
      filas: filas,
      plan: filas.reduce(function(total, item) {
        return total + (Number(item.plan) || 0);
      }, 0)
    };
  });

  return { tramos: tramos, proveedores: proveedores, sinPlan: false };
}

/** Una celda de la tabla del correo. */
function celdaCorreo_(contenido, alineado, tenue) {
  return '<td style="padding:7px 10px;border-bottom:1px solid #E6E3DC;' +
    'font-size:13px;text-align:' + (alineado || 'left') + ';' +
    'color:' + (tenue ? '#6B6A66' : '#22201C') + '">' +
    contenido + '</td>';
}

/**
 * El cuerpo del correo. Todo en tablas y con estilos en línea, porque
 * Outlook descarta hojas de estilo y casi todo lo que no sea tabla.
 */
function avisoSilencioHtml_(aviso, data) {
  const fuente = data.source || {};

  const cabecera =
    '<div style="font-family:Arial,Helvetica,sans-serif;max-width:860px">' +
    '<h2 style="margin:0 0 4px;font-size:19px;color:#1E4634">' +
    'Proveedores del plan sin despachar</h2>' +
    '<p style="margin:0 0 18px;font-size:13px;color:#6B6A66">' +
    esc_(data.month.label) + ' · datos reales hasta <b>' +
    esc_(fuente.lastActualDateLabel || '—') + '</b>, planilla al <b>' +
    esc_(fuente.latestReportDateLabel || '—') + '</b>. ' +
    'Los días son hábiles y se cuentan desde el último despacho ' +
    'registrado, sea de Ingresos o de la planilla.</p>';

  if (aviso.sinPlan) {
    return cabecera +
      '<p style="font-size:13px">La hoja <b>' + CONFIG.SHEET_PLAN +
      '</b> no tiene filas para este mes, así que no hay contra qué ' +
      'comparar.</p></div>';
  }

  const conFilas = aviso.tramos.filter(function(tramo) {
    return tramo.filas.length;
  });

  if (!conFilas.length) {
    return cabecera +
      '<p style="font-size:14px;padding:14px;background:#EAF2ED;' +
      'border-left:3px solid #1E4634">Ningún proveedor del plan lleva ' +
      ALERTAS.TRAMOS[0].desde + ' días hábiles o más sin despachar.' +
      '</p></div>';
  }

  const bloques = aviso.tramos.map(function(tramo) {
    const color = !tramo.hasta ? '#9C3B2E'
      : tramo.desde >= 5 ? '#C9903F' : '#6B6A66';

    if (!tramo.filas.length) {
      return '<h3 style="margin:22px 0 6px;font-size:15px;color:' + color +
        '">' + esc_(tramo.titulo) + '</h3>' +
        '<p style="margin:0;font-size:13px;color:#6B6A66">' +
        'Ninguno.</p>';
    }

    const filas = tramo.filas.map(function(item) {
      return '<tr>' +
        celdaCorreo_('<b>' + esc_(item.proveedor) + '</b>') +
        celdaCorreo_(esc_(item.subproductosLista.join(' · ')), 'left', true) +
        celdaCorreo_(formatoTs_(item.plan), 'right') +
        celdaCorreo_(formatoTs_(item.ingresado), 'right') +
        celdaCorreo_(
          item.ultimo
            ? formatDateKey_(item.ultimo) +
              (item.fuenteUltimo === 'PLANILLA' ? ' (planilla)' : '')
            : '—',
          'left',
          !item.ultimo
        ) +
        celdaCorreo_(
          '<b style="color:' + color + '">' +
          (item.dias === null ? 'sin ingresos' : item.dias) + '</b>',
          'right'
        ) +
        '</tr>';
    }).join('');

    const th = function(texto, alineado) {
      return '<th style="padding:7px 10px;border-bottom:2px solid #D8D4CB;' +
        'font-size:11px;letter-spacing:.04em;text-transform:uppercase;' +
        'color:#6B6A66;text-align:' + (alineado || 'left') + '">' +
        texto + '</th>';
    };

    return '<h3 style="margin:22px 0 6px;font-size:15px;color:' + color +
      '">' + esc_(tramo.titulo) + ' · ' + tramo.filas.length +
      (tramo.filas.length === 1 ? ' proveedor' : ' proveedores') +
      (tramo.plan > 0 ? ' · ' + formatoTs_(tramo.plan) + ' TS de plan' : '') +
      '</h3>' +
      '<table cellpadding="0" cellspacing="0" border="0" ' +
      'style="border-collapse:collapse;width:100%">' +
      '<tr>' + th('Proveedor') + th('Subproducto del plan') +
      th('Plan del mes (TS)', 'right') +
      th('Ingresado en el mes (TS)', 'right') +
      th('Último despacho') + th('Días', 'right') + '</tr>' +
      filas + '</table>';
  }).join('');

  return cabecera + bloques +
    '<p style="margin:24px 0 0;font-size:12px;color:#6B6A66;' +
    'border-top:1px solid #E6E3DC;padding-top:10px">' +
    'Generado desde <a href="' + esc_(fuente.spreadsheetUrl || '') +
    '" style="color:#1E4634">' + esc_(fuente.spreadsheetName || 'la planilla') +
    '</a>. «Ingresado en el mes» incluye lo estimado desde la planilla.' +
    '</p></div>';
}

/**
 * Miles con punto, a mano. toLocaleString('es-CL') en Apps Script
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

function esc_(valor) {
  return String(valor === null || valor === undefined ? '' : valor)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * Entrada del disparador diario y del menú.
 *
 * Devuelve un resumen en vez de no devolver nada, para que el menú
 * pueda decir qué se mandó sin volver a calcularlo.
 */
function enviarAvisoSilencio(forzar) {
  const data = getDashboardData();
  const hoy = (data.workdays || {}).todayKey || '';

  if (
    !forzar &&
    ALERTAS.SOLO_HABILES &&
    hoy &&
    (data.workdays.workdayKeys || []).indexOf(hoy) === -1
  ) {
    return {
      enviado: false,
      motivo: 'Hoy no es día hábil: el conteo es el mismo del último ' +
        'día hábil y el correo saldría repetido.'
    };
  }

  const aviso = construirAvisoSilencio_(data);

  const total = aviso.tramos.reduce(function(suma, tramo) {
    return suma + tramo.filas.length;
  }, 0);

  const asunto = ALERTAS.ASUNTO + ' · ' + formatDateKey_(hoy) +
    (total ? ' · ' + total : ' · ninguno');

  MailApp.sendEmail({
    to: ALERTAS.PARA.join(','),
    subject: asunto,
    htmlBody: avisoSilencioHtml_(aviso, data),
    name: 'Control de astilla verde'
  });

  return {
    enviado: true,
    para: ALERTAS.PARA.slice(),
    asunto: asunto,
    total: total,
    tramos: aviso.tramos.map(function(tramo) {
      return tramo.titulo + ': ' + tramo.filas.length;
    })
  };
}

/** Envío manual desde el menú, salta el filtro de día hábil. */
function enviarAvisoSilencioAhora() {
  const ui = SpreadsheetApp.getUi();

  try {
    const r = enviarAvisoSilencio(true);

    ui.alert(
      'Aviso enviado a:\n' + r.para.join('\n') + '\n\n' +
      r.tramos.join('\n')
    );
  } catch (error) {
    ui.alert('No se pudo enviar: ' + error.message);
  }
}

function instalarAvisoDiario() {
  eliminarAvisoDiario();

  ScriptApp
    .newTrigger('enviarAvisoSilencio')
    .timeBased()
    .everyDays(1)
    .atHour(ALERTAS.HORA)
    .inTimezone(CONFIG.TIMEZONE)
    .create();

  SpreadsheetApp.getUi().alert(
    'Aviso diario instalado. Sale cada día hábil alrededor de las ' +
    ALERTAS.HORA + ':00 a:\n' +
    ALERTAS.PARA.join('\n')
  );
}

function eliminarAvisoDiario() {
  let removed = 0;

  ScriptApp.getProjectTriggers().forEach(function(trigger) {
    if (trigger.getHandlerFunction() === 'enviarAvisoSilencio') {
      ScriptApp.deleteTrigger(trigger);
      removed++;
    }
  });

  return removed;
}

/**
 * Los ítems de menú de este archivo. Codigo.gs la llama si existe, así
 * que agregar o quitar alertas no obliga a tocar el otro archivo.
 */
function menuAlertas_(menu) {
  menu
    .addSeparator()
    .addItem('Enviar aviso de sin despachar (ahora)',
             'enviarAvisoSilencioAhora')
    .addItem('Instalar aviso diario', 'instalarAvisoDiario')
    .addItem('Eliminar aviso diario', 'eliminarAvisoDiario');
}
