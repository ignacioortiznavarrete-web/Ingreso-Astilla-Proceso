/**
 * ASTILLA PROCESO · ALERTAS · CONFIGURACIÓN
 *
 * Proyecto de Apps Script APARTE del dashboard. No es un archivo más
 * del panel: es un script independiente que abre la misma planilla en
 * modo lectura y manda un correo.
 *
 * Lo único que hay que tocar acá es SPREADSHEET_ID y PARA.
 *
 * Qué NO comparte con el dashboard, y por qué no importa:
 * un proyecto separado no puede llamar a getDashboardData(), así que
 * este script lee las hojas por su cuenta. Lee bastante menos: no
 * necesita precios, ni valorización, ni la fusión día por día de
 * Ingresos con la planilla. Para «cuándo despachó por última vez»
 * basta la fecha más alta de las dos fuentes, que es más simple y no
 * puede quedar desincronizada con el panel por una regla de fusión
 * que aquí no se usa.
 *
 * Lo que sí está duplicado son constantes y funciones puras —códigos
 * de material, factores, feriados, normalización de nombres—. Si
 * alguna cambia en el dashboard, hay que cambiarla también acá; están
 * todas en este archivo justamente para que se vea de una sola
 * mirada.
 */

const CONFIG = Object.freeze({
  // La planilla del dashboard. Se abre por ID porque este proyecto no
  // está ligado a ella.
  SPREADSHEET_ID: '1PNQToRtF7g-obmmOHuoonNGN5-VhhTYnW6SEhK36EOk',

  SHEET_INGRESOS: 'Ingresos',
  SHEET_INFORME: 'InformeAstilla',
  SHEET_PLAN: 'Plan',
  SHEET_PROVEEDORES: 'Proveedores',

  TIMEZONE: 'America/Santiago',
  UNIDAD: 'TS',

  PARA: Object.freeze([
    'francisco.correa@masisa.com',
    'jaime.rojas@masisa.com'
  ]),

  ASUNTO: 'Astilla verde · proveedores del plan en riesgo',

  // Los tramos de silencio. Son excluyentes: un proveedor lleva los
  // días que lleva, y su fila muestra UN tramo, el suyo. `hasta: 0`
  // significa "y de ahí para arriba".
  TRAMOS: Object.freeze([
    Object.freeze({ desde: 3, hasta: 4 }),
    Object.freeze({ desde: 5, hasta: 6 }),
    Object.freeze({ desde: 7, hasta: 0 })
  ]),

  /**
   * Cuándo se dice que un proveedor viene "a la baja".
   *
   * Dos señales, y basta una. Son distintas a propósito: la primera
   * mira el compromiso —va atrasado contra SU plan—, la segunda mira
   * al proveedor contra sí mismo —entrega menos que antes, tenga el
   * plan que tenga—. Un proveedor puede ir bien contra un plan chico
   * y haberse caído a la mitad; eso igual hay que verlo.
   */
  BAJA: Object.freeze({
    // Fracción del ritmo que pide el plan bajo la cual se avisa. 0,85
    // es un 15% de atraso: menos que eso lo mueve un camión.
    RITMO_PLAN: 0.85,

    // Caída respecto de su propio ritmo diario de los meses
    // anteriores. 0,25 es "entrega un cuarto menos por día".
    CAIDA_PROPIA: 0.25,

    // Meses cerrados que forman ese promedio.
    MESES_BASE: 3,

    // Días hábiles que tiene que llevar el mes para hablar de ritmo.
    // El día 1 nadie ha entregado nada y el prorrateo diría que TODOS
    // vienen a la baja: un aviso que el primer día del mes acusa a
    // todo el mundo no se vuelve a leer.
    MINIMO_DIAS: 4
  }),

  // Hora local del envío. El disparador corre cerca de esta hora,
  // con el margen de ±15 minutos que da Apps Script.
  HORA: 9,
  MINUTO: 0,

  // Sábado y domingo el número no cambia —no son días hábiles— y el
  // correo saldría idéntico al del viernes. Se salta.
  SOLO_HABILES: true,

  // Bajo esto, dos nombres no son el mismo proveedor. Es el mismo
  // umbral que usa el panel: si se cambia acá y no allá, el correo
  // empieza a decir algo distinto de lo que muestra la pantalla.
  UMBRAL_PARECIDO: 0.72,

  // Cuántos meses atrás se lee para encontrar el último despacho. Un
  // proveedor que no despacha hace más que esto sale como «sin
  // ingresos», que para una alerta dice lo mismo.
  MESES_ATRAS: 4,

  // 0=domingo ... 6=sábado. Igual que en el dashboard.
  WORKDAYS: Object.freeze([1, 2, 3, 4, 5]),

  // Feriados: calculados, no escritos. Una lista a mano se acaba en
  // silencio y a partir de ahí el 18 de septiembre cuenta como día
  // hábil. La misma función que usa el panel, en Feriados.gs.
  //
  // Va como getter para no depender del orden en que Apps Script
  // carga los archivos: este corre antes que Feriados.gs y llamar la
  // función acá mismo reventaría al abrir el proyecto.
  get FERIADOS() { return feriadosDelPanel_(); },

  // Solo estos materiales son astilla de proceso. Igual que en el
  // dashboard: si aparece uno nuevo, hay que agregarlo en los dos.
  MATERIAL_MAP: Object.freeze({
    '3000039': 'ASTILLA PINO VERDE',
    '3009002': 'AST. PINO VERDE C/ CORTEZA',
    '3009003': 'ASTILLA EUCALYPTUS NITENS'
  }),

  // Posiciones de respaldo (base cero) de la hoja Ingresos, por si
  // los encabezados no se reconocen por nombre.
  INGRESOS_COLUMNS: Object.freeze({
    MATERIAL: 2,
    FECHA_CONTABLE: 4,
    CANTIDAD: 8,
    PROVEEDOR: 11,
    DESCRIPCION_PROVEEDOR: 12
  })
});
