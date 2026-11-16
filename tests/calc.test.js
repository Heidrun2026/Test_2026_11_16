import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  easterSunday, isoDate, berlinHolidays, planningMonths, holidaySet, workingDays,
  ferienWorkdays, memberMonth, monthStatus, statusFor, shiftMonth,
} from '../js/calc.js';

test('Ostersonntag', () => {
  assert.equal(isoDate(easterSunday(2026)), '2026-04-05');
  assert.equal(isoDate(easterSunday(2027)), '2027-03-28');
});

test('Berliner Feiertage 2027 enthalten bewegliche Feiertage und Frauentag', () => {
  const dates = berlinHolidays(2027).map((h) => h.date);
  for (const d of ['2027-03-08', '2027-03-26', '2027-03-29', '2027-05-06', '2027-05-17']) assert.ok(dates.includes(d), d);
  assert.equal(dates.length, 10);
});

test('Planungshorizont: aktueller Monat + 6 Folgemonate, über den Jahreswechsel', () => {
  const m = planningMonths(new Date(Date.UTC(2026, 10, 16)), 7);
  assert.deepEqual(m, ['2026-11', '2026-12', '2027-01', '2027-02', '2027-03', '2027-04', '2027-05']);
  assert.equal(shiftMonth('2027-01', -1), '2026-12');
});

test('Arbeitstage abzüglich Feiertage', () => {
  const hol = holidaySet([2026, 2027]);
  assert.equal(workingDays('2026-12', hol), 22); // 23 Werktage, 25.12.2026 ist ein Freitag (26.12. Samstag)
});

test('Ferien-Arbeitstage werden nur gezählt, nicht abgezogen', () => {
  const hol = holidaySet([2027]);
  assert.equal(ferienWorkdays('2027-02', hol, [{ von: '2027-02-01', bis: '2027-02-05' }]), 5);
});

const basis = () => ({
  einstellungen: { schwellen: { rueckfrage: 90, ueberlast: 100 } },
  mitglieder: [{ id: 'a', name: 'Test A', rolle: 'Anwendungsberatung', beschaeftigung: 100, linie: 20, orga: 10 }],
  buchungen: [],
  grunddaten: {},
  meldungen: {},
});

test('Kapazität: verfügbar, Linie/Orga, Projekte, Auslastung', () => {
  const s = basis();
  const hol = new Set();
  // Februar 2027: 20 Werktage
  s.grunddaten.a = { '2027-02': { abwesenheit: 0 } };
  s.buchungen.push({ memberId: 'a', monat: '2027-02', projektId: 'p', tage: 10, geplantVon: 'a' });
  const r = memberMonth(s, s.mitglieder[0], '2027-02', hol);
  assert.equal(r.arbeitstage, 20);
  assert.equal(r.verfuegbar, 20);
  assert.equal(r.linie, 4);
  assert.equal(r.orga, 2);
  assert.equal(r.belegt, 16);
  assert.equal(Math.round(r.auslastung), 80);
  assert.equal(r.status, 'ok');
});

test('Abwesenheit und Teilzeit reduzieren die Kapazität', () => {
  const s = basis();
  s.mitglieder[0].beschaeftigung = 50;
  s.grunddaten.a = { '2027-02': { abwesenheit: 2, linie: 0, orga: 0 } };
  s.buchungen.push({ memberId: 'a', monat: '2027-02', tage: 8 });
  const r = memberMonth(s, s.mitglieder[0], '2027-02', new Set());
  assert.equal(r.verfuegbar, 8);
  assert.equal(r.status, 'pruefen'); // genau 100 % → Rückfrage, noch keine Überlast
});

test('Schwellen: ab 90 % Rückfrage, über 100 % Überlast', () => {
  const sw = { rueckfrage: 90, ueberlast: 100 };
  assert.equal(statusFor(89.9, sw), 'ok');
  assert.equal(statusFor(90, sw), 'pruefen');
  assert.equal(statusFor(100, sw), 'pruefen');
  assert.equal(statusFor(100.1, sw), 'ueberlast');
  assert.equal(statusFor(Infinity, sw), 'ueberlast');
});

test('Monatsstatus: fertig erst, wenn alle gemeldet und niemand überlastet', () => {
  const s = basis();
  const hol = new Set();
  assert.equal(monthStatus(s, '2027-02', hol).fertig, false);
  s.meldungen['2027-02'] = { a: true };
  assert.equal(monthStatus(s, '2027-02', hol).fertig, true);
  s.buchungen.push({ memberId: 'a', monat: '2027-02', tage: 30 });
  const st = monthStatus(s, '2027-02', hol);
  assert.equal(st.fertig, false);
  assert.equal(st.ueberlast.length, 1);
});
