# ETF-Sparplan Auswahl (Prototyp)

Lokaler Prototyp, nur für die eigene Nutzung. Keine Anlageberatung.

## Ablauf (aus dem Prozess-Steckbrief)
1. Pflichtangaben eingeben: monatlicher Betrag (Standard 100 EUR) und Zeitraum (Standard 10 Jahre).
2. „10 ETFs anzeigen“: feste Vorauswahl breit gestreuter, sparplanfähiger UCITS-ETFs (Aktien Welt/Regionen, Mischung, Anleihen).
3. Für jeden ETF die Kennzahlen des letzten Jahres aus kostenlosen Quellen eintragen (Links je ETF): Wertentwicklung 1 Jahr, Volatilität 1 Jahr, TER, Risikoklasse (SRI), Stand.
4. Die Auswertung bewertet automatisch und zeigt Sparplan-Szenarien (2 / 5 / 7 % p. a. abzüglich TER).

## Regeln
- **Rückfrage**, solange weniger als 5 ETFs mit vollständigen Kennzahlen zum Risikoprofil passen.
- **Erledigt** ab 5 passenden ETFs.
- Risikoprofil „mittel bis niedrig“ = Risikoklasse 1–4. ETFs darüber werden markiert und ans Ende sortiert.
- Punkte 0–100, relativ zu den anderen eingetragenen ETFs: Wertentwicklung 40, niedrige Volatilität 35, niedrige Kosten 15, niedrige Risikoklasse 10.
- Nicht-Ziel: Keine anderen Anlageformen als ETFs.

## Grenzen
- Keine automatischen Kursabrufe. Externe Datendienste bräuchten eine Freigabe, und ihre Nutzungsbedingungen müssten geprüft werden.
- Stammdaten (Name, ISIN, Index) stammen aus dem Wissensstand und sind vor einer Anlage im Basisinformationsblatt zu prüfen.
- Szenarien ohne Steuern, Ordergebühren und Inflation.

## Starten
```
python3 -m http.server 8080 --bind 127.0.0.1
```
Dann http://127.0.0.1:8080/etf/ öffnen. Tests: `npm test` (`tests/etf-calc.test.js`).
