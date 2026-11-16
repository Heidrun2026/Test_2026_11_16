// Reine Rechenlogik der Kapazitätsplanung – ohne DOM, damit sie testbar ist.
// Alle Datumswerte als ISO-Strings (YYYY-MM-DD), Monate als 'YYYY-MM'.

const pad = (n) => String(n).padStart(2, '0');
export const isoDate = (d) => `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
const utc = (y, m, d) => new Date(Date.UTC(y, m - 1, d));
const addDays = (d, n) => new Date(d.getTime() + n * 86400000);

/** Ostersonntag (gregorianisch, anonymer Algorithmus). */
export function easterSunday(year) {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return utc(year, month, day);
}

/** Gesetzliche Feiertage im Land Berlin (Stand: inkl. Frauentag seit 2019). */
export function berlinHolidays(year) {
  const easter = easterSunday(year);
  const list = [
    [utc(year, 1, 1), 'Neujahr'],
    [utc(year, 3, 8), 'Internationaler Frauentag'],
    [addDays(easter, -2), 'Karfreitag'],
    [addDays(easter, 1), 'Ostermontag'],
    [utc(year, 5, 1), 'Tag der Arbeit'],
    [addDays(easter, 39), 'Christi Himmelfahrt'],
    [addDays(easter, 50), 'Pfingstmontag'],
    [utc(year, 10, 3), 'Tag der Deutschen Einheit'],
    [utc(year, 12, 25), '1. Weihnachtstag'],
    [utc(year, 12, 26), '2. Weihnachtstag'],
  ];
  return list.map(([d, name]) => ({ date: isoDate(d), name }));
}

export function monthKey(date) {
  return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}`;
}

/** Aktueller Monat plus `count - 1` Folgemonate. */
export function planningMonths(today, count = 7) {
  const months = [];
  for (let i = 0; i < count; i++) {
    months.push(monthKey(utc(today.getUTCFullYear(), today.getUTCMonth() + 1 + i, 1)));
  }
  return months;
}

export function shiftMonth(key, delta) {
  const [y, m] = key.split('-').map(Number);
  return monthKey(utc(y, m + delta, 1));
}

export function monthLabel(key, style = 'long') {
  const [y, m] = key.split('-').map(Number);
  return new Intl.DateTimeFormat('de-DE', { month: style, year: 'numeric', timeZone: 'UTC' }).format(utc(y, m, 1));
}

/** Alle Werktage (Mo–Fr) eines Monats als ISO-Strings. */
export function weekdaysOfMonth(key) {
  const [y, m] = key.split('-').map(Number);
  const days = [];
  for (let d = utc(y, m, 1); d.getUTCMonth() === m - 1; d = addDays(d, 1)) {
    const wd = d.getUTCDay();
    if (wd !== 0 && wd !== 6) days.push(isoDate(d));
  }
  return days;
}

/** Feiertage (Berlin + zusätzlich gepflegte freie Tage) als Set von ISO-Strings. */
export function holidaySet(years, extraDays = []) {
  const set = new Set(extraDays.map((x) => x.date));
  for (const y of years) for (const h of berlinHolidays(y)) set.add(h.date);
  return set;
}

export function workingDays(key, holidays) {
  return weekdaysOfMonth(key).filter((d) => !holidays.has(d)).length;
}

/** Arbeitstage eines Monats, die in Ferienzeiträume fallen (nur Hinweis, keine Verrechnung). */
export function ferienWorkdays(key, holidays, ferien = []) {
  return weekdaysOfMonth(key).filter(
    (d) => !holidays.has(d) && ferien.some((f) => f.von <= d && d <= f.bis),
  ).length;
}

const round1 = (x) => Math.round(x * 10) / 10;

export function statusFor(auslastung, schwellen) {
  if (auslastung > schwellen.ueberlast) return 'ueberlast';
  if (auslastung >= schwellen.rueckfrage) return 'pruefen';
  return 'ok';
}

/** Grunddaten eines Mitglieds für einen Monat (Monatswert oder Standardwert des Mitglieds). */
export function grunddatenFor(state, member, key) {
  const g = state.grunddaten?.[member.id]?.[key] ?? {};
  return {
    abwesenheit: Number(g.abwesenheit ?? 0),
    linie: Number(g.linie ?? member.linie ?? 0),
    orga: Number(g.orga ?? member.orga ?? 0),
  };
}

/**
 * Kapazität und Auslastung eines Mitglieds in einem Monat, alles in Personentagen.
 * verfügbar = Arbeitstage × Beschäftigungsgrad − Abwesenheit
 * belegt    = Linie % + Organisation % (bezogen auf verfügbar) + geplante Projekt-/Clustertage
 */
export function memberMonth(state, member, key, holidays) {
  const arbeitstage = workingDays(key, holidays);
  const soll = arbeitstage * (Number(member.beschaeftigung ?? 100) / 100);
  const g = grunddatenFor(state, member, key);
  const verfuegbar = Math.max(0, soll - g.abwesenheit);
  const linie = (verfuegbar * g.linie) / 100;
  const orga = (verfuegbar * g.orga) / 100;
  const buchungen = state.buchungen.filter((b) => b.memberId === member.id && b.monat === key);
  const projekte = buchungen.reduce((s, b) => s + Number(b.tage || 0), 0);
  const belegt = linie + orga + projekte;
  let auslastung;
  if (verfuegbar > 0) auslastung = (belegt / verfuegbar) * 100;
  else auslastung = belegt > 0 ? Infinity : 0;
  return {
    arbeitstage,
    soll: round1(soll),
    abwesenheit: g.abwesenheit,
    verfuegbar: round1(verfuegbar),
    linie: round1(linie),
    orga: round1(orga),
    projekte: round1(projekte),
    belegt: round1(belegt),
    frei: round1(verfuegbar - belegt),
    auslastung,
    status: statusFor(auslastung, state.einstellungen.schwellen),
    buchungen,
  };
}

/** Summe über das Team (ohne Rückschluss auf Einzelne). */
export function teamMonth(state, key, holidays) {
  let verfuegbar = 0;
  let belegt = 0;
  for (const m of state.mitglieder) {
    const r = memberMonth(state, m, key, holidays);
    verfuegbar += r.verfuegbar;
    belegt += r.belegt;
  }
  const auslastung = verfuegbar > 0 ? (belegt / verfuegbar) * 100 : 0;
  return { verfuegbar: round1(verfuegbar), belegt: round1(belegt), frei: round1(verfuegbar - belegt), auslastung };
}

/**
 * Abstimmungsstand eines Monats nach den Regeln des Prozesses:
 * vollständig = alle haben ihre Planung als gepflegt gemeldet
 * fertig      = vollständig und niemand über der Überlastgrenze
 */
export function monthStatus(state, key, holidays) {
  const gemeldet = state.mitglieder.filter((m) => state.meldungen?.[key]?.[m.id]);
  const zeilen = state.mitglieder.map((m) => ({ member: m, ...memberMonth(state, m, key, holidays) }));
  const rueckfragen = zeilen.filter((z) => z.status === 'pruefen');
  const ueberlast = zeilen.filter((z) => z.status === 'ueberlast');
  const vollstaendig = gemeldet.length === state.mitglieder.length;
  return {
    gemeldet: gemeldet.length,
    gesamt: state.mitglieder.length,
    vollstaendig,
    rueckfragen,
    ueberlast,
    fertig: vollstaendig && ueberlast.length === 0,
  };
}

export function formatProzent(x) {
  if (!Number.isFinite(x)) return 'keine Kapazität';
  return `${Math.round(x)} %`;
}

export function formatTage(x) {
  return `${new Intl.NumberFormat('de-DE', { maximumFractionDigits: 1 }).format(x)} PT`;
}
