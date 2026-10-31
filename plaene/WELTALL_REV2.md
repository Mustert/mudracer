# WELTALL Rev 2 – Umsetzungsplan

Stand: 2026-10-31, Branch `map_pack`. Eigener Plan für den Komplettumbau der Weltall-Strecke (Strecke 12, Cup 4, Schlussprüfung des Platin-Cups). Er steht bewusst nicht in `ROADMAP.md`; dort bleibt nur der Block `1S12` mit einem Verweis hierher. Grundlage: Prototyp in `src/space.js` und `src/spacemap.js`, `Strecken.md` Abschnitt 12, ROADMAP 1S12-1 bis 1S12-3 und 1M-1, Skills `strecke` und `mechanik`, Streckendesign-Grundsätze in `CLAUDE.md`. Gemeinsamer Rahmen: `plaene/REWORKS_CUP4_CUP5.md`. Vorbild: `plaene/EIS_REV2.md`, `plaene/WUESTE_REV3.md`, `plaene/VULKAN_REV2.md` (Branch `vulkan_rev2`).

**Status je Paket** wird hier gepflegt. Erst beim Abschluss (W8) wird `ROADMAP.md` nachgezogen: 1S12, Tabelle „Strecken im Überblick“, 1M-1, 1M-2, 1P-1, 1P-2.

## Ziel in einem Satz

Das Weltall wird zum Orbit: aus dem Hangar einer drehenden Raumstation hinaus auf schwerelose Plattformen, in einem weiten Swing-by um einen Ringplaneten (wer auf dem Ring innen fährt, wird schneller, aber stärker gezogen), durch ein offenes Asteroidenfeld oder durchs Wurmloch, mit einem langen Mondsprung über einen Krater und durch die Dekontaminations-Schleuse zurück, während ab Runde 2 ein schwarzes Loch die Bahnen verbiegt.

## Ausgangslage (Prototyp)

- 1360×765, Runde 25–30 s, Start auf der linken Geraden (2°). Bau 0,8 s.
- Vorhanden und brauchbar: Station mit Rad, Glasröhre, schwerelose Plattformen (Code 17, wenig Haftung, Düsen-Optik), Traktorstrahl nach dem Abdriften ins All (`fallCar 'space'`), Planet mit Zug (`PULL`) und Swing-by über den Ring (`orbit`), Kraftfeld-Banden an den Kehren, Wurmloch auf einer Plattform (`portals`), feste Asteroiden, Mond mit Kratern und Mondstaub (Matsch, silbergrau), Mondboden (Code 13), Luftschleuse wäscht, Boost-Felder, Ereignisse `asteroiden` (Radar-Pfeil, gestrichelte Bahn) und `schwarzesloch` (ab Runde 2 Zug zur Mitte), Lied `space`.
- Schwach: Optik schlicht (Staubflecken, Stationsmodule, 1S12-1), Musik stockt beim Wechsel `spaceLast` (1S12-2, 1M-1), Runde zu kurz für Strecke 12 (1S12-3, 1P-2), die Luftschleuse wäscht jeden auf der Linie (kein Wahl-Waschen, Grundsatz 13), das schwarze Loch zieht auf der ganzen Karte (Grundsatz 9: es überlagert Planet und Asteroiden), Hauptlinie ist ein Rundkurs mit Kehren; Text „SWING-BY!“ und Meldung beim Öffnen des Lochs.

## Entscheidungen (Vorschlag, vom Nutzer zu bestätigen)

| Frage | Vorschlag |
|---|---|
| Umfang | **Kompletter Umbau**: die Bahnen der Himmelskörper bestimmen die Strecke (Station, Planet, Mond, Gürtel, Loch liegen so, dass die Straße ihren Kräften folgt). Bausteine des Prototyps bleiben (Schwerelosigkeit, Traktorstrahl, Zug, Swing-by, Kraftfeld, Wurmloch, Mondstaub, Asteroiden-Ereignis, Loch, Lied) |
| Kartengröße | **1700 × 1000** (1,7 Mpx). Der größte Teil ist leeres All (billig zu malen: Sternenkarte grob, keine Pixel-Schleife über das All) |
| Rundenzeit | Ziel **45–50 s** |
| Planetenring | wird ein **offenes Feld** (neu **Code 100 Ringstaub**: glitzernder Eisstaub, wenig Haftung wie Code 17, feste Eisbrocken darin wie die Pinien im Eiswald); innen kurz und stark gezogen, außen lang und ruhig. Swing-by am Ausgang je nach gefahrener Linie |
| Mondsprung | **neu**: über einen großen Krater führt eine Rampe; auf dem Mond ist die Schwerkraft gering, das Auto fliegt lang und langsam (eigenes `g` im Sprung, etwa 150 statt 380, über 1,5 s in der Luft). Schief landen gibt keinen Dreher (1S8-12). Zu langsam: man rollt in den Krater (Mondstaub, kein Sturz) und klettert hinaus |
| Waschen | **Dekontaminations-Schleuse als Seitenbucht** vor dem Hangar (Düsen, weißer Nebel, Zischen), statt der Luftschleuse auf der Linie. Die Hauptlinie geht durch ein schlichtes Hangartor ohne Waschen |
| Ereignisse | `asteroiden` (bleibt, nur über Plattformen und Mond, steigt je Runde), `schwarzesloch` (ab Runde 2, **wirkt nur in seinem Umkreis** im Asteroidenfeld und an der Gabelung zum Wurmloch, nicht auf Planet und Mond; letzte Runde größer, Plattformen am Rand blinken). Räumlich getrennt: Asteroiden fliegen nicht durch den Umkreis des Lochs (es schluckt sie) |
| Name, Rekorde | Name `WELTALL` bleibt, `rev: 2`. Lied `space`: Schichten an den Runden, `spaceLast` und der Wechsel beim Öffnen des Lochs entfallen als `swap` (1S12-2) |

### Offene Fragen an den Nutzer

1. Mockup vorhanden? Sonst Grundriss nach diesem Plan.
2. Soll der Planetenring wirklich ein offenes Feld werden (Vorschlag) oder eine feste Ringbahn mit zwei Spuren bleiben?
3. Mondsprung mit geringer Schwerkraft gut? Alternative: Mondbuggy-Hügel als mehrere kleine Sprünge.
4. Das schwarze Loch nur lokal (Vorschlag, Grundsatz 9) oder weiter auf der ganzen Karte schwach?
5. Soll die Raumstation sich sichtbar drehen (Rad mit Fenstern, heute angedeutet) und der Hangar ein dunkler Innenraum mit Lichtkarte sein?

## Grundriss

```
 x:  0      250      500      750      1000     1250     1500   1700
 y ┌───────────────────────────────────────────────────────────────┐
  0 │  ✦   ╭──(2) Glasröhre ──→ (3) PLATTFORMEN (schwerelos) ──╮   ✦ │
    │ ╭────╯     Satellit   ╭─╮ Gitterbrücke  ╭─╮ Kraftfeld    ╲     │
200 │ │ STATION  ◎Rad       ╰─╯ oder Plattform ╰─╯              ╲    │
    │ │ (1) Hangar 🏁                            ╭────── RING ────╮  │
400 │ │      ║                                    │ (4)  ◯PLANET◯  │  │
    │ │ (9) Deko-Bucht (W)       ● (7) Loch       │  Ringstaub-Feld │  │
600 │ │      ║              (6) Wurmloch ↔ ┐     ╰─ Swing-by ─────╯  │
    │ │      ╰──╮                     ╭────┴──── (5) ASTEROIDENFELD ◄╯ │
800 │ ╰─(8) MOND ◐ ═Rampe⇗ Krater ⇘═══╯   Asteroiden, Mondstaub-Senken  │
    │      Lander, Fahne, Mondbuggy                                    │
1000└───────────────────────────────────────────────────────────────┘
```

Fahrtrichtung (Uhrzeigersinn): Start im Hangar links nach Norden (1), durch die Glasröhre (2) hinaus auf die Plattformkette (3) nach Osten, im weiten Bogen um den Ringplaneten (4) hinunter, durch das Asteroidenfeld (5) nach Westen oder vorher ins Wurmloch (6) mit Ausgang am Mondrand, über den Mond mit dem Kratersprung (8), hinauf in den Hangar; vor dem Tor die Dekontaminations-Bucht (9). Das schwarze Loch (7) öffnet sich im Innenfeld zwischen Station, Gürtel und Wurmloch.

Richtwerte (in W1 festlegen):

| Stelle | Richtwert (Spielpixel) |
|---|---|
| Karte | 1700 × 1000 |
| Station / Hangar (1) | x 40–260, y 150–700; Startgerade x ≈ 150, Linie y ≈ 560, Aufstellung y 580–780 (Fahrt nach Norden); Rad bei (200, 120) |
| Glasröhre (2) | (150, 140) → (520, 70) |
| Plattformen (3) | x 520–1200, y 40–260; zwei Gabelungen: schmale Gitterbrücke (kurz) oder breite Plattform (lang); Kraftfeld nur an den Kehren |
| Planet (4) | Mitte (1400, 430), Radius 120; Ringstaub-Feld als Kreisring r 150–250, x 1150–1650, y 180–680 |
| Asteroidenfeld (5) | x 700–1300, y 650–900, offenes Feld (Plattformgitter mit Code 17, feste Asteroiden, Mondstaub-Senken) |
| Wurmloch (6) | Eingang auf einer Plattform bei (900, 620), Ausgang am Mondrand (560, 780) |
| Schwarzes Loch (7) | (600, 470), Wirkung bis 300 px |
| Mond (8) | Kreis (330, 1150), r 420 (oben ragt er in die Karte); Krater-Sprung x 380–560, y 820–860 |
| Deko-Bucht (9) | an der Einfahrt vom Mond in den Hangar, x 40–120, y 790–900 (vor der Aufstellung, nicht neben ihr) |

Rundenzeit-Schätzung: Hangar und Röhre 5 s, Plattformen 10 s, Ring 9 s, Asteroidenfeld 9 s (Wurmloch spart etwa 4 s), Mond und Sprung 8 s, Rückweg 5 s ≈ **46 s**.

## Die Elemente

| # | Element | Umsetzung |
|---|---|---|
| 1 | **Hangar** | Startgerade in der Station: Metallboden mit Leuchtstreifen, künstliche Schwerkraft (Code 1), Roboterarm, Lichter an den Wänden, Schiffe in Docks (Deko). Das Hangartor über der Ziellinie ist offen und verdeckt nichts (Grundsatz 14) |
| 2 | **Glasröhre** | Wie heute, länger; man sieht durch das Glas die Sterne (Parallaxe). Ein Boost-Feld in der Mitte |
| 3 | **Plattformkette** | Schwerelos (Code 17). Plattformen als Inseln mit Rand, zwischen ihnen **Gitterbrücken**; an zwei Stellen eine Wahl: schmale Gitterbrücke (kurz, halbe Breite 12, wer runterfällt, treibt ins All) gegen breite Plattform (Bogen, länger). Kraftfeld-Banden nur an Kehren. Kontrast: Plattform hell mit gelb-schwarzem Rand gegen das dunkle All. Satellit, Astronaut (winkt, schwebt vorbei), Raumschrott als Kulisse |
| 4 | **Ringplanet** | Die Straße läuft außen um den Planeten; der **Ring** ist ein offenes Feld aus Ringstaub (Code 100, `T.alt`), mit festen Eisbrocken (Poisson, freie Gasse). Der Zug des Planeten wächst nach innen (vorhandene `PULL`, jetzt mit Abstand zum Planeten statt Ring-Spur). **Swing-by**: wer den Ring innerhalb eines Radius verlässt, bekommt Schub, je weiter innen, desto mehr (statt Ja/Nein); Glitzerspur statt Text. Wer zu langsam innen ist, wird an den Planeten gezogen: Atmosphäre glüht, Traktorstrahl holt ihn zurück |
| 5 | **Asteroidenfeld** | Offenes Feld auf einem Plattformgitter (Code 17), große feste Asteroiden als zusammenhängende Formen mit Krater-Optik (1S9-9-Stil statt Kreise), Mondstaub (Code 2, silbergrau) in Senken neben den Asteroiden, nicht als Flecken (1S12-1). Gassen mit Leuchtbojen markiert (lesbar ohne Raten, Grundsatz 4) |
| 6 | **Wurmloch** | Eingang auf einer kleinen Plattform an der Einfahrt ins Asteroidenfeld (bewusst anfahren), spart etwa 4 s; Ausgang am Mondrand, gleiche Richtung und gleiches Tempo. Ab Runde 2 liegt es im Umkreis des schwarzen Lochs: der Zug macht das Treffen schwerer (gewollte Steigerung) |
| 7 | **Schwarzes Loch** | Siehe Ereignisse. Dunkler Wirbel mit leuchtendem Rand, Sterne nahebei zu Streifen verzogen |
| 8 | **Mond** | Graue Kraterlandschaft, Fahrspuren im Mondboden (Code 13 neben dem Weg), Lämpchen, Lander, Fahne, Mondbuggy (Deko). **Kratersprung**: Rampe am Kraterrand, im Flug geringe Schwerkraft (neues Feld `g` am Sprung in `trackfx.js`), Landung auf dem anderen Rand; zu kurz: in den Krater (Mondstaub, kein Fall), wieder hinaus. Staubwolken steigen langsam auf und fallen langsam |
| 9 | **Dekontaminations-Bucht** | Seitenbucht vor dem Hangar: Düsen im Boden und an der Decke blasen den Staub ab (weißer Nebel, Zischen), Waschboden wie `washMask`. Die Hauptlinie daneben wäscht nicht |
| 10 | **Kulisse** | Sterne in drei Ebenen, Nebel in Lila und Blau, Erde am Kartenrand, Sternschnuppen, ein Ufo huscht ab und zu vorbei, Raumschiffe docken an der Station an, Sonne mit Lichtkegel über die Plattformen (nur Optik) |

Bleibt: Schwerelosigkeit, Traktorstrahl, Zug des Planeten, Swing-by (abgestuft), Kraftfeld-Bande, Wurmloch, Mondstaub, Boost in der Röhre, Asteroiden-Ereignis, schwarzes Loch, Station mit Rad, Lied.
Entfällt: der alte Rundkurs (`poly`), die Ring-Spur mit zwei Abzweigen (`orbit`), die Luftschleuse auf der Linie (`airlock`), das Boost-Feld vor dem Mond, die Kreis-Asteroiden, Text „SWING-BY!“ und die Meldung beim Öffnen des Lochs.

## Waschen (Grundsatz 13)

Nur die **Dekontaminations-Bucht** (9). Wäscht nicht sofort, kündigt sich an (Nebel schon von der Röhre aus zu sehen, Zischen, Schild mit Düsensymbol), KI nur dreckig (Schwellen .4 / .55 / .7, Gas ≤ .6).

## Ereignisse

| Schlüssel | Ablauf | Ankündigung | Ort |
|---|---|---|---|
| `asteroiden` | Runde 1 einzeln alle 6–9 s, Runde 2 alle 4–6 s und mittlere zerbrechen, letzte Runde Schwärme von drei. Fliegen nur über Plattformkette, Asteroidenfeld-Rand und Mond, nie in Hangar, Röhre oder Wurmloch-Plattform | Radar-Pfeil am Bildrand (vorhanden), gestrichelte Bahn auf dem Boden, Piepen, 1,9 s | Plattformen, Mond |
| `schwarzesloch` | Öffnet, sobald der Führende Runde 2 beginnt (an `T.ev.t` gebunden wie heute). Zieht nur im Umkreis von 300 px, je näher, desto stärker; schluckt Asteroiden und biegt ihre Bahnen. Letzte Runde: Umkreis 360 px, Plattformen am Rand blinken rot. Wer in den Wirbel gerät, wird mit Spiralflug in den Traktorstrahl geholt | Brummen wird lauter, Sterne verzerren sich vorher, Paukenwirbel im Lied, Warndreieck am Bildrand in Richtung des Lochs (kein Text) | Innenfeld zwischen Gürtel und Wurmloch |

`T.ev`-Felder beginnen mit `sp` (`spAsts`, `spHole`, `spSwings` …); heute heißen sie `asts`, `hole`, `swings`, `humT` (T22) und werden mit W1 umbenannt.

## Lied `space`

Schichten an den Runden statt `swap` (1S12-2, 1M-1):
- Runde 1: Space-Disco wie heute (Four-on-the-floor, Oktavbass, Arpeggios), Vocoder nur im Refrain.
- Runde 2 (Loch offen): Flächen dunkler, Filter halb zu, Sidechain stärker; **kein Umstimmen** mitten im Lied (der Ganzton tiefer kommt nur als Effekt auf den Flächen, nicht als Neuaufbau).
- Letzte Runde: Arpeggio doppelt so dicht als zusätzliche Stimme (nicht über Tempowechsel), Vocoder auch in der Strophe.
- Paukenwirbel (hier ein Sub-Drop) vor dem Öffnen des Lochs.

## Performance (Pflicht, ROADMAP 1P-1)

Bau:
- Das All ist leer: kein Bodenbild aus Rauschen je Pixel; Sterne als Punkte (einmal), Nebel als wenige große Verläufe in kleiner Auflösung, hochskaliert.
- Pixel-Schleifen nur über Plattformen, Ring, Gürtel und Mond (Rechtecke).
- Planet, Mond, Erde als vorgerenderte Sprites.

Laufzeit:
- Parallaxe-Sterne: drei vorgerenderte Kacheln, verschoben gezeichnet.
- Zug von Planet und Loch: ein Abstandsquadrat je Auto, nur im Umkreis.
- Asteroiden höchstens 9 zugleich, Kollision über Abstandsquadrat.
- `T.ev.obst`: Eisbrocken und Asteroiden nur nahe KI-Autos.
- Messen in W8: Bauzeit, Frame-Zeit mit 10 Autos auf dem Ring und am Loch in der letzten Runde, Mobilgröße.

## Technik

- **`TRACK_DEFS`**: `rev: 2`, `W: 1700`, `H: 1000`, neue `poly`, Felder `station`, `tube`, `plats` (Plattformen), `bridges` (Gitterbrücken mit Wahl), `planet` (Mitte, Radius, Ring innen/außen, `field`), `rocks` (Formen), `belt` (Feld), `portals`, `hole` (Mitte, Reichweite), `moon`, `craterJump`, `decon` (Bucht), `fields` (Kraftfeld), Kulisse. Entfallen: `orbit`, `airlock`, `pads`, `narrow` alt.
- **Boden-Codes**: **100 Ringstaub**; 13 und 17 bleiben. Hook `surf`, Liste über `surfOf`, Skills.
- **Sprung mit eigener Schwerkraft**: `jumps[].g` (Standard 380) in `trackfx.js` `airborne`; Skill `mechanik` Abschnitt 7 nachziehen.
- **Dateien**: `src/spacemap.js` (neu), `src/space.js` (Ring als Feld, Swing-by abgestuft, Loch lokal, Bucht, Mondsprung, KI-Hooks, `sp`-Namen), `src/trackfx.js` (`g`), `src/tracks.js`, `src/music.js` (Schichten), `src/audio.js` (Düsen-Bucht, Sub-Drop).
- **Fortschritt**: Hook `progress` (Ring-Feld neben der Straße, Gürtel neben dem Mond, Wurmloch springt im Index: `c.idx` beim Austritt setzen wie heute).
- **KI**:
  - Ring: Linie nach Stufe (LEICHT außen, SCHWER innen mit Vollgas), Hook `target` über den Ring; gegen den Zug lenken (vorhanden).
  - Wurmloch: SCHWER meistens, MITTEL manchmal, LEICHT selten; ab Runde 2 nur mit genug Tempo (Zug des Lochs).
  - Asteroidenfeld: breit (Hook `wander`), Asteroiden über `T.ev.obst`.
  - Mondsprung: Vollgas; zu langsam (aus dem Staub) nimmt die KI den Umweg am Kraterrand (Nebenweg wie die Schacht-Sprünge der Wüste).
  - Bucht: nur dreckig.
- **Prüfung**: `check('WELTALL')` meldet über dem Ring und im Gürtel gewollte Linien; das All neben den Plattformen ist für die Prüfung „Fall“ (Abkürzung nur, wenn sie über Plattformen geht).

## Arbeitspakete

| Paket | Inhalt | Prüfen | Status |
|---|---|---|---|
| W1 Grundriss | Kartengröße, Mittellinie, Hangar-Startgerade, Röhre, Plattformkette, Straße um den Planeten, Gürtel als Feld, Mond, Hook `progress`, `sp`-Namen | `check`: Start gerade, keine Abkürzung übers All, 10/10; Bauzeit | offen |
| W2 Plattformen | Gitterbrücken mit Wahl, Kraftfeld an den Kehren, Kontrast der Ränder, Satellit, Astronaut | `check`, Stürze an den Brücken, Screenshot | offen |
| W3 Ringplanet | Ringstaub-Feld (Code 100), Eisbrocken, Zug nach Abstand, Swing-by abgestuft mit Glitzerspur, KI-Linien | `check` alle Stufen, Rundenzeit innen gegen außen | offen |
| W4 Asteroidenfeld und Wurmloch | Formen-Asteroiden, Mondstaub-Senken, Bojen, Wurmloch an der Einfahrt, KI-Wahl | `check`, `checkPic` | offen |
| W5 Mond | Krater, Lander, Kratersprung mit geringer Schwerkraft (`g`), Umweg am Kraterrand, Staubwolken | `check`, Sprung bei 60/100/135 px/s, Screenshot im Flug | offen |
| W6 Bucht und Hangar | Dekontaminations-Bucht (Waschen), Hangar-Deko, Station mit Rad, Tor | `check`, KI nur dreckig | offen |
| W7 Ereignisse und Lied | Asteroiden steigend je Runde, Loch lokal mit Ankündigung, letzte Runde größer; Lied in Schichten ohne `swap`, Sub-Drop; neue Töne | `check` mit und ohne `fx`, Musik ohne Stocken an der Rundengrenze | offen |
| W8 Abschluss | Kulisse (Ufo, Sternschnuppen, Schiffe), Performance, `check` LEICHT/MITTEL/SCHWER mit 3, 5, 10 Autos, Grundsätze 1–14; Doku: ROADMAP (1S12, Tabelle, 1M-1, 1P-1, 1P-2, „Zuletzt abgeglichen“), `Strecken.md` 12, Skills `mechanik` (Code 100, Sprung-`g`, „Weltall Rev 2 in Kürze“) und `strecke` | alles | offen |

## Grundsätze-Check (für W8)

1. Steigerung: schwerer als DSCHUNGEL Rev 2 (wenig Grip fast überall, Kräfte von Planet und Loch, Hindernisse aus allen Richtungen), nicht schwerer als SUESS Rev 2.
2. Nichts Unlogisches: Plattformen hängen an der Station, der Ring liegt um den Planeten, das Wurmloch hat zwei Mündungen, der Mond hat Krater mit Rand.
3. Mondstaub in Senken neben Asteroiden und in Kratern, nicht als Fleck.
4. Keine Abkürzung übers All (man treibt ab), Bojen und Banden zeigen den Weg.
5. Startaufstellung komplett auf der Hangar-Geraden.
6. Mehr als ein Kreis: Gitterbrücken oder Plattform, Ringlinien, Wurmloch, Mondsprung oder Umweg.
7. Ereignisse `asteroiden`, `schwarzesloch`.
8. Eigenes Lied `space`.
9. Nicht zu viel auf einmal: Asteroiden nicht im Umkreis des Lochs, das Loch nicht am Planeten.
10. Plattformränder kräftig, Deko (Astronaut, Schiffe) abseits; Asteroiden mit Schatten.
11. Nicht kindgerecht: ins All treiben, ins Loch gezogen werden.
12. Mondstaub als Entscheidung (Senken auf der Ideallinie im Gürtel), Ring innen gegen außen.
13. Waschen: nur die Dekontaminations-Bucht.
14. Hangartor, Nebel und Loch nie über Ziellinie und Aufstellung.
