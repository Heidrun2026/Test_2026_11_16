# Kapazitätsplanung Team

## Zweck
Web-Anwendung zur monatlichen Kapazitätsplanung eines Teams (8 Anwendungsberatung, 3 Entwicklung) mit Übersicht für den aktuellen und die nächsten 6 Monate.
Status: Prototyp – nur fiktive Daten, nur lokal, nicht für den Betrieb.

## Befehle
- Starten (lokal): `python3 -m http.server 8080 --bind 127.0.0.1`
- Tests: `npm test` (node:test, keine Abhängigkeiten)
- Einzelne HTML-Datei bauen: `npm run build:html` → `dist/` (Artifact: `dist/artifact.html`)

## Architektur
- Statisches Frontend, Vanilla JavaScript (ES-Module), keine Fremdpakete, kein Build.
- `js/calc.js`: reine Rechenlogik (Feiertage Berlin, Arbeitstage, Auslastung, Monatsstatus) – getestet in `tests/`.
- `js/store.js`: Beispieldaten und Speicherung im localStorage (nur Prototyp).
- `js/app.js`: Oberfläche; Ansichten als HTML-Strings, alle Nutzertexte über `esc()`.
- Daten: Beschäftigtendaten (Abwesenheitstage, Auslastung) – im Prototyp nur fiktiv.

## Konventionen
- Fachbegriffe deutsch (Mitglieder, Buchungen, Grunddaten, Meldungen, Entscheidungen).
- Monate als `YYYY-MM`, Datumswerte als ISO `YYYY-MM-DD`, Rechnen in UTC.
- Keine externen CDNs/Schriften; CSP in `index.html` erlaubt nur `'self'`.

## Stolperfallen
- Keine `confirm()`/`alert()` verwenden (in eingebetteten Ansichten gesperrt); stattdessen `askConfirm()`.
- Aufwände dürfen nie automatisch umverteilt werden (fachliches Nicht-Ziel).
- Keine Leistungsauswertung einzelner Personen ergänzen (Mitbestimmung Betriebsrat).
- Service Worker cacht nur die App-Hülle; bei Änderungen an der Hülle `CACHE` in `sw.js` hochzählen.

## Teilprojekt `etf/` (ETF-Sparplan Auswahl)
- Eigenständiger lokaler Prototyp, wird NICHT über GitHub Pages veröffentlicht. Details: `etf/README.md`.
- Logik in `etf/js/etf-calc.js` (Tests: `tests/etf-calc.test.js`), Vorauswahl in `etf/js/etf-data.js`.
- Keine Kurs-/Renditewerte im Code hinterlegen; keine anderen Anlageformen als ETFs (Nicht-Ziel).
- Offene APIs (Bundesbank, EZB, Eurostat, GLEIF) in `etf/js/marktdaten.js`, nur auf Klick; neue Hosts auch in `connect-src` der CSP in `etf/index.html` eintragen. Parser-Tests: `tests/marktdaten.test.js`.
