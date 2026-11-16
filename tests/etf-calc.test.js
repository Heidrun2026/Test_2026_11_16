import { test } from 'node:test';
import assert from 'node:assert/strict';
import { pruefeEingaben, zahl, fehlendeKennzahlen, bewerte, sparplan, szenarien, status, MIN_ANGEBOTE } from '../etf/js/etf-calc.js';
import { ETFS } from '../etf/js/etf-data.js';

// Nur erfundene Kennzahlen für Tests.
const k = (rendite1J, vola1J, ter, sri) => ({ rendite1J, vola1J, ter, sri });

test('Vorauswahl: genau 10 ETFs mit eindeutiger, formal gültiger ISIN', () => {
  assert.equal(ETFS.length, 10);
  assert.equal(new Set(ETFS.map((e) => e.isin)).size, 10);
  for (const e of ETFS) assert.match(e.isin, /^[A-Z]{2}[A-Z0-9]{9}\d$/);
});

test('Pflichtangaben Betrag und Zeitraum', () => {
  assert.deepEqual(pruefeEingaben({ betrag: 100, jahre: 10 }), []);
  assert.equal(pruefeEingaben({ betrag: 0, jahre: 10 }).length, 1);
  assert.equal(pruefeEingaben({ betrag: null, jahre: 10 }).length, 1);
  assert.equal(pruefeEingaben({ betrag: 100, jahre: 0 }).length, 1);
  assert.equal(pruefeEingaben({ betrag: 100, jahre: 2.5 }).length, 1);
  assert.equal(pruefeEingaben({ betrag: 10.123, jahre: 10 }).length, 1);
});

test('zahl() versteht deutsches Komma und leere Werte', () => {
  assert.equal(zahl('7,5'), 7.5);
  assert.equal(zahl('-3.1 %'), -3.1);
  assert.equal(zahl(''), null);
  assert.equal(zahl('abc'), null);
});

test('fehlende oder unplausible Kennzahlen werden erkannt', () => {
  assert.deepEqual(fehlendeKennzahlen(k('8', '12', '0,2', '4')), []);
  assert.deepEqual(fehlendeKennzahlen({}), ['rendite1J', 'vola1J', 'ter', 'sri']);
  assert.deepEqual(fehlendeKennzahlen(k('8', '12', '0,2', '8')), ['sri']);
  assert.deepEqual(fehlendeKennzahlen(k('8', '12', '0,2', '3,5')), ['sri']);
});

test('Sparplan ohne Rendite = Summe der Einzahlungen', () => {
  assert.deepEqual(sparplan(100, 10, 0), { eingezahlt: 12000, endwert: 12000, ertrag: 0 });
});

test('Sparplan mit 5 % p. a., Einzahlung zum Monatsanfang', () => {
  const r = sparplan(100, 10, 5);
  assert.equal(r.eingezahlt, 12000);
  // Kontrollrechnung: 100 * ((1+rm)^120 - 1)/rm * (1+rm), rm = 1,05^(1/12) - 1
  const rm = Math.pow(1.05, 1 / 12) - 1;
  const soll = Math.round(10000 * ((Math.pow(1 + rm, 120) - 1) / rm) * (1 + rm)) / 100;
  assert.equal(r.endwert, soll);
  assert.ok(r.endwert > 15450 && r.endwert < 15550);
});

test('Szenarien ziehen die TER ab', () => {
  const ohne = szenarien(100, 10, 0);
  const mit = szenarien(100, 10, 0.5);
  assert.equal(ohne.length, 3);
  for (let i = 0; i < 3; i++) assert.ok(mit[i].endwert < ohne[i].endwert);
});

test('Bewertung: bessere Rendite, geringeres Risiko und geringere Kosten führen', () => {
  const etfs = [{ isin: 'A' }, { isin: 'B' }, { isin: 'C' }, { isin: 'D' }];
  const kz = {
    A: k(10, 10, 0.1, 3),   // gut
    B: k(5, 20, 0.5, 4),    // schlechter
    C: k(30, 25, 0.2, 6),   // hohe Rendite, aber Risikoklasse über Profil
    D: k('', 10, 0.1, 3),   // unvollständig
  };
  const r = bewerte(etfs, kz);
  assert.deepEqual(r.map((e) => e.isin), ['A', 'B', 'C']);
  assert.equal(r[2].passtZumProfil, false);
  assert.ok(r.every((e) => e.punkte >= 0 && e.punkte <= 100));
});

test('Status: Rückfrage unter 5 passenden ETFs, erledigt ab 5', () => {
  const etfs = ['1', '2', '3', '4', '5', '6'].map((isin) => ({ isin }));
  const kz = { 1: k(5, 10, 0.2, 4), 2: k(5, 10, 0.2, 4), 3: k(5, 10, 0.2, 4), 4: k(5, 10, 0.2, 4), 5: k(5, 10, 0.2, 5) };
  let s = status(etfs, kz);
  assert.equal(s.stufe, 'rueckfrage');
  assert.equal(s.fehlen, MIN_ANGEBOTE - 4);
  kz[6] = k(3, 5, 0.1, 2);
  s = status(etfs, kz);
  assert.equal(s.stufe, 'erledigt');
  assert.equal(s.passend, 5);
});
