# Mudracer – Analyse, Ideen und offene Punkte

Die eine Liste für alles, was am Spiel schwach, offen oder geplant ist. Enthält auch die früheren Verbesserungsideen (ehemals `VERBESSERUNGEN.md`, Abschnitt I).

- Analyse am 2026-10-09 auf Stand `c5aed10` bis `42eb5ec`, am 2026-10-11 gegen `2d022f4` (Branch `map_pack`, 12 Strecken) nachgeprüft.
- Zuletzt abgeglichen: 2026-10-12, Commit „Technik-Umbau abgeschlossen“ (Branch `map_pack`; alle T-Punkte bis T14 bearbeitet, siehe „Stand Technik“ unter der Technik-Tabelle). (Bei jedem Abgleich Datum und Commit hier nachziehen, siehe `CLAUDE.md`.)
- Ausführliche Fassung der Analyse mit Begründungen (Stand 2026-10-09): https://claude.ai/code/artifact/5ecd1e70-685b-404d-b2e6-ed798433c1fb

## So wird diese Datei benutzt

- Jeder Punkt hat eine feste ID (T = Technik, M = Mechanik, D = Design-Theorie, G = Grafik, B = Bedienung/Audio, I = Ideen und Wünsche). In Commits und Gesprächen die ID nennen.
- Fundstellen sind als Datei und Funktion angegeben, nicht als Zeilennummer, weil die sich ständig verschieben. Vor dem Ändern die Stelle per Grep suchen.
- Wer einen Befund erledigt, setzt den Status auf `erledigt (<commit>)` und lässt die Zeile stehen. Neue Befunde unten in der passenden Tabelle anhängen.
- Status: `offen` = am 2026-10-11 im Code noch so gesehen, `offen?` = seit 2026-10-09 nicht nachgeprüft, `teilweise`, `erledigt`.
- Schwere: K = kritisch, H = hoch, M = mittel, N = niedrig.

## Gesamturteil

Liebevoll gebautes, komplett prozedurales Pixel-Rennspiel ohne ein einziges Asset (Strecken, Autos, Musik, Geräusche entstehen zur Laufzeit). Schmutz als Kernmechanik ist eigenständig und kindgerecht lesbar. Schwächen: KI ohne Biss, unsaubere Pixel beim Drehen und Skalieren. (Das fehlende Sicherheitsnetz und die lange synchrone Ladezeit sind seit dem Technik-Umbau vom 2026-10-12 behoben: Linter, Tests, sichtbare Fehler, Bauen bei Bedarf.)

Annahme der Analyse: Kinder sind die Hauptzielgruppe, SCHWER ist ein Bonus für Ältere. Vom Nutzer noch nicht bestätigt.

## Technik (T)

| ID | S | Status | Befund | Fundstelle | Empfehlung |
|---|---|---|---|---|---|
| T1 | K | erledigt (3b58385) | Lackieren überschrieb `def.acc` (Beschleunigung) mit dem Akzent-Farbobjekt → `NaN`-Position, Rennen hing | `cars.js` `setPaint` | jetzt Feld `accent`. Am 2026-10-12 im Browser geprüft: alle 10 Autos × 11 Farben fahren je 6 s ohne `NaN`; der NaN-Wächter (T6) fängt so etwas jetzt ab. Als automatischer Test fehlt er (braucht Canvas) |
| T2 | H | erledigt (3b58385) | Quad/Rally hatten den Schlüssel `acc` doppelt | `cars.js` `CAR_DEFS` | ESLint `no-dupe-keys` ist seit T9 aktiv (`npm run lint`) |
| T3 | H | erledigt (Technik-Umbau) | Alle Strecken wurden synchron beim Import gebaut (12 Strecken: ~8 s blockiert im Dev-Server). Jetzt: `TRACKS` sind leichte Einträge, `buildTrack` und die Kartenmodule sind Generatoren, gebaut in Häppchen im Leerlauf (`idle.js`) oder auf dem Ladebildschirm; Menüs zeigen eine geglättete Vorschau (480×270), vorher die Streckenform. Nur 2 Strecken behalten ihre schweren Daten. Ergebnis pixelgleich geprüft | `tracks.js` `TRACKS = TRACK_DEFS.map(buildTrack)` | erst bei Bedarf bauen und cachen, Menüvorschauen klein vorrendern, evtl. Worker + OffscreenCanvas |
| T4 | M | erledigt (Technik-Umbau; Drehung 0 sofort, Rest in Häppchen, `keepSets`) | Sprite-Sätze (48 Drehungen × 6 Schmutzstufen) entstehen erst beim Rennstart, ~120 ms je Auto; Zement-Strecke baut je Auto einen zweiten Satz | `cars.js` `carSet`/`buildCar`, `race.js` `makeCar` | im Menü/Countdown per `requestIdleCallback` vorbauen |
| T5 | M | erledigt (Technik-Umbau; `clock.js`, Schritt 1/60 s, Autos und Kamera dazwischen gezeichnet; Rundenzeit bei 30/60/144/240 Hz identisch geprüft) | Variabler Zeitschritt (dt bis 0,05) mit Euler: unter 20 fps läuft das Spiel langsamer, Zeitfahr-Rekorde hängen leicht von der Bildrate ab | `main.js` `loop`, `physics.js` `physics` | fester Physikschritt (z. B. 120 Hz) mit Akkumulator, interpoliert zeichnen |
| T6 | M | erledigt (Technik-Umbau; `errors.js`, Fehlerleiste im Dev-Modus, `guardCar`, Audio-Wächter) | Hauptschleife fängt jede Ausnahme und loggt nur; Fehler bleiben unsichtbar | `main.js` `loop` (`try/catch`) | im Dev-Modus Fehler einblenden; `NaN`-Wächter am Ende von `physics()` und vor Audio-Parametern |
| T7 | M | teilweise (Technik-Umbau: alle Felder in `g.js` beschrieben; Import-Kreise von einem Kreis aus 24 Modulen auf Audio↔Musik reduziert: `setState` in `state.js`, Eingabe über `setInputHandlers`, Zeichenhelfer in `gfx.js`, `undo.js`, `rank.js`; `test/imports.test.js` wacht darüber. `G` ist nicht in Bereiche geteilt) | Ein globales `G` mit ~60+ Feldern, Kreis-Importe (physics → menus → race → physics) | `g.js`, `state.js` | `G` in Bereiche teilen (`race`, `ui`, `save`), Felder per JSDoc beschreiben |
| T8 | M | erledigt (Technik-Umbau; `@fontsource/press-start-2p`, latin-woff2 eingebettet, erster Frame wartet max. 1 s) | Schrift von Google Fonts; offline oder vor dem Laden zeichnet der Canvas mit Monospace | `index.html`, `core.js` (`document.fonts.load` ohne Warten) | woff2 einbetten, vor dem ersten Frame auf `document.fonts.ready` warten |
| T9 | M | erledigt (Technik-Umbau: `npm run lint` mit ESLint inkl. `no-dupe-keys`, `no-shadow`; `npm test` mit Vitest, 7 Dateien: Zeitformate, Rekord-Umrechnung, Geist, Rangliste, Cups und Strecken, Hindernis-Gitter, Zeitschritt, Spielstand, Import-Kreise. Kein Typcheck) | Keine Tests, kein Linter, kein Typcheck | `package.json` | Vitest für reine Funktionen (`convertRecord`, `cupTrackIdx`, `fmtTime`, `placeOf`), ESLint mit `no-dupe-keys`, `no-shadow` |
| T10 | N | erledigt (Technik-Umbau; ESLint `no-shadow` verhindert es künftig) | Lokale Konstanten namens `G` überschatten den Spielzustand; in `drawTrophy` wird `G.time` dadurch `NaN`, das Funkeln am Pokal ist dauerhaft an | `screens.js` `drawTrophy`; auch `tracks.js` `buildTrack`, `run.js` `buildRun`, `junglemap.js` | umbenennen |
| T11 | N | erledigt (Technik-Umbau; `grid.js`, auch für rollende Reifen) | Jedes Auto prüft jeden Frame alle Hindernisse (Baustelle: 573) | `update.js` `updateRace` (Schleife über `G.T.trees`) | Spatial Hash |
| T12 | N | erledigt (Technik-Umbau: `checkSpots` in `events.js` prüft im Dev-Modus Löcher, Koi-Sprünge, rollende Reifen, Dschungelbäume und Kipper gegen die gebaute Strecke und zeigt Abweichungen in der Fehlerleiste. Dabei gefunden: ein Koi im Garten springt 3 px vom Ufer ab, wird toleriert) | Ereignis-Koordinaten fest verdrahtet (Löcher, Kois, Kühe, Lotus, Pier); geänderte Streckenlinie verschiebt sie stillschweigend | `events.js` `COWS`, `HOLES`, `KOIS` | relativ zur Streckenlinie oder beim Bau prüfen und warnen |
| T13 | N | erledigt (Technik-Umbau: `save.js`, alle Zugriffe laufen darüber, Version in `mudracer-save`, Schlüssel unverändert; Optionsmenü: SPIELSTAND SICHERN (Datei) und LADEN; im claude.ai-Artifact kann der Download vom Browser gesperrt sein, das Menü meldet es dann) | Speicherstände in vielen Einzelschlüsseln, ohne Gesamtversion, ohne Export | `cars.js`, `cups.js`, `timetrial.js`, `diff.js` | ein Save-Modul mit Version, Export/Import als JSON |
| T14 | N | erledigt (Technik-Umbau; Kacheln à 400 Zeilen, pixelgleich geprüft; die Reifenspur-Ebene ist seit dem Folge-Umbau ebenfalls gekachelt, `layer.js`, Kacheln nur wo gefahren wird, in der Matschfahrt höchstens 24) | Matschfahrt baut 480 × 6.400 px auf einmal, zeitweise ~50 MB Puffer (Mobilgeräte) | `run.js` `buildRun` | nur sichtbare Kacheln rendern |
| T15 | M | erledigt (Folge-Umbau 2026-10-12: jede Strecke kann `W`/`H` in ihrer Definition mitbringen, Standard bleibt 800×450; Bau- und Laufzeitmodule rechnen mit `T.W`/`T.H` bzw. `MW`/`MH`, nur `core.js` und `tracks.js` kennen den Standard. Geprüft: alle Strecken pixelgleich, eine doppelt so große Testkarte 1600×900 baut in ~0,4 s und lässt sich ohne Fehler zu Ende fahren) | Weltgröße 800×450 ist an ~300 Stellen als `WW`/`WH` fest verdrahtet (Kartenmodule, Ereignisse); größere Strecken brauchen `T.W`/`T.H` überall | alle `*map.js`, Ereignis-Module | schrittweise auf `T.W`/`T.H` umstellen |

### Stand Technik (2026-10-12)

Technik-Umbau abgeschlossen: T1–T14 erledigt außer T7 (teilweise), dazu G4 und G11. Geprüft: alle 12 Strecken und die Matschfahrt pixelgleich zu vorher (Prüfsummen), alle Strecken als Rennen bis ins Ziel, ein ganzer Grand Prix, jedes Auto mit jeder Farbe, gleiche Rundenzeit bei 30 bis 240 Hz.
Folge-Umbau (2026-10-12): T15 (Weltgröße pro Strecke) und die gekachelte Reifenspur-Ebene erledigt. Neue große Strecken geben in `TRACK_DEFS` einfach `W` und `H` an; Ereignis-Konstanten mit festen Koordinaten (`FLOOD`, `PIER`, Strand-Ufer bei y 412) gelten nur für ihre Strecke.

Arbeitsweise: `npm run lint` und `npm test` vor jedem Commit. Dev-Hilfe: im Dev-Server gibt es `window.mudracer` (G, race, tracks, cars, `frameAt(now)` für einzelne Frames, auch wenn das Vorschaufenster verborgen ist und rAF schläft).

## Spielmechanik (M)

| ID | S | Status | Befund | Fundstelle | Empfehlung |
|---|---|---|---|---|---|
| M1 | H | teilweise | Belohnungen an leere Cups gebunden. Seit `map_pack` haben Cup 3 und 4 Strecken (Quad, Rally, Supercup erreichbar). Cup 5 ist weiter leer: Batmobil und Superdupercup außerhalb des Kindermodus unerreichbar | `cups.js` `CUPS`, `cars.js` (`cup: 5`) | Cup 5 bauen oder Batmobil vorerst an ein erreichbares Ziel hängen |
| M2 | H | offen | KI-Gas = Höchstgeschwindigkeit: 0,52–0,66 (LEICHT) bis 0,80–0,91 (SCHWER), mit Gummiband max. 1,0. Gegner nie schneller als ein fehlerfreier Spieler mit gleichem Auto | `diff.js` `DIFFS`, `update.js` (Gummiband) | auf SCHWER Ideallinie mit Kurvenbremsen statt Gasdrossel; ein Rivale pro Rennen leicht über 1,0 |
| M3 | M | offen? | KI folgt Mittellinie mit Sinus-Versatz, weicht Kühen und (je Stufe) Matsch aus; überholt, blockt, rammt nicht gezielt; Hupe ohne Wirkung | `physics.js` `aiTarget` | Fahrstile pro Auto (Polizei sauber, Monster rammt, Traktor stur) |
| M4 | M | offen? | Spieler startet immer in Reihe 1; mit gedrosselten Gegnern Führung ab Kurve 1 | `race.js` `startRace` | im GP nach Punktestand umgekehrt aufstellen |
| M5 | N | offen? | Beim Zieldurchlauf des Spielers wird sofort gewertet, knappe Zieleinläufe gibt es nicht | `race.js` `finishRace` | Gegner 2–3 s weiterfahren lassen |
| M6 | M | offen | Alle Autos gleicher Radius (9 px zu Hindernissen, 18 px untereinander) und gleiche Masse | `update.js` `updateRace` | Masse/Radius pro Auto aus der Sprite-Größe, evtl. zwei Kreise pro Auto (siehe G8) |
| M7 | N | offen? | Gras bremst wie Matsch, macht aber nicht schmutzig; für Geländeautos (Traktor 64 % Spitze) lohnen Kurvenschnitte übers Gras | `physics.js` `surfOf` (case 0) | Gras etwas langsamer oder leicht schmutzig |
| M8 | M | offen | Zement: 1/3,8 der Matschgeschwindigkeit (gewollt hart, 42eb5ec), Flitzer ~10 % Spitze | `physics.js` `surfOf` (case 6) | Strafe lassen, aber sichtbare saubere Umfahrung anbieten, damit es eine Entscheidung ist |
| M9 | M | offen? | Kois springen ohne Vorwarnung (Kühe, Zug, Kipplaster sind angekündigt) | `events.js` `updateKois` | 0,5 s vorher Kreise im Wasser (passt zu Streckengrundsatz 9) |
| M10 | M | offen? | Matschfahrt: eine feste Strecke (Seed 4242), keine Zeit, kein Rekord, Zähler ohne Wertung | `run.js` | Sterne-Ziele, Bestzeit, täglich wechselnder Seed |
| M11 | N | offen? | Werkstatt rein kosmetisch, alle Farben sofort offen, kein Belohnungskreislauf | `shop.js`, `cars.js` `PAINTS` | Farben/Sticker für Trophäen und Rekorde freischalten |
| M12 | N | offen | Fest 3 Runden für alle Modi | `core.js` `LAPS` | Runden pro Schwierigkeit (Kinder 2, SCHWER 4) |
| M13 | N | offen | Feld wird mit `sort(() => Math.random() - .5)` verzerrt gemischt | `race.js` `startGP` | Fisher-Yates |

## Design-Theorie (D)

- **D1 Flow/Schwierigkeitskurve:** Kindermodus passt. Nach oben endet die Kurve früh, weil die KI nie schneller als ihr Auto fährt (M2); danach bleibt nur Zeitfahren.
- **D2 Interessante Entscheidungen:** Die Kernidee „schnell durch Matsch oder sauber außen herum“ kommt auf den alten Strecken kaum vor: Matsch-/Wasserfelder reichen meist 32–36 px vom Mittelstrich nach außen, die Fahrbahn nur 30 px (`HALF`), Ausweichen ist unmöglich. Für neue Strecken: je 2–3 Stellen mit kurzer Matschlinie gegen längere saubere Linie, Waschstelle mit kleinem Umweg. Ergänzt die Streckengrundsätze 3 und 6 in `CLAUDE.md`.
- **D3 Lernen ohne Text:** Sterne TEMPO/MATSCH und sichtbarer Schmutz erklären viel. Dass Schmutz bremst und Wasser hilft, muss das Kind selbst finden → einmaliger Bildhinweis beim ersten starken Verschmutzen.
- **D4 Belohnungen:** Kern (Rennen → Platz → Pokal) und Sammelebene (Trophäen, Bestzeiten je Auto und Strecke) sind gut. Freischaltpfad siehe M1, Werkstatt siehe M11.
- **D5 Fairness:** Gummiband mild und unsichtbar (richtig für Kinder). Ereignisse im Zeitfahren hängen nur an der Rennzeit, Rekorde bleiben vergleichbar (gut). Ausnahme ohne Ankündigung: Kois (M9).
- **D6 Lesbarkeit:** Kamera schaut 0,35 s voraus, bei Spitze ~1,3 s (senkrecht) bis 2 s (waagrecht) Sicht. Ohne Minikarte im Rennen sieht man auf verwinkelten Strecken die nächste Kurve spät → Kurvenpfeile am Rand oder Richtungsanzeige am Bildrand.

## Grafik (G)

Stark: einheitliche Lichtrichtung (Schatten nach rechts unten), durchgehend dunkelbraune Umrisslinie (`OUT`), eigene Paletten je Thema, viele kleine Animationen. Die unsauberen Stellen entstehen fast alle beim Drehen, Skalieren und Verkleinern.

| ID | S | Status | Befund | Fundstelle | Empfehlung |
|---|---|---|---|---|---|
| G1 | H | offen | Auto-Sprites werden per Nearest-Neighbour in 48 Schritten gedreht; schräg werden 1-px-Linien zu Treppen mit doppelten/fehlenden Pixeln, Räder verformen sich (im Spiel vergrößert geprüft) | `cars.js` `rotateImg` | RotSprite (3× Scale2x, drehen, verkleinern) oder 8-fach vergrößert drehen und per Mehrheitsfarbe verkleinern; Umriss danach wie bisher |
| G2 | H | offen | Unter Faktor 3 nicht ganzzahlig skaliert (1280×720 → 2,67; Handy quer → ~1,44); Pixel und Schrift ungleich breit, Flimmern beim Scrollen | `core.js` `fit` | intern ganzzahlig vergrößert rendern und den Puffer glatt skalieren, oder ganzzahlig mit Rand |
| G3 | M | offen | Volle Schmutzstufe macht Autos zu braunen Klecksen, eigenes Auto im Pulk kaum zu finden | `cars.js` `buildCar` (`amt = lv / 5 * 1.15`) | Schmutz auf ~70 % Fläche begrenzen, Dach/Umriss sauber lassen; Spielermarker dauerhaft (9817e89 zeigt jetzt ein 1P-Schild, prüfen ob das reicht) |
| G4 | M | erledigt (Technik-Umbau, mit T3: geglättete Vorschau, `drawTrackPic`) | Menühintergründe und Modus-Karten verkleinern die 800×450-Strecke per Nearest-Neighbour (Faktor 1,67 bis 4,3) → Pixelrauschen | `screens.js` `drawMenuBg`, `drawMain` | Vorschauen einmal geglättet vorrendern und cachen |
| G5 | M | offen? | Gemischte Pixelraster: Kois mit `rotate`/`scale`, Abseitspfeil und Schattenellipsen als geglättete Pfade, fliegende Autos krumm skaliert | `events.js` `drawKoi`, `draw.js` `drawCritters`/`drawCar`/`drawRace` | Kois vorgedreht cachen, Pfeil als Sprite, Sprunggrößen in festen Stufen |
| G6 | M | offen | Reifenspuren landen jedes Frame mit ~9 % Deckung auf einer dauerhaften Ebene und verblassen nie; Ideallinie wird ein dunkles Band | `update.js` `updateRace` (Spur auf `tctx`) | Spurebene langsam ausblenden oder Deckung begrenzen |
| G7 | M | offen | Wald: Nachtschleier 64 %, Vignette, ab Runde 2 Regen; dunkler Matsch auf brauner Straße kaum lesbar | `events.js` `drawNight` | Matsch mit hellem Rand/Glanz, Schleier ~50 % |
| G8 | M | offen | Hitboxen passen nicht zum Bild (alle 9 px): Feuerwehr (39 px lang) ragt in Bäume, Quad prallt ohne Berührung ab | `update.js` `updateRace` | zwei Kreise pro Auto aus der Sprite-Länge |
| G9 | N | offen? | Fliegende Autos werden nach y sortiert und liegen unter Baumkronen | `draw.js` `drawRace` | Autos mit `z > 0` nach der Kronen-Ebene zeichnen |
| G10 | N | offen? | Schmale Menükarten füllen ZEITFAHREN und WERKSTATT randlos (80 von 82 px) | `screens.js` `CARD` | 2 px Innenabstand oder Kurzform |
| G11 | N | erledigt (mit T10) | Pokal-Funkeln blinkt nicht (siehe T10) | `screens.js` `drawTrophy` | umbenennen |
| G12 | N | offen? | HUD ohne Rundenzeit und Abstand zum Vordermann | `draw.js` `drawRace` | für Ältere ergänzen, Kindermodus schlank lassen |

## Audio, Bedienung, Zugänglichkeit (B)

| ID | S | Status | Befund | Fundstelle | Empfehlung |
|---|---|---|---|---|---|
| B1 | H | offen? | Touch im Standardmodus: Gas und Lenken liegen alle im Steuerkreuz unten links, Gas halten und lenken braucht zwei Finger einer Hand | `index.html` (`#touch`), `input.js` | eigener Gasknopf rechts oder Auto-Gas auf Touch |
| B2 | M | offen? | Alternativer Touch-Modus kennt nur 4 Richtungen | `index.html`, `update.js` | virtueller Stick mit freiem Winkel |
| B3 | N | offen? | Touch-Knöpfe nur bei `pointer: coarse`; Touch-Laptops bekommen sie nicht | `input.js` `coarse` | auch beim ersten Touch-Ereignis einblenden |
| B4 | N | offen | Kein Gamepad, keine freie Tastenbelegung; `Backspace` als Zurück | `input.js` `KEYS` | Gamepad-API, Belegung im Optionsmenü |
| B5 | M | offen? | Nur das Spielerauto hat einen Motor, ein Feld von 8 Autos klingt leer | `audio.js` `engineSound` | 2–3 leise Gegnermotoren in der Nähe |
| B6 | N | offen? | Nur Musik an/aus und Stummtaste, keine getrennten Regler | `menus.js` Optionen, `audio.js` | Regler Musik/Effekte |
| B7 | N | offen? | Blinken (Sirenen ~4 Hz, Warnschilder, Texte) ohne Option zum Reduzieren | `draw.js` | Option „weniger Blinken“ |
| B8 | N | offen? | Matsch, Erde, Straße alles Brauntöne; bei Rot-Grün-Schwäche und im Dunkeln schwer zu trennen | Themen in `tracks.js` | Textur oder Glanzrand am Matsch |
| B9 | N | offen | Nur Deutsch, Texte über die Module verteilt; kein Manifest/Offline | alle Bildschirme, `index.html` | Texttabelle; PWA mit lokal eingebetteter Schrift (T8) |

## Ideen und Wünsche (I)

Übernommen aus `VERBESSERUNGEN.md` (Stand 2026-10-07) und am 2026-10-11 gegen den Code abgeglichen.

| ID | Status | Idee | Stand / Bemerkung |
|---|---|---|---|
| I1 | erledigt | Autos spürbar unterscheiden | Feinwerte `speed`, `mud`, `acc`, `turn`, `soil` in `cars.js`, Sterne TEMPO/MATSCH daraus abgeleitet; alle Autos brauchen etwa gleich lang (±3 %), fühlen sich aber verschieden an |
| I2 | erledigt | Bestzeiten, Geist, Zeitfahren | Rekord pro Strecke und Auto (`mudracer-tt-<STRECKE>-<auto-id>`), Geist schaltbar (`mudracer-ghost`) |
| I3 | teilweise | Einstellungen und Pause | Zahnrad (Musik, Steuerung), Pause (`Esc`, `P`, Menüknopf) da; offen: getrennte Regler (B6), freie Tastenbelegung (B4) |
| I4 | offen | Items / Power-ups: Matschbombe, Schlammschild, Nitro | bisher nur Boost-Felder auf Regenbogen; würde das Rennen am stärksten verändern |
| I5 | offen | KI mit Charakter | siehe M2, M3 |
| I6 | offen | Drift / Handbremse mit Mini-Boost, besonders für Quad und Flitzer | gäbe Älteren eine Technik zum Meistern (D1) |
| I7 | teilweise | Mehr Freischaltziele | Cups schalten Autos frei, Trophäen nach Platz und Stufe; offen: Ziele wie Matschfahrt unter X s, alle Strecken sauber beenden, 3× Waschanlage (passt zu M10, M11) |
| I8 | anders umgesetzt | Schwierigkeitsgrad / Advanced-Modus | umgesetzt als Kindermodus-Schalter, LEICHT/MITTEL/SCHWER und Schalter Streckeneffekte (`diff.js`). Aus dem Konzept offen: Runden pro Stufe (M12), Matsch/Wasser-Menge pro Strecke. Umsetzungshinweise siehe unten |
| I9 | teilweise | Werkstatt | Variante B (kosmetisch): Lack in 11 Farben umgesetzt; offen Aufkleber, Felgen, Spoiler, Hupe, Freischalten der Teile (M11). Variante A (Upgrades für Motor, Reifen, Getriebe, Stoßstange als Multiplikatoren auf `CAR_DEFS`) offen; Risiko Balance, im GP und Zeitfahren begrenzen oder neutralisieren |
| I10 | weitgehend | Neue Strecken, Wetter, Tageszeit | 12 Strecken, Regen und Dämmerung im Wald; Plan für 15 Strecken und Cup 5 in `Obsidian/Mudracer/Strecken.md` |
| I11 | erledigt | Streckenereignisse | jede Strecke hat mindestens eins, einzeln über `G.events` (`state.js`), im Menü ein Schalter pro Rennen |
| I12 | offen | Lokaler Zwei-Spieler-Modus (Splitscreen oder geteilte Tastatur) | für ein Familienspiel wohl das stärkste Einzelfeature |
| I13 | offen | Gamepad | siehe B4 |
| I14 | teilweise | Automatisierte Tests (Rundenzählung, Checkpoints, `score()`, Zug- und Kollisionsfälle) | siehe T9: Vitest steht (`score()`/Rangliste u. a.); Rundenzählung, Checkpoints, Zug- und Kollisionsfälle noch ohne Test |
| I15 | teilweise | PWA / Offline | Schrift eingebettet (T8), das Spiel braucht keinen Server mehr; Manifest/Service Worker fehlen (B9) |
| I16 | offen | Barrierefreiheit (weniger Flackern, Farbschwäche) | siehe B7, B8 |
| I17 | erledigt | Logo im Hauptmenü wie auf dem Titelbild | `title.js` `makeArt`, im Menü 32 px |

### Umsetzungshinweise aus dem Advanced-Konzept (für I8, M12)

- Matsch, Wasser und Boost-Felder sind ins Streckenbild eingebrannt (`buildTrack`). Andere Mengen brauchen eine eigene Streckenvariante, beim ersten Bedarf gebaut und zwischengespeichert. Ereignisse wie der Zug lassen sich dagegen zur Laufzeit abschalten.
- Rundenzahl: `LAPS` wird eine Variable pro Rennen.
- Rekorde unter abweichenden Regeln bekommen ein Suffix am Schlüssel; Standardregeln behalten den alten Schlüssel (siehe Grundregel unten).
- Ein Prototyp (Advanced-Checkbox, Optionsbildschirm pro Strecke, `mudracer-adv`, `mudracer-opt-<STRECKE>`) wurde getestet und bewusst nicht übernommen.

## Grundregel: Spielstände bleiben gültig

Gespeicherte Daten (`mudracer-car`, `mudracer-unlock`, `mudracer-cups`, `mudracer-tt-*`, `mudracer-gp-*`, `mudracer-paint-*` …) dürfen nie unbrauchbar werden und werden nie überschrieben, um sie umzudeuten.
- Änderungen an Fahrwerten bekommen eine neue Balance-Version (`BAL` in `timetrial.js`); alte Rekorde werden beim Laden umgerechnet (`BAL_OLD`).
- Geänderte Strecken bekommen eine Revision (`rev` in `TRACK_DEFS`), ihre Rekorde beginnen dann neu, die alten bleiben im Speicher.

## Priorität

1. **Sofort (wenig Aufwand, viel Nutzen):** M1 (Batmobil erreichbar), B1 (Gasknopf), G2 (ganzzahlig skalieren), M9 (Koi-Ankündigung). (T9 und T6 erledigt.)
2. **Planen (viel Aufwand, viel Nutzen):** G1 (RotSprite), D2 (Ausweichlinien bei Matsch), M2/M3 (KI), M10 (Ziele für die Matschfahrt), G8/M6 (Hitboxen). (T3, T4, T5, T15 erledigt.)
3. **Nebenbei:** G6, M13. (G4, T8, T10 erledigt.)
4. **Später:** B4, B9 (PWA), Rest von T7. (T14 erledigt.)
5. **Große Features (aus den Ideen):** I4 Items, I12 Zwei-Spieler-Modus, I6 Drift, I9 Werkstatt-Ausbau. Reihenfolge laut alter Ideenliste: erst Items, dann Zwei-Spieler, dann Werkstatt.
