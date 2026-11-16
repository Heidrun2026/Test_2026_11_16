// Abruf offizieller, offener Daten ohne API-Schlüssel (nur auf Klick, aus dem Browser).
// Übertragen werden nur Serienschlüssel bzw. ISINs (und technisch die IP-Adresse) – keine Eingaben der Nutzerin.
// Parser sind reine Funktionen und in tests/marktdaten.test.js getestet.

export const ENDPUNKTE = {
  bundesbank: 'https://api.statistiken.bundesbank.de/rest/',
  ezb: 'https://data-api.ecb.europa.eu/service/',
  eurostat: 'https://ec.europa.eu/eurostat/api/dissemination/',
  gleif: 'https://api.gleif.org/api/v1/',
};

// Serienschlüssel (bitte bei Fehlern im jeweiligen Datenportal prüfen)
export const SERIEN = {
  // Bundesbank: Tägliche Rendite börsennotierter Bundeswertpapiere, Restlaufzeit 10 Jahre
  bund10: 'BBSIS/D.I.ZAR.ZI.EUR.S1311.B.A604.R10XX.R.A.A._Z._Z.A',
  // EZB: Zinssatz der Einlagefazilität
  einlagezins: 'FM/D.U2.EUR.4F.KR.DFR.LEV',
  // EZB: Referenzkurs US-Dollar je Euro
  eurUsd: 'EXR/D.USD.EUR.SP00.A',
  // Eurostat: HVPI Deutschland, Veränderung zum Vorjahresmonat
  inflationEurostat: 'statistics/1.0/data/prc_hicp_manr?geo=DE&coicop=CP00&lastTimePeriod=1',
  // EZB (Ersatz, falls Eurostat nicht antwortet): HVPI Deutschland, Jahresrate
  inflationEzb: 'ICP/M.DE.N.000000.4.ANR',
};

const CSV_ACCEPT = 'application/vnd.sdmx.data+csv;version=1.0.0';

/** Liest SDMX-CSV (Bundesbank, EZB) und liefert [{periode, wert}] aufsteigend nach Periode. */
export function sdmxCsvWerte(text) {
  const zeilen = String(text).replace(/^﻿/, '').split(/\r?\n/).filter((z) => z.trim() !== '');
  if (zeilen.length < 2) return [];
  const sep = (zeilen[0].match(/;/g) || []).length > (zeilen[0].match(/,/g) || []).length ? ';' : ',';
  const teile = (z) => z.split(sep).map((t) => t.trim().replace(/^"|"$/g, ''));
  const kopf = teile(zeilen[0]).map((k) => k.toUpperCase());
  const iZeit = kopf.indexOf('TIME_PERIOD');
  const iWert = kopf.indexOf('OBS_VALUE');
  if (iZeit < 0 || iWert < 0) throw new Error('Unerwartetes CSV-Format (TIME_PERIOD/OBS_VALUE fehlt).');
  return zeilen.slice(1)
    .map(teile)
    .filter((t) => t[iZeit] && t[iWert] !== undefined && t[iWert] !== '' && t[iWert].toUpperCase() !== 'NAN')
    .map((t) => ({ periode: t[iZeit], wert: Number(sep === ';' ? t[iWert].replace(',', '.') : t[iWert]) }))
    .filter((o) => Number.isFinite(o.wert))
    .sort((a, b) => a.periode.localeCompare(b.periode));
}

/** Letzter Wert aus einer JSON-stat-2.0-Antwort (Eurostat) mit nur einer Zeitreihe. */
export function jsonStatLetzterWert(js) {
  const zeit = js?.dimension?.time?.category?.index;
  if (!zeit || js.value === undefined) throw new Error('Unerwartetes JSON-stat-Format.');
  const anzahl = (js.size || []).reduce((a, b) => a * b, 1);
  if (anzahl !== Object.keys(zeit).length) throw new Error('Antwort enthält mehr als eine Zeitreihe.');
  const perioden = Object.entries(zeit).sort((a, b) => a[1] - b[1]);
  for (let i = perioden.length - 1; i >= 0; i--) {
    const [periode, idx] = perioden[i];
    const wert = js.value[idx] ?? js.value[String(idx)];
    if (typeof wert === 'number') return { periode, wert };
  }
  return null;
}

/** Erster Treffer einer GLEIF-Abfrage nach ISIN, oder null. */
export function gleifEintrag(json) {
  const a = json?.data?.[0]?.attributes;
  if (!a) return null;
  return {
    lei: a.lei,
    name: a.entity?.legalName?.name || '',
    land: a.entity?.legalAddress?.country || '',
    kategorie: a.entity?.category || '',
    status: a.registration?.status || '',
  };
}

/** Veränderung des US-Dollars gegenüber dem Euro in % aus EUR/USD-Kursen (erster vs. letzter Wert). */
export function dollarVeraenderung(werte) {
  if (!werte || werte.length < 2) return null;
  const erst = werte[0], letzt = werte[werte.length - 1];
  return { von: erst.periode, bis: letzt.periode, kursVon: erst.wert, kursBis: letzt.wert,
    prozent: Math.round(((erst.wert / letzt.wert) - 1) * 10000) / 100 };
}

// ---------- Abruf (Browser) ----------

async function holen(url, { accept, ms = 15000 } = {}) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), ms);
  try {
    const res = await fetch(url, { headers: accept ? { Accept: accept } : {}, signal: ctrl.signal, referrerPolicy: 'no-referrer', credentials: 'omit' });
    if (res.status === 404) return null;
    if (!res.ok) throw new Error(`Antwort ${res.status}`);
    return res;
  } catch (e) {
    if (e.name === 'AbortError') throw new Error('Zeitüberschreitung');
    if (e instanceof TypeError) throw new Error('nicht erreichbar oder vom Browser blockiert');
    throw e;
  } finally { clearTimeout(t); }
}

const isoTag = (d) => d.toISOString().slice(0, 10);

export async function ladeBund10() {
  const res = await holen(`${ENDPUNKTE.bundesbank}data/${SERIEN.bund10}?lastNObservations=1`, { accept: CSV_ACCEPT });
  const w = res ? sdmxCsvWerte(await res.text()).at(-1) : null;
  if (!w) throw new Error('keine Werte');
  return { ...w, quelle: 'Deutsche Bundesbank' };
}

export async function ladeEinlagezins() {
  const res = await holen(`${ENDPUNKTE.ezb}data/${SERIEN.einlagezins}?lastNObservations=1&format=csvdata`);
  const w = res ? sdmxCsvWerte(await res.text()).at(-1) : null;
  if (!w) throw new Error('keine Werte');
  return { ...w, quelle: 'Europäische Zentralbank' };
}

export async function ladeDollar(heute = new Date()) {
  const start = new Date(heute.getTime() - 372 * 86400000);
  const res = await holen(`${ENDPUNKTE.ezb}data/${SERIEN.eurUsd}?startPeriod=${isoTag(start)}&format=csvdata`);
  const v = res ? dollarVeraenderung(sdmxCsvWerte(await res.text())) : null;
  if (!v) throw new Error('keine Werte');
  return { ...v, quelle: 'Europäische Zentralbank' };
}

export async function ladeInflation() {
  try {
    const res = await holen(`${ENDPUNKTE.eurostat}${SERIEN.inflationEurostat}`);
    const w = res ? jsonStatLetzterWert(await res.json()) : null;
    if (w) return { ...w, quelle: 'Eurostat' };
  } catch { /* Ersatzquelle versuchen */ }
  const res = await holen(`${ENDPUNKTE.ezb}data/${SERIEN.inflationEzb}?lastNObservations=1&format=csvdata`);
  const w = res ? sdmxCsvWerte(await res.text()).at(-1) : null;
  if (!w) throw new Error('keine Werte');
  return { ...w, quelle: 'Europäische Zentralbank (Ersatz für Eurostat)' };
}

export async function ladeGleif(isin) {
  if (!/^[A-Z]{2}[A-Z0-9]{9}\d$/.test(isin)) throw new Error('ungültige ISIN');
  const res = await holen(`${ENDPUNKTE.gleif}lei-records?filter%5Bisin%5D=${encodeURIComponent(isin)}&page%5Bsize%5D=1`, { accept: 'application/vnd.api+json' });
  return res ? gleifEintrag(await res.json()) : null;
}
