# Mudracer – Roadmap bis zum Full Release

Die eine Liste für alles, was am Spiel noch zu tun ist. Sie ersetzt `ANALYSE.md`, `VERBESSERUNGEN.md` und die Einzelmeldungen aus `feedback/`. Nichts davon existiert mehr gesondert; die alten Stände liegen in der Git-Historie (`git show 8fb323f:ANALYSE.md`).

Stand: 2026-10-21, Branch `map_pack`. Zuletzt abgeglichen: 2026-10-22, Commit „ZUG Rev 3: Schanze an jedem Übergang“ (1S4-6 und 1S4-7 neu und erledigt); davor Commit „Skill mechanik“ (1T-9 neu und erledigt); davor Eingang gesichtet (6 Meldungen vom 2026-10-21, alle schon als 1S3-5 bis 7 und 1S6-4 bis 7 erledigt, Dateien gelöscht); davor Commit „Abnahme WIESE, WALD, STRAND, BAUSTELLE“ (Strecken 1, 2, 3 und 5 abgenommen, 1S3-8 erledigt); davor „CLAUDE.md: keine Feature-Abschluss-Frage bei offener Roadmap“ (1T-8 neu und erledigt); davor „ZUG: doppelt so viele und unterschiedlich lange Züge“ (1S4-4 und 1S4-5 neu und erledigt, 1S4-3 angepasst); davor „STRAND Rev 3: Feinschliff“ (1S3-9 bis 11 erledigt: Volleyball-Abkürzung schwerer, Steg breiter, Flut niedriger); davor „ZUG Rev 2“ (1S4-2 erledigt: Matsch neu verteilt, zweite graue Schanze, Waschanlage auf der linken Geraden, ein Zug je Linie, bayerisches Dorf als Kulisse; 1S4-3 neu); davor „GARTEN Rev 2“ (1S6-4 bis 7 neu und erledigt: kein Matsch unter Brücken, zweite Abkürzung funktioniert, Kois nicht über Steinen, Ankündigung nur am Absprung); davor „STRAND Rev 3“ (1S3-4 bis 7 erledigt: Dusche verschoben, Pfeiler bei Flut, Beachvolleyball-Abkürzung, Meer bremst mehr; 1S3-8 neu; Boden-Codes 50–52 vergeben, neue Strecken nehmen 60–69); davor „WALD Rev 3“ (1S2-2 und 1S2-3 erledigt: kein Slalom nach dem Regen, Pfützen wachsen mit dem Regen); davor „Baustelle Rev 3“ (1S5-1 bis 3 erledigt, Startgerade); davor „Strand Rev 2“ (1S3-1 bis 3 erledigt, Start gerade, Dusche für 1A-2); davor „Wüste Rev 2“ (1S8-1 erledigt, 1S8-2 teilweise, 1S8-4 neu, 1A-2 und 1A-5 für die Wüste). Davor: Umbau auf die Roadmap (Commit „Roadmap statt ANALYSE.md“).

## Die drei Phasen

| Phase | Name | Ziel in einem Satz | Stand |
|---|---|---|---|
| 1 | **Map_Pack** (Branch `map_pack`) | Alle 15 Strecken spielbar, überarbeitet und geprüft; alle 5 Cups und die Freischaltung der Strecken fertig; Performance reicht dafür | in Arbeit (2 von 15 Strecken überarbeitet, Wüste Rev 2 im Spiel noch nicht abgenommen) |
| 2 | **Cars & Customizations** | Keine NPC-Autos mehr; mehr spielbare Autos mit spürbar anderer Handhabung; mehr freischaltbare Anpassungen; hinter jeder Stufe jedes Cups liegt etwas; Achievement-Übersicht | nicht begonnen |
| 3 | **Game_Modes** | Vier Stufen LEICHT, MITTEL, SCHWER, PRO; alle Einstellungen ohne Überladung; Kindermodus verbessert; KI verhält sich auf jeder Strecke richtig und hat Charakter; das ganze Spiel ist poliert | nicht begonnen |
| – | Nach dem Release | Große Ideen, die nicht zum Full Release gehören | ungeplant |

Jede Phase endet mit einem Feature-Abschluss (siehe `CLAUDE.md`: Build, Publish als Artifact, Merge). Jede Phase enthält auch ihre technischen Aufgaben (Skills, `CLAUDE.md`, Prüfskripte, Tests); sie stehen als eigener Block `…T` in der Phase und gelten genauso als Voraussetzung für den Abschluss.

## So wird diese Datei benutzt

- **IDs:** `<Phase><Block>-<Nr>`, z. B. `1A-3` (Phase 1, Block A, Punkt 3) oder `1S6-2` (Phase 1, Strecke 6, Punkt 2). In Commits und im Gespräch die ID nennen. Neue Punkte bekommen die nächste freie Nummer im Block, IDs werden nie wiederverwendet.
- **Alt:** In der Spalte „Herkunft“ steht die frühere ID aus `ANALYSE.md` (T, M, D, G, B, I) oder die Meldung aus `feedback/` (Datum, Strecke). Code-Kommentare mit „ANALYSE.md T21“ o. ä. meinen den Stand in der Git-Historie.
- **Status:** `offen`, `in Arbeit`, `teilweise (…)`, `erledigt (<commit>)`. Erledigte Zeilen bleiben stehen, bis die Phase abgeschlossen ist; danach wandern sie in „Erledigt“ ganz unten (nur noch als Kurzfassung).
- **Prio:** H hoch, M mittel, N niedrig.
- **Vor der Arbeit** die Punkte des Bereichs hier nachsehen und berücksichtigen. **Vor dem Commit:** erledigte Punkte abhaken, Neues mit nächster freier ID anhängen, falsch gewordene Angaben korrigieren, „Zuletzt abgeglichen“ oben nachziehen.
- **Eingang (F8):** Das F8-Fenster im Dev-Server speichert Meldungen wie bisher in `feedback/` (`bug_…md`, `feature_…md` mit Bild). Sie bleiben dort liegen. Nur wenn der Nutzer es sagt („sichte den Eingang“), ordnet Claude sie hier ein (Skill `roadmap`) und löscht die verarbeiteten Dateien. Es gibt keine zweite Liste.
- **Spielstände bleiben gültig** (gilt für jede Änderung): Gespeicherte Daten (`mudracer-car`, `mudracer-unlock`, `mudracer-cups`, `mudracer-tt-*`, `mudracer-gp-*`, `mudracer-paint-*` …) werden nie unbrauchbar und nie überschrieben, um sie umzudeuten. Änderungen an Fahrwerten bekommen eine neue Balance-Version (`BAL` in `timetrial.js`), alte Rekorde werden beim Laden umgerechnet (`BAL_OLD`). Geänderte Strecken bekommen eine Revision (`rev` in `TRACK_DEFS`), ihre Rekorde beginnen neu, die alten bleiben im Speicher.
- Streckendesign-Grundsätze 1–14 stehen in `CLAUDE.md`, der Ablauf einer Strecke im Skill `strecke`.

---

# Phase 1 – Map_Pack

**Fertig, wenn:**
1. Alle 15 Strecken haben ihre Abnahme (Tabelle „Strecken im Überblick“): Streckendesign-Grundsätze 1–14 geprüft, `mudracer.check('NAME')` sauber auf LEICHT, MITTEL und SCHWER, von Hand im Spiel gefahren, Lied angehört, Doku in `Obsidian/Mudracer/Strecken.md` abgeglichen.
2. Alle 5 Cups, Supercup und Superdupercup sind spielbar, Siegerehrung, Pokale und Platzberechnung sind zuverlässig (Block 1C). Die Freischaltung der Cups und Strecken untereinander (E1) kommt zu Beginn von Phase 2 (2C-0).
3. Performance-Ziele (Block P) sind gemessen und erreicht.
4. Technik-Block 1T erledigt, `map_pack` ist auf `main` zusammengeführt und als Artifact veröffentlicht.

## Strecken im Überblick

Reifegrad aus `Obsidian/Mudracer/Strecken.md` und `ANALYSE.md`. „Abnahme“ ist der Haken aus „Fertig, wenn“ Punkt 1.

| Nr | Strecke | Cup | Größe | Stand | Abnahme |
|---|---|---|---|---|---|
| 1 | WIESE | 1 | 800×450 | umgesetzt (Rev 2) | **abgenommen** (Nutzer 2026-10-22) |
| 2 | WALD | 1 | 800×450 | umgesetzt (Rev 3: Pfützen wachsen mit dem Regen) | **abgenommen** (Nutzer 2026-10-22) |
| 3 | STRAND | 1 | 800×450 | umgesetzt (Rev 3: Beachvolleyball-Abkürzung, Pfeiler bei Flut, Dusche vor der Ziellinie, Steg breiter, Flut niedriger) | **abgenommen** (Nutzer 2026-10-22) |
| 4 | ZUG | 2 | 1120×630 | umgesetzt (Rev 3: an jedem der vier Übergänge eine Schanze in einer eigenen Spur neben der Schranke, Landung sicher hinter den Gleisen; Matsch nur halbseitig, ein Zug je Linie, bayerisches Dorf als Kulisse; Runde ca. 16–18 s; im Spiel noch nicht abgenommen) | offen |
| 5 | BAUSTELLE | 2 | 800×450 | umgesetzt (Rev 3: keine Pfützen, zwei Schläuche, Zementumfahrung, Erdhaufen auf der Fahrbahn, Startgerade) | **abgenommen** (Nutzer 2026-10-22) |
| 6 | GARTEN | 2 | 800×450 | umgesetzt (Rev 2: kein Matsch unter Brücken, zweite Abkürzung am Südrand des Sees, Koi-Ankündigung nur am Absprung; im Spiel noch nicht abgenommen) | offen |
| 7 | RENNSTRECKE | 3 | 800×450 | Prototyp, überarbeitet (Rev 2: Boxenregel, Box in der letzten Runde zu, Reifen später, Startgerade) | offen |
| 8 | WUESTE | 3 | 800×560 | überarbeitet (Rev 2) | offen |
| 9 | EIS | 3 | 800×450 | überarbeitet (Rev 1) | offen |
| 10 | VULKAN | 4 | 800×450 | Prototyp, Rework offen | offen |
| 11 | DSCHUNGEL | 4 | 800×450 | Prototyp, Rework offen | offen |
| 12 | WELTALL | 4 | 1360×765 | Prototyp | offen |
| 13 | SUESS | 5 | 1200×675 | Prototyp | offen |
| 14 | SPIELZIMMER | 5 | 1280×720 | Prototyp | offen |
| 15 | REGENBOGEN | 5 | 1440×810 | Prototyp (Rev 1) | offen |

## 1A – Querschnitt (gilt für alle Strecken)

| ID | Prio | Status | Aufgabe | Herkunft |
|---|---|---|---|---|
| 1A-1 | H | teilweise (WIESE Rev 2: Matsch und Pfützen innen in den Kurven, außen sauber; gemeinsamer Baustein und Prüfung in `check` fehlen noch) | **Matsch und Pfützen sind eine Entscheidung, kein Zwang.** Auf jeder Strecke gibt es an mehreren Stellen eine kürzere Linie durch Matsch gegen eine längere saubere Linie; nie ist alles unausweichlich, aber auch nie alles umfahrbar. Gemeinsamer Baustein, der Matsch, Sumpf, Asche, Tiefschnee und Treibsand vom Rand her in die Fahrbahn wachsen lässt (Stempel mitten auf der Fahrbahn vermeiden). Die Menge auf der Wiese bleibt ausdrücklich. Prüfung: `check` meldet Matschstellen, die nicht umfahrbar sind | D2, D9, Meldung 2026-10-16 WIESE |
| 1A-2 | H | teilweise (WÜSTE Rev 2: Oase an einem Nebenweg mit Schild, wäscht im flachen Wasser nach und nach, die KI fährt nur dreckig hin) | **Ein verständliches Wasch-Konzept je Strecke:** genau eine Art, sauber zu werden (Dusche, Waschanlage, Box, Oase, Schlauchstelle), vorher erkennbar, wäscht nie sofort (Dauer/Grad je Strecke festlegen), die Computerautos nutzen sie nur, wenn sie dreckig sind, und eine Strecke mit sehr vielen Pfützen braucht keine zusätzliche Waschstraße. Einzelfälle: 1S3-2, 1S5-1, 1S6-2, 1S7-1 (erledigt), 1S8 | Meldungen STRAND, GARTEN, BAUSTELLE, RENNSTRECKE, WUESTE (2026-10-17) |
| 1A-3 | M | teilweise (RENNSTRECKE Rev 2: Reifenwurf mit Anfangsverzögerung; Flagge kündigt ihn an) | **Gefahren kündigen sich an** (Grundsatz 9): Kois, Reifenwurf, jede Lawine/Bombe/Böe prüfen, ob Schatten, Blinken, Ton oder Text kommen. Prüfung in `check` oder im Skill `strecke` als Liste je Ereignis | M9, Meldungen GARTEN, RENNSTRECKE |
| 1A-4 | H | teilweise (BAUSTELLE Rev 3 erledigt) | **Startaufstellung gerade** (Grundsatz 5) für alle Strecken, die noch in der Kurve starten (Wert in Grad bei 10 Autos): WIESE (Rev 2: 6°, erledigt), WALD (Rev 2 erledigt, 7°), STRAND (Rev 2: 5°, erledigt), ZUG (Rev 1: 7°, erledigt), BAUSTELLE (Rev 3: 0°, erledigt), GARTEN (Rev 1: 8°, erledigt), RENNSTRECKE (Rev 2: 3°, erledigt), VULKAN 90°, DSCHUNGEL 90°, SPIELZIMMER 90°. Gerade sind WÜSTE (Rev 2), EIS, WELTALL 2°, SUESS 7°, REGENBOGEN 2°. Jede neue Startlinie ist eine neue `rev` | D7 |
| 1A-5 | M | teilweise (WÜSTE Rev 2: der Sandsturm spart die Ziellinie aus, keine Verwehung auf der Startaufstellung; Prüfung in `check` fehlt noch) | **Nichts darf die Ziellinie überdecken** (Eis: Schnee/Frost lag darüber). Prüfung in `check`: Ziellinie im letzten Rennbild sichtbar, auf jeder Strecke | Meldung EIS |
| 1A-6 | M | teilweise (Kipplaster-Erdhaufen: BAUSTELLE Rev 3, Matschpfütze am Strand offen) | **Hindernis oder Deko?** Prüfen, dass jedes Hindernis auf der Fahrbahn klar anders aussieht als die Deko daneben und dass jedes Hindernis spürbar wirkt (Beispiele: Kipplaster-Erdhaufen, Matschpfütze am Strand) | Grundsatz 10, Meldungen BAUSTELLE, STRAND |
| 1A-7 | N | offen | **Mehr als ein Kreis ab Strecke 5** (Grundsatz 6): bei jeder Abnahme für 5–15 ausdrücklich bestätigen; offen bei VULKAN (nur der Spieler nimmt den Geysir), DSCHUNGEL | Grundsatz 6, D19 |

## 1S – Strecken

### 1S1 WIESE
| ID | Prio | Status | Aufgabe | Herkunft |
|---|---|---|---|---|
| 1S1-1 | M | erledigt (WIESE Rev 2: Matsch und Pfützen auf der Innenseite der Kurven, außen mindestens 26 px sauber; Anzahl bleibt, Stellen länger) | Matsch und Pfützen sind oft unausweichlich: Ideallinie durch Matsch gegen längeren, sauberen Weg außen herum (siehe 1A-1); die Anzahl bleibt | Meldung 2026-10-16 WIESE |

### 1S2 WALD
| ID | Prio | Status | Aufgabe | Herkunft |
|---|---|---|---|---|
| 1S2-1 | M | erledigt (Rev 2: Schleier 50 %, Vignette .28, Matsch mit hellem Rand und Glanz) | Nachtschleier 64 % und Vignette: dunkler Matsch auf brauner Straße kaum lesbar; Matsch mit hellem Rand/Glanz, Schleier etwa 50 % | G7 |
| 1S2-2 | M | erledigt (Rev 3: Matsch oben links/rechts nur außen, unten links nur am unteren Rand; zwei Löcher auf die Ideallinie; check LEICHT/MITTEL/SCHWER sauber) | Nach dem Regen fährt man Slalom: Matsch oben links (Anfang und Innenseite) und oben rechts (Innenseite) verkleinern, unten links den markierten Teil weg, die Löcher in der Mitte unten und auf der Startgeraden auf die Ideallinie | Screenshot WALD_Improvements |
| 1S2-3 | M | erledigt (Rev 3: `grow: .5` in `TRACK_DEFS`, `growPuddles` in `events.js`; ohne Regen bleiben sie halb) | Alle Matsch- und Wasserpfützen sind bis zum Regen nur halb gefüllt und wachsen mit dem Regen auf ihre volle Größe | Wunsch Nutzer 2026-10-21 |

### 1S3 STRAND
| ID | Prio | Status | Aufgabe | Herkunft |
|---|---|---|---|---|
| 1S3-1 | M | erledigt (Rev 2: Matsch wie nasser Sand statt dunkler Klumpen) | Die Matschpfütze unter dem Auto wirkt kaum und sieht hässlich aus: Wirkung und Optik überarbeiten | Meldung STRAND 00:00:04 |
| 1S3-2 | M | erledigt (Rev 2: Dusche wäscht etwa doppelt so lange, nur kleiner Spritzer beim Einfahren) | Duschen waschen nicht sofort, sondern mindestens 30 % länger (Teil von 1A-2) | Meldung STRAND 00:00:47 |
| 1S3-3 | M | erledigt (Rev 2: Eckpfütze liegt im Trockenen, die kleine auf der gefluteten Gerade ist weg) | Der untere, geflutete Abschnitt: keine halb geflutete Matschpfütze (sieht schlecht aus), die Pfütze etwas höher setzen | Meldung STRAND 00:01:21 |
| 1S3-4 | M | erledigt (Rev 3: die Dusche hinter der Ziellinie steht jetzt links davor an der oberen Geraden) | Die Dusche direkt hinter der Ziellinie verschieben (nach links an die obere Gerade) | Screenshot `STRAND_Improvements.jpg` |
| 1S3-5 | H | erledigt (Rev 3: die Flut malt genau die Pfeiler des Stegs neu, die sie gerade überspült; Liste `T.piles`) | Die Holzpfeiler links und rechts vom Steg verschwinden bei steigendem Wasser | Meldung F8 2026-10-21 22:49 |
| 1S3-6 | H | erledigt (Rev 3: keine Pfeiler mehr außerhalb des Stegs) | Bei voller Flut sammeln sich Holzpfeiler mitten in der ersten Kurve | Meldung F8 2026-10-21 22:50 |
| 1S3-7 | M | erledigt (Rev 3: Beachvolleyballfeld statt der Lagune; schmale Sandspur mitten über das Feld als Abkürzung, Netz bremst einmal, der Ball trifft und schleudert, Schatten kündigt Schmetterbälle an; Meer und Flut bremsen etwas mehr; Computerautos nehmen die Abkürzung manchmal, öfter auf SCHWER und bei Flut; etwa gleich schnell wie außen herum) | Statt des unlogischen Sees ein Beachvolleyballfeld mit Abkürzung: Spieler, Netz bremst, Ball trifft beim Seitenwechsel; das Meer bremst etwas mehr | Idee F8 2026-10-21 22:51 |
| 1S3-9 | M | erledigt (Rev 3: Sandspur 76 % statt 84 % Tempo, Netz bremst auf 40 %, öfter Schmetterbälle; ohne Treffer etwa gleich schnell, eher langsamer) | Die Volleyball-Abkürzung ist beim Fahren von Hand schneller als außen herum: einen Tick schwieriger machen | Nutzer 2026-10-21 |
| 1S3-10 | M | erledigt (Rev 3: Steg 24 px statt 16 px breit) | Über den Holzsteg zu fahren soll etwas einfacher werden: breiter | Nutzer 2026-10-21 |
| 1S3-11 | H | erledigt (Rev 3: die Flut steigt nur noch bis y 310 statt 284; die Schlenkerkurve im Südosten bleibt mindestens 31 px breit trocken, der Steg schließt an beiden Enden an) | Die Flut darf nur so hoch steigen, dass man in der Schlenkerkurve im Südosten nicht zwingend durchs Wasser muss (sonst ist der Weg über den Steg im Nachteil) | Nutzer 2026-10-21 |
| 1S3-8 | N | erledigt (Abnahme STRAND 2026-10-22: bleibt so) | Die Ausfahrt der Volleyball-Abkürzung mündet in die Matschstelle der linken Kurve (gewollt als Preis der Abkürzung); beim Fahren von Hand prüfen, ob das zu hart ist, sonst die Matschstelle nach außen rücken | Rev 3 |

### 1S4 ZUG
| ID | Prio | Status | Aufgabe | Herkunft |
|---|---|---|---|---|
| 1S4-1 | H | erledigt (ZUG Rev 1: Karte 1120×630, Runde ca. 17 s; Pause zwischen zwei Zügen sinkt je Runde auf 65 % und 45 %; Sprungschanze auf der Außenhälfte vor dem rechten unteren Bahnübergang, Autos in der Luft trifft der Zug nicht; die Weiche gab es schon, sie wird weiter erst mit der Warnung gestellt; Startaufstellung jetzt 7° auf der linken Geraden (ZUG-Teil von 1A-4); Grundsatz 9: Pfiff, Glocke, Schranken und „ZUG KOMMT“ 2,5 s vorher wie bisher; check LEICHT/MITTEL/SCHWER sauber) | **Mehr Eskalation:** die Strecke wird insgesamt größer; die Zugfrequenz steigt mit der Rundenzahl; zusätzlich eine optionale Sprungschanze, über die man die Züge überspringen kann; eventuell Weichen vor und nach dem Tunnel, damit eine Überraschung entsteht, auf welcher Bahn der Zug fährt. Neue `rev`, Startgerade (1A-4) und Grundsatz 9 mitprüfen | Meldung ZUG |
| 1S4-2 | H | erledigt (ZUG Rev 2: Matsch oben zwischen den Übergängen innen, neu oben rechts außen, rechte Pfütze in zwei Hälften geteilt und auseinandergeschoben, untere Pfütze außen in Linie vor der Schanze; zweite Schanze innen vor dem linken Übergang, beide aus grauem Beton; Waschanlage links hinter der Startaufstellung; Teich und Pfütze unten links weg; jede Linie hat ihren eigenen Zug, also doppelt so viele, auch gleichzeitig, Weichenhäuschen entfällt; Kulisse in `bahnmap.js`: Dorf mit Zwiebelturm und Maibaum, Bauernhof mit Stadel, Misthaufen, Hühnern, Kuhweide, Acker mit Traktor, Felder, Hopfengarten, Streuobstwiese, Bahnhof, Stellwerk, Telegrafenmasten; check LEICHT/MITTEL/SCHWER sauber, Runde ca. 16 s) | **Verbesserungen nach Screenshot:** Pfützen verschieben, teilen und vor die Schanze legen, neue Matschpfütze, Waschanlage verschieben, Pfütze unten links und Teich weg; eine zweite Sprungschanze; Schanzen grau für Kontrast; Züge doppelt so oft, auch auf beiden Linien gleichzeitig; die Karte wirkt leer: Kulisse rundherum, gern ein bayerisches Dorf oder etwas Ländliches | `Obsidian/Mudracer/Screenshots/Zug_Improvements.jpg` |
| 1S4-3 | M | offen | Mit zwei Zügen von Hand fahren: wird Runde 3 zu dicht (seit 1S4-4 Pause je Linie in Runde 3 nur 1,6–2,7 s, dazu bis zu 12 Waggons)? Der Bot verliert im Test bis zu 4 s je Runde; gegebenenfalls die Pause der dritten Runde etwas anheben | ZUG Rev 2 |
| 1S4-4 | H | erledigt (Pause zwischen zwei Zügen je Linie halbiert: Runde 1 3,5–6 s, Runde 2 etwa 2,3–3,9 s, Runde 3 etwa 1,6–2,7 s; der erste Zug kommt nach 4 s, der zweite 2 s später; check LEICHT/MITTEL/SCHWER sauber, Runde ca. 16–18 s) | Nochmal doppelt so viele Züge | Nutzer 2026-10-22 |
| 1S4-5 | M | erledigt (jeder Zug hat 3 bis 12 Waggons, zufällig, im Zeitfahren fest; der längste ist mit 686 px länger als die Karte hoch; neuer grauer Kesselwagen, die Waggonarten wechseln sich ab; `trainOf` in `trainsprite.js` baut jede Länge beim ersten Mal) | Züge unterschiedlich lang, gern deutlich länger | Nutzer 2026-10-22 |
| 1S4-6 | H | erledigt (ZUG Rev 3: an allen vier Übergängen eine graue Schanze; die Straße wird dort auf einer Seite um 38 px breiter (oben außen, unten innen), die Schanze liegt in dieser Spur neben dem Schrankenpfosten, der auf einer festen Verkehrsinsel zwischen Straße und Spur steht; die Schranken sperren nur die Straße, gesprungen wird daneben; `railJump` im `TRACK_DEFS`-Eintrag, Schrankenpfosten folgen der Seite der Spur in `draw.js`; Felder oben, Sonnenblumen, Weizen und Kuhweide unten etwas kleiner, damit das Dorf Platz behält) | An jedem Übergang eine Sprungschanze; die Straße vor den Übergängen verbreitern, damit die Schanzen nicht über die Schranken springen, sondern daneben | Nutzer 2026-10-22 |
| 1S4-7 | H | erledigt (Ursache: die Schanze lag 48 px vor dem Gleis und gab keinen Schwung; wer langsamer als etwa 140 px/s ankam, z. B. aus dem Matsch, landete auf dem Gleis. Jetzt liegt die Kante 36 px vor dem Gleis, jeder Sprung startet mit 170 bis 200 px/s vorwärts (neue Grenze `cap` für Sprünge in `trackfx.js`), Landung 55–62 px hinter dem Gleis, Trefferzone endet bei 23 px; geprüft mit 12 Sprüngen bei 60, 135 und 220 px/s an allen vier Übergängen mit Zug auf dem Übergang: kein Treffer; check LEICHT/MITTEL/SCHWER sauber) | Die Sprungschanzen funktionieren nicht, beim Landen wird man immer vom Zug erwischt | Nutzer 2026-10-22 |

### 1S5 BAUSTELLE
| ID | Prio | Status | Aufgabe | Herkunft |
|---|---|---|---|---|
| 1S5-1 | M | erledigt (Rev 3: beide Pfützen weg; zweiter Schlauch in der Kurve unten rechts hinter dem Kipplaster; Waschanlage unten links am Ende der Runde bleibt) | Keine Pfützen mehr; stattdessen eine zweite Wasserschlauchstelle und die Reinigungsstation am Ende der Runde (Teil von 1A-2) | Meldung BAUSTELLE 00:08:59 |
| 1S5-2 | M | erledigt (Rev 3: Erdhaufen wachsen als Matsch 14 px in die Fahrbahn, Staubwolke größer und etwa 2,4-mal so schmutzig, Berührung des Lasters macht dreckig) | Kipplaster: Die Erdhaufen verdrecken die Autos nicht und die Laster machen nicht dreckig genug; sie sind kaum als Hindernis wahrnehmbar (1A-6) | Meldung BAUSTELLE 00:09:59 |
| 1S5-3 | M | erledigt (Rev 3: Zement nur auf der Innenseite der linken Kurve, die äußeren 28 px sind sauber und die Linie dort länger, Bremse bleibt 1/3,8) | Zement bremst auf 1/3,8: bewusst hart, aber es braucht eine sichtbare saubere Umfahrung, damit es eine Entscheidung ist (1A-1) | M8 |

### 1S6 GARTEN
| ID | Prio | Status | Aufgabe | Herkunft |
|---|---|---|---|---|
| 1S6-1 | H | erledigt (Garten Rev 1: Wasserkreise 0,6 s vor jedem Sprung; seit Rev 2 nur am Absprung, 1S6-7) | Die springenden Kois brauchen eine Ankündigung (etwa 0,5 s vorher Kreise im Wasser) | M9, Meldung GARTEN 00:11:41 |
| 1S6-2 | M | erledigt (Garten Rev 1: Waschstreifen entfernt, Matsch und Pfütze liegen nicht mehr übereinander; 1A-2) | Die halb/halb-Pfütze am Ende sieht merkwürdig aus; bei so vielen Pfützen braucht es keine Waschstraße (1A-2) | Meldung GARTEN 00:11:58 |
| 1S6-3 | M | erledigt (Garten Rev 1: zweite Trittsteinreihe vom Teich neben der Brücke über den See zur Westseite, ein Koi springt darüber; Grundsatz 4 und 6 geprüft) | Eine zweite Abkürzung (die Idee der ersten ist gut), mit Risiko; Grundsatz 4 und 6 mitprüfen | Meldung GARTEN 00:12:34 |
| 1S6-4 | H | erledigt (Garten Rev 2: Matsch von 0,09 auf 0,045 vor die untere Brücke, Pfütze von 0,17 auf 0,205 und 10 px nach Norden, saubere Spur am Seeufer) | Matsch und Pfützen liegen unter den Brücken versteckt | Meldung GARTEN 2026-10-21 22:55 |
| 1S6-5 | H | erledigt (Garten Rev 2: vier Steine am Südrand des Sees, von der Kurve nach der schrägen Brücke gerade nach Westen; Testfahrt kommt trocken an, die Runde zählt, `check` sauber auf LEICHT, MITTEL, SCHWER) | Die zweite Abkürzung geht gar nicht (die Steine begannen hinter dem Brückengeländer) | Meldung GARTEN 2026-10-21 22:55 |
| 1S6-6 | M | erledigt (Garten Rev 2: schwimmende Kois nur, wenn Kopf, Mitte und Schwanz über offenem Wasser sind; ihre Kreise in See und Teich neben die Steine gelegt) | Kleine Kois schwimmen wieder über den Steinen | Meldung GARTEN 2026-10-21 22:56 |
| 1S6-7 | M | erledigt (Garten Rev 2: Kreise nur noch am Absprung, an der Landung nur der Spritzer beim Aufkommen) | Die Ankündigung an der Landestelle ist unnötig, der Spritzer beim Landen reicht | Meldung GARTEN 2026-10-21 22:58 |

### 1S7 RENNSTRECKE
| ID | Prio | Status | Aufgabe | Herkunft |
|---|---|---|---|---|
| 1S7-1 | H | erledigt (Rev 2: Boxengasse = Stopp über die ganze Gassenbreite, gewaschen wird nur im Stopp, nicht mehr beim Vorbeifahren; Schild „BOX = HALT“; in der letzten Runde eines Autos Schild rot „BOX ZU“, kein Stopp, kein Waschen, Computerautos fahren nicht hinein) | Die Box ist unverständlich: man weiß nicht, wann man dort angehalten wird, wann man nur etwas sauber wird und seitlich vorbeifahren kann. In der letzten Runde soll die Box zu sein, und die Computerautos fahren sie dann nicht an (Teil von 1A-2) | Meldung RENNSTRECKE 00:14:21 |
| 1S7-2 | M | erledigt (Rev 2: erster Reifenwurf je Stelle nach 20 bis 28 s statt 4 bis 12 s, also etwa am Ende der ersten Runde; die gelbe Flagge kommt wie bisher 2,6 s vorher) | Der erste Reifenwurf der Strecke kommt zu früh (Anfangsverzögerung des Ereignisses, 1A-3) | Meldung RENNSTRECKE 00:15:33 |

### 1S8 WUESTE
Rev 2 (2026-10-21, aus den Meldungen vom 2026-10-17): Karte 800×560, Oase oben an einem eigenen Nebenweg mit Schild (wäscht im flachen Wasser, die KI fährt hin, wenn ihr Dreck über 0,35 liegt), Pyramide 240 px mit lesbarer dunkler Maske und wenigen Fackeln, kein Sturm in der Pyramide und über der Ziellinie, Sturm ohne Wind, Böen, Steppenläufer und Windsäcke (Dunst, Sandwirbel um die Autos, Autos werden langsam sandig, drei Verwehungen), Brücke an einem langen sicheren Nebenweg unten und der Sprung als kurzer Weg über die straßenbreite Rampe, Treibsand mit der Mitte neben der Straße und dunklem Rand, schwächeres Hitzeflimmern, Felskämme statt Findlingsketten, zwei Kakteen etwa 80 px hinter dem Pyramidenausgang. `mudracer.check('WUESTE')`: Bau etwa 0,45 s, Mittellinie 901 Punkte, Start 0°, keine Abkürzungen, 10/10 im Ziel und keine Stürze auf LEICHT, MITTEL und SCHWER, schnellste Runde 12,7 bis 15 s.

| ID | Prio | Status | Aufgabe | Herkunft |
|---|---|---|---|---|
| 1S8-1 | H | erledigt (Wüste Rev 2) | Rev 2 abschließen. Die Stürze auf LEICHT kamen von Autos nach dem Ziel, die den Brückenweg nicht mehr nahmen (`desertTarget` gilt jetzt auch im Zustand `finish`), und von Autos auf der Innenseite der Kurve vor dem Abzweig; `npm test`, `check` auf allen Stufen, `rev` 2, Obsidian `Strecken.md` | Memory „Wüste Rev 2 pausiert“ |
| 1S8-2 | M | teilweise (Wüste Rev 2 umgesetzt, vom Nutzer im Spiel noch nicht abgenommen) | Aus den Meldungen vom 2026-10-17 gegen den fertigen Stand abhaken: Oase nicht deplatziert und eine Waschmöglichkeit (00:16:38), Pyramide: nicht zu viele Lichter, kein Sturm (00:20:43), Treibsand besser sichtbar und größere Areale außerhalb der Strecke (00:21:29), Brücke und Sprung nicht zu dicht, Sprung riskant und kurz, Brücke sicher und länger (00:21:29), Wind und wehende Objekte entfernt, Sturm nur leicht, Flimmern schwächer, Kakteen weiter vom Pyramidenausgang, Pyramide größer, Felsen in der Mitte natürlicher (00:17:50) | Meldungen WUESTE |
| 1S8-3 | N | offen | Rest aus dem Rework: echtes Wadi mit Felskämmen an beiden Rändern, Sphinx und Pyramiden als Grenze am Kartenrand, Pyramidenausgang als zweite Wahl | D10, D13 |
| 1S8-4 | N | offen | Brückenweg und Oasenweg im Spiel abstimmen: der Bot braucht mit Brücke und Oase in einer Runde bis zu 23 s statt 13 s (Brücke bremst auf 60 %, Wasser auf 72 %, enge Kurven). Ist der sichere Weg zu teuer, die Brücke weniger bremsen lassen oder den Weg kürzen | `check('WUESTE', { diff: 1 })` 2026-10-21 |

### 1S9 EIS
| ID | Prio | Status | Aufgabe | Herkunft |
|---|---|---|---|---|
| 1S9-1 | M | offen | Das Eis darf die Ziellinie nicht überdecken (1A-5) | Meldung EIS |
| 1S9-2 | M | offen | Fünf gerade Linien sparen Straße; ein Teil führt über den Eissee (gewollt), der Rest ist mit `checkPic('EIS')` zu prüfen und zu schließen | D26 |

### 1S10 VULKAN
| ID | Prio | Status | Aufgabe | Herkunft |
|---|---|---|---|---|
| 1S10-1 | H | offen | Computerautos stürzen mit dem Ereignis `ausbruch` an der unteren Furt (456, 410) immer wieder in die Lava (88 Stürze auf SCHWER, 3 von 10 hängen fest). Rückkehrpunkt oder falsche Furt prüfen; fertig, wenn `mudracer.check('VULKAN', { diff: 0 })` kein festhängendes Auto meldet | M21 |
| 1S10-2 | H | offen | Zu viel gleichzeitig ab Runde 2 (Bomben, Kruste, Geysir, Furtwechsel, Zunge, Ascheregen, Hitze): keine Bomben in Entscheidungszonen, Bomben alle 5–7 s, steigender Lavasee der letzten Runde dafür mit weniger Bomben | D17, I18 |
| 1S10-3 | H | offen | Startaufstellung auf die untere Gerade (y 410, Fahrt nach links) (1A-4); neue `rev` | D7 |
| 1S10-4 | M | offen | Asche als drei Stempel mitten auf der Fahrbahn: Asche im Windschatten des Kraters, vom Rand her (1A-1) | D9 |
| 1S10-5 | M | offen | Lavagraben als Rechteck ohne Zufluss, Wasserfall ohne Abfluss: Graben als Spalte vom Kratersee zum Rand, Bach vom Kartenrand unter der Straße weiter, Dampf an der Lavafurt | D18 |
| 1S10-6 | M | offen | Acht gerade Linien über den Ascheboden (Kehren der Serpentine, rechte Schleife) sparen 75–280 px: Felsrippen oder Lavarinnen; `checkPic('VULKAN')` | D26 |
| 1S10-7 | N | offen | Die Felskante vor dem Graben (4-px-Steine) ist kaum zu sehen: deutliche Felsstufe mit Schatten | D20 |
| 1S10-8 | M | offen | Gegner nehmen die Geysir-Abkürzung nie (Grundsatz 6 gilt nur für den Spieler); auf SCHWER/PRO nehmen (mit 3B-4 abstimmen) | D19 |
| 1S10-9 | N | offen | Härte: volle Hitze würgt den Motor ab, Lava „nur peinlich“ entschärfen (Grundsatz 11) | D25 |
| 1S10-10 | N | offen | Liedwechsel `volcanoFast` an der Rundengrenze: Ruckler prüfen (siehe 1M-1) | B13 |

### 1S11 DSCHUNGEL
| ID | Prio | Status | Aufgabe | Herkunft |
|---|---|---|---|---|
| 1S11-1 | H | offen | Ein Rechteck mit offenem Waldboden im Innenfeld, leichter als der Vulkan davor (Grundsatz 1 und 4): dichtes Unterholz mit festen Würgefeigen, Wurzelwänden und Felsblöcken, gewundener Pfad mit S-Kurven | D21 |
| 1S11-2 | H | offen | Die Gabelung (Sumpfweg oder trockener Umweg) liegt unter dem Laubdach, man muss raten: Gabelung vor den Rand des Laubdachs oder Lichtung darüber, Fähnchen oder Wegweiser für beide Wege | D22 |
| 1S11-3 | H | offen | Startaufstellung auf y 230 (Sumpf bei 60/240 und Baum bei 60/196 dort weg) (1A-4); neue `rev` | D7 |
| 1S11-4 | M | offen | Sumpf als sieben Stempel über die ganze Breite: Mangroven, Sumpf neben der Straße (1A-1); nach dem Umbau Sumpf wie die Wüste auf Stürze prüfen (`check('DSCHUNGEL', { diff: 0 })`) | D9, D28 |
| 1S11-5 | M | offen | Furt als hartes Rechteck, gerade Schluchtufer neben gewundenem Fluss, die Steinkugel verschwindet am Tempelausgang: Furt als Flussverbreiterung mit Kiesbänken, Ufer folgen dem Fluss, Kugel rollt in den Fluss | D23 |
| 1S11-6 | M | offen | Zu dicht unten rechts: Tempelausgang (720, 336), morscher Baum (720, 368), Furt mit Strömung und Krokodilen; Baum versetzen, Krokodil nicht im Takt der Kugel | D24 |
| 1S11-7 | N | offen | Aus dem Plan nachholen: Affen, Nebel über dem Sumpf (darf ihn verdecken), Glühwürmchen | I18 |
| 1S11-8 | N | offen | Krokodile schieben nur, Steinkugel drückt nur kurz platt: schärfen (Grundsatz 11) | D25 |

### 1S12 WELTALL
| ID | Prio | Status | Aufgabe | Herkunft |
|---|---|---|---|---|
| 1S12-1 | M | offen | Optik: Staubflecken neben den Asteroiden, schlichte Stationsmodule | Weltall-Prototyp |
| 1S12-2 | H | offen | Die Musik stockt kurz vor der 3. Runde, wenn das Lied in die Vocoder-Phase wechselt (`spaceLast`, `holeOpen`, Rundenwechsel nur an Taktgrenzen) (siehe 1M-1) | B10 |
| 1S12-3 | N | offen | Länge prüfen: Runde 25–30 s, Rennen etwa 80 s (siehe 1P-2) | T18 |

### 1S13 SUESS
| ID | Prio | Status | Aufgabe | Herkunft |
|---|---|---|---|---|
| 1S13-1 | N | offen | Die Trittstein-Abkürzung über den Schokofluss spart etwa 1 s, die KI nimmt sie nie: nach dem Spielen prüfen, ob das Risiko reicht; auf SCHWER manchmal drüberschicken (3B-4) | D8 |
| 1S13-2 | M | offen | Karamell, Kaugummi und Wolken bremsen über eine Dämpfung (`suessGround`, Faktor 3,2 geschätzt) statt über `surfOf`: im Spiel abstimmen | M17 |
| 1S13-3 | N | offen | Länge und Ladezeit prüfen (Runde 21 s, Rennen 60 s; zweiter Sprite-Satz `goo2` je Auto) (1P-2, 1P-3) | T19 |

### 1S14 SPIELZIMMER
| ID | Prio | Status | Aufgabe | Herkunft |
|---|---|---|---|---|
| 1S14-1 | H | offen | Startgerade hat nur 115 px bis zur Kurve, die letzte Reihe steht knapp davor (1A-4) | D7 |
| 1S14-2 | M | offen | Computerautos bekommen auf der Kissen-Geraden Schub und fallen nie; auf LEICHT ab und zu einen Sturz zulassen (mit 3B abstimmen) | M19 |
| 1S14-3 | N | offen | Der Saugroboter erwischt fast nie ein Computerauto: gezielter in Richtung Straße lenken, wenn er lange niemanden erwischt hat | M20 |
| 1S14-4 | N | offen | Knete-Spritzer bleiben dauerhaft auf der Reifenspur-Ebene und färben die Straße ein: seltener oder blasser, Ebene verblassen lassen (3E-6) | G13 |
| 1S14-5 | M | offen | Lied noch nicht angehört (1M-2) | Spielzimmer-Prototyp |

### 1S15 REGENBOGEN
| ID | Prio | Status | Aufgabe | Herkunft |
|---|---|---|---|---|
| 1S15-1 | M | offen | Lieder `rainbow`, `rainbowStorm`, `rainbowFinal` ungehört; Wechsel an der Rundengrenze prüfen (1M-1) | B11 |
| 1S15-2 | N | offen | Wolken und Löcher als Rauschen, Gewitterwolken sehen wie Steine aus, Münzinseln ohne Glanz, nur eine Parallaxe-Ebene; Wolkenzug und drehendes Podest aus dem Plan | G14, Strecken.md 15 |
| 1S15-3 | M | offen | Farbbahnen und Sprung mit Kindern prüfen (siehe 3D-4) | Regenbogen-Prototyp |

## 1C – Cups und Freischaltung

| ID | Prio | Status | Aufgabe | Herkunft |
|---|---|---|---|---|
| 1C-1 | H | verschoben nach Phase 2 (2C-0) | Freischaltung der Strecken und Cups: Entscheidung E1 fällt am Anfang von Phase 2 (Nutzer, 2026-10-21). Bis dahin bleibt es wie heute: Cup 1–5 immer offen, Supercup nach Cup 1–4, Superdupercup nach Cup 5 | M1 |
| 1C-2 | H | offen | **Siegerehrung vorzeitig beenden darf nichts kosten:** Wer die Siegerehrung wegklickt, bekommt trotzdem Pokal und neues Auto (Ergebnis und Freischaltung beim Rennende speichern, nicht beim Verlassen des Bildschirms) | Meldung STRAND 00:04:22 (mit Bild 00:04:11) |
| 1C-3 | H | offen | Platzberechnung im Grand Prix prüfen: Platz 41 und 45 am Ende (Ursache vermutlich der nie laufende Reset von `finCount`, behoben in `845bdaa`, im Spiel nicht nachgeprüft). Test mit Wurmloch, Schwarzem Loch, Respawn: Rang nur aus Runde und Fortschritt | M14, M15, M16 |
| 1C-4 | M | offen | Mit 15 Strecken: Custom Cup (`CUSTOM_MAX` 12), Supercup und Superdupercup (Streckenzahl, Dauer), Cup-Wahl und Anzeige prüfen | neu |
| 1C-5 | N | offen | Cup 5: die Wertung Superdupercup dauert 15 Rennen; prüfen, ob das sinnvoll ist oder ein Zwischenstand gespeichert werden soll | neu |

## 1P – Performance

| ID | Prio | Status | Aufgabe | Herkunft |
|---|---|---|---|---|
| 1P-1 | H | offen | **Ziel (E2, entschieden): flüssige 60 fps im Browser auf Mobilgerät und Desktop-PC; messen auf beiden.** Ladezeit-Ziel: Bau einer Strecke im Hintergrund unter 1 s. Außerdem messen: Bauzeit je Strecke (Weltall 0,8 s, Süß 0,8 s, Regenbogen etwa 2 s), Speicher (Regenbogen zwei Überlagerungen je 4,7 MB), Größe von `dist/index.html`. Dev-Hilfe `mudracer.perf` | T18, T19, T23 |
| 1P-2 | M | offen | **Rundenlänge (E2, entschieden):** je nach Schwierigkeit der Strecke zwischen 20 s (frühe Strecken) und 60–90 s (späte Strecken), steigend mit der Streckennummer. Gemessen wird erst später (Nutzer, 2026-10-21), nicht jetzt. Bekannte Werte aus früheren Prüfungen: Wüste 13–16 s, Süß 21, Weltall und Regenbogen 25–30, Spielzimmer 26–28. Zu kurze Runden verlängern (Wüste, Eis …), zu lange kürzen. Die Länge je Strecke steht in der Tabelle „Strecken im Überblick“ | T18 |
| 1P-3 | M | offen | Regenbogen: Überlagerungen nur für die Straßen-Rechtecke halten; Schleifen über alle Pixel in `rainbowTerrain` beschleunigen | T23 |
| 1P-4 | N | offen | Reifenspuren landen jedes Frame auf einer dauerhaften Ebene: Deckung begrenzen, damit sie nicht zum dunklen Band wird (auch Optik, siehe 3E-6) | G6 |

## 1M – Musik und Ton

| ID | Prio | Status | Aufgabe | Herkunft |
|---|---|---|---|---|
| 1M-1 | H | offen | **Rundenwechsel im Lied:** Weltall (`spaceLast`), Vulkan (`volcanoFast`), Regenbogen (`rainbowStorm`, `rainbowFinal`) wechseln per `swap` an der Rundengrenze und ruckeln womöglich; nur an Taktgrenzen wechseln, Tonerzeugung nicht doppelt aufbauen | B10, B11, B13 |
| 1M-2 | M | offen | **Alle Lieder anhören** (Weltall, Spielzimmer, Regenbogen noch nie), Grundsatz 8 für jede Strecke bestätigen: eigenes Lied, passt zu Thema, Mudracer und Rennen | Prototypen |
| 1M-3 | N | offen | Leitmotive der Cups (ein wiederkehrendes Motiv je Cup) | Strecken.md |

## 1T – Technik, Skills, CLAUDE.md (Phase 1)

| ID | Prio | Status | Aufgabe | Herkunft |
|---|---|---|---|---|
| 1T-1 | H | erledigt (Roadmap-Umbau) | `CLAUDE.md` auf `ROADMAP.md` umgestellt (Doku-Pflicht, Eingang, Grundregel), Skill `strecke` angepasst, neuer Skill `roadmap` (Eingang sichten, Roadmap pflegen) | – |
| 1T-2 | M | erledigt (Roadmap-Umbau) | Streckendesign-Grundsätze 12–14 in `CLAUDE.md`: Matsch ist eine Entscheidung (1A-1), ein Wasch-Konzept je Strecke (1A-2), Ziellinie und Start immer sichtbar (1A-5) | Meldungen 2026-10-16/17 |
| 1T-3 | H | offen | `check.js` erweitern: Ziellinie sichtbar (1A-5), Matschstellen umfahrbar (1A-1), Wasch-Stelle vorhanden und ihre Wirkung (1A-2), Ereignis-Ankündigung vorhanden (1A-3), `checkAll({ sim: true })` auf allen drei Stufen in einem Lauf (`diffs`), Messung der Performance (1P-1). Skill `strecke` um die **Abnahme-Checkliste** je Strecke ergänzen (Haken in der Tabelle oben) | – |
| 1T-4 | M | offen | Tests in `test/`: Cups und Freischaltung (1C-1), Siegerehrung speichert (1C-2), Rangliste mit Sonderfällen (1C-3) | I14 |
| 1T-5 | M | offen | `mudracer.check` meldet je Strecke eine Kurzzeile (Start, Abkürzungen, Stürze, Rundenzeit), damit die Abnahme in der Tabelle eine Zeile bleibt | T25 |
| 1T-6 | H | offen | **Abschluss Phase 1:** `main` und `map_pack` zusammenführen (Konflikte in `src/audio.js`, `src/input.js`, `src/update.js`: die `map_pack`-Fassung nehmen, `git merge map_pack` auf `main`, dann `git checkout --theirs …`; danach `npm install`, lint, test, typecheck), `npm run build`, Artifact aktualisieren | T16 |
| 1T-7 | N | offen | `Obsidian/Mudracer/Strecken.md`, `Autos.md`, `Spielmodi.md` bleiben der Ist-Stand und werden mit jeder Änderung angepasst (Verweise auf `ANALYSE.md` darin meinen die Git-Historie, neue Verweise gehen auf `ROADMAP.md`) | – |
| 1T-8 | N | erledigt (CLAUDE.md: keine Feature-Abschluss-Frage) | Solange Punkte der Phase des aktuellen Branches offen sind, fragt Claude nicht nach dem Feature-Abschluss und publisht nicht (Ausnahme in `CLAUDE.md`, Abschnitt „Feature-Abschluss und Publish“) | Nutzer 2026-10-22 |
| 1T-9 | M | erledigt (Skill mechanik) | Neuer Skill `mechanik` (`.claude/skills/mechanik/SKILL.md`): Kurzabriss und Index der Mechaniken (Spielschleife, Streckenfelder, Boden-Codes, tiefes Wasser und Brücken, Schmutz und Waschen, Physik, Fallen und Sprünge, KI, Runden, Ereignisse, Zeichnen, Zustand), verlinkt aus `CLAUDE.md` und Skill `strecke`; wird mit jeder Änderung an einer dort beschriebenen Mechanik nachgezogen | Nutzer 2026-10-22 |

---

# Phase 2 – Cars & Customizations

**Ziel:** Das Spiel hat nur noch Autos, die man fahren kann. Autos fühlen sich spürbar verschieden an. Es gibt mehr Anpassungen, und fast alles davon will verdient sein: hinter jeder Schwierigkeitsstufe jedes Cups liegt etwas. Eine Achievement-Übersicht zeigt alle Freischaltungen mit Bedingung.

**Fertig, wenn:**
1. Das Starterfeld besteht nur aus spielbaren Autos (keine Füllautos GRAU, BEIGE, OLIV, WEINROT, TUERKIS, LILA, GOLD mehr).
2. Die Handhabung unterscheidet sich messbar und spürbar (Test und Spielgefühl), alle Autos bleiben konkurrenzfähig (Balance-Version erhöht, alte Rekorde umgerechnet).
3. Jede Zelle der Tabelle Cup × Stufe (5 Cups × LEICHT/MITTEL/SCHWER/PRO) ist mit einer Belohnung belegt oder bewusst leer; die PRO-Spalte ist angelegt und wird mit Phase 3 scharf.
4. Die Achievement-Übersicht zeigt alle Freischaltungen und Bedingungen und kennt den Fortschritt.
5. Technik-Block 2T erledigt, Feature-Abschluss gemacht.

## 2A – Autos

| ID | Prio | Status | Aufgabe | Herkunft |
|---|---|---|---|---|
| 2A-1 | H | offen | **Füllautos abschaffen:** Gegner kommen aus den spielbaren Autos (Entscheidung E3: Anzahl Autos). Startgitter bis 10 Autos (5 Reihen), `startGP` mischen per Fisher-Yates statt `sort(() => Math.random() - .5)`, Aufstellung im Grand Prix nach Punktestand (umgekehrt) statt immer Reihe 1 | M13, M4 |
| 2A-2 | H | offen | **Neue spielbare Autos** (Zahl und Themen E3), je mit Sprite (Drehungen und Schmutzstufen), Hupe, Motorklang, Feinwerten und Freischaltung; Ablauf im neuen Skill `auto` (2T-1) | I1 |
| 2A-3 | H | offen | **Handhabung spürbar verschieden:** zusätzlich zu `speed`, `mud`, `acc`, `turn`, `engine` Masse, Radius (zwei Kreise aus der Sprite-Länge), Grip/Drift pro Auto. Gegen Hitboxen, die nicht zum Bild passen (Feuerwehr ragt in Bäume, Quad prallt ohne Berührung ab). Optional Drift/Handbremse mit Mini-Boost (Entscheidung E4) | M6, G8, I6 |
| 2A-4 | H | offen | **Balance:** Rundenzeit je Auto und Strecke in einer Spanne (heute ±3 %), dazu bewusste Nischen („gut für“ je Strecke aus `Strecken.md`); Dev-Hilfe `mudracer.checkCars`; `BAL` erhöhen, `BAL_OLD` pflegen | I1, Grundregel |
| 2A-5 | M | offen | Gras bremst wie Matsch, macht aber nicht schmutzig; für Geländeautos lohnen Kurvenschnitte über Gras: Gras etwas langsamer oder leicht schmutzig | M7 |
| 2A-6 | M | offen | Der Spieler ist im Pulk schwer zu finden und volle Schmutzstufe macht Autos zu braunen Klecksen: Schmutz auf etwa 70 % Fläche begrenzen, Dach und Umriss sauber; 1P-Schild prüfen | G3 |

## 2B – Customizations

| ID | Prio | Status | Aufgabe | Herkunft |
|---|---|---|---|---|
| 2B-1 | H | offen | **Welche Anpassungen gibt es** (Entscheidung E5): heute Lack in 11 Farben (alle sofort offen). Kandidaten: Aufkleber, Felgen, Spoiler, Hupe, Startnummer, Reifenspur-Effekt, Fahrer | I9, M11 |
| 2B-2 | H | offen | Anpassungen freischaltbar machen (Farben, Aufkleber … als Belohnung aus 2C), Werkstatt zeigt Gesperrtes mit Bedingung; Speicherschlüssel `mudracer-paint-<id>` bleibt gültig, neue Daten bekommen neue Schlüssel | M11 |
| 2B-3 | N | offen | Upgrades (Motor, Reifen, Getriebe) als Multiplikatoren: nur falls Entscheidung E5 sie will; Risiko Balance, im Grand Prix und Zeitfahren neutralisieren | I9 Variante A |

## 2C – Freischaltungen

| ID | Prio | Status | Aufgabe | Herkunft |
|---|---|---|---|---|
| 2C-0 | H | offen | **Als Erstes: E1 klären und bauen** (Freischaltung der Cups und Strecken untereinander; aus 1C-1 hierher verschoben). Cup 5 bekommt dabei seine Bedingung | M1, 1C-1 |
| 2C-1 | H | offen | **Tabelle Cup × Stufe → Belohnung** festlegen (5 Cups × 4 Stufen, plus Supercup, Superdupercup): Autos, Lacke, Aufkleber …. Bestehende Autofreischaltung (1. Sieg in Cup 1–5) bleibt gültig | M1, I7, D4 |
| 2C-2 | H | offen | **Zentrale Freischalt-Tabelle im Code** (z. B. `unlocks.js`): Bedingung als Funktion, Belohnung, Text; speist Autowahl, Werkstatt, Siegerehrung und Achievements. Gespeichert wird nur über `save.js`; die vorhandenen Trophäen-Schlüssel `mudracer-gp-<cup>-d<stufe>-<auto>` (Stufe 3 = PRO) bleiben die Quelle | T13 |
| 2C-3 | M | offen | Weitere Ziele (nicht nur Cups): Zeitfahren unter X s, alle Strecken sauber beenden, 3× Waschanlage, Matschfahrt-Ziele; Kindermodus schaltet für das normale Spiel nichts frei (bleibt) | I7, M10, M11 |
| 2C-4 | M | offen | Die Siegerehrung zeigt, was neu freigeschaltet wurde (Auto, Pokal, Anpassung); in der Cup-Wahl ist die Belohnung als drehendes Geschenk erkennbar (bleibt) | Meldung STRAND, Spielmodi.md |

## 2D – Achievement-Übersicht

| ID | Prio | Status | Aufgabe | Herkunft |
|---|---|---|---|---|
| 2D-1 | H | offen | Neuer Menüpunkt (Entscheidung E6: Platz im Hauptmenü): alle Freischaltungen aus 2C-2 als Liste, gesperrt mit Bedingung und Fortschritt, freigeschaltet mit Datum/Auto; PRO-Einträge bis Phase 3 als „bald“ markiert | – |
| 2D-2 | M | offen | Mockup in `Obsidian/Mudracer/Spielmodi.md` ergänzen (Ist-Stand der Menüs bleibt), Menü im Kindermodus klären (3D) | – |

## 2T – Technik, Skills, CLAUDE.md (Phase 2)

| ID | Prio | Status | Aufgabe |
|---|---|---|---|
| 2T-1 | H | offen | Neuer Skill `auto`: Ablauf für ein neues Auto (Sprite, Feinwerte, Hupe, Motor, Freischaltung, Balance-Prüfung, `Autos.md`) |
| 2T-2 | M | offen | `CLAUDE.md`: Regeln für Autos und Freischaltungen (Balance-Version bei jeder Wertänderung, Spielstand-Grundregel, `Autos.md` abgleichen); `Obsidian/Mudracer/Autos.md` auf den neuen Stand bringen, sobald es neue Autos gibt |
| 2T-3 | M | offen | Tests: Freischalt-Tabelle (jede Belohnung erreichbar, kein Zyklus), Spielstand-Migration, Balance-Spanne (`checkCars` als Test, soweit ohne Canvas möglich) |
| 2T-4 | N | offen | `check.js`: Prüfung, dass jedes Auto jede Strecke zu Ende fährt (Auto × Strecke), ersetzt das manuelle „jedes Auto mit jeder Farbe“ (T1) |

---

# Phase 3 – Game_Modes

**Ziel:** Die Spielmodi sind überarbeitet und das Spiel als Ganzes poliert. Der normale Modus hat vier Stufen: LEICHT, MITTEL, SCHWER, PRO. Alle gewünschten Einstellungen sind eingebaut, ohne das Spiel zu überladen. Der Kindermodus passt für Kinder. Die KI verhält sich auf jeder Strecke richtig, und einzelne Autos haben ein eigenes Verhalten.

**Fertig, wenn:**
1. Die vier Stufen sind definiert, gebaut, getestet (`checkAll({ sim: true })` auf allen vier Stufen ohne festhängende Autos) und überall sichtbar.
2. Die Optionen decken alles Gewünschte ab und sind nach „einfach“ und „erweitert“ geordnet.
3. Der Kindermodus ist mit Kindern gespielt und angepasst.
4. Die KI hat Biss und Charakter, auf jeder Strecke.
5. Die Polier-Liste (3E) ist abgearbeitet, Release-Checkliste (3T) erfüllt, Full Release veröffentlicht.

## 3A – Schwierigkeitsstufen

| ID | Prio | Status | Aufgabe | Herkunft |
|---|---|---|---|---|
| 3A-1 | H | offen | **PRO einführen** (Entscheidung E7: was PRO ist: KI-Tempo über 1,0, Ideallinie mit Kurvenbremsen, kein oder schwaches Gummiband, volle Ereignisse, mehr Schmutz). Stufe 3 in `diff.js` `DIFFS`; Rekorde und Trophäen bekommen die Stufe im Schlüssel (`-d3`), vorhandene Schlüssel bleiben | M2, I8 |
| 3A-2 | H | offen | **Jede Stufe beschreiben und anpassen:** KI-Gas, Gummiband, Fehlerquote, Streckeneffekte (heute im Grand Prix ab MITTEL an), Rundenzahl (heute fest 3), Schmutz. Tabelle in `Spielmodi.md` | M2, M12, I8 |
| 3A-3 | M | offen | Die Schwierigkeit wird im Rennen oben angezeigt (HUD) und in der Siegerehrung/Rekordliste | Meldung VULKAN 00:24:25 |
| 3A-4 | M | offen | Aktivierung der Belohnungen für PRO in der Freischalt-Tabelle (2C-2) und der Achievement-Übersicht (2D-1) | – |
| 3A-5 | M | offen | Matsch/Wasser-Menge pro Stufe nur, wenn es sich lohnt (eine Streckenvariante wird gebaut und gecacht); Rekorde unter abweichenden Regeln bekommen ein Suffix am Schlüssel | I8, Advanced-Konzept |

## 3B – KI

| ID | Prio | Status | Aufgabe | Herkunft |
|---|---|---|---|---|
| 3B-1 | H | offen | **Biss:** auf SCHWER und PRO fährt die KI die Ideallinie mit Kurvenbremsen statt Gasdrossel, ein Rivale pro Rennen schneller als 1,0; Gegner nie schneller als ein fehlerfreier Spieler gilt nicht mehr für PRO | M2 |
| 3B-2 | H | offen | **Verhalten pro Auto** (Fahrstile: Polizei sauber, Monster rammt, Traktor stur, Flitzer riskant); Überholen, Blocken, Hupe wirkt | M3, I5 |
| 3B-3 | H | offen | **Jede Strecke korrekt:** je Strecke prüfen, ob die KI die Hooks (`lane`, `target`) richtig nutzt: Strecken-Ereignisse, Abkürzungen, Wasch-Stellen (1A-2), Schluchten, Furten, Sumpf. `checkAll({ sim: true })` auf allen vier Stufen: 0 festhängende Autos, Stürze begrenzt | D8, D19, M19, M20, M21, D28 |
| 3B-4 | M | offen | KI nimmt Abkürzungen mit Risiko (Süß-Trittsteine, Vulkan-Geysir, Garten-Steine) auf SCHWER/PRO, wenn sie passen | D8, D19 |
| 3B-5 | M | offen | Beim Zieldurchlauf des Spielers wird sofort gewertet: Gegner 2–3 s weiterfahren lassen, knappe Zieleinläufe | M5 |
| 3B-6 | N | offen | Nur das Spielerauto hat einen Motor: 2–3 leise Gegnermotoren in der Nähe | B5 |

## 3C – Spielmodi und Einstellungen

| ID | Prio | Status | Aufgabe | Herkunft |
|---|---|---|---|---|
| 3C-1 | H | offen | **Einstellungen-Konzept** (Entscheidung E8): ein Optionsmenü mit „einfach“ und „erweitert“, damit nichts überladen wirkt. Kandidaten: Runden 1–5 (heute fest 3), Gegner 0–9 (heute 1–7), Streckeneffekte global und je Ereignis, Geist, Steuerung/Belegung, getrennte Regler Musik/Effekte, weniger Blinken, Farbschwäche-Hilfe | M12, B4, B6, B7, B8, I3, Spielmodi.md |
| 3C-2 | M | offen | Einzelstrecke und Zeitfahren: Optionen wie in `Spielmodi.md` geplant (Gegner 0–9, Runden 1–5, Schwierigkeit, Effekte); Rekorde bei abweichenden Regeln mit Suffix am Schlüssel | Spielmodi.md |
| 3C-3 | M | offen | **Matschfahrt:** eine feste Strecke (Seed 4242), keine Zeit, kein Rekord: Sterne-Ziele, Bestzeit, täglich wechselnder Seed | M10 |
| 3C-4 | N | offen | Texte an einem Ort (Texttabelle), wenn später Sprachen kommen sollen (siehe „Nach dem Release“) | B9 |

## 3D – Kindermodus

| ID | Prio | Status | Aufgabe | Herkunft |
|---|---|---|---|---|
| 3D-1 | H | offen | **Konzept** (Entscheidung E9): Heute immer LEICHT, keine Streckeneffekte, alle Autos und Cups offen. Festlegen, was „kindgerecht“ zusätzlich heißt: kürzere Rennen (2 Runden), Bildhinweise ohne Text, größere Schrift, keine Sturzstrafe, Lenkhilfe, Rundenzeiten ausblenden | I8, D1, M12 |
| 3D-2 | M | offen | Einmaliger Bildhinweis beim ersten starken Verschmutzen: Schmutz bremst, Wasser hilft | D3 |
| 3D-3 | M | offen | Kurvenpfeile am Rand oder Richtungsanzeige, besonders auf verwinkelten Strecken | D6 |
| 3D-4 | M | offen | Mit Kindern spielen lassen und anpassen (Regenbogen, Farbbahnen, Sprung, Spielzimmer als Test) | 1S15-3 |
| 3D-5 | N | offen | Wie verhält sich der Kindermodus zu Freischaltungen und Achievements (Belohnungen nur im normalen Spiel, Kinder sehen aber alles)? | 2C-3 |

## 3E – Polish

| ID | Prio | Status | Aufgabe | Herkunft |
|---|---|---|---|---|
| 3E-1 | H | offen | Autos beim Drehen: Nearest-Neighbour in 48 Schritten verformt Räder und 1-px-Linien; RotSprite oder 8-fach vergrößert drehen und per Mehrheitsfarbe verkleinern | G1 |
| 3E-2 | H | offen | Unter Faktor 3 nicht ganzzahlig skaliert (1280×720 → 2,67; Handy quer → 1,44), Flimmern: intern ganzzahlig vergrößern oder ganzzahlig mit Rand | G2 |
| 3E-3 | M | offen | Gemischte Pixelraster: Kois (`rotate`/`scale`), Abseitspfeil, geglättete Schattenellipsen, fliegende Autos | G5 |
| 3E-4 | N | offen | Fliegende Autos liegen unter Baumkronen: nach der Kronen-Ebene zeichnen | G9 |
| 3E-5 | N | offen | Schmale Menükarten (ZEITFAHREN, WERKSTATT) füllen die Breite randlos | G10 |
| 3E-6 | M | offen | Reifenspuren verblassen nie, die Ideallinie wird ein dunkles Band (siehe 1P-4, 1S14-4) | G6, G13 |
| 3E-7 | M | offen | HUD für Ältere: Rundenzeit und Abstand zum Vordermann, im Kindermodus schlank lassen | G12 |
| 3E-8 | M | offen | Gesamtdurchgang: jede Menüansicht, jedes Auto, jede Strecke, jede Stufe in einer Sitzung; Menü-Vorschaubilder (Wald dunkel, Strand ohne Flut) | – |

## 3T – Technik, Skills, CLAUDE.md (Phase 3) und Release

| ID | Prio | Status | Aufgabe |
|---|---|---|---|
| 3T-1 | H | offen | Neuer Skill `ki` (Fahrstile, Profile, Prüfung mit `check` über alle Stufen); `check.js` mit `diffs: [0,1,2,3]` |
| 3T-2 | M | offen | `CLAUDE.md` und `Obsidian/Mudracer/Spielmodi.md`: Stufen, Optionen, Kindermodus, Menüfluss als Ist-Stand pflegen |
| 3T-3 | M | offen | Tests: Rundenzählung, Checkpoints, Zug- und Kollisionsfälle (bisher nur `score()`/Rangliste u. a., früher I14) |
| 3T-4 | H | offen | **Release-Checkliste** (Skill `release`): lint, test, typecheck, Build, alle Strecken × 4 Stufen `checkAll`, Spielstand-Migration mit einem alten Spielstand, Performance-Ziele (1P-1), Artifact aktualisieren, Version/Datum, Doku abgeglichen |

---

# Offene Entscheidungen

Diese Punkte entscheidet der Nutzer, bevor die Phase beginnt oder der betroffene Punkt dran ist. Claude fragt rechtzeitig nach; die Empfehlung ist ein Vorschlag, kein Beschluss.

| ID | Phase | Frage | Empfehlung |
|---|---|---|---|
| E1 | 2 (Beginn) | Wie schalten sich Cups und Strecken untereinander frei? (Cup n+1 nach Cup n? Einzelstrecke/Zeitfahren erst, wenn die Strecke im Grand Prix gefahren wurde? Gilt jede Stufe, oder reicht LEICHT?) | Cups der Reihe nach (Cup n+1 nach erstem Sieg von Cup n auf beliebiger Stufe), Strecken in Einzelstrecke und Zeitfahren offen, sobald der Cup freigeschaltet ist; Kindermodus öffnet alles |
| E2 | 1 | **Entschieden (2026-10-21):** flüssige 60 fps im Browser auf Mobil und Desktop-PC; Rundenlänge je nach Schwierigkeit der Strecke zwischen 20 s und 60–90 s. Ladezeit: der Bau einer Strecke dauert im Hintergrund unter 1 s (Regenbogen mit etwa 2 s liegt noch darüber, 1P-3). Damit ist E2 vollständig entschieden | – |
| E3 | 2 | Wie viele spielbare Autos? Heute 10 spielbar und 7 Füllautos. Das Startgitter fasst 10 Autos | 10 bis 14: die Füllautos werden nicht alle ausgebaut; Gegner kommen aus den spielbaren |
| E4 | 2 | Gibt es Drift/Handbremse mit Mini-Boost (I6)? | Nein im ersten Schritt; zuerst Masse, Grip, Radius; Drift später, falls es sich anbietet |
| E5 | 2 | Welche Anpassungen: Aufkleber, Felgen, Spoiler, Hupe, Startnummer, Spur-Effekt, Fahrer? Upgrades (Variante A) ja oder nein? | Nur kosmetisch (Farben, Aufkleber, Felgen, Hupen, Spur-Effekt), keine Upgrades |
| E6 | 2 | Wo sitzt die Achievement-Übersicht (eigene Karte im Hauptmenü oder in der Werkstatt)? Sind gesperrte Einträge sichtbar mit Bedingung? | Eigene Karte, gesperrte Einträge sichtbar mit Bedingung |
| E7 | 3 | Was ist PRO genau (Tempo, Gummiband, Ereignisse, Fehlerquote, Schmutz)? | KI-Gas bis 1,05, kein Gummiband, volle Ereignisse, Ideallinie mit Kurvenbremsen |
| E8 | 3 | Wie viele Einstellungen und welche (siehe 3C-1)? | Zwei Seiten (einfach/erweitert), Runden und Gegner je Modus, Rest im Optionsmenü |
| E9 | 3 | Was soll der Kindermodus zusätzlich können (3D-1)? Altersgruppe? | Zielgruppe etwa 5 bis 9 Jahre; 2 Runden, Bildhinweise, Pfeile, keine Zeiten |

---

# Nach dem Release (ungeplant)

Große Ideen, die nicht zum Full Release gehören. Sie wandern erst in eine Phase, wenn der Nutzer es sagt.

| ID | Idee | Herkunft |
|---|---|---|
| N-1 | **Items/Power-ups** (Matschbombe, Schlammschild, Nitro): würde das Rennen am stärksten verändern; bisher nur Boost-Felder | I4 |
| N-2 | **Lokaler Zwei-Spieler-Modus** (Splitscreen oder geteilte Tastatur) | I12 |
| N-3 | **Drift/Handbremse mit Mini-Boost** (falls nicht in 2A-3) | I6 |
| N-4 | **Gamepad** und freie Tastenbelegung (`Backspace` als Zurück) | B4, I13 |
| N-5 | **PWA/Offline** mit Manifest und Service Worker (Schrift ist schon eingebettet) | B9, I15 |
| N-6 | **Mehrsprachigkeit** (bisher nur Deutsch, Texte in den Modulen verteilt) | B9 |
| N-7 | **Bug-Meldung ohne Tastatur** (gestrichen am 2026-10-16, Melden ist nur im Dev-Server am PC nötig) | I19 |

---

# Erledigt (Kurzfassung)

Technik-Umbau (2026-10-12/13, Branch `map_pack`), Details in der Git-Historie von `ANALYSE.md`: Strecken werden erst bei Bedarf in Häppchen gebaut (T3), Sprites vorgebaut (T4), fester Physikschritt 1/60 s (T5), sichtbare Fehler und NaN-Wächter (T6), Zustand in `G`/`UI`/`PREFS` und keine Importkreise (T7), eingebettete Schrift (T8), ESLint, Vitest und Typcheck (T9), Namenskollisionen (T10), Hindernis-Gitter (T11), Prüfung der Ereignis-Koordinaten (T12), ein Spielstand-Modul mit Datei-Export (T13), gekachelte Ebenen (T14), Weltgröße je Strecke `W`/`H` (T15), Hook-Registry für Sonderstrecken (T26), Duplikate zusammengelegt (T27), Boden-Codes an einer Stelle (T21, T22), Prüfskript `check.js` und Skill `strecke` (T25), Platz-Reset zwischen Rennen (M16, nicht nachgeprüft: 1C-3), Touch-Steuerung (B1–B3), F8-Meldung im Dev-Server (B14), Eis-Rework Rev 1 (D14–D16, D25 für Eis, B12), Wüste Rev 1 (D11, D12, D28 und Teile von D9, D10, D13).
