// Oberfläche der ETF-Auswahl. Alle Nutzertexte über esc().
import { ETFS, quellen } from './etf-data.js';
import { pruefeEingaben, fehlendeKennzahlen, bewerte, szenarien, sparplan, realwert, status, MIN_ANGEBOTE, MAX_SRI_PROFIL, GEWICHTE, zahl } from './etf-calc.js';
import { ladeBund10, ladeEinlagezins, ladeDollar, ladeInflation, ladeGleif } from './marktdaten.js';

const SPEICHER = 'etf-auswahl-v1';
const FELDER = [
  { key: 'rendite1J', label: 'Wertentwicklung 1 Jahr (%)', hilfe: 'z. B. 8,4 oder -3,1' },
  { key: 'vola1J', label: 'Volatilität 1 Jahr (%)', hilfe: 'Schwankungsbreite' },
  { key: 'ter', label: 'Laufende Kosten TER (% p. a.)', hilfe: 'z. B. 0,20' },
  { key: 'sri', label: 'Risikoklasse SRI (1–7)', hilfe: 'aus dem Basisinformationsblatt' },
  { key: 'stand', label: 'Stand (Datum)', hilfe: '', typ: 'date' },
];
const NAMEN = { rendite1J: 'Wertentwicklung', vola1J: 'Volatilität', ter: 'TER', sri: 'Risikoklasse' };

const $ = (sel) => document.querySelector(sel);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const eur = (n) => n.toLocaleString('de-DE', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 });
const pz = (n, d = 2) => `${n.toLocaleString('de-DE', { minimumFractionDigits: d, maximumFractionDigits: d })} %`;

function laden() {
  try { return JSON.parse(localStorage.getItem(SPEICHER)) || { kennzahlen: {} }; } catch { return { kennzahlen: {} }; }
}
function speichern() {
  try { localStorage.setItem(SPEICHER, JSON.stringify(zustand)); } catch { /* Speicher nicht verfügbar */ }
}
let zustand = laden();
zustand.kennzahlen ||= {};
zustand.markt ||= {};

function askConfirm(text) {
  const d = $('#bestaetigen');
  d.querySelector('.b-text').textContent = text;
  return new Promise((resolve) => {
    d.addEventListener('close', () => resolve(d.returnValue === 'ok'), { once: true });
    d.showModal();
  });
}

function eingaben() {
  return { betrag: zahl($('#betrag').value), jahre: Number($('#jahre').value) };
}

function gleifZeile(isin) {
  const g = zustand.markt.gleif?.[isin];
  if (g === undefined) return '';
  if (g === null) return '<p class="hinweis">GLEIF: keine LEI-Zuordnung zu dieser ISIN gefunden.</p>';
  if (g.fehler) return `<p class="hinweis">GLEIF: ${esc(g.fehler)}</p>`;
  return `<p class="hinweis">Rechtsträger laut GLEIF: <strong>${esc(g.name)}</strong> (LEI ${esc(g.lei)}, ${esc(g.land)}, ${esc(g.kategorie)}, Status ${esc(g.status)})</p>`;
}

const datum = (p) => (/^\d{4}-\d{2}-\d{2}$/.test(p) ? new Date(p + 'T00:00:00Z').toLocaleDateString('de-DE', { timeZone: 'UTC' }) : p);
const markt = (key) => { const m = zustand.markt[key]; return m && !m.fehler ? m : null; };

function marktAnzeigen() {
  const m = zustand.markt;
  if (!m.geladenAm) { $('#markt').innerHTML = ''; return; }
  const zeile = (titel, key, text) => {
    const d = m[key];
    if (!d) return '';
    if (d.fehler) return `<li><strong>${esc(titel)}:</strong> <span class="fehler">nicht geladen (${esc(d.fehler)})</span></li>`;
    return `<li><strong>${esc(titel)}:</strong> ${text(d)} <span class="hinweis">– ${esc(d.quelle)}</span></li>`;
  };
  $('#markt').innerHTML = `<ul class="markt-liste">
    ${zeile('Rendite 10-jährige Bundesanleihen', 'bund10', (d) => `${pz(d.wert)} p. a. (Stand ${esc(datum(d.periode))})`)}
    ${zeile('EZB-Einlagezins', 'einlagezins', (d) => `${pz(d.wert)} p. a. (Stand ${esc(datum(d.periode))})`)}
    ${zeile('Inflation Deutschland (HVPI, Vorjahr)', 'inflation', (d) => `${pz(d.wert, 1)} (${esc(d.periode)})`)}
    ${zeile('US-Dollar gegenüber Euro', 'dollar', (d) => `${d.prozent > 0 ? '+' : ''}${pz(d.prozent, 1)} vom ${esc(datum(d.von))} bis ${esc(datum(d.bis))}${d.prozent < 0 ? ' – ein schwächerer Dollar mindert die Euro-Rendite von US-Aktien' : ''}`)}
  </ul>
  <p class="hinweis">Abgerufen am ${esc(new Date(m.geladenAm).toLocaleString('de-DE'))}.</p>`;
}

async function marktLaden() {
  const knopf = $('#markt-laden');
  knopf.disabled = true; knopf.textContent = 'Lädt …';
  const fehler = (e) => ({ fehler: e?.message || 'unbekannter Fehler' });
  const [bund10, einlagezins, inflation, dollar] = await Promise.allSettled([ladeBund10(), ladeEinlagezins(), ladeInflation(), ladeDollar()]);
  const gleif = {};
  for (const e of ETFS) { // nacheinander, um den Dienst zu schonen
    try { gleif[e.isin] = await ladeGleif(e.isin); } catch (err) { gleif[e.isin] = fehler(err); }
  }
  const wert = (r) => (r.status === 'fulfilled' ? r.value : fehler(r.reason));
  zustand.markt = { bund10: wert(bund10), einlagezins: wert(einlagezins), inflation: wert(inflation), dollar: wert(dollar), gleif, geladenAm: new Date().toISOString() };
  speichern();
  knopf.disabled = false; knopf.textContent = 'Aktuelle Daten neu laden';
  marktAnzeigen();
  $('#etf-liste').innerHTML = ETFS.map(etfKarte).join('');
  auswertung();
}

function etfKarte(e) {
  const k = zustand.kennzahlen[e.isin] || {};
  const fehlt = fehlendeKennzahlen(k);
  const sri = zahl(k.sri);
  const zuHoch = fehlt.length === 0 && sri > MAX_SRI_PROFIL;
  const badge = fehlt.length
    ? `<span class="badge badge-offen">Es fehlen: ${esc(fehlt.map((f) => NAMEN[f]).join(', '))}</span>`
    : zuHoch ? '<span class="badge badge-hoch">Risiko über deinem Profil</span>' : '<span class="badge badge-ok">Vollständig</span>';
  const felder = FELDER.map((f) => {
    const id = `${f.key}-${e.isin}`;
    return `<div class="feld"><label for="${id}">${esc(f.label)}</label>
      <input id="${id}" data-isin="${esc(e.isin)}" data-key="${f.key}" type="${f.typ || 'text'}" ${f.typ ? '' : 'inputmode="decimal"'} value="${esc(k[f.key] ?? '')}" ${f.hilfe ? `placeholder="${esc(f.hilfe)}"` : ''}></div>`;
  }).join('');
  const links = quellen(e.isin).map((q) => `<a href="${esc(q.url)}" target="_blank" rel="noopener noreferrer">${esc(q.titel)}<span class="sr-only"> (öffnet neues Fenster)</span></a>`).join('');
  return `<article class="etf-karte ${fehlt.length ? '' : zuHoch ? 'hoch' : 'ok'}" aria-labelledby="t-${esc(e.isin)}">
    <h3 id="t-${esc(e.isin)}">${esc(e.name)}</h3>
    <p class="etf-meta">ISIN ${esc(e.isin)} · ${esc(e.klasse)} · ${esc(e.region)} · Index: ${esc(e.index)}</p>
    <p data-badge="${esc(e.isin)}">${badge}</p>
    <div class="kennzahlen">${felder}</div>
    ${gleifZeile(e.isin)}
    <p class="quellen">Kostenlose Quellen: ${links}</p>
  </article>`;
}

function auswertung() {
  const { betrag, jahre } = eingaben();
  const st = status(ETFS, zustand.kennzahlen);
  const banner = $('#status');
  banner.classList.toggle('status-erledigt', st.stufe === 'erledigt');
  banner.textContent = st.stufe === 'erledigt'
    ? `Erledigt: ${st.passend} ETFs mit vollständigen Kennzahlen passen zu deinem Risikoprofil (mindestens ${MIN_ANGEBOTE} nötig). Die Auswertung ist vollständig.`
    : `Rückfrage: Bisher ${st.passend} von mindestens ${MIN_ANGEBOTE} passenden ETFs mit vollständigen Kennzahlen. Bitte bei ${st.fehlen === 1 ? 'einem weiteren ETF' : `${st.fehlen} weiteren ETFs`} die Werte eintragen.`;

  const rf = markt('einlagezins')?.wert;
  const infl = markt('inflation')?.wert;
  const bund = markt('bund10')?.wert;
  const liste = bewerte(ETFS, zustand.kennzahlen, { risikofrei: rf ?? 0 });
  if (liste.length === 0) {
    $('#auswertung').innerHTML = '<p>Noch keine Auswertung. Trage unten für mindestens fünf ETFs die Kennzahlen des letzten Jahres ein.</p>';
    return;
  }
  const zeilen = liste.map((e, i) => {
    const sz = szenarien(betrag, jahre, e.ter);
    return `<tr>
      <td>${i + 1}</td>
      <td><strong>${esc(e.name)}</strong><br><span class="hinweis">${esc(e.klasse)} · ${esc(e.region)}${e.stand ? ` · Stand ${esc(new Date(e.stand + 'T00:00:00Z').toLocaleDateString('de-DE', { timeZone: 'UTC' }))}` : ''}</span>
        ${e.passtZumProfil ? '' : '<br><span class="badge badge-hoch">Risiko über deinem Profil</span>'}</td>
      <td class="zahl">${e.punkte}<meter class="balken" min="0" max="100" value="${e.punkte}" aria-hidden="true"></meter></td>
      <td class="zahl">${pz(e.rendite1J, 1)}</td>
      <td class="zahl">${pz(e.vola1J, 1)}</td>
      <td class="zahl">${e.renditeJeRisiko === null ? '–' : e.renditeJeRisiko.toLocaleString('de-DE')}</td>
      <td class="zahl">${pz(e.ter)}</td>
      <td class="zahl">${e.sri}</td>
      <td class="zahl">${sz.map((s) => `<span class="hinweis">${s.renditePa} %:</span> ${eur(s.endwert)}${infl !== undefined ? ` <span class="hinweis">(heute ${eur(realwert(s.endwert, infl, jahre))})</span>` : ''}`).join('<br>')}</td>
    </tr>`;
  }).join('');
  const eingezahlt = szenarien(betrag, jahre)[0].eingezahlt;
  $('#auswertung').innerHTML = `
    <p>Sparplan: <strong>${eur(betrag)}</strong> pro Monat über <strong>${jahre} Jahre</strong> = <strong>${eur(eingezahlt)}</strong> eingezahlt.</p>
    ${bund !== undefined ? `<p>Vergleich sichere Anlage: Zur aktuellen Rendite 10-jähriger Bundesanleihen (${pz(bund)}) ergäbe der Sparplan etwa <strong>${eur(sparplan(betrag, jahre, bund).endwert)}</strong>. Ein ETF sollte diesen Wert auf Dauer deutlich übertreffen, um sein höheres Schwankungsrisiko auszugleichen.</p>` : ''}
    <div class="tabelle-scroll" tabindex="0" role="region" aria-label="Rangfolge der ETFs">
    <table class="rang">
      <caption class="sr-only">Rangfolge der ETFs nach Punkten</caption>
      <thead><tr><th scope="col">Rang</th><th scope="col">ETF</th><th scope="col" class="zahl">Punkte (0–100)</th><th scope="col" class="zahl">Wert­entw. 1 J.</th><th scope="col" class="zahl">Volatilität</th><th scope="col" class="zahl">${rf !== undefined ? `Rendite je Risiko (über ${pz(rf)} Einlagezins)` : 'Rendite je Risiko'}</th><th scope="col" class="zahl">TER</th><th scope="col" class="zahl">SRI</th><th scope="col" class="zahl">Endwert nach ${jahre} J. je Szenario</th></tr></thead>
      <tbody>${zeilen}</tbody>
    </table></div>
    <p class="hinweis">So entstehen die Punkte (relativ zu den anderen eingetragenen ETFs): Wertentwicklung ${GEWICHTE.rendite}, niedrige Schwankung ${GEWICHTE.risiko}, niedrige Kosten ${GEWICHTE.kosten}, niedrige Risikoklasse ${GEWICHTE.risikoklasse}.
      ETFs mit Risikoklasse über ${MAX_SRI_PROFIL} stehen am Ende. Endwerte: Szenario-Rendite abzüglich TER, vor Steuern – keine Prognose.${infl !== undefined ? ` „Heute“ = Kaufkraft bei gleichbleibender Inflation von ${pz(infl, 1)} p. a.` : ''}</p>`;
}

function anzeigen() {
  const fehler = pruefeEingaben(eingaben());
  $('#eingabe-fehler').innerHTML = fehler.map((f) => `<p class="fehler">${esc(f)}</p>`).join('');
  if (fehler.length) { $('#betrag').focus(); return false; }
  $('#ergebnis').hidden = false;
  $('#etf-liste').innerHTML = ETFS.map(etfKarte).join('');
  auswertung();
  return true;
}

$('#eingaben').addEventListener('submit', (ev) => {
  ev.preventDefault();
  zustand.betrag = $('#betrag').value; zustand.jahre = $('#jahre').value; speichern();
  if (anzeigen()) $('#h-auswertung').scrollIntoView({ block: 'start' });
});

$('#etf-liste').addEventListener('change', (ev) => {
  const el = ev.target.closest('input[data-isin]');
  if (!el) return;
  const { isin, key } = el.dataset;
  (zustand.kennzahlen[isin] ||= {})[key] = el.value.trim();
  speichern();
  const karte = el.closest('.etf-karte');
  const neu = document.createElement('div');
  neu.innerHTML = etfKarte(ETFS.find((e) => e.isin === isin));
  karte.className = neu.firstElementChild.className;
  karte.querySelector(`[data-badge]`).innerHTML = neu.querySelector('[data-badge]').innerHTML;
  auswertung();
});

$('#markt-laden').addEventListener('click', marktLaden);

$('#loeschen').addEventListener('click', async () => {
  if (!(await askConfirm('Alle eingetragenen Kennzahlen löschen?'))) return;
  zustand = { kennzahlen: {}, markt: zustand.markt, betrag: zustand.betrag, jahre: zustand.jahre };
  speichern();
  anzeigen();
});

if (zustand.betrag) $('#betrag').value = zustand.betrag;
if (zustand.jahre) $('#jahre').value = zustand.jahre;
if (Object.keys(zustand.kennzahlen).length || zustand.markt.geladenAm) { anzeigen(); marktAnzeigen(); }
