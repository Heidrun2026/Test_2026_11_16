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

## Offizielle Daten (offene APIs ohne Schlüssel)
Werden nur auf Klick („Aktuelle Daten laden“) direkt aus dem Browser abgerufen (`etf/js/marktdaten.js`). Übertragen werden nur Serienschlüssel und ISINs; die Dienste sehen technisch die IP-Adresse.

| Quelle | Verwendung in der App | Serie / Abfrage |
|---|---|---|
| Bundesbank | Vergleich „sichere Anlage“: Sparplan zur Rendite 10-jähriger Bundesanleihen | `BBSIS/D.I.ZAR.ZI.EUR.S1311.B.A604.R10XX.R.A.A._Z._Z.A` |
| EZB | Einlagezins als sicherer Zins für „Rendite je Risiko“; EUR/USD-Veränderung über 1 Jahr (Währungseffekt) | `FM/D.U2.EUR.4F.KR.DFR.LEV`, `EXR/D.USD.EUR.SP00.A` |
| Eurostat | Inflation Deutschland → Kaufkraft der Endwerte in heutigen Euro (Ersatz: EZB `ICP/M.DE.N.000000.4.ANR`) | `prc_hicp_manr`, geo=DE, coicop=CP00 |
| GLEIF | Rechtsträger (Fonds) und LEI zur ISIN | `lei-records?filter[isin]=…` |

**SEC EDGAR ist bewusst nicht angebunden:** Die ausgewählten ETFs sind europäische UCITS-Fonds (Irland/Luxemburg) und stehen nicht in EDGAR. Außerdem verlangt EDGAR einen User-Agent mit Kontaktangabe, den ein Browser nicht setzen kann; dafür wäre ein eigenes Backend nötig.

Ungetestet gegen die Live-Dienste (in der Entwicklungsumgebung gesperrt). Liefert eine Quelle einen Fehler, zeigt die App ihn je Quelle an; dann Serienschlüssel im Datenportal prüfen. Falls der Browser eine Quelle wegen CORS blockiert, wäre ein kleiner lokaler Proxy nötig.

## Grenzen
- Keine Kurs- und Renditeabrufe für die ETFs selbst: Die offiziellen offenen APIs liefern keine Fondskurse.
- Stammdaten (Name, ISIN, Index) stammen aus dem Wissensstand und sind vor einer Anlage im Basisinformationsblatt zu prüfen.
- Szenarien ohne Steuern, Ordergebühren und Inflation.

## Starten
```
python3 -m http.server 8080 --bind 127.0.0.1
```
Dann http://127.0.0.1:8080/etf/ öffnen. Tests: `npm test` (`tests/etf-calc.test.js`).
