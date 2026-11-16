// Datenhaltung des Prototyps im Browser (localStorage).
// Nur für fiktive Daten! Im echten Betrieb gehören die Daten auf einen Server
// mit Anmeldung, nicht dauerhaft in den Browser.

import { planningMonths } from './calc.js';

const KEY = 'kapazitaetsplanung-prototyp-v1';

let idCounter = Date.now();
export const newId = (prefix) => `${prefix}-${(idCounter++).toString(36)}`;

/** Erfundene Beispieldaten: 8 Anwendungsberater*innen, 3 Entwickler*innen. */
export function seedState(today = new Date()) {
  const mitglieder = [
    ...'ABCDEFGH'.split('').map((c, i) => ({
      id: `m-ab-${c}`,
      name: `Beratung ${c}`,
      rolle: 'Anwendungsberatung',
      beschaeftigung: i === 5 ? 80 : 100,
      linie: 20 + (i % 3) * 5,
      orga: 10,
    })),
    ...[1, 2, 3].map((n) => ({
      id: `m-dev-${n}`,
      name: `Entwicklung ${n}`,
      rolle: 'Entwicklung',
      beschaeftigung: 100,
      linie: 10,
      orga: 10,
    })),
  ];

  const projekte = [
    { id: 'p-1', name: 'Projekt Alpha', typ: 'Projekt', aktiv: true },
    { id: 'p-2', name: 'Projekt Beta', typ: 'Projekt', aktiv: true },
    { id: 'p-3', name: 'Projekt Gamma', typ: 'Projekt', aktiv: true },
    { id: 'p-4', name: 'Reporting', typ: 'Themencluster', aktiv: true },
    { id: 'p-5', name: 'Schnittstellen', typ: 'Themencluster', aktiv: true },
    { id: 'p-6', name: 'Weiterentwicklung Fachanwendung', typ: 'Themencluster', aktiv: true },
  ];

  const months = planningMonths(new Date(Date.UTC(today.getFullYear(), today.getMonth(), 1)), 7);
  const buchungen = [];
  // Deterministisch "zufällige" Planung, damit Rückfragen und Überlastungen sichtbar werden.
  let seed = 7;
  const rnd = () => ((seed = (seed * 9301 + 49297) % 233280) / 233280);
  months.forEach((monat, mi) => {
    const abnahme = 1 - mi * 0.12; // weiter in der Zukunft ist weniger geplant
    mitglieder.forEach((m, i) => {
      const anzahl = 1 + Math.floor(rnd() * 3);
      for (let k = 0; k < anzahl; k++) {
        const p = projekte[Math.floor(rnd() * projekte.length)];
        let tage = Math.round((2 + rnd() * 4.5) * abnahme * 2) / 2;
        if (mi === 1 && (i === 2 || i === 9) && k === 0) tage += 12; // gezielte Überlast im Folgemonat
        if (tage <= 0) continue;
        // Entwickler*innen werden von Anwendungsberater*innen eingeplant
        const geplantVon = m.rolle === 'Entwicklung' ? mitglieder[Math.floor(rnd() * 8)].id : m.id;
        buchungen.push({ id: newId('b'), monat, memberId: m.id, projektId: p.id, tage, geplantVon, notiz: '' });
      }
    });
  });

  const grunddaten = {};
  grunddaten['m-ab-B'] = { [months[1]]: { abwesenheit: 5 } };
  grunddaten['m-dev-2'] = { [months[2]]: { abwesenheit: 10 } };
  grunddaten['m-ab-E'] = { [months[1]]: { abwesenheit: 3 } };

  return {
    version: 1,
    einstellungen: { schwellen: { rueckfrage: 90, ueberlast: 100 } },
    zusatzFrei: [], // z. B. Heiligabend/Silvester, falls betrieblich frei: {date, name}
    ferien: [], // {id, name, von, bis}
    mitglieder,
    projekte,
    buchungen,
    grunddaten,
    meldungen: {}, // {monat: {memberId: true}}
    entscheidungen: [], // {id, monat, memberId, text, datum, von}
  };
}

export function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return JSON.parse(raw);
  } catch {
    /* Speicher nicht verfügbar oder beschädigt – Beispieldaten verwenden */
  }
  return seedState();
}

export function save(state) {
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
    return true;
  } catch {
    return false;
  }
}

export function reset() {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* ignorieren */
  }
  return seedState();
}

/** Minimale Plausibilitätsprüfung für importierte Dateien. */
export function validateImport(obj) {
  const arrays = ['mitglieder', 'projekte', 'buchungen', 'ferien', 'zusatzFrei', 'entscheidungen'];
  if (!obj || typeof obj !== 'object') return 'Die Datei enthält keine gültigen Daten.';
  for (const a of arrays) if (!Array.isArray(obj[a])) return `Feld „${a}“ fehlt oder ist ungültig.`;
  if (!obj.einstellungen?.schwellen) return 'Die Schwellenwerte fehlen.';
  return null;
}
