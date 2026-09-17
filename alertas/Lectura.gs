/**
 * ASTILLA PROCESO · ALERTAS · LECTURA DE LA PLANILLA
 *
 * Todo lo que este script necesita saber de las hojas, y nada más.
 */

/* --- Ayudas de texto y fecha ---------------------------------------- */

function text_(value) {
  return String(value === null || value === undefined ? '' : value)
    .trim()
    .replace(/\s+/g, ' ');
}

function normalizeHeader_(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[._-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeKey_(value) {
  return String(value || '')
    .trim()
    .toUpperCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^\w\s/-]/g, ' ')
    .replace(/_/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Nombre de proveedor reducido a lo que permite compararlo entre
 * hojas: "PROMASA S.A." y "PROMASA SA" tienen que dar lo mismo.
 * Copiado del dashboard a propósito —es una función pura y estable—
 * para no depender de él.
 */
function comparable_(value) {
  const legales = {
    SA: true, SPA: true, LTDA: true, LIMITADA: true, EIRL: true,
    S: true, A: true, E: true, I: true, R: true, L: true,
    SOC: true, SOCIEDAD: true
  };

  return normalizeKey_(value)
    .replace(/\bBIOBIO\b/g, 'BIO BIO')
    .replace(/\bASERRADEROS\b/g, 'ASERRADERO')
    .replace(/\bFOR\b/g, 'FORESTAL')
    .replace(/\bIND\b/g, 'INDUSTRIA')
    .replace(/\bINDUST\b/g, 'INDUSTRIA')
    .replace(/\bINMOB\b/g, 'INMOBILIARIA')
    .replace(/\bSERV\b/g, 'SERVICIOS')
    .split(' ')
    .filter(function(token) { return token && !legales[token]; })
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** 'yyyy-MM-dd' desde una celda que puede venir Date o texto. */
function fechaClave_(crudo, mostrado) {
  if (crudo instanceof Date && !isNaN(crudo.getTime())) {
    return Utilities.formatDate(crudo, CONFIG.TIMEZONE, 'yyyy-MM-dd');
  }

  const texto = text_(mostrado !== undefined ? mostrado : crudo);

  let m = texto.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);

  if (m) {
    return m[1] + '-' + pad2_(m[2]) + '-' + pad2_(m[3]);
  }

  // dd/mm/yyyy y dd-mm-yyyy, que es como lo muestra la hoja.
  m = texto.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})$/);

  if (!m) { return ''; }

  const anio = m[3].length === 2 ? '20' + m[3] : m[3];

  return anio + '-' + pad2_(m[2]) + '-' + pad2_(m[1]);
}

function pad2_(v) {
  return String(v).length === 1 ? '0' + v : String(v);
}

function hoyClave_() {
  return Utilities.formatDate(new Date(), CONFIG.TIMEZONE, 'yyyy-MM-dd');
}

/** 'dd-MM-yyyy', que es como se lee un correo. */
function fechaLegible_(clave) {
  const p = String(clave || '').split('-');

  return p.length === 3 ? p[2] + '-' + p[1] + '-' + p[0] : (clave || '—');
}

function mapaEncabezados_(fila) {
  const mapa = {};

  fila.forEach(function(valor, i) { mapa[normalizeHeader_(valor)] = i; });

  return mapa;
}

/** El mes en curso, como 'yyyy-MM'. */
function mesActual_() {
  return Utilities.formatDate(new Date(), CONFIG.TIMEZONE, 'yyyy-MM');
}

/** Primer día del mes que está MESES_ATRAS antes del actual. */
function desdeClave_() {
  const hoy = hoyClave_().split('-');
  const d = new Date(Date.UTC(Number(hoy[0]), Number(hoy[1]) - 1, 1));

  d.setUTCMonth(d.getUTCMonth() - CONFIG.MESES_ATRAS);

  return d.getUTCFullYear() + '-' + pad2_(d.getUTCMonth() + 1) + '-01';
}

/**
 * Días hábiles transcurridos DESPUÉS de una fecha y hasta hoy. Si
 * despachó hoy son cero; si despachó el viernes, el lunes es uno.
 *
 * Es la razón de contar en hábiles y no corridos: con días corridos,
 * quien despachó el viernes aparecería todos los lunes con tres días
 * de silencio sin que hubiera pasado nada.
 */
function diasHabilesDesde_(desde, hasta) {
  if (!desde || desde >= hasta) { return 0; }

  const feriados = {};

  CONFIG.FERIADOS.forEach(function(k) { feriados[k] = true; });

  const p = desde.split('-');
  const cursor = new Date(
    Date.UTC(Number(p[0]), Number(p[1]) - 1, Number(p[2]))
  );

  let habiles = 0;

  // Se avanza un día y se cuenta, para no incluir el día del despacho.
  for (let i = 0; i < 400; i++) {
    cursor.setUTCDate(cursor.getUTCDate() + 1);

    const clave = cursor.getUTCFullYear() + '-' +
      pad2_(cursor.getUTCMonth() + 1) + '-' + pad2_(cursor.getUTCDate());

    if (clave > hasta) { break; }

    if (
      CONFIG.WORKDAYS.indexOf(cursor.getUTCDay()) !== -1 &&
      !feriados[clave]
    ) {
      habiles++;
    }
  }

  return habiles;
}

function esDiaHabil_(clave) {
  if (CONFIG.FERIADOS.indexOf(clave) !== -1) { return false; }

  const p = String(clave).split('-');
  const d = new Date(
    Date.UTC(Number(p[0]), Number(p[1]) - 1, Number(p[2]))
  );

  return CONFIG.WORKDAYS.indexOf(d.getUTCDay()) !== -1;
}

/* --- Hojas ----------------------------------------------------------- */

function abrirPlanilla_() {
  return SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
}

/**
 * Alias de proveedor → nombre canónico de SAP, desde la hoja
 * Proveedores. Es una tabla escrita a mano y manda sobre cualquier
 * parecido automático.
 */
function leerAlias_(planilla) {
  const hoja = planilla.getSheetByName(CONFIG.SHEET_PROVEEDORES);
  const porAlias = {};

  if (!hoja || hoja.getLastRow() < 2) { return porAlias; }

  const valores = hoja.getDataRange().getValues();
  const mapa = mapaEncabezados_(valores[0]);
  const cSap = mapa[normalizeHeader_('Proveedor SAP')];
  const cAlias = mapa[normalizeHeader_('Alias')];

  if (cSap === undefined || cAlias === undefined) { return porAlias; }

  // La columna SAP se arrastra hacia abajo: una fila con alias y sin
  // SAP pertenece al último SAP escrito.
  let arrastre = '';

  for (let i = 1; i < valores.length; i++) {
    const sap = text_(valores[i][cSap]);
    const alias = text_(valores[i][cAlias]);

    if (sap) { arrastre = sap; }

    if (arrastre && alias) {
      porAlias[comparable_(alias)] = arrastre;
    }
  }

  return porAlias;
}

/**
 * El plan del mes en curso, sumado por proveedor.
 *
 * La hoja Plan tiene una columna por mes; se busca la del mes actual
 * igual que en el dashboard: por encabezado, aceptando Date, 'yyyy-MM'
 * y 'SEP-2026'.
 */
function leerPlanDelMes_(planilla, alias) {
  const hoja = planilla.getSheetByName(CONFIG.SHEET_PLAN);
  const vacio = { porProveedor: {}, columna: -1, etiqueta: '' };

  if (!hoja || hoja.getLastRow() < 2) { return vacio; }

  const rango = hoja.getDataRange();
  const valores = rango.getValues();
  const mostrados = rango.getDisplayValues();

  let filaEnc = -1;
  let cSuministro = -1;
  let cProveedor = -1;

  for (let i = 0; i < Math.min(valores.length, 20); i++) {
    const mapa = mapaEncabezados_(valores[i]);

    if (
      mapa['suministro'] !== undefined &&
      mapa['proveedor'] !== undefined
    ) {
      filaEnc = i;
      cSuministro = mapa['suministro'];
      cProveedor = mapa['proveedor'];
      break;
    }
  }

  if (filaEnc === -1) { return vacio; }

  const mes = mesActual_();
  const enc = valores[filaEnc];
  const encMostrado = mostrados[filaEnc] || [];

  let cMes = -1;
  let etiqueta = '';

  for (let c = 0; c < enc.length; c++) {
    let prefijo = '';

    if (enc[c] instanceof Date) {
      prefijo = Utilities.formatDate(enc[c], CONFIG.TIMEZONE, 'yyyy-MM');
    }

    if (!prefijo) {
      prefijo = prefijoDeEncabezado_(encMostrado[c] || enc[c]);
    }

    if (prefijo === mes) {
      cMes = c;
      etiqueta = text_(encMostrado[c] || enc[c]);
      break;
    }
  }

  if (cMes === -1) { return vacio; }

  const porProveedor = {};
  let suministro = '';

  for (let i = filaEnc + 1; i < valores.length; i++) {
    const celdaSuministro = text_(
      mostrados[i][cSuministro] !== ''
        ? mostrados[i][cSuministro]
        : valores[i][cSuministro]
    );

    // "Suministro" se arrastra hacia abajo dentro del grupo.
    if (celdaSuministro) { suministro = celdaSuministro; }

    const proveedor = text_(
      mostrados[i][cProveedor] !== ''
        ? mostrados[i][cProveedor]
        : valores[i][cProveedor]
    );

    if (!proveedor || /^TOTAL\b/.test(normalizeKey_(proveedor))) {
      continue;
    }

    const ts = aNumero_(
      mostrados[i][cMes] !== '' ? mostrados[i][cMes] : valores[i][cMes]
    );

    if (!ts) { continue; }

    const clave = canonico_(proveedor, alias);

    if (!porProveedor[clave]) {
      porProveedor[clave] = {
        clave: clave,
        proveedor: proveedor,
        subproductos: {},
        plan: 0
      };
    }

    porProveedor[clave].plan += ts;

    if (suministro) {
      porProveedor[clave].subproductos[suministro] = true;
    }
  }

  return { porProveedor: porProveedor, columna: cMes, etiqueta: etiqueta };
}

function prefijoDeEncabezado_(valor) {
  const texto = normalizeKey_(valor);

  let m = texto.match(/^(\d{4})[-/](\d{1,2})/);

  if (m) { return m[1] + '-' + pad2_(m[2]); }

  m = texto.match(
    /^(ENE|FEB|MAR|ABR|MAY|JUN|JUL|AGO|SEP|OCT|NOV|DIC)[A-Z]*[- ](\d{4})/
  );

  if (!m) { return ''; }

  const meses = {
    ENE: 1, FEB: 2, MAR: 3, ABR: 4, MAY: 5, JUN: 6,
    JUL: 7, AGO: 8, SEP: 9, OCT: 10, NOV: 11, DIC: 12
  };

  return m[2] + '-' + pad2_(meses[m[1]]);
}

function aNumero_(valor) {
  if (typeof valor === 'number' && isFinite(valor)) { return valor; }

  const texto = text_(valor);

  if (!texto) { return 0; }

  // 1.234,5 (es-CL) y 1234.5 conviven en la misma hoja.
  const limpio = /^-?\d{1,3}(\.\d{3})+(,\d+)?$/.test(texto)
    ? texto.replace(/\./g, '').replace(',', '.')
    : texto.replace(/\s/g, '').replace(',', '.');

  const n = Number(limpio);

  return isFinite(n) ? n : 0;
}

/** El nombre canónico de SAP si la hoja Proveedores lo homologa. */
function canonico_(nombre, alias) {
  const clave = comparable_(nombre);

  return alias[clave] ? comparable_(alias[clave]) : clave;
}

/**
 * Último día con despacho por proveedor, mirando las dos fuentes.
 *
 * Para esta pregunta no hace falta la fusión día por día del panel:
 * la fecha más alta de Ingresos o de la planilla ES el último
 * despacho conocido, venga de donde venga.
 */
function leerUltimosDespachos_(planilla, alias) {
  const desde = desdeClave_();
  const mes = mesActual_();
  const porProveedor = {};

  function anotar(clave, fecha, ts, fuente) {
    if (!porProveedor[clave]) {
      porProveedor[clave] = { ultimo: '', fuente: '', mes: 0 };
    }

    const item = porProveedor[clave];

    if (fecha > item.ultimo) {
      item.ultimo = fecha;
      item.fuente = fuente;
    }

    if (fecha.slice(0, 7) === mes) { item.mes += ts; }
  }

  // --- Ingresos (SAP) ---
  const hIng = planilla.getSheetByName(CONFIG.SHEET_INGRESOS);

  if (hIng && hIng.getLastRow() > 1) {
    const rango = hIng.getDataRange();
    const valores = rango.getValues();
    const mostrados = rango.getDisplayValues();
    const mapa = mapaEncabezados_(valores[0]);
    const d = CONFIG.INGRESOS_COLUMNS;

    function col(nombres, respaldo) {
      for (let i = 0; i < nombres.length; i++) {
        if (mapa[nombres[i]] !== undefined) { return mapa[nombres[i]]; }
      }
      return respaldo;
    }

    const cMaterial = col(['material', 'cod material'], d.MATERIAL);
    const cFecha = col(
      ['fecha contab', 'fecha contable', 'fecha contabilizacion'],
      d.FECHA_CONTABLE
    );
    const cCantidad = col(['cantidad', 'ctd', 'cantidad um'], d.CANTIDAD);
    const cProv = col(
      ['descripcion proveedor', 'nombre proveedor', 'proveedor'],
      d.DESCRIPCION_PROVEEDOR
    );

    for (let i = 1; i < valores.length; i++) {
      const fecha = fechaClave_(valores[i][cFecha], mostrados[i][cFecha]);

      if (!fecha || fecha < desde) { continue; }

      const codigo = text_(valores[i][cMaterial]).replace(/\D/g, '');

      if (!CONFIG.MATERIAL_MAP[codigo]) { continue; }

      const ts = aNumero_(
        mostrados[i][cCantidad] !== ''
          ? mostrados[i][cCantidad]
          : valores[i][cCantidad]
      );

      if (ts <= 0) { continue; }

      const proveedor = text_(valores[i][cProv]);

      if (!proveedor) { continue; }

      anotar(canonico_(proveedor, alias), fecha, ts, 'SAP');
    }
  }

  // --- InformeAstilla (planilla del reservador) ---
  const hInf = planilla.getSheetByName(CONFIG.SHEET_INFORME);

  if (hInf && hInf.getLastRow() > 1) {
    const valores = hInf.getDataRange().getValues();
    const mapa = mapaEncabezados_(valores[0]);
    const cFecha = mapa[normalizeHeader_('Fecha ISO')];
    const cProv = mapa[normalizeHeader_('Proveedor Planilla')];
    const cTs = mapa[normalizeHeader_('TS Estimadas')];
    const cEstado = mapa[normalizeHeader_('Estado')];

    if (cFecha !== undefined && cProv !== undefined) {
      for (let i = 1; i < valores.length; i++) {
        // Una fila con Estado ERROR no es un despacho: es un correo
        // que no se pudo leer.
        if (
          cEstado !== undefined &&
          normalizeKey_(valores[i][cEstado]).indexOf('ERROR') === 0
        ) {
          continue;
        }

        const fecha = text_(valores[i][cFecha]);

        if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha) || fecha < desde) {
          continue;
        }

        const proveedor = text_(valores[i][cProv]);

        if (!proveedor) { continue; }

        const ts = cTs !== undefined ? aNumero_(valores[i][cTs]) : 0;

        if (ts <= 0) { continue; }

        anotar(canonico_(proveedor, alias), fecha, ts, 'PLANILLA');
      }
    }
  }

  return porProveedor;
}
