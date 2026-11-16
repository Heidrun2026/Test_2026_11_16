// Oberfläche des Prototyps "Kapazitätsplanung Team".
// Rendert Ansichten als HTML-Strings; alle Nutzertexte laufen durch esc().

import {
  planningMonths, monthLabel, shiftMonth, holidaySet, berlinHolidays, workingDays, ferienWorkdays,
  memberMonth, teamMonth, monthStatus, grunddatenFor, formatProzent, formatTage,
} from './calc.js';
import { load, save, reset, seedState, newId, validateImport } from './store.js';

document.documentElement.lang = 'de'; // falls die Seite ohne eigenes <html lang> eingebettet wird
const LEAD = 'teamleitung';
const today = new Date();
const MONTHS = planningMonths(new Date(Date.UTC(today.getFullYear(), today.getMonth(), 1)), 7);
const NEXT = MONTHS[1];

let state = load();
const ui = {
  view: 'uebersicht',
  user: readPref('user') || LEAD,
  monat: NEXT,
  grundMember: null,
  filter: 'alle',
  form: { memberId: null, projektId: '', tage: '', notiz: '' },
};

function readPref(k) {
  try { return localStorage.getItem(`kapa-pref-${k}`); } catch { return null; }
}
function writePref(k, v) {
  try { localStorage.setItem(`kapa-pref-${k}`, v); } catch { /* egal */ }
}

// ---------- Hilfen ----------
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const holidays = () => holidaySet(
  [...new Set(MONTHS.map((m) => Number(m.slice(0, 4))))],
  state.zusatzFrei,
);
const isLead = () => ui.user === LEAD;
const member = (id) => state.mitglieder.find((m) => m.id === id);
const projekt = (id) => state.projekte.find((p) => p.id === id);
const nameOf = (id) => (id === LEAD ? 'Teamleitung' : member(id)?.name ?? '(entfernt)');
const canEditBooking = (b) => isLead() || b.geplantVon === ui.user;
const canEditGrunddaten = (memberId) => isLead() || memberId === ui.user;

const STATUS_TEXT = { ok: 'im Rahmen', pruefen: 'Rückfrage', ueberlast: 'Überlast' };
const STATUS_ICON = { ok: '✓', pruefen: '!', ueberlast: '▲' };

function badge(r) {
  return `<span class="badge badge-${r.status}"><span aria-hidden="true">${STATUS_ICON[r.status]}</span> ${formatProzent(r.auslastung)}<span class="sr-only">, ${STATUS_TEXT[r.status]}</span></span>`;
}

function monthOptions(selected) {
  return MONTHS.map((m) => `<option value="${m}" ${m === selected ? 'selected' : ''}>${esc(monthLabel(m))}</option>`).join('');
}

function memberOptions(selected, { withLead = false } = {}) {
  const groups = {};
  for (const m of state.mitglieder) (groups[m.rolle] ??= []).push(m);
  let html = withLead ? `<option value="${LEAD}" ${selected === LEAD ? 'selected' : ''}>Teamleitung</option>` : '';
  for (const [rolle, list] of Object.entries(groups)) {
    html += `<optgroup label="${esc(rolle)}">${list.map((m) => `<option value="${esc(m.id)}" ${m.id === selected ? 'selected' : ''}>${esc(m.name)}</option>`).join('')}</optgroup>`;
  }
  return html;
}

function announce(text) {
  const el = document.getElementById('status-meldung');
  el.textContent = '';
  setTimeout(() => { el.textContent = text; }, 30);
}

function commit(text = 'Gespeichert.') {
  const ok = save(state);
  render();
  announce(ok ? text : 'Achtung: Speichern im Browser nicht möglich. Änderungen gehen beim Neuladen verloren.');
}

// ---------- Ansicht: Übersicht ----------
function viewUebersicht() {
  const hol = holidays();
  const st = monthStatus(state, NEXT, hol);
  const groups = {};
  for (const m of state.mitglieder) (groups[m.rolle] ??= []).push(m);

  const head = MONTHS.map((k) => {
    const fer = ferienWorkdays(k, hol, state.ferien);
    return `<th scope="col"><span class="m-name">${esc(monthLabel(k, 'short'))}</span>
      <span class="m-info">${workingDays(k, hol)} AT${fer ? ` · ${fer} Ferientage` : ''}</span></th>`;
  }).join('');

  let body = '';
  for (const [rolle, list] of Object.entries(groups)) {
    body += `<tr class="gruppe"><th scope="rowgroup" colspan="${MONTHS.length + 1}">${esc(rolle)}</th></tr>`;
    for (const m of list) {
      body += `<tr class="${m.id === ui.user ? 'ich' : ''}"><th scope="row">${esc(m.name)}${m.id === ui.user ? ' <span class="hinweis">(Sie)</span>' : ''}</th>`;
      for (const k of MONTHS) {
        const r = memberMonth(state, m, k, hol);
        body += `<td><button type="button" class="zelle zelle-${r.status}" data-action="detail" data-member="${esc(m.id)}" data-monat="${k}"
          aria-label="${esc(m.name)}, ${esc(monthLabel(k))}: ${formatProzent(r.auslastung)}, ${STATUS_TEXT[r.status]}, frei ${formatTage(r.frei)}. Details öffnen">
          <span class="z-wert"><span aria-hidden="true">${STATUS_ICON[r.status]}</span> ${formatProzent(r.auslastung)}</span>
          <span class="z-frei">frei ${formatTage(r.frei)}</span></button></td>`;
      }
      body += '</tr>';
    }
  }
  const foot = MONTHS.map((k) => {
    const t = teamMonth(state, k, hol);
    return `<td><span class="z-wert">${formatProzent(t.auslastung)}</span><span class="z-frei">${formatTage(t.belegt)} von ${formatTage(t.verfuegbar)}</span></td>`;
  }).join('');

  return `
  <h1>Auslastung des Teams</h1>
  <p class="lead">Aktueller Monat und die nächsten sechs Monate. Grundlage sind Arbeitstage abzüglich Feiertage und geplanter Abwesenheiten, belegt durch Linientätigkeit, Organisation und geplante Projekt- und Themencluster-Tage.</p>

  <section aria-labelledby="h-naechster" class="karten">
    <h2 id="h-naechster" class="sr-only">Stand für ${esc(monthLabel(NEXT))}</h2>
    <div class="karte"><span class="k-titel">Planung für ${esc(monthLabel(NEXT))}</span>
      <span class="k-wert">${st.gemeldet} / ${st.gesamt}</span><span class="k-text">haben ihre Planung gemeldet</span></div>
    <div class="karte karte-pruefen"><span class="k-titel">Rückfragen (ab ${state.einstellungen.schwellen.rueckfrage} %)</span>
      <span class="k-wert">${st.rueckfragen.length}</span><span class="k-text">im Abgleichstermin klären</span></div>
    <div class="karte karte-ueberlast"><span class="k-titel">Überlastungen (über ${state.einstellungen.schwellen.ueberlast} %)</span>
      <span class="k-wert">${st.ueberlast.length}</span><span class="k-text">Entscheidung der Teamleitung</span></div>
    <div class="karte ${st.fertig ? 'karte-ok' : ''}"><span class="k-titel">Status</span>
      <span class="k-wert">${st.fertig ? 'Fertig' : 'Offen'}</span><span class="k-text">${st.fertig ? 'alle gemeldet, niemand über 100 %' : 'noch nicht abgeschlossen'}</span></div>
  </section>
  <p><button type="button" class="btn" data-action="goto" data-view="abstimmung">Zur Abstimmung für ${esc(monthLabel(NEXT))}</button></p>

  <div class="legende" aria-label="Legende">
    <span class="badge badge-ok"><span aria-hidden="true">✓</span> unter ${state.einstellungen.schwellen.rueckfrage} %</span>
    <span class="badge badge-pruefen"><span aria-hidden="true">!</span> ${state.einstellungen.schwellen.rueckfrage}–${state.einstellungen.schwellen.ueberlast} %: Rückfrage</span>
    <span class="badge badge-ueberlast"><span aria-hidden="true">▲</span> über ${state.einstellungen.schwellen.ueberlast} %: Entscheidung</span>
    <span class="hinweis">AT = Arbeitstage, PT = Personentage</span>
  </div>

  <div class="tabelle-scroll" tabindex="0" role="region" aria-labelledby="cap-uebersicht">
    <table class="matrix">
      <caption id="cap-uebersicht">Auslastung je Teammitglied und Monat (Zelle anklicken für Details)</caption>
      <thead><tr><th scope="col">Teammitglied</th>${head}</tr></thead>
      <tbody>${body}</tbody>
      <tfoot><tr><th scope="row">Team gesamt</th>${foot}</tr></tfoot>
    </table>
  </div>`;
}

function detailHtml(memberId, k) {
  const m = member(memberId);
  const r = memberMonth(state, m, k, holidays());
  const ents = state.entscheidungen.filter((e) => e.memberId === memberId && e.monat === k);
  const rows = r.buchungen.map((b) => `<tr><td>${esc(projekt(b.projektId)?.name ?? '(entfernt)')}</td><td class="zahl">${formatTage(Number(b.tage))}</td><td>${esc(nameOf(b.geplantVon))}</td><td>${esc(b.notiz)}</td></tr>`).join('');
  return `
    <h2 id="detail-titel">${esc(m.name)} – ${esc(monthLabel(k))}</h2>
    <p>${badge(r)}</p>
    <dl class="aufstellung">
      <dt>Arbeitstage</dt><dd>${r.arbeitstage}</dd>
      <dt>Soll nach Beschäftigungsgrad (${m.beschaeftigung} %)</dt><dd>${formatTage(r.soll)}</dd>
      <dt>Geplante Abwesenheit</dt><dd>− ${formatTage(r.abwesenheit)}</dd>
      <dt><strong>Verfügbar</strong></dt><dd><strong>${formatTage(r.verfuegbar)}</strong></dd>
      <dt>Linientätigkeit</dt><dd>${formatTage(r.linie)}</dd>
      <dt>Organisation</dt><dd>${formatTage(r.orga)}</dd>
      <dt>Projekte und Themencluster</dt><dd>${formatTage(r.projekte)}</dd>
      <dt><strong>Frei</strong></dt><dd><strong>${formatTage(r.frei)}</strong></dd>
    </dl>
    <h3>Geplante Aufwände</h3>
    ${rows ? `<div class="tabelle-scroll"><table><thead><tr><th scope="col">Projekt / Cluster</th><th scope="col">Tage</th><th scope="col">Geplant von</th><th scope="col">Notiz</th></tr></thead><tbody>${rows}</tbody></table></div>` : '<p class="leer">Noch nichts geplant.</p>'}
    ${ents.length ? `<h3>Entscheidungen</h3><ul class="entscheidungen">${ents.map((e) => `<li><strong>${esc(e.datum)}</strong>: ${esc(e.text)}</li>`).join('')}</ul>` : ''}
    <p class="aktionen"><button type="button" class="btn" data-action="plan-for" data-member="${esc(memberId)}" data-monat="${k}">Aufwand für ${esc(m.name)} planen</button>
    <button type="button" class="btn btn-zweit" data-action="close-detail">Schließen</button></p>`;
}

// ---------- Ansicht: Planung ----------
function viewPlanung() {
  const hol = holidays();
  const f = ui.form;
  if (!f.memberId) f.memberId = ui.user === LEAD ? state.mitglieder[0]?.id : ui.user;
  const m = member(f.memberId) ?? state.mitglieder[0];
  const r = m ? memberMonth(state, m, ui.monat, hol) : null;
  const neu = Number(String(f.tage).replace(',', '.')) || 0;
  const nachher = r && r.verfuegbar > 0 ? ((r.belegt + neu) / r.verfuegbar) * 100 : Infinity;
  const aktive = state.projekte.filter((p) => p.aktiv);

  let liste = state.buchungen.filter((b) => b.monat === ui.monat);
  if (ui.filter === 'von-mir') liste = liste.filter((b) => b.geplantVon === ui.user);
  if (ui.filter === 'fuer-mich') liste = liste.filter((b) => b.memberId === ui.user);
  liste.sort((a, b) => nameOf(a.memberId).localeCompare(nameOf(b.memberId)) || (projekt(a.projektId)?.name ?? '').localeCompare(projekt(b.projektId)?.name ?? ''));

  const rows = liste.map((b) => {
    const edit = canEditBooking(b);
    return `<tr>
      <td>${esc(nameOf(b.memberId))}</td>
      <td>${esc(projekt(b.projektId)?.name ?? '(entfernt)')}</td>
      <td class="zahl">${edit
        ? `<label class="sr-only" for="t-${esc(b.id)}">Tage</label><input id="t-${esc(b.id)}" class="eingabe-klein" type="number" min="0" step="0.5" value="${esc(b.tage)}" data-action="booking-tage" data-id="${esc(b.id)}">`
        : formatTage(Number(b.tage))}</td>
      <td>${esc(nameOf(b.geplantVon))}</td>
      <td>${esc(b.notiz)}</td>
      <td>${edit ? `<button type="button" class="btn btn-zweit btn-klein" data-action="booking-del" data-id="${esc(b.id)}">Löschen</button>` : '<span class="hinweis">nur Ersteller*in</span>'}</td>
    </tr>`;
  }).join('');

  return `
  <h1>Aufwand planen</h1>
  <p class="lead">Planen Sie Ihre eigene Kapazität und die Kapazität anderer Teammitglieder (z. B. Entwicklung) je Projekt oder Themencluster in Personentagen.</p>

  <div class="zweispaltig">
  <form class="formular" data-form="booking" novalidate>
    <fieldset>
      <legend>Neuer Eintrag</legend>
      <div class="feld"><label for="f-monat">Monat</label>
        <select id="f-monat" data-action="set-monat">${monthOptions(ui.monat)}</select></div>
      <div class="feld"><label for="f-member">Kapazität von</label>
        <select id="f-member" data-action="form-member">${memberOptions(f.memberId)}</select></div>
      <div class="feld"><label for="f-projekt">Projekt oder Themencluster</label>
        <select id="f-projekt" data-action="form-field" data-field="projektId" required>
          <option value="">Bitte wählen</option>
          ${['Projekt', 'Themencluster'].map((t) => `<optgroup label="${t}">${aktive.filter((p) => p.typ === t).map((p) => `<option value="${esc(p.id)}" ${p.id === f.projektId ? 'selected' : ''}>${esc(p.name)}</option>`).join('')}</optgroup>`).join('')}
        </select></div>
      <div class="feld"><label for="f-tage">Personentage</label>
        <input id="f-tage" type="number" min="0.5" step="0.5" inputmode="decimal" value="${esc(f.tage)}" data-action="form-field" data-field="tage" required aria-describedby="f-tage-hilfe">
        <span id="f-tage-hilfe" class="hilfe">In halben Tagen, z. B. 2,5</span></div>
      <div class="feld"><label for="f-notiz">Notiz (optional)</label>
        <input id="f-notiz" type="text" maxlength="200" value="${esc(f.notiz)}" data-action="form-field" data-field="notiz" aria-describedby="f-notiz-hilfe">
        <span id="f-notiz-hilfe" class="hilfe">Bitte keine Angaben zu Personen (z. B. Krankheit, Urlaubsgründe).</span></div>
      <p id="form-fehler" class="fehler" role="alert"></p>
      <button type="submit" class="btn">Eintrag hinzufügen</button>
    </fieldset>
  </form>

  ${r ? `<aside class="kapa-box" aria-labelledby="h-kapa" aria-live="polite">
    <h2 id="h-kapa">${esc(m.name)} im ${esc(monthLabel(ui.monat))}</h2>
    <dl class="aufstellung">
      <dt>Verfügbar</dt><dd>${formatTage(r.verfuegbar)}</dd>
      <dt>Bereits belegt</dt><dd>${formatTage(r.belegt)}</dd>
      <dt>Frei</dt><dd>${formatTage(r.frei)}</dd>
      <dt>Auslastung jetzt</dt><dd>${badge(r)}</dd>
      ${neu ? `<dt>Mit neuem Eintrag</dt><dd>${formatProzent(nachher)}</dd>` : ''}
    </dl>
    ${neu && nachher > state.einstellungen.schwellen.ueberlast ? '<p class="warnung">Mit diesem Eintrag wäre die Kapazität überschritten. Sie können trotzdem speichern; die Teamleitung entscheidet im Abgleich.</p>' : ''}
  </aside>` : ''}
  </div>

  <h2>Einträge im ${esc(monthLabel(ui.monat))}</h2>
  <div class="werkzeugleiste">
    <div class="feld feld-inline"><label for="f-filter">Anzeigen</label>
      <select id="f-filter" data-action="set-filter">
        <option value="alle" ${ui.filter === 'alle' ? 'selected' : ''}>Alle Einträge</option>
        <option value="von-mir" ${ui.filter === 'von-mir' ? 'selected' : ''}>Von mir geplant</option>
        <option value="fuer-mich" ${ui.filter === 'fuer-mich' ? 'selected' : ''}>Meine Kapazität</option>
      </select></div>
    ${ui.user !== LEAD ? `<button type="button" class="btn btn-zweit" data-action="copy-prev">Meine Einträge aus ${esc(monthLabel(shiftMonth(ui.monat, -1)))} übernehmen</button>` : ''}
  </div>
  ${rows ? `<div class="tabelle-scroll" tabindex="0" role="region" aria-label="Einträge"><table>
    <thead><tr><th scope="col">Kapazität von</th><th scope="col">Projekt / Cluster</th><th scope="col">Tage</th><th scope="col">Geplant von</th><th scope="col">Notiz</th><th scope="col">Aktion</th></tr></thead>
    <tbody>${rows}</tbody></table></div>` : '<p class="leer">Für diese Auswahl gibt es noch keine Einträge.</p>'}`;
}

// ---------- Ansicht: Grunddaten ----------
function viewGrunddaten() {
  const hol = holidays();
  if (!ui.grundMember) ui.grundMember = ui.user === LEAD ? state.mitglieder[0]?.id : ui.user;
  const m = member(ui.grundMember) ?? state.mitglieder[0];
  if (!m) return '<h1>Grunddaten</h1><p class="leer">Noch keine Teammitglieder angelegt.</p>';
  const edit = canEditGrunddaten(m.id);
  const rows = MONTHS.map((k) => {
    const g = grunddatenFor(state, m, k);
    const r = memberMonth(state, m, k, hol);
    const inp = (field, val, label, max) => edit
      ? `<label class="sr-only" for="g-${field}-${k}">${label} ${esc(monthLabel(k))}</label><input id="g-${field}-${k}" class="eingabe-klein" type="number" min="0" ${max ? `max="${max}"` : ''} step="0.5" value="${val}" data-action="grund" data-field="${field}" data-monat="${k}">`
      : esc(val);
    return `<tr><th scope="row">${esc(monthLabel(k))}</th><td class="zahl">${r.arbeitstage}</td>
      <td>${inp('abwesenheit', g.abwesenheit, 'Abwesenheit in Tagen', r.arbeitstage)}</td>
      <td>${inp('linie', g.linie, 'Linientätigkeit in Prozent', 100)}</td>
      <td>${inp('orga', g.orga, 'Organisation in Prozent', 100)}</td>
      <td class="zahl">${formatTage(r.verfuegbar)}</td>
      <td class="zahl">${formatTage(Math.round((r.verfuegbar - r.linie - r.orga) * 10) / 10)}</td></tr>`;
  }).join('');
  return `
  <h1>Grunddaten pflegen</h1>
  <p class="lead">Geplante Abwesenheiten (z. B. Urlaub, Fortbildung) in Arbeitstagen sowie die Anteile für Linientätigkeit und Organisation. Gründe für Abwesenheiten werden bewusst nicht erfasst.</p>
  <div class="feld feld-inline"><label for="g-member">Teammitglied</label>
    <select id="g-member" data-action="grund-member">${memberOptions(m.id)}</select></div>
  ${edit ? '' : '<p class="hinweis-box">Sie können die Grunddaten anderer Teammitglieder ansehen, aber nicht ändern.</p>'}
  <p class="hinweis">Beschäftigungsgrad: ${m.beschaeftigung} %. Standardwerte Linie ${m.linie} % und Organisation ${m.orga} % gelten, solange für einen Monat nichts anderes eingetragen ist.</p>
  <div class="tabelle-scroll" tabindex="0" role="region" aria-label="Grunddaten je Monat"><table>
    <thead><tr><th scope="col">Monat</th><th scope="col">Arbeitstage</th><th scope="col">Abwesenheit (Tage)</th><th scope="col">Linie (%)</th><th scope="col">Organisation (%)</th><th scope="col">Verfügbar</th><th scope="col">Für Projekte</th></tr></thead>
    <tbody>${rows}</tbody></table></div>`;
}

// ---------- Ansicht: Abstimmung ----------
function viewAbstimmung() {
  const hol = holidays();
  const k = ui.monat;
  const st = monthStatus(state, k, hol);
  const meld = state.meldungen[k] ?? {};
  const rows = state.mitglieder.map((m) => {
    const r = memberMonth(state, m, k, hol);
    const own = m.id === ui.user;
    return `<tr><th scope="row">${esc(m.name)}</th>
      <td><input type="checkbox" id="meld-${esc(m.id)}" ${meld[m.id] ? 'checked' : ''} ${own ? '' : 'disabled'} data-action="meldung" data-member="${esc(m.id)}">
        <label for="meld-${esc(m.id)}">${meld[m.id] ? 'gemeldet' : 'offen'}</label></td>
      <td class="zahl">${formatTage(r.verfuegbar)}</td><td class="zahl">${formatTage(r.belegt)}</td><td>${badge(r)}</td></tr>`;
  }).join('');

  const fall = (z) => {
    const ents = state.entscheidungen.filter((e) => e.memberId === z.member.id && e.monat === k);
    const proj = z.buchungen.map((b) => `<li>${esc(projekt(b.projektId)?.name ?? '(entfernt)')}: ${formatTage(Number(b.tage))} <span class="hinweis">(geplant von ${esc(nameOf(b.geplantVon))})</span></li>`).join('');
    return `<article class="fall fall-${z.status}">
      <h4>${esc(z.member.name)} ${badge(z)}</h4>
      <p>Verfügbar ${formatTage(z.verfuegbar)}, belegt ${formatTage(z.belegt)} (davon Linie ${formatTage(z.linie)}, Organisation ${formatTage(z.orga)}).</p>
      ${proj ? `<ul>${proj}</ul>` : ''}
      ${ents.length ? `<p><strong>Festgehaltene Entscheidungen:</strong></p><ul class="entscheidungen">${ents.map((e) => `<li><strong>${esc(e.datum)}</strong>: ${esc(e.text)}</li>`).join('')}</ul>` : ''}
      ${isLead() ? `<form data-form="entscheidung" data-member="${esc(z.member.id)}">
        <label for="e-${esc(z.member.id)}">Entscheidung festhalten</label>
        <textarea id="e-${esc(z.member.id)}" rows="2" maxlength="500" required placeholder="z. B. Projekt Beta um 4 PT in den Folgemonat verschieben – Umplanung durch Ersteller*in"></textarea>
        <button type="submit" class="btn">Entscheidung speichern</button></form>`
        : '<p class="hinweis">Die Entscheidung trifft die Teamleitung im Abgleichstermin.</p>'}
    </article>`;
  };

  return `
  <h1>Abstimmung</h1>
  <div class="feld feld-inline"><label for="a-monat">Monat</label>
    <select id="a-monat" data-action="set-monat">${monthOptions(k)}</select></div>

  <div class="status-banner ${st.fertig ? 'status-fertig' : ''}" role="status">
    ${st.fertig
      ? `<strong>Fertig:</strong> Alle haben gemeldet, niemand liegt über ${state.einstellungen.schwellen.ueberlast} %.`
      : `<strong>Noch offen:</strong> ${st.gemeldet} von ${st.gesamt} haben gemeldet${st.ueberlast.length ? `, ${st.ueberlast.length} Überlastung(en)` : ''}${st.rueckfragen.length ? `, ${st.rueckfragen.length} Rückfrage(n)` : ''}.`}
  </div>

  <h2>1. Meldungen der Teammitglieder</h2>
  <p class="hinweis">Jedes Teammitglied bestätigt hier, dass es seine Planung (für sich und für andere) gepflegt hat.</p>
  <div class="tabelle-scroll" tabindex="0" role="region" aria-label="Meldungen"><table>
    <thead><tr><th scope="col">Teammitglied</th><th scope="col">Planung gepflegt</th><th scope="col">Verfügbar</th><th scope="col">Belegt</th><th scope="col">Auslastung</th></tr></thead>
    <tbody>${rows}</tbody></table></div>

  <h2>2. Abgleich und Entscheidung</h2>
  <p class="hinweis-box">Die Anwendung verschiebt keine Aufwände automatisch. Nach einer Entscheidung passen die jeweiligen Ersteller*innen ihre Einträge selbst unter „Planen“ an.</p>
  <h3>Überlastungen über ${state.einstellungen.schwellen.ueberlast} % (Entscheidung erforderlich)</h3>
  ${st.ueberlast.length ? st.ueberlast.map(fall).join('') : '<p class="leer">Keine Überlastungen.</p>'}
  <h3>Rückfragen ab ${state.einstellungen.schwellen.rueckfrage} %</h3>
  ${st.rueckfragen.length ? st.rueckfragen.map(fall).join('') : '<p class="leer">Keine Rückfragen.</p>'}`;
}

// ---------- Ansicht: Einrichtung ----------
function viewEinrichtung() {
  const years = [...new Set(MONTHS.map((m) => Number(m.slice(0, 4))))];
  const feiertage = years.flatMap(berlinHolidays).filter((h) => MONTHS.includes(h.date.slice(0, 7)));
  const fmt = (iso) => new Intl.DateTimeFormat('de-DE', { dateStyle: 'medium', timeZone: 'UTC' }).format(new Date(`${iso}T00:00:00Z`));
  const s = state.einstellungen.schwellen;

  return `
  <h1>Einrichtung</h1>
  ${isLead() ? '' : '<p class="hinweis-box">Die Grundeinrichtung pflegt die Teamleitung. Sie können die Werte ansehen.</p>'}
  <fieldset class="block" ${isLead() ? '' : 'disabled'}>
    <legend>Schwellenwerte</legend>
    <div class="reihe">
      <div class="feld"><label for="s-rf">Rückfrage ab (%)</label><input id="s-rf" type="number" min="1" max="200" value="${s.rueckfrage}" data-action="schwelle" data-field="rueckfrage"></div>
      <div class="feld"><label for="s-ul">Überlast über (%)</label><input id="s-ul" type="number" min="1" max="200" value="${s.ueberlast}" data-action="schwelle" data-field="ueberlast"></div>
    </div>
  </fieldset>

  <fieldset class="block" ${isLead() ? '' : 'disabled'}>
    <legend>Feiertage (Berlin, automatisch) und zusätzliche freie Tage</legend>
    <ul class="liste-kompakt">${feiertage.map((h) => `<li>${fmt(h.date)}: ${esc(h.name)}</li>`).join('')}</ul>
    <p class="hinweis">Feiertage werden nach den gesetzlichen Regeln für Berlin berechnet. Bitte bei Bedarf gegen den offiziellen Kalender prüfen.</p>
    ${state.zusatzFrei.length ? `<ul class="liste-kompakt">${state.zusatzFrei.map((z) => `<li>${fmt(z.date)}: ${esc(z.name)} <button type="button" class="btn btn-zweit btn-klein" data-action="zusatz-del" data-date="${esc(z.date)}">Entfernen</button></li>`).join('')}</ul>` : ''}
    <form data-form="zusatz" class="reihe">
      <div class="feld"><label for="z-date">Zusätzlicher freier Tag</label><input id="z-date" type="date" required></div>
      <div class="feld"><label for="z-name">Bezeichnung</label><input id="z-name" type="text" maxlength="60" placeholder="z. B. Heiligabend" required></div>
      <button type="submit" class="btn">Hinzufügen</button>
    </form>
  </fieldset>

  <fieldset class="block" ${isLead() ? '' : 'disabled'}>
    <legend>Schulferien (Hinweis in der Übersicht)</legend>
    <p class="hinweis">Ferien verringern die Kapazität nicht automatisch; sie werden als Hinweis angezeigt, weil in dieser Zeit häufiger Urlaub geplant wird. Termine bitte aus dem offiziellen Ferienkalender übernehmen.</p>
    ${state.ferien.length ? `<ul class="liste-kompakt">${state.ferien.map((f) => `<li>${esc(f.name)}: ${fmt(f.von)} – ${fmt(f.bis)} <button type="button" class="btn btn-zweit btn-klein" data-action="ferien-del" data-id="${esc(f.id)}">Entfernen</button></li>`).join('')}</ul>` : '<p class="leer">Noch keine Ferien eingetragen.</p>'}
    <form data-form="ferien" class="reihe">
      <div class="feld"><label for="fe-name">Bezeichnung</label><input id="fe-name" type="text" maxlength="60" placeholder="z. B. Winterferien" required></div>
      <div class="feld"><label for="fe-von">Von</label><input id="fe-von" type="date" required></div>
      <div class="feld"><label for="fe-bis">Bis</label><input id="fe-bis" type="date" required></div>
      <button type="submit" class="btn">Hinzufügen</button>
    </form>
  </fieldset>

  <fieldset class="block" ${isLead() ? '' : 'disabled'}>
    <legend>Team</legend>
    <div class="tabelle-scroll" tabindex="0" role="region" aria-label="Team"><table>
      <thead><tr><th scope="col">Name</th><th scope="col">Rolle</th><th scope="col">Beschäftigung (%)</th><th scope="col">Linie (%)</th><th scope="col">Organisation (%)</th><th scope="col">Aktion</th></tr></thead>
      <tbody>${state.mitglieder.map((m) => `<tr>
        <td><label class="sr-only" for="tm-n-${esc(m.id)}">Name</label><input id="tm-n-${esc(m.id)}" type="text" maxlength="60" value="${esc(m.name)}" data-action="mitglied" data-id="${esc(m.id)}" data-field="name"></td>
        <td><label class="sr-only" for="tm-r-${esc(m.id)}">Rolle</label><select id="tm-r-${esc(m.id)}" data-action="mitglied" data-id="${esc(m.id)}" data-field="rolle">
          ${['Anwendungsberatung', 'Entwicklung'].map((r) => `<option ${r === m.rolle ? 'selected' : ''}>${r}</option>`).join('')}</select></td>
        ${['beschaeftigung', 'linie', 'orga'].map((f) => `<td><label class="sr-only" for="tm-${f}-${esc(m.id)}">${f}</label><input id="tm-${f}-${esc(m.id)}" class="eingabe-klein" type="number" min="0" max="100" step="5" value="${esc(m[f])}" data-action="mitglied" data-id="${esc(m.id)}" data-field="${f}"></td>`).join('')}
        <td><button type="button" class="btn btn-zweit btn-klein" data-action="mitglied-del" data-id="${esc(m.id)}">Entfernen</button></td></tr>`).join('')}</tbody></table></div>
    <p><button type="button" class="btn btn-zweit" data-action="mitglied-add">Teammitglied hinzufügen</button></p>
  </fieldset>

  <fieldset class="block" ${isLead() ? '' : 'disabled'}>
    <legend>Projekte und Themencluster</legend>
    <div class="tabelle-scroll" tabindex="0" role="region" aria-label="Projekte"><table>
      <thead><tr><th scope="col">Name</th><th scope="col">Art</th><th scope="col">Aktiv</th></tr></thead>
      <tbody>${state.projekte.map((p) => `<tr>
        <td><label class="sr-only" for="pr-n-${esc(p.id)}">Name</label><input id="pr-n-${esc(p.id)}" type="text" maxlength="80" value="${esc(p.name)}" data-action="projekt" data-id="${esc(p.id)}" data-field="name"></td>
        <td><label class="sr-only" for="pr-t-${esc(p.id)}">Art</label><select id="pr-t-${esc(p.id)}" data-action="projekt" data-id="${esc(p.id)}" data-field="typ">${['Projekt', 'Themencluster'].map((t) => `<option ${t === p.typ ? 'selected' : ''}>${t}</option>`).join('')}</select></td>
        <td><input type="checkbox" id="pr-a-${esc(p.id)}" ${p.aktiv ? 'checked' : ''} data-action="projekt" data-id="${esc(p.id)}" data-field="aktiv"><label for="pr-a-${esc(p.id)}" class="sr-only">aktiv</label></td></tr>`).join('')}</tbody></table></div>
    <form data-form="projekt" class="reihe">
      <div class="feld"><label for="np-name">Neues Projekt / Cluster</label><input id="np-name" type="text" maxlength="80" required></div>
      <div class="feld"><label for="np-typ">Art</label><select id="np-typ"><option>Projekt</option><option>Themencluster</option></select></div>
      <button type="submit" class="btn">Hinzufügen</button>
    </form>
  </fieldset>

  <fieldset class="block">
    <legend>Daten des Prototyps</legend>
    <p class="hinweis">Der Prototyp speichert nur in diesem Browser. Nur erfundene Daten verwenden.</p>
    <div class="reihe">
      <button type="button" class="btn btn-zweit" data-action="export">Als Datei sichern (JSON)</button>
      <div class="feld"><label for="imp">Sicherung laden</label><input id="imp" type="file" accept="application/json,.json" data-action="import"></div>
      <button type="button" class="btn btn-gefahr" data-action="reset" ${isLead() ? '' : 'disabled'}>Auf Beispieldaten zurücksetzen</button>
    </div>
  </fieldset>`;
}

// ---------- Rahmen ----------
const VIEWS = {
  uebersicht: ['Übersicht', viewUebersicht],
  planung: ['Planen', viewPlanung],
  grunddaten: ['Grunddaten', viewGrunddaten],
  abstimmung: ['Abstimmung', viewAbstimmung],
  einrichtung: ['Einrichtung', viewEinrichtung],
};

function render() {
  if (ui.user !== LEAD && !member(ui.user)) ui.user = LEAD;
  document.getElementById('nutzer').innerHTML = memberOptions(ui.user, { withLead: true });
  document.querySelectorAll('[data-view-tab]').forEach((b) => {
    const active = b.dataset.viewTab === ui.view;
    b.setAttribute('aria-current', active ? 'page' : 'false');
  });
  const main = document.getElementById('inhalt');
  main.innerHTML = VIEWS[ui.view][1]();
}

function switchView(view) {
  ui.view = view;
  render();
  const h1 = document.querySelector('#inhalt h1');
  if (h1) { h1.tabIndex = -1; h1.focus(); }
}

function openDetail(memberId, k) {
  const dlg = document.getElementById('detail');
  dlg.querySelector('.dialog-inhalt').innerHTML = detailHtml(memberId, k);
  dlg.showModal();
}

/** Bestätigung als Dialog in der Seite (Browser-Rückfragen sind in eingebetteten Ansichten gesperrt). */
function askConfirm(text, okLabel = 'Bestätigen') {
  const dlg = document.getElementById('bestaetigen');
  dlg.querySelector('.b-text').textContent = text;
  dlg.querySelector('[value=ok]').textContent = okLabel;
  dlg.returnValue = '';
  dlg.showModal();
  return new Promise((resolve) => {
    dlg.addEventListener('close', () => resolve(dlg.returnValue === 'ok'), { once: true });
  });
}

function showExport() {
  const json = JSON.stringify(state, null, 2);
  const dlg = document.getElementById('detail');
  dlg.querySelector('.dialog-inhalt').innerHTML = `
    <h2 id="detail-titel">Daten sichern</h2>
    <p>Kopieren Sie den Inhalt und speichern Sie ihn als Textdatei (z. B. <code>kapazitaet.json</code>). Über „Sicherung laden“ können Sie ihn später wieder einlesen.</p>
    <label for="export-text">Sicherung (JSON)</label>
    <textarea id="export-text" rows="10" readonly>${esc(json)}</textarea>
    <p class="aktionen"><button type="button" class="btn" data-action="export-copy">In die Zwischenablage kopieren</button>
    <button type="button" class="btn btn-zweit" data-action="export-download">Als Datei herunterladen</button>
    <button type="button" class="btn btn-zweit" data-action="close-detail">Schließen</button></p>`;
  dlg.showModal();
}

function download(name, text) {
  const blob = new Blob([text], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

const num = (v, min = 0, max = Infinity) => Math.min(max, Math.max(min, Number(String(v).replace(',', '.')) || 0));

// ---------- Ereignisse ----------
function onClick(e) {
  const t = e.target.closest('[data-action], [data-view-tab]');
  if (!t) return;
  if (t.dataset.viewTab) return switchView(t.dataset.viewTab);
  const { action } = t.dataset;
  switch (action) {
    case 'detail': return openDetail(t.dataset.member, t.dataset.monat);
    case 'close-detail': return document.getElementById('detail').close();
    case 'goto': ui.monat = NEXT; return switchView(t.dataset.view);
    case 'plan-for':
      document.getElementById('detail').close();
      ui.monat = t.dataset.monat;
      ui.form.memberId = t.dataset.member;
      return switchView('planung');
    case 'booking-del': {
      const b = state.buchungen.find((x) => x.id === t.dataset.id);
      if (!b || !canEditBooking(b)) return;
      askConfirm(`Eintrag „${projekt(b.projektId)?.name ?? ''}“ (${b.tage} PT für ${nameOf(b.memberId)}) löschen?`, 'Löschen').then((ok) => {
        if (!ok) return;
        state.buchungen = state.buchungen.filter((x) => x.id !== b.id);
        commit('Eintrag gelöscht.');
      });
      return undefined;
    }
    case 'copy-prev': {
      const prev = shiftMonth(ui.monat, -1);
      const src = state.buchungen.filter((b) => b.monat === prev && b.geplantVon === ui.user);
      let n = 0;
      for (const b of src) {
        const exists = state.buchungen.some((x) => x.monat === ui.monat && x.memberId === b.memberId && x.projektId === b.projektId && x.geplantVon === ui.user);
        if (!exists) { state.buchungen.push({ ...b, id: newId('b'), monat: ui.monat }); n++; }
      }
      return commit(n ? `${n} Einträge übernommen. Bitte Tage prüfen.` : 'Keine neuen Einträge zum Übernehmen gefunden.');
    }
    case 'zusatz-del':
      state.zusatzFrei = state.zusatzFrei.filter((z) => z.date !== t.dataset.date);
      return commit();
    case 'ferien-del':
      state.ferien = state.ferien.filter((f) => f.id !== t.dataset.id);
      return commit();
    case 'mitglied-add': {
      const m = { id: newId('m'), name: 'Neues Teammitglied', rolle: 'Anwendungsberatung', beschaeftigung: 100, linie: 20, orga: 10 };
      state.mitglieder.push(m);
      commit('Teammitglied hinzugefügt.');
      document.getElementById(`tm-n-${m.id}`)?.focus();
      return undefined;
    }
    case 'mitglied-del': {
      const m = member(t.dataset.id);
      const n = state.buchungen.filter((b) => b.memberId === m.id).length;
      askConfirm(`${m.name} entfernen? ${n} geplante Einträge für diese Person werden ebenfalls gelöscht.`, 'Entfernen').then((ok) => {
        if (!ok) return;
        state.mitglieder = state.mitglieder.filter((x) => x.id !== m.id);
        state.buchungen = state.buchungen.filter((b) => b.memberId !== m.id);
        delete state.grunddaten[m.id];
        commit('Teammitglied entfernt.');
      });
      return undefined;
    }
    case 'export': return showExport();
    case 'export-copy': {
      const ta = document.getElementById('export-text');
      const fallback = () => { ta.focus(); ta.select(); announce('Kopieren nicht möglich. Der Text ist markiert, bitte mit Strg+C kopieren.'); };
      if (!navigator.clipboard) return fallback();
      navigator.clipboard.writeText(ta.value).then(() => announce('In die Zwischenablage kopiert.'), fallback);
      return undefined;
    }
    case 'export-download':
      return download(`kapazitaetsplanung-${new Date().toISOString().slice(0, 10)}.json`, JSON.stringify(state, null, 2));
    case 'reset':
      askConfirm('Alle Daten in diesem Browser durch die Beispieldaten ersetzen?', 'Zurücksetzen').then((ok) => {
        if (!ok) return;
        state = reset();
        commit('Beispieldaten geladen.');
      });
      return undefined;
    default:
  }
}

function onChange(e) {
  const t = e.target;
  const { action } = t.dataset;
  switch (action) {
    case 'nutzer':
      ui.user = t.value; writePref('user', ui.user);
      ui.form.memberId = null; ui.grundMember = null;
      render(); return announce(`Angemeldet als ${nameOf(ui.user)} (Simulation).`);
    case 'set-monat': ui.monat = t.value; render(); return document.getElementById(t.id)?.focus();
    case 'set-filter': ui.filter = t.value; render(); return document.getElementById(t.id)?.focus();
    case 'form-member': ui.form.memberId = t.value; render(); return document.getElementById(t.id)?.focus();
    case 'grund-member': ui.grundMember = t.value; render(); return document.getElementById(t.id)?.focus();
    case 'booking-tage': {
      const b = state.buchungen.find((x) => x.id === t.dataset.id);
      if (!b || !canEditBooking(b)) return;
      b.tage = num(t.value, 0, 31);
      return commit();
    }
    case 'grund': {
      if (!canEditGrunddaten(ui.grundMember)) return;
      const g = ((state.grunddaten[ui.grundMember] ??= {})[t.dataset.monat] ??= {});
      g[t.dataset.field] = num(t.value, 0, t.dataset.field === 'abwesenheit' ? 31 : 100);
      const id = t.id;
      commit();
      return document.getElementById(id)?.focus();
    }
    case 'meldung': {
      if (t.dataset.member !== ui.user) return;
      (state.meldungen[ui.monat] ??= {})[ui.user] = t.checked;
      const id = t.id;
      commit(t.checked ? 'Planung als gepflegt gemeldet.' : 'Meldung zurückgenommen.');
      return document.getElementById(id)?.focus();
    }
    case 'schwelle':
      if (!isLead()) return;
      state.einstellungen.schwellen[t.dataset.field] = num(t.value, 1, 200);
      return commit();
    case 'mitglied': {
      if (!isLead()) return;
      const m = member(t.dataset.id);
      const f = t.dataset.field;
      m[f] = ['name', 'rolle'].includes(f) ? t.value.trim() || m[f] : num(t.value, 0, 100);
      return commit();
    }
    case 'projekt': {
      if (!isLead()) return;
      const p = projekt(t.dataset.id);
      const f = t.dataset.field;
      p[f] = f === 'aktiv' ? t.checked : t.value.trim() || p[f];
      return commit();
    }
    case 'import': {
      const file = t.files?.[0];
      if (!file) return;
      file.text().then((txt) => {
        let obj;
        try { obj = JSON.parse(txt); } catch { return announce('Die Datei ist kein gültiges JSON.'); }
        const err = validateImport(obj);
        if (err) return announce(err);
        return askConfirm('Aktuelle Daten durch die Sicherung ersetzen?', 'Ersetzen').then((ok) => {
          if (!ok) return;
          state = { ...seedState(), ...obj, meldungen: obj.meldungen ?? {}, grunddaten: obj.grunddaten ?? {} };
          commit('Sicherung geladen.');
        });
      });
      return undefined;
    }
    default:
  }
}

function onInput(e) {
  const t = e.target;
  if (t.dataset.action === 'form-field') {
    ui.form[t.dataset.field] = t.value;
    if (t.dataset.field === 'tage') {
      // Nur die Kapazitätsbox aktualisieren, damit der Fokus im Feld bleibt
      const tmp = document.createElement('div');
      tmp.innerHTML = viewPlanung();
      const neu = tmp.querySelector('.kapa-box');
      const alt = document.querySelector('.kapa-box');
      if (neu && alt) alt.replaceWith(neu);
    }
  }
}

function onSubmit(e) {
  const f = e.target;
  const kind = f.dataset.form;
  if (!kind) return;
  e.preventDefault();
  if (kind === 'booking') {
    const tage = num(ui.form.tage, 0, 31);
    const err = !ui.form.projektId ? 'Bitte ein Projekt oder Themencluster wählen.' : tage <= 0 ? 'Bitte Personentage größer 0 angeben.' : '';
    if (err) {
      f.querySelector('#form-fehler').textContent = err;
      f.querySelector(ui.form.projektId ? '#f-tage' : '#f-projekt').focus();
      return;
    }
    state.buchungen.push({
      id: newId('b'), monat: ui.monat, memberId: ui.form.memberId, projektId: ui.form.projektId,
      tage, geplantVon: ui.user, notiz: ui.form.notiz.trim(),
    });
    ui.form = { ...ui.form, projektId: '', tage: '', notiz: '' };
    commit('Eintrag hinzugefügt.');
    document.getElementById('f-projekt')?.focus();
  } else if (kind === 'entscheidung' && isLead()) {
    const text = f.querySelector('textarea').value.trim();
    if (!text) return;
    state.entscheidungen.push({ id: newId('e'), monat: ui.monat, memberId: f.dataset.member, text, datum: new Date().toLocaleDateString('de-DE'), von: LEAD });
    commit('Entscheidung gespeichert.');
  } else if (kind === 'zusatz' && isLead()) {
    const date = f.querySelector('#z-date').value;
    const name = f.querySelector('#z-name').value.trim();
    if (!date || !name) return;
    state.zusatzFrei = [...state.zusatzFrei.filter((z) => z.date !== date), { date, name }].sort((a, b) => a.date.localeCompare(b.date));
    commit('Freier Tag hinzugefügt.');
  } else if (kind === 'ferien' && isLead()) {
    const name = f.querySelector('#fe-name').value.trim();
    const von = f.querySelector('#fe-von').value;
    const bis = f.querySelector('#fe-bis').value;
    if (!name || !von || !bis || bis < von) return announce('Bitte Bezeichnung und gültigen Zeitraum angeben.');
    state.ferien.push({ id: newId('f'), name, von, bis });
    state.ferien.sort((a, b) => a.von.localeCompare(b.von));
    commit('Ferien hinzugefügt.');
  } else if (kind === 'projekt' && isLead()) {
    const name = f.querySelector('#np-name').value.trim();
    if (!name) return;
    state.projekte.push({ id: newId('p'), name, typ: f.querySelector('#np-typ').value, aktiv: true });
    commit('Projekt hinzugefügt.');
  }
}

document.addEventListener('click', onClick);
document.addEventListener('change', onChange);
document.addEventListener('input', onInput);
document.addEventListener('submit', onSubmit);
document.getElementById('detail').addEventListener('click', (e) => {
  if (e.target === e.currentTarget) e.currentTarget.close(); // Klick auf Hintergrund
});
render();

if ('serviceWorker' in navigator && location.protocol !== 'file:') {
  window.addEventListener('load', () => navigator.serviceWorker.register('./sw.js').catch(() => {}));
}
