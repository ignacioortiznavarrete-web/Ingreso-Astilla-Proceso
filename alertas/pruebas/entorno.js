/**
 * Corre los .gs del proyecto de alertas en node, con lo mínimo de
 * Apps Script simulado: hojas en memoria, Utilities, MailApp y
 * ScriptApp. Sirve para probar los lectores contra la forma real de
 * las hojas sin tocar la planilla.
 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

function hoja(nombre, filas) {
  const alto = filas.length;
  const ancho = filas.reduce((m, f) => Math.max(m, f.length), 0);
  const norm = filas.map(f => {
    const c = f.slice();
    while (c.length < ancho) c.push('');
    return c;
  });
  const mostrar = v => v instanceof Date
    ? String(v.getUTCDate()).padStart(2, '0') + '/' +
      String(v.getUTCMonth() + 1).padStart(2, '0') + '/' + v.getUTCFullYear()
    : (v === null || v === undefined ? '' : String(v));

  return {
    getName: () => nombre,
    getLastRow: () => alto,
    getLastColumn: () => ancho,
    getDataRange: () => ({
      getValues: () => norm.map(f => f.slice()),
      getDisplayValues: () => norm.map(f => f.map(mostrar))
    }),
    getRange: (r, c, nr, nc) => ({
      getValues: () => norm.slice(r - 1, r - 1 + nr).map(f => f.slice(c - 1, c - 1 + nc))
    })
  };
}

function cargar(hojas, hoy) {
  const enviados = [];
  const registro = [];
  const disparadores = [];

  const ctx = {
    console,
    SpreadsheetApp: {
      openById: () => ({
        getName: () => 'Astilla Proceso',
        getUrl: () => 'https://docs.google.com/spreadsheets/d/x',
        getSheetByName: n => hojas[n] || null
      })
    },
    Utilities: {
      formatDate: (d, tz, fmt) => {
        const p = n => String(n).padStart(2, '0');
        const y = d.getUTCFullYear(), m = p(d.getUTCMonth() + 1), dd = p(d.getUTCDate());
        return fmt === 'yyyy-MM' ? y + '-' + m : y + '-' + m + '-' + dd;
      }
    },
    MailApp: { sendEmail: o => enviados.push(o) },
    Logger: { log: m => registro.push(String(m)) },
    ScriptApp: {
      newTrigger: f => {
        const t = { f };
        const api = {
          timeBased: () => api, everyDays: () => api, atHour: h => { t.h = h; return api; },
          inTimezone: () => api, create: () => { disparadores.push(t); return t; }
        };
        return api;
      },
      getProjectTriggers: () => disparadores.map(t => ({
        getHandlerFunction: () => t.f
      })),
      deleteTrigger: () => { disparadores.length = 0; }
    }
  };

  // Hoy fijo, para que las pruebas no cambien de resultado cada día.
  const real = Date;
  ctx.Date = class extends real {
    constructor(...a) { if (!a.length) { super(hoy + 'T12:00:00Z'); } else { super(...a); } }
    static now() { return new real(hoy + 'T12:00:00Z').getTime(); }
    static UTC(...a) { return real.UTC(...a); }
  };

  vm.createContext(ctx);
  const dir = path.join(__dirname, '..');
  ['Config.gs', 'Lectura.gs', 'Aviso.gs'].forEach(f => {
    vm.runInContext(fs.readFileSync(path.join(dir, f), 'utf8'), ctx, { filename: f });
  });

  return { ctx, enviados, registro, disparadores };
}

module.exports = { hoja, cargar };
