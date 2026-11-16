# Kapazitätsplanung Team (Prototyp)

Ersetzt die bisherige Excel-Planung je Mitarbeiter*in durch eine Web-Anwendung: Die Teammitglieder (Anwendungsberatung und Entwicklung) planen ihre eigene Kapazität und die anderer Teammitglieder je Projekt und Themencluster in Personentagen. Die Anwendung zeigt die Auslastung des Teams für den aktuellen Monat und die nächsten sechs Monate und unterstützt den Abgleich und die Entscheidung der Teamleitung bei Überlastung.

> **Prototyp – nur erfundene Daten, nicht für den Betrieb.** Die Daten liegen nur im Browser (localStorage). Die Anmeldung ist simuliert.

## Starten

Keine Installation nötig, es werden keine Fremdpakete verwendet.

```bash
python3 -m http.server 8080 --bind 127.0.0.1
```

Dann im Browser `http://127.0.0.1:8080/` öffnen. Tests der Rechenlogik (Node.js 22 oder neuer):

```bash
npm test
```

### Als einzelne HTML-Datei

```bash
npm run build:html
```

Erzeugt `dist/kapazitaetsplanung.html` (eine Datei, die sich per Doppelklick im Browser öffnen lässt) und `dist/artifact.html` (dieselbe Seite ohne Dokumentgerüst, für die Veröffentlichung als claude.ai-Artifact). Eingecheckt wird nur `dist/kapazitaetsplanung.html`; nach Änderungen am Code bitte neu bauen.

## Abbildung des Prozesses

| Prozessschritt (Canvas) | In der Anwendung |
|---|---|
| 1. Grundeinrichtung: Ferien, Feiertage | **Einrichtung** (Teamleitung): Berliner Feiertage automatisch, zusätzliche freie Tage, Schulferien als Hinweis, Team, Projekte/Themencluster, Schwellenwerte |
| 2. Grunddaten: Abwesenheiten, Anteil Linie, Anteil Organisation | **Grunddaten**: je Person und Monat; Standardwerte je Person in der Einrichtung |
| 3. Aufwandplanung je Projekt und Themencluster | **Planen**: Einträge für sich und für andere, mit „Geplant von“; Übernahme aus dem Vormonat |
| 4. Termin zum Abgleich | **Abstimmung**: Meldung „Planung gepflegt“ je Person, Liste der Rückfragen und Überlastungen |
| 5. Entscheidung bei Überlastung | **Abstimmung**: Teamleitung hält Entscheidungen fest; die Umplanung erfolgt manuell |
| Übersicht für aktuellen + 6 Monate | **Übersicht**: Matrix Person × Monat, Team gesamt, Details je Zelle |

**Berechnung (in Personentagen):**
verfügbar = Arbeitstage (ohne Feiertage) × Beschäftigungsgrad − geplante Abwesenheit
belegt = Linie % × verfügbar + Organisation % × verfügbar + geplante Projekt-/Clustertage
Auslastung = belegt ÷ verfügbar

**Regeln:** ab 90 % Rückfrage, über 100 % Entscheidung der Teamleitung (beides einstellbar). Ein Monat ist *fertig*, wenn alle gemeldet haben und niemand über 100 % liegt.

**Bewusst nicht enthalten (Nicht-Ziel):** Aufwände werden nie automatisch auf andere Teammitglieder verschoben.

## Rechte im Prototyp

| Aktion | Teammitglied | Teamleitung |
|---|---|---|
| Übersicht und Details ansehen | alle | alle |
| Aufwand planen (für sich und andere) | ja | ja |
| Eigene Einträge ändern/löschen | nur selbst angelegte | alle |
| Grunddaten pflegen | nur eigene | alle |
| „Planung gepflegt“ melden | nur für sich | – |
| Entscheidungen festhalten | – | ja |
| Einrichtung | ansehen | ändern |

## Datenschutz

- Im Betrieb verarbeitet die Anwendung Beschäftigtendaten (Abwesenheitstage, Auslastung je Person). Sie plant nur und misst keine Ist-Zeiten. Trotzdem kann sie als technische Einrichtung zur Leistungs- oder Verhaltenskontrolle geeignet sein (§ 87 Abs. 1 Nr. 6 BetrVG). **Vor dem echten Einsatz Datenschutz und Betriebsrat einbinden.**
- Gründe für Abwesenheiten werden bewusst nicht erfasst, nur die Anzahl der Tage. Notizfelder weisen darauf hin, keine Angaben zu Personen einzutragen.
- Exportdateien (`kapazitaetsplanung-*.json`) nicht einchecken.

## Vom Prototyp zum Betrieb – offene Punkte

- [ ] Ablage in einem Azure-DevOps-Repository (derzeit GitHub, nur für den Prototyp freigegeben)
- [ ] Abstimmung mit Datenschutz und Betriebsrat (Zweck, Sichtbarkeit, Aufbewahrungsfristen)
- [ ] Server mit Datenbank und REST-API (OpenAPI), Migrationen; Daten nicht mehr im Browser
- [ ] Anmeldung über Microsoft Entra ID, Rollen „Team“ und „Teamleitung“ über Entra-Gruppen, Rechteprüfung serverseitig
- [ ] Docker-Setup, Backups, Logs ohne Personendaten
- [ ] Frontend in TypeScript mit Tests (Komponenten, E2E, Barrierefreiheit)
- [ ] Gewobag-Corporate-Design (Farben und Schrift sind Platzhalter)
- [ ] Sicherheitsprüfung der Laufzeitversionen gegen endoflife.date, OSV.dev und CISA KEV
- [ ] Optional: Kernfunktionen (Auslastung abfragen, Aufwand planen) als MCP-Server für KI-Assistenten
- [ ] Fachlich klären: Feiertage nur Berlin? Heiligabend/Silvester halbe Tage? Rückfrage ab 90 % oder Entscheidung bereits ab 90 % (Canvas nennt beides)?

## Verantwortlich

[TODO: fachlich verantwortliche Person / Team]
