# VULKAN Rev 6 – Umsetzungsliste nach der ersten Testfahrt

Stand: 2026-11-19, Branch `map_pack`. Baut auf Rev 5 auf (`plaene/VULKAN_REV5.md`). **L1 und L2 erledigt** (2026-11-19), L3 bis L6 offen. In `ROADMAP.md` stehen die Punkte als 1S10-22 bis 1S10-30; hier die Umsetzung im Detail.

## Rückmeldung des Nutzers (2026-11-19)

Aus dem Chat, mit Bildern:

1. Unten an der Startgeraden liegen Steine (das Ende einer Felsrippe) über der untersten Terrassenmauer. Dort keine Steine über der Mauer.
2. In den Löchern der Brücke laufen die Metallstreben weiter. Wo man nicht durchkommt, müssen sie weg, sonst sieht es nicht nach Fallen aus.
3. Der Steinhintergrund des Labyrinths (graue Pflasterfläche) ergibt optisch keinen Sinn: Was soll das sein? Oben rechts schaut noch ein Zipfel hinter der Strecke hervor.
4. Das Labyrinth fühlt sich nicht wie bergab an. Allgemein fehlt das Gefühl, einen Vulkan hinauf- und wieder hinunterzukraxeln. Die beiden Lavaströme neben dem Hauptstrom braucht es optisch nicht.

Aus dem Spiel (F8, Rev 5, Build 7699955):

5. Bug: Unten hinter dem Labyrinth ist die Strecke offen (bei 341, 862 fährt man aus der Rinne auf die Wiese). Sie soll dort zu sein.
6. Bug: Die kleine Mauer zwischen Gerade und Feuerwehrbucht ragt in den Weg der Bucht hinein. Der Weg der Bucht soll einfach Asphaltfarbe bekommen.
7. Idee: Nach einem Sturz in die Lava keine Asche/Ruß, das ist doppelte Strafe. Dafür erdig werden, wenn man am Berg neben der Straße fährt.

## Pakete

| Paket | Inhalt | Wo | Punkte |
|---|---|---|---|
| **L1 Schnelle Korrekturen** | (a) Felsrippe `[1395, 650, 1395, 835, 'r']` endet über der Mauer bei y 835: kürzen, sodass sie an der Mauer endet und nichts über die Mauer oder die Gerade gezeichnet wird; allgemein beim Zeichnen von `rockRidge` keine Steine auf Straße und Mauern. (b) Brückenloch: die zwei Träger, die das Loch queren (`volcano.js`, Zeichnen der Löcher), entfallen; man sieht nur den Schacht hinunter zur Lava, die Träger enden an den Lochkanten. Auch im Kartenbild (`volcanomap.js`, Träger der Brücke) unter Lochplatten keine Streben. (c) Labyrinth unten zu: Knoten `Y` (330, 868) und die Rinne `E1–Y` liegen zu nah am unteren Rand der Fläche (y 905); der Fels muss unter den Rinnen geschlossen sein, nur `Z` mündet auf die Gerade. Prüfen mit `check` (keine Abkürzung, kein Zurück-Pfeil im Fels). (d) Feuerwehrbucht: die Mauer `bay.wall` [1000, 1200, 918] nur dort, wo Gerade und Bucht parallel laufen (Ein- und Ausfahrt frei); Belag der Bucht in Asphaltfarbe wie die Gerade (Fliesen nur im Waschfeld) | `tracks.js` (VULKAN), `volcanomap.js`, `volcano.js` | 1S10-22, 1S10-23, 1S10-26, 1S10-27 |
| **L2 Lava ohne Ruß, Erde am Hang** | Ein Sturz in die Lava (auch durch die Brücke) lässt den Dreck, wie er war (`fallCar` setzt bei `'lava'` kein `dirt = 1` mehr; nur der Vulkan hat Lava). Neben der Straße (Code 0) wird man am Berg erdig: Hook `ground` des Vulkans erhöht `dirt` wie leichter Matsch (etwa .3/s, schneller über Asche weiter oben), Schmutzfarbe `goo` des Themas `vulkan` wird Erde/Asche-braun statt Ruß. Der Löschschaum (zweiter Satz) bleibt. Folgen prüfen: wie oft die Computerautos dann noch in die Bucht fahren (1S10-16) | `trackfx.js`, `volcano.js` (Hook `ground`), `tracks.js` (`THEMES.vulkan.goo`), Skill `mechanik` | 1S10-28 |
| **L3 Seitenströme weg** | Die Ströme 3 (West: Krater → Westkante → Lavasee) und 4 (Ost: Fächer → Ostkante des Labyrinths → Tümpel) und ihre `pools` entfallen; es bleibt nur der Hauptstrom (Krater → Fächer unter der Brücke → unter der Geraden zum Rand). Die Westkante des Labyrinths bekommt dafür einen natürlichen Abschluss (Steilhang oder Grat bis zum Kartenrand). Quelle der Lavazungen (Grundsatz 2, die Lava kommt nicht aus dem Nichts), entschieden: (a) der Fächer unter der Brücke läuft am Westende der Brücke über und schickt Zungen oben in die Rinnen (Tore an der Oberkante statt an den Seiten), dazu (b) ein bis zwei glühende Spalten im Hang, die sich vor der Runde öffnen (Dampf, Glühen, Ton). Die Zungen und `laps` bleiben im Prinzip, `mazeOpen` gilt weiter | `tracks.js` (`flows`, `pools`, `maze.gates`), `volcanomap.js`, `volcano.js` | 1S10-25 |
| **L4 Labyrinth als Hang mit Rinnen** | Die graue Pflasterfläche (Code 80 als Polygon `maze.area`) entfällt als Bild. Stattdessen ein ausgewaschener Hang: die Rinnen folgen überwiegend der Falllinie (von oben nach unten, leicht verzweigt, mit Querverbindungen), zwischen ihnen Grate aus Lavagestein mit Licht- und Schattenseite (Licht von Nordwest), Geröll und Felsbrocken in den Rinnen, Schuttfächer an den Mündungen. Die Bodenfarben folgen der Höhe wie am übrigen Berg (oben grau/schwarz, unten trockenes Gras, ganz unten grün), damit man sieht, dass es bergab geht. Keine Polygonkante: der Fels endet am Hang, oben an der Straße, ohne Zipfel hinter der Strecke (Fläche oben rechts an `[590, 318]` weg). Fest bleibt der Fels (Code 80) zwischen den Rinnen, Grundsatz 10 (fahrbar sieht anders aus als fest) gilt. Netz der Rinnen bei Bedarf neu (mehr senkrechte Rinnen, weniger waagerechte); Mittellinie, `rowIdx`, KI-Wegsuche und `laps` nachziehen | `tracks.js` (`maze`), `volcanomap.js` (`volcanoTerrain`, `paintVolcano`) | 1S10-24, 1S10-29, 1S10-21 |
| **L5 Hinauf und hinunter spüren** | Ganze Karte: (a) Relief stärker: Schattierung nach Hangrichtung (der Kegel `cone` hell an der Nordwestflanke, dunkel an der Südostflanke), radiale Grate und Rinnen vom Krater herab, Höhenstufen mit weichen Schattenkanten; die Vegetation endet nach oben (Wiese → Büsche → Gras → Schotter → Asche). (b) Serpentinen: höhere Stützmauern mit längeren Schatten, Hanganschnitt deutlicher, Geröll unter den Mauern; bergauf dreht der Motor hörbar höher, Staub. (c) Bergab im Labyrinth: das Gefälle (`slopes`, heute 22) spürbar machen (schneller, Geröll rutscht nach), Rollsplitt-Staub. (d) Oben: Rauchsäule und Dampf über dem Krater (über den Autos, `drawSky`), Wind treibt Asche bergab. Messen: Rundenzeiten und Bauzeit (1S10-14) | `volcanomap.js` (`hillShade`, Zonen), `volcano.js` (Zeichnen, Gefälle), `tracks.js` (`slopes`) | 1S10-29 |
| **L6 Abschluss** | `rev: 6` (der Kurs im Labyrinth ändert sich), `check` auf LEICHT, MITTEL, SCHWER mit 4 und 10 Autos, `checkAll`, Bauzeit messen, Bilder ansehen (Start, Mauer, Brücke mit Loch, Labyrinth von oben, Unterkante, Bucht); Doku: `Strecken.md` Abschnitt 10 (Wünsche als umgesetzt markieren), `ROADMAP.md` (1S10-21 bis 1S10-30, Tabelle, „Zuletzt abgeglichen“), Skill `mechanik` (Abschnitt 16, Code 80, Schmutz am Vulkan) | alles | 1S10-12, 1S10-14 |

## Stand der Pakete

- **L1 erledigt:** Felsbrocken einer Felsrippe liegen nie auf einer Trockensteinmauer (`onDry` in `rockRidge`, `volcanomap.js`); Brückenlöcher ohne Träger, die offenen Platten einer Reihe als ein Loch ohne Fuge, am Brückenrand ist der Träger aufgerissen (`drawHoles`, `drawHoleGaps` in `volcano.js`, über der oberen Ebene); Gelände bis 9–14 px neben jeder Rinne wird Fels (Abstandsfeld in `volcanoTerrain`), das Labyrinth ist unten zu; Mauer der Bucht x 1032–1168, Weg der Bucht Asphalt.
- **L2 erledigt:** Lava lässt den Dreck (`fallCar`), am Vulkan macht Code 0 erdig (`EARTH` .27/s im Hook `ground`), Satz `ash` erdbraun.
- Prüfung: `check` SCHWER und LEICHT, 10 Autos: alle im Ziel, keine Hinweise, keine Abkürzung; SCHWER Bot 31,7 / 33,7 / 36,8 s; Bau 4,0 s am Stück (verborgenes Vorschaufenster).

## Reihenfolge

L1 zuerst (klein, sofort sichtbar), dann L2. L3 und L4 gehören zusammen (die Tore der Zungen hängen am neuen Hang). L5 zuletzt, weil es die Farben von L4 mitnimmt.

## Entscheidungen des Nutzers (2026-11-19)

1. Quelle der Lavazungen (L3): **Überlauf und Spalten**: der Fächer unter der Brücke läuft am Westende in die oberen Rinnen über, dazu öffnen sich ein bis zwei glühende Spalten im Hang vor der Runde (Dampf, Glühen, Ton).
2. Rinnen-Netz (L4): **neu bauen**: überwiegend in der Falllinie, weniger waagerechte Rinnen, weiter sich kreuzende Wege und jede Runde andere Zungen; `rev: 6`.
3. Erdig am Hang (L2): **halb so schnell wie Matsch** auf der Wiese.
