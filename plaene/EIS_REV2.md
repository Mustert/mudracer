# EIS Rev 2 – Umsetzungsplan

Stand: 2026-10-24, Branch `map_pack`. Eigener Plan für den Komplettumbau der Eisstrecke (Strecke 9, Cup 3). Er steht bewusst nicht in `ROADMAP.md` (`Obsidian/Mudracer/ROADMAP.md`); dort bleibt nur der Block `1S9` mit einem Verweis hierher. Grundlage: Mockup `Obsidian/Mudracer/Screenshots/EIS_improvements.jpg` (die Ziffern unten sind die Ziffern im Mockup; links die alte Karte, rechts die neue), Rev 1 in `src/ice.js` und `src/icemap.js`, Skills `strecke` und `mechanik`, Streckendesign-Grundsätze in `CLAUDE.md`, Vorlage für Aufbau und Ablauf: `plaene/WUESTE_REV3.md`.

**Status je Paket** wird hier gepflegt (Abschnitt „Arbeitspakete“). Erst beim Abschluss (E8) wird `ROADMAP.md` nachgezogen: 1S9 auf den neuen Stand, Tabelle „Strecken im Überblick“, 1A-4/1A-5, 1P-1.

## Ziel in einem Satz

Die Eisstrecke wird zum Wintersport-Berg: hinter der Ziellinie fährt ein Sessellift alle Autos nach oben, von dort geht es durch eine lange Bobbahn, über eine Skisprungschanze in den Wald, bergauf zu den Serpentinen, auf denen Schneebälle herunterrollen, und zum Schluss über einen großen Eissee, der von Runde zu Runde löchriger wird.

## Entscheidungen

Vom Nutzer vorgegeben (Prompt 2026-10-24):

| Frage | Entscheidung |
|---|---|
| Umfang | **Kompletter Umbau**, das Berg-Thema wird zentral; viele Elemente der alten Karte werden wiederverwendet (Bobbahn-Bande, Schanze, Gefälle, Eissee mit Rissen, Schneekugel, Einschneien, Schneewehen, Dorf, Pinguine, Farben) |
| Entfällt | **Frost (vereisende Kurven) und schlechtes Wetter**: Ereignis `frost`, dichter Schneefall, Eisblumen. Ebenso der Gletscher im Innenfeld, der Gletscherbach mit Holzbrücke, die heiße Quelle (ersetzt durch den Fön), das Boost-Pad vor der Schanze |
| Tiere | Rentiere, Pinguine, Eisbären an der Felswand (16) sind **rein optisch**; das Ereignis `pinguine` (Pinguine als Hindernis) entfällt |
| Ereignisse | **`schneeball`** (Schneebälle auf den Serpentinen, 14) und **`eisbruch`** (Einbrechen im Eissee, 15), beide einzeln ausschaltbar |
| Schanze | Kein Beschleunigungsstreifen (erst einmal ohne versuchen); der Zaun zum Lift kann nicht übersprungen werden |
| Name, Rekorde | Name `EIS` bleibt, `rev: 2` (neue Rekorde, alte bleiben gültig). Lied `ice` bleibt, Schichten werden neu gebunden (siehe E8) |

Mit dem Nutzer geklärt (2026-10-24):

| Frage | Entscheidung |
|---|---|
| Kartengröße | **Hochkant** wie im Mockup, so weit gestaucht wie möglich (Ziel etwa 1000 × 1500); größer nur, wenn die Bauzeit nicht über der der Wüste liegt |
| Lift | **Keine Warteschlange**, Autos auf dem Lift dürfen sich überlappen, ohne sich wegzuschieben |
| Löcher im See | **Bleiben dauerhaft offen**, keine Wiedervereisung |
| Polarlicht | Bleibt in der letzten Runde über dem See (Optik) |
| Liftdauer | Start mit etwa **5 s** (200 px/s), danach nach Spielgefühl einstellen |

## Grundriss

Der Mockup ist **hochkant** (etwa 2 : 3). Die Kacheln im Mockup stammen aus der alten Karte im selben Maßstab (alte Karte 800 px ≙ 557 px im Bild), daraus ergeben sich die Richtwerte unten: Spielpixel ≈ (Bildpixel − Ursprung) / 0,70.

```
 x:  0      170        330                720           1000  1100
 y ┌─────────────────────────────────────────────────────────────┐
  0 │ ╭Bergstation─→ (4) BOBBAHN ═══╗╔══╗ ╭─(5) Verlängerung ─╮      │
    │ ║  (3)          ═══════════════╝╚╗ ║ ╰────╮  ╭──────────╯      │
200 │ ║ ┃     ╭─(7) Schnee ← ← ← ← ← ← ←╚═╝←(6)─╯  ╰──╯               │
    │ ║ ┃     ▼ Schanze                                              │
400 │ ║ ┃  ~~~~~~~~~~~~~~~~ (8) WALD ~~~~ ━━━(14) Felswand━━━━━━━━━━  │
    │ L ┃  🌲   🌲  (Flug über   🌲        ╭──────────────────╮ ▼ ▼ ▼ │
600 │ I ┃(2)♚  🌲  die Bäume) 🌲   🌲     ╰─╮ (13) SERPENTINEN  │      │
    │ F ┃    🌲  (9) Tiefschnee   🌲  (12)╭─╯   Klippe dazwischen │     │
800 │ T ┃  🌲    🌲     🌲             ↑  ╰──────────────────╮──╯      │
    │ ║ ┃            (10)╭──╮ ← (11) Fön     bergauf          │        │
1000│ ║ ┃                ╰──╯                                 │        │
    │ ║    ══════ (16) Felswand mit Tieren ════════           │        │
1200│ 🏁(1)                                                   │        │
    │ ║ Start   ╭─(17)──  ≈≈≈≈≈ (15) EISSEE ≈≈≈≈≈ ──────────────╯        │
1500│ ╰─────────╯         ≈≈≈≈≈≈≈≈≈≈≈≈≈≈≈≈≈≈≈≈≈                           │
    └─────────────────────────────────────────────────────────────┘
```

Fahrtrichtung: Start unten links nach oben, sofort in den Lift (1), oben nach rechts in die Bobbahn (4, 5), zurück nach links auf die Schneestrecke (6, 7), Schanze nach unten in den Wald (8, 9), unten auf die Straße (10) mit dem Fön-Schlenker (11), bergauf nach rechts oben (12), Serpentinen hinunter (13, 14), rechts außen hinunter, über den Eissee nach links (15), unten zurück zur Startgeraden (17).

Richtwerte (in E1 festlegen, danach nur noch hier ändern):

| Stelle | Richtwert (Spielpixel) |
|---|---|
| Karte | etwa **1100 × 1640** (1,8 Mpx); Ziel ist, in E1 auf etwa **1000 × 1500** (1,5 Mpx) zu stauchen, siehe Performance |
| Ziellinie / Startgerade | x ≈ 72, Linie y ≈ 1280, Aufstellung y 1290–1500 (Fahrt nach oben) |
| Lift (1) | x ≈ 50–110 (zwei Seile), y 1280 → 220; Bergstation bei (80, 140) |
| Zaun (3) | x ≈ 172, y 310–1170 |
| Schach (2) | etwa (136, 700), zwischen Lift und Zaun |
| Bobbahn (4, 5) | x 200–1000, y 55–360, Ausfahrt (6) bei etwa (780, 360) |
| Schanze (7) | Tisch bei etwa (330, 350), Fahrt nach Süden |
| Wald (8, 9) | x 195–525, y 430–920 |
| Straße unten, Fön (10, 11) | U bei x 390–545, y 990–1155; Fön-Schlenker x 545–620 |
| Bergauf (12) | x ≈ 540–590, y 990 → 490 |
| Felswand (14), Serpentinen (13) | Wand y ≈ 445, x 560–990; vier Schenkel y ≈ 490 / 600 / 690 / 830–950 |
| Abfahrt rechts | x ≈ 1050, y 980 → 1460 |
| Felswand mit Tieren (16) | y ≈ 1200, x 240–920 |
| Eissee (15) | x 345–860, y 1290–1600 |

Rundenzeit-Schätzung (gefahrene Strecke etwa 5,5–6 km Pixel): Lift 5 s, Bobbahn 10 s, Schanze und Wald 7 s, Fön/Bergauf 6 s, Serpentinen 12 s, Abfahrt 4 s, See 6 s, Rest 3 s ≈ **50 s** (Wüste 31–40 s; 1P-2 erlaubt späten Strecken 60–90 s). Ist sie deutlich länger, zuerst Bobbahn-Verlängerung und Serpentinen kürzen.

## Die Elemente

| # | Element | Umsetzung |
|---|---|---|
| 1 | **Sessellift** | Direkt hinter der Ziellinie. Die Mittellinie läuft durch die Lifttrasse (Fortschritt, Platzierung). Neuer Boden-Code **70 Lifttrasse**. Wer sie erreicht, wird sofort eingehängt (`c.lift`, wie `c.tube` im Spielzimmer): Physik und Eingabe aus, das Auto fährt mit festem Tempo (Start mit 200 px/s, etwa 5 s; nach Spielgefühl nachstellen) die Trasse hinauf, leicht pendelnd, mit Sessel und Bügel gezeichnet; oben wird es mit dem Tempo der Straße in Fahrtrichtung abgesetzt. **Keine Wartezeit**: jedes Auto bekommt seinen eigenen Sessel im Moment der Ankunft, egal wie viele zugleich kommen. Abstände bleiben erhalten (alle brauchen gleich lang). Auch beim Start fahren alle zehn Autos direkt in den Lift. Über dem Lift laufen zwei Seile mit leeren Sesseln (nur im Sichtfeld gezeichnet), Tal- und Bergstation als Häuschen. Fallen, Zurück-Pfeil, Festgefahren-Prüfung und Gummiband sind auf dem Lift aus |
| 2 | **Weihnachtsmann und Grinch** | Im Schnee unter dem Lift (zwischen Lift und Zaun) sitzen sie an einem Schachbrett auf einem Baumstumpf: alle paar Sekunden zieht einer, der Grinch ärgert sich (Arme hoch), der Weihnachtsmann streicht den Bart; Rentier daneben. Reine Deko, im `top`-Bild statisch, nur die Figuren werden im Sichtfeld animiert (Hook `drawGround`) |
| 3 | **Zaun Lift / Wald** | Fester Zaun (Hindernis-Kreise, kräftig mit Schatten, Grundsatz 10) entlang der ganzen Trasse zwischen Lift und Wald-Piste. **Gilt auch in der Luft** (normale Hindernisse ohne `ground`), damit die Schanze nicht in den Lift springen lässt |
| 4 | **Bobbahn** | Bausteine aus Rev 1: Eisrinne (Code 12) mit federnder Bande (Hindernisse mit `bob: true`, `update.js`). Beginnt kurz nach der Bergstation |
| 5 | **Bobbahn-Verlängerung** | Die blaue Linie im Mockup: nach der alten Haarnadel nach rechts, dann drei Kehren hinunter (S-Schleifen), deutlich länger als bisher. Gefälle über `pushes` (die Bahn führt bergab), damit das Schlittern Spaß macht. Die Bande ist überall durchgehend, keine Abkürzung zwischen den Schleifen (Grundsatz 4) |
| 6 | **Ausfahrt** | Die Rinne endet auf der Schneestrecke (Code 1), mit kurzer Auslaufzone aus Eis |
| 7 | **Schanze** | Nach einer Linkskurve fährt man nach Süden auf den Schanzentisch (Baustein `jumps` aus Rev 1, ohne Boost-Pad). Der Sprung geht **bergab** und ist groß (Richtwert `vz` 220–240, über 1 s in der Luft), Fahnen am Tisch. Landung in jedem Fall möglich, kein Absturz. Schiefe Landung: Einschneien wie in Rev 1 (`iceAir`, `snowT`) |
| 8 | **Wald-Piste** | Offenes Feld (wie das Wüstenfeld: `T.alt`, kein Zurück-Pfeil, `c.safe` zählt), Boden neuer Code **71 Pulverschnee** (etwas langsamer als die Straße, macht nicht weiß). Tannen **nicht so dicht wie im Mockup**: Verteilung mit Mindestabstand (Poisson-Scheiben, etwa 45–55 px), entlang der Mittellinie immer eine fahrbare Gasse. **In der Luft fliegt man über die Bäume**: Bäume im Landebereich bekommen `ground: true` (dieselbe Regel wie die Felskante am Vulkan, `update.js`), nach der Landung sind sie Hindernisse. Auto in der Luft wird über den Baumkronen gezeichnet (siehe Technik). Die „8“ ist im Mockup im Wald versteckt: als kleiner Gag eine 8 aus Schnee oder Holz zwischen den Bäumen |
| 9 | **Tiefschnee** | Unterer Teil des Waldes: Tiefschnee (Code 2, macht weiß) als Senken und Schneewehen um Baumgruppen, mit sauberen Gassen daneben (Grundsatz 12: kürzere Linie durch Schnee gegen längere saubere) |
| 10 | **Straße wieder** | Unten fängt die Straße (Code 1) an, das Feld läuft wie ein Trichter auf sie zu (Schneewälle, Zaun), damit man nicht raten muss (Grundsatz 4) |
| 11 | **Fön** | Einziges Wasch-Konzept (Grundsatz 13): kurzer Schlenker rechts von der Straße durch eine Hütte mit großem Heißluftgebläse (Wärmeschimmer, rote Glühspiralen). Vorhandene `washMask` (wäscht nicht sofort), schmilzt den Schnee ab. Ankündigung durch Schild und Dampf. KI nur, wenn sie dreckig ist (Hook `target`, Schwellen wie in der Wüste) |
| 12 | **Bergauf** | Straße nach Norden; Gefälle als negativer Schub (`pushes` mit negativem `f`), Bild mit hellerem Hang und Schatten talwärts |
| 13 | **Serpentinen** | Vier Schenkel mit drei Kehren hinunter. Zwischen den Schenkeln **Bergklippe** (Fels mit harter Schattenkante nach unten, feste Hindernis-Kette an der Klippenkante), am Rand der Straße Schnee. Gefälle-Schub talwärts, die Kehren eng (bremsen nötig). Die Klippen sind fest, damit niemand zwischen den Schenkeln abkürzt (Grundsatz 4); Schenkel mindestens 80 px auseinander (Fortschrittssuche) |
| 14 | **Felswand mit Schneebällen** | Teilverschneite Felswand oberhalb der Serpentinen. **Ereignis `schneeball`**: alle 8–14 s löst sich an einer von drei Stellen ein Schneeball und kullert im Pfeilrichtung senkrecht über alle Schenkel hinunter, wird dabei größer und springt über die Klippen (kleine Hüpfer). Angekündigt durch Rieseln an der Wand, Schatten und Grollen (wie die Lawine aus Rev 1, Grundsatz 9). Treffer: Einschneien (`snowT`, freirütteln, danach weiß). Unten zerplatzt er an der Felswand ohne Haufen (sonst wächst die Strecke zu). In `T.ev.obst`, die KI weicht aus |
| 15 | **Eissee** | Großer See, über den die Hauptlinie quer führt (kein Umweg mehr außen herum). Glatteis (Code 12). **Ereignis `eisbruch`**: Risse und Löcher wie in Rev 1, aber eine Zelle bricht **abhängig von der Zahl der Autos** schneller (Richtwert: `BREAK = max(3, round(24 / Autos))` Überfahrten, bei 10 Autos 3, bei 4 Autos 6), und Löcher bleiben **dauerhaft offen** (keine Wiedervereisung). Dadurch wird der See in Runde 2 und 3 enger. **Ein Randstreifen (etwa 28 px) bricht nie** und ist sichtbar dicker (weißlich, mit Schneerand), damit niemand den See durch Einbrechen am Rand abkürzt. Außerdem höchstens etwa 45 % der Seefläche offen, und eine Zelle bricht nicht, wenn sie die letzte freie Verbindung quer über den See schließen würde (Prüfung über die Zellen, nicht über Pixel). Wer einbricht, wird **hinter** dem Loch auf der Linie abgesetzt (`c.safe`), nie am Ufer weiter vorn. Ohne Ereignis ist der See nur glatt |
| 16 | **Felswand mit Tieren** | Felswand zwischen Serpentinen-Bereich und See (fest). Davor und darauf Rentiere, Pinguine (Bilder aus Rev 1) und Eisbären, rein optisch, einige mit kleiner Animation im Sichtfeld |
| 17 | **Zurück zum Start** | Schneestrecke vom See nach links unten und in einer Kurve auf die Startgerade nach Norden |

Bleibt aus Rev 1: Farbpalette `K`, Bobbahn-Bande, Schanze und Landung, Gefälle-Schübe, Risse/Löcher (`paintHole`, Zellen), Einschneien (`iceStuck`), Schneewehen (`drifts`), Pinguin-Bilder, Dorf (Skihütte, Schneemänner) an der Talstation, Polarlicht in der letzten Runde über dem See (Optik, kein Wetter), Lied.

## Performance (Pflicht, ROADMAP 1P-1)

Die Karte wird größer als die Wüste (1,5–1,8 statt 1,15 Mpx). Die Wüste baut in 1,4–1,7 s; das Ziel ist unter 1 s, und **EIS darf nicht langsamer bauen als die Wüste**.

Bau:
- Kartengröße in E1 so klein wie möglich: Lifttrasse und rechter Rand sind im Mockup großzügig; erst stauchen, dann bauen.
- Jede Schleife über Pixel nur über das umschließende Rechteck ihres Elements, nie über die ganze Karte (Rev 1 läuft für Bobbahn, Landung und Frost über alle `A` Pixel; das entfällt bzw. wird auf Rechtecke umgestellt). Mit `yield` in Häppchen.
- Kein `vnoise` je Pixel im Bodenbild, wo es vermeidbar ist: grob rechnen (jede 4. Zeile/Spalte) und halten, Muster aus `sin`.
- Bäume: Poisson-Verteilung einmal, Kronen ins `top`-Bild, Stämme als Hindernis-Kreise (`grid`).
- Klippen, Zaun und Bande als Kreis-Ketten mit 4–6 px Abstand, nicht dichter.
- Mittellinie: Länge prüfen (`N`), das Abstandsfeld wächst mit ihr; wo die Linie Felder quert (Wald, See), nur so breit stempeln wie nötig.
- Speicher: `base` und `top` je etwa 6–7 MB bei 1,6–1,8 Mpx; die Reifenspur-Ebene (`TiledLayer`) bleibt gekachelt.

Laufzeit:
- Lift: Sessel und Seile nur im Sichtfeld zeichnen (Sprites einmal erzeugt); Autos auf dem Lift ohne Physik und ohne Kollisionsprüfung (spart eher Zeit).
- Schneebälle: höchstens zwei zugleich; Kollision nur über Abstandsquadrat.
- See: `snap` einmal nur über das Rechteck des Sees; `paintHole` nur beim Aufbrechen (kleines `getImageData` von etwa 30×30 px), höchstens ein Loch je 0,2 s; kein `getImageData` im Frame.
- `T.ev.obst` klein halten: Bäume nur in der Nähe der Autos (Raster abfragen), nicht alle Bäume des Waldes.
- Tiere, Schachspieler, Fön-Schimmer, Fahnen nur im Sichtfeld (`inView`).
- Kein Schneefall über der ganzen Karte mehr (entfällt mit dem Wetter); höchstens Pulverschnee-Partikel an den Autos.
- Messen in E8: Bauzeit (`mudracer.perf`, `check`), Frame-Zeit mit 10 Autos im Wald, auf den Serpentinen mit Schneeball und auf dem See mit vielen Löchern, Desktop und Mobilgröße (`resize_window` mobile), Größe von `dist/index.html`.

## Technik

- **`TRACK_DEFS`**: `rev: 2`, `W`/`H`, neue `poly`, `events: ['schneeball', 'eisbruch']`; neue Felder: `lift` (Trasse, Tempo), `fence`, `chess`, `bob` (jetzt mit Verlängerung), `jump`, `forest` (Rechteck, Mindestabstand, freie Gasse), `snowFields`, `funnel`, `dryer` (Fön), `slopes`, `serp` (Klippen zwischen den Schenkeln), `rockface` und `balls` (Schneeball-Bahnen), `lake` (mit `rim`), `animals`, `village`. Alte Felder `glacier`, `rivers`, `gate`, `spring`, `frost`, `colony`, `avalanche`, `ridges`, `slope`, `outcrops`, `boostAt`, `landing` entfallen.
- **Boden-Codes**: **70 Lifttrasse**, **71 Pulverschnee** (Wald); Hook `surf`, Eintrag in die Liste über `surfOf` (`physics.js`) und in den Skills `mechanik` und `strecke` (Block 70–79 ist für die nächste neue Strecke frei gewesen: danach nehmen neue Strecken 80–89).
- **`T.ev`-Felder** beginnen mit `ice` (`iceBalls`, `iceCells`, `iceHoles`, `iceBreak` …); `ev.obst` wie bisher.
- **Ereignisse**: `schneeball`, `eisbruch` in `PREFS.events` (`state.js`), `FX_NAMES` (`raceopts.js`), Hook `events` in `ice.js`. Die alten Schlüssel `frost` und `pinguine` werden aus `PREFS.events` und `FX_NAMES` entfernt; gespeicherte Einstellungen mit diesen Schlüsseln müssen weiter laden (prüfen, dass `save.js` unbekannte Schlüssel ignoriert; Grundregel „Spielstände bleiben gültig“).
- **Lift** (`ice.js`): Hook `stuck` (oder eigenes Feld wie `c.tube` in `toys.js`) übernimmt Autos mit `c.lift`; Position aus dem Fortschritt entlang der Trasse, `c.idx` läuft mit (Platzierung stimmt). Auto-gegen-Auto-Kollision auf dem Lift aus (über `c.lvl` oder `ghost`-ähnliche Ausnahme). Hook `noRespawn` verhindert Absetzen auf der Trasse.
- **Zeichnen in der Luft über den Baumkronen**: heute zeichnet `drawRace` (`draw.js`) Autos in der Luft vor `top`, also unter den Kronen. Kleine allgemeine Änderung: Autos mit `z` über einer Schwelle nach `top` zeichnen (oder Hook `drawAbove` für fliegende Autos im Wald). Mit ZUG prüfen (Autos über dem Zug, 1S4-9).
- **Menü-Vorschau**: `makePreview` und `trackPicture` (`tracks.js`) strecken die Karte auf 480×270; eine hochkante Karte würde gestaucht. Vorschau mit Rand (letterbox) zeichnen, wenn `H/W` deutlich von 9/16 abweicht. Prüfen, ob die Cup- und Streckenwahl sonst noch 16:9 annimmt.
- **Fortschritt**: Hook `progress` wie in der Wüste: Wald neben Lift und Bergauf-Straße, Serpentinen-Schenkel und Bobbahn-Schleifen liegen nah beieinander; der Hook hält Autos bei der globalen Suche im richtigen Abschnitt. Checkpoints nicht auf dem Lift und nicht im See.
- **KI**:
  - Lift: automatisch.
  - Bobbahn: Mittellinie, Gas auf Eis nach Rev 1.
  - Wald: breit fahren (Hook `wander`), Bäume über `T.ev.obst` und `steerAround`, Tiefschnee nur für Autos mit `mud < 1.15` meiden (Stufe).
  - Fön: Hook `target`, nur dreckig.
  - Serpentinen: weniger Gas vor den Kehren (Hook `throttle`), Schneebälle über `T.ev.obst`.
  - See: Hook `target` sucht wie `iceTarget` in Rev 1 die Linie mit dem meisten Abstand zu Löchern und brüchigen Zellen, jetzt über den ganzen See (die Hauptlinie führt drüber).
- **Dateien**: `src/icemap.js` (Gelände und Bild neu), `src/ice.js` (Lift, Schach, Schneeball, See, KI-Hooks; Frost, Lawinenhang, Pinguin-Ereignis raus), `src/tracks.js` (`TRACK_DEFS`, `THEMES.eis`, Vorschau), `src/draw.js` (Luft über `top`), `src/state.js`, `src/raceopts.js`, `src/audio.js` (Lift-Rattern, Fön, Schneeball-Grollen, Schachfigur), `src/music.js` (Schichten).
- **Prüfung**: `check('EIS')` meldet im Wald und auf dem See gewollte gerade Linien; im Bericht begründen. Der Lift ist für die Prüfung normale Straße.

## Arbeitspakete

Jedes Paket ist ein Commit (lint, test, typecheck sauber, `check('EIS')` ohne festhängende Autos). Ab E1 ist die Strecke spielbar, `rev: 2` kommt mit E1.

| Paket | Inhalt | Prüfen | Status |
|---|---|---|---|
| E1 Grundriss | Kartengröße festlegen und stauchen, Mittellinie, Startgerade, Lifttrasse als Straße (noch ohne Lift), Bobbahn-Strecke, Schanze, Wald als Feld, Serpentinen, See als Glatteis, Checkpoints, Hook `progress`, alte Felder und Ereignisse `frost`/`pinguine` raus, Menü-Vorschau hochkant | `check`: Start gerade, keine ungewollten Abkürzungen, 10/10 im Ziel; Bauzeit; Vorschau im Menü | offen |
| E2 Sessellift | Code 70, Einhängen ohne Wartezeit, Fahrt, Absetzen, Sessel und Seile, Stationen, Zaun (auch in der Luft fest), Weihnachtsmann und Grinch beim Schach | Start mit 10 Autos, `check` LEICHT/SCHWER, Screenshot | offen |
| E3 Bobbahn | Verlängerung mit drei Kehren, Bande durchgehend, Gefälle, Ausfahrt auf die Schneestrecke | `check`, `checkPic` (keine Abkürzung zwischen den Schleifen) | offen |
| E4 Schanze und Wald | Sprung bergab, Bäume mit Mindestabstand, `ground` im Landebereich, Code 71, Tiefschnee-Senken, Trichter zur Straße, Auto in der Luft über den Kronen, „8“ im Wald, KI im Wald | `check` alle Stufen (Stürze, Festhängen an Bäumen), Screenshot im Flug | offen |
| E5 Fön, Bergauf, Serpentinen | Fön-Hütte mit `washMask`, KI nur dreckig; Bergauf-Schub; Serpentinen mit Klippen, Schnee am Rand, Gefälle, KI-Gas vor den Kehren | `check`, `checkPic`, Screenshot Serpentinen | offen |
| E6 Ereignis Schneeball | Felswand (14), drei Bahnen, Ankündigung, Hüpfer über die Klippen, Einschneien, `T.ev.obst`, Schalter `schneeball` | `check` mit und ohne `fx`, Frame-Zeit | offen |
| E7 Eissee und Ereignis Eisbruch | Großer See mit festem Rand, Bruch abhängig von der Autozahl, keine Wiedervereisung, Obergrenze und freie Verbindung, Absetzen hinter dem Loch, KI-Linien, Felswand mit Tieren (16), Rückweg (17), Schalter `eisbruch` | `check` mit 4 und 10 Autos, mit und ohne `fx`; Runde 3 noch befahrbar; Frame-Zeit | offen |
| E8 Abschluss | Lied `ice`: Winterwunderland in Runde 1, Breakbeat ab Runde 2 (nicht mehr am Frost), Chor in der letzten Runde, Paukenwirbel vor dem Schneeball; Polarlicht über dem See in der letzten Runde; Töne; Performance messen; `check` LEICHT/MITTEL/SCHWER; Grundsätze 1–14; Doku: `ROADMAP.md` (1S9, Tabelle, 1A-4, 1A-5, 1P-1, „Zuletzt abgeglichen“), `Strecken.md` Abschnitt 9 (Status, Ereignisse, Lied; Wünsche als umgesetzt markieren), Skills `mechanik` (Codes 70/71, Lift, `ground`-Bäume, Luft über `top`) und `strecke` (Code-Liste, nächster freier Block) | alles | offen |

## Grundsätze-Check (für E8)

1. Steigerung: mindestens so anspruchsvoll wie WUESTE Rev 3 (1S9-3): längere Runde, Sprung in den Wald, Serpentinen mit Schneebällen, See wird von Runde zu Runde enger. Nicht schwerer als VULKAN nach dessen Rework (dort festhalten).
2. Nichts Unlogisches: der Lift hat Tal- und Bergstation, die Bobbahn führt bergab, die Serpentinen haben sichtbare Klippen, der See ist von Ufern und Felswand eingefasst, die Schanze landet auf einem Hang.
3. Tiefschnee in Senken und Wehen um Baumgruppen und an Kurvenaußenseiten, nicht als Fleck.
4. Keine Abkürzung: Zaun am Lift, durchgehende Bobbahn-Bande, Klippen zwischen den Serpentinen, Trichter im Wald, fester Seerand.
5. Startaufstellung komplett auf der Startgeraden unter der Ziellinie (vor dem Lift).
6. Mehr als ein Kreis: offenes Waldfeld, Fön-Schlenker, Linien über den See.
7. Ereignisse `schneeball` und `eisbruch`, beide ausschaltbar.
8. Eigenes Lied: `ice`.
9. Nicht zu viel auf einmal: Schneebälle nur auf den Serpentinen, Eisbruch nur auf dem See, dazwischen Abfahrt ohne Ereignis; Schneebälle kündigen sich an, Risse knacken vor dem Bruch.
10. Zaun, Bande und Klippen kräftig mit Schatten; Deko (Schach, Tiere, Schneemänner) klar abseits der Fahrbahn; Bäume, über die man fliegt, sehen aus wie die übrigen, weil sie nach der Landung auch fest sind.
11. Nicht kindgerecht: Einbrechen, Einschneien und enge Kehren sind gewollt.
12. Tiefschnee im Wald als Entscheidung, Schneewehen an den Kehren.
13. Waschen: nur der Fön.
14. Ziellinie und Startaufstellung frei (kein Schneefall, kein Polarlicht, kein Liftschatten darüber).
