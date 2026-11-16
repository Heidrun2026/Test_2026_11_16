// Reine Rechenlogik für die ETF-Auswahl. Keine Oberfläche, kein Speicher.
// Hinweis: Szenario-Rechnungen, keine Prognosen und keine Anlageberatung.

export const MIN_ANGEBOTE = 5;            // Regel: Auswertung erst ab 5 vollständigen ETFs
export const MAX_SRI_PROFIL = 4;          // Risikoprofil „mittel bis niedrig“: Risikoklasse (SRI) 1–4
export const SZENARIEN_PA = [2, 5, 7];    // Jahresrenditen in %, nur zur Veranschaulichung
export const GEWICHTE = { rendite: 40, risiko: 35, kosten: 15, risikoklasse: 10 };

const PFLICHT = ['rendite1J', 'vola1J', 'ter', 'sri'];

/** Prüft die Pflichtangaben Betrag (EUR/Monat) und Zeitraum (Jahre). */
export function pruefeEingaben({ betrag, jahre }) {
  const fehler = [];
  const b = Number(betrag);
  const j = Number(jahre);
  if (!Number.isFinite(b) || b <= 0) fehler.push('Bitte einen monatlichen Betrag größer 0 angeben.');
  else if (b > 100000) fehler.push('Der monatliche Betrag ist unplausibel hoch (max. 100.000 EUR).');
  else if (Math.round(b * 100) !== b * 100) fehler.push('Der Betrag darf höchstens zwei Nachkommastellen haben.');
  if (!Number.isInteger(j) || j < 1 || j > 50) fehler.push('Bitte einen Zeitraum von 1 bis 50 ganzen Jahren angeben.');
  return fehler;
}

/** Wandelt eine Eingabe wie „7,5“ oder „7.5“ in eine Zahl um; leer/ungültig → null. */
export function zahl(wert) {
  if (wert === null || wert === undefined) return null;
  const s = String(wert).trim().replace('%', '').replace(',', '.');
  if (s === '') return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

/** Welche Kennzahlen fehlen oder sind unplausibel? */
export function fehlendeKennzahlen(k = {}) {
  const fehlt = [];
  const r = zahl(k.rendite1J), v = zahl(k.vola1J), t = zahl(k.ter), s = zahl(k.sri);
  if (r === null || r < -100 || r > 500) fehlt.push('rendite1J');
  if (v === null || v < 0 || v > 200) fehlt.push('vola1J');
  if (t === null || t < 0 || t > 5) fehlt.push('ter');
  if (s === null || !Number.isInteger(s) || s < 1 || s > 7) fehlt.push('sri');
  return fehlt;
}

export const istVollstaendig = (k) => fehlendeKennzahlen(k).length === 0;

/** Normiert x zwischen min und max auf 0..1 (höher = besser, oder umgekehrt). */
function norm(x, min, max, hoeherBesser) {
  if (max === min) return 1;
  const n = (x - min) / (max - min);
  return hoeherBesser ? n : 1 - n;
}

/**
 * Bewertet ETFs mit vollständigen Kennzahlen.
 * Punkte 0–100 relativ zu den anderen erfassten ETFs:
 * Rendite 1 Jahr (hoch gut), Schwankung 1 Jahr (niedrig gut), Kosten TER (niedrig gut), Risikoklasse (niedrig gut).
 * @param {Array<{isin:string}>} etfs Stammdaten
 * @param {Record<string, object>} kennzahlen je ISIN
 */
export function bewerte(etfs, kennzahlen) {
  const kandidaten = etfs
    .filter((e) => istVollstaendig(kennzahlen[e.isin]))
    .map((e) => {
      const k = kennzahlen[e.isin];
      return { ...e, rendite1J: zahl(k.rendite1J), vola1J: zahl(k.vola1J), ter: zahl(k.ter), sri: zahl(k.sri), stand: k.stand || '' };
    });
  if (kandidaten.length === 0) return [];
  const spanne = (feld) => [Math.min(...kandidaten.map((k) => k[feld])), Math.max(...kandidaten.map((k) => k[feld]))];
  const [rMin, rMax] = spanne('rendite1J');
  const [vMin, vMax] = spanne('vola1J');
  const [tMin, tMax] = spanne('ter');
  return kandidaten
    .map((k) => {
      const punkte =
        GEWICHTE.rendite * norm(k.rendite1J, rMin, rMax, true) +
        GEWICHTE.risiko * norm(k.vola1J, vMin, vMax, false) +
        GEWICHTE.kosten * norm(k.ter, tMin, tMax, false) +
        GEWICHTE.risikoklasse * ((7 - k.sri) / 6);
      return {
        ...k,
        punkte: Math.round(punkte),
        renditeJeRisiko: k.vola1J > 0 ? Math.round((k.rendite1J / k.vola1J) * 100) / 100 : null,
        passtZumProfil: k.sri <= MAX_SRI_PROFIL,
      };
    })
    .sort((a, b) => Number(b.passtZumProfil) - Number(a.passtZumProfil) || b.punkte - a.punkte || a.ter - b.ter);
}

/**
 * Endwert eines monatlichen Sparplans (Einzahlung jeweils zum Monatsanfang).
 * @param {number} betrag EUR pro Monat
 * @param {number} jahre Laufzeit
 * @param {number} renditePa Jahresrendite in % (nach Kosten)
 * @returns {{eingezahlt:number, endwert:number, ertrag:number}} in EUR, auf Cent gerundet
 */
export function sparplan(betrag, jahre, renditePa) {
  const monate = jahre * 12;
  const eingezahltCent = Math.round(betrag * 100) * monate;
  const rm = Math.pow(1 + renditePa / 100, 1 / 12) - 1;
  const endwertCent = rm === 0
    ? eingezahltCent
    : Math.round(betrag * 100) * ((Math.pow(1 + rm, monate) - 1) / rm) * (1 + rm);
  const e = Math.round(endwertCent);
  return { eingezahlt: eingezahltCent / 100, endwert: e / 100, ertrag: (e - eingezahltCent) / 100 };
}

/** Szenarien je ETF: Szenariorendite abzüglich laufender Kosten (TER). */
export function szenarien(betrag, jahre, ter = 0) {
  return SZENARIEN_PA.map((p) => ({ renditePa: p, ...sparplan(betrag, jahre, p - ter) }));
}

/** Gesamtstatus nach der Regel „vollständig, wenn mindestens 5 Angebote vorliegen“. */
export function status(etfs, kennzahlen) {
  const vollstaendig = etfs.filter((e) => istVollstaendig(kennzahlen[e.isin]));
  const passend = vollstaendig.filter((e) => zahl(kennzahlen[e.isin].sri) <= MAX_SRI_PROFIL);
  if (passend.length >= MIN_ANGEBOTE) return { stufe: 'erledigt', vollstaendig: vollstaendig.length, passend: passend.length };
  return { stufe: 'rueckfrage', vollstaendig: vollstaendig.length, passend: passend.length, fehlen: MIN_ANGEBOTE - passend.length };
}
