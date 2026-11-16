import { test } from 'node:test';
import assert from 'node:assert/strict';
import { sdmxCsvWerte, jsonStatLetzterWert, gleifEintrag, dollarVeraenderung } from '../etf/js/marktdaten.js';
import { realwert, bewerte } from '../etf/js/etf-calc.js';

// Alle Antworten sind nachgebaute Beispiele im Format der Dienste mit erfundenen Werten.

test('SDMX-CSV der EZB (Komma-getrennt)', () => {
  const csv = 'KEY,FREQ,REF_AREA,TIME_PERIOD,OBS_VALUE,OBS_STATUS\nFM.D.U2.EUR.4F.KR.DFR.LEV,D,U2,2026-11-12,1.5,A\nFM.D.U2.EUR.4F.KR.DFR.LEV,D,U2,2026-11-13,1.75,A\n';
  assert.deepEqual(sdmxCsvWerte(csv), [{ periode: '2026-11-12', wert: 1.5 }, { periode: '2026-11-13', wert: 1.75 }]);
});

test('SDMX-CSV mit Semikolon, Dezimalkomma, BOM und leeren Werten', () => {
  const csv = '﻿"DATAFLOW";"TIME_PERIOD";"OBS_VALUE"\n"BBSIS";"2026-11-13";"2,45"\n"BBSIS";"2026-11-14";""\n"BBSIS";"2026-11-11";"2,40"\n';
  assert.deepEqual(sdmxCsvWerte(csv), [{ periode: '2026-11-11', wert: 2.4 }, { periode: '2026-11-13', wert: 2.45 }]);
});

test('SDMX-CSV ohne erwartete Spalten wirft verständlichen Fehler', () => {
  assert.throws(() => sdmxCsvWerte('A,B\n1,2'), /TIME_PERIOD/);
  assert.deepEqual(sdmxCsvWerte(''), []);
});

test('JSON-stat (Eurostat): letzter vorhandener Wert', () => {
  const js = {
    id: ['freq', 'unit', 'coicop', 'geo', 'time'], size: [1, 1, 1, 1, 3],
    dimension: { time: { category: { index: { '2026-08': 0, '2026-09': 1, '2026-10': 2 } } } },
    value: { 0: 2.1, 1: 2.3 },
  };
  assert.deepEqual(jsonStatLetzterWert(js), { periode: '2026-09', wert: 2.3 });
  assert.throws(() => jsonStatLetzterWert({ ...js, size: [1, 1, 1, 2, 3] }), /mehr als eine/);
  assert.throws(() => jsonStatLetzterWert({}), /Format/);
});

test('GLEIF: erster Treffer oder null', () => {
  const json = { data: [{ attributes: { lei: '5299001ABCDEFGHIJK12', entity: { legalName: { name: 'Beispiel Fonds plc' }, legalAddress: { country: 'IE' }, category: 'FUND' }, registration: { status: 'ISSUED' } } }] };
  assert.deepEqual(gleifEintrag(json), { lei: '5299001ABCDEFGHIJK12', name: 'Beispiel Fonds plc', land: 'IE', kategorie: 'FUND', status: 'ISSUED' });
  assert.equal(gleifEintrag({ data: [] }), null);
});

test('Dollar-Veränderung: Euro steigt → Dollar verliert', () => {
  const v = dollarVeraenderung([{ periode: '2025-11-14', wert: 1.0 }, { periode: '2026-11-13', wert: 1.25 }]);
  assert.equal(v.prozent, -20);
  assert.equal(dollarVeraenderung([{ periode: 'x', wert: 1 }]), null);
});

test('Kaufkraft und Rendite je Risiko über sicherem Zins', () => {
  assert.equal(realwert(11000, 10, 1), 10000);
  assert.equal(realwert(15000, 0, 10), 15000);
  const r = bewerte([{ isin: 'A' }], { A: { rendite1J: 8, vola1J: 10, ter: 0.2, sri: 4 } }, { risikofrei: 2 });
  assert.equal(r[0].renditeJeRisiko, 0.6);
});
