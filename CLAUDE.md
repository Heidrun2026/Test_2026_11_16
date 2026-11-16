# Kapazitätsplanung Team

## Zweck
Web-Anwendung zur monatlichen Kapazitätsplanung eines Teams (8 Anwendungsberatung, 3 Entwicklung) mit Übersicht für den aktuellen und die nächsten 6 Monate.
Status: Prototyp – nur fiktive Daten, nur lokal, nicht für den Betrieb.

## Befehle
- Starten (lokal): `python3 -m http.server 8080 --bind 127.0.0.1`
- Tests: `npm test` (node:test, keine Abhängigkeiten)

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
- Aufwände dürfen nie automatisch umverteilt werden (fachliches Nicht-Ziel).
- Keine Leistungsauswertung einzelner Personen ergänzen (Mitbestimmung Betriebsrat).
- Service Worker cacht nur die App-Hülle; bei Änderungen an der Hülle `CACHE` in `sw.js` hochzählen.
