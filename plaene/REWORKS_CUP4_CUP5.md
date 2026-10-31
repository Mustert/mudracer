# Reworks Strecke 11 bis 15 – Übersicht

Stand: 2026-10-31, Branch `map_pack`. Gemeinsamer Rahmen für die fünf Strecken, die noch im Prototyp-Format sind: DSCHUNGEL (11), WELTALL (12), SUESS (13), SPIELZIMMER (14), REGENBOGEN (15). Jede Strecke hat ihren eigenen Umsetzungsplan; diese Datei hält nur fest, was für alle gilt, damit es nicht fünfmal dasteht.

| Strecke | Plan | Art des Umbaus |
|---|---|---|
| 11 DSCHUNGEL | `plaene/DSCHUNGEL_REV2.md` | Komplettumbau: Flusstal mit Tempelpyramide |
| 12 WELTALL | `plaene/WELTALL_REV2.md` | Komplettumbau: Orbit um den Ringplaneten |
| 13 SUESS | `plaene/SUESS_REV2.md` | Komplettumbau: Schokoberg und Bonbonfabrik |
| 14 SPIELZIMMER | `plaene/SPIELZIMMER_REV2.md` | Umbau im neuen Format: Gabelung über oder unter dem Bett, größeres Zimmer |
| 15 REGENBOGEN | `plaene/REGENBOGEN_REV2.md` | Umbau im neuen Format: Ehrenrunde durch die überarbeiteten Welten, zuletzt |

Die Pläne sind **Vorschläge von Claude**. Anders als bei Wüste und Eis gibt es noch kein Mockup des Nutzers. Jeder Plan nennt darum am Anfang die offenen Fragen; kommt ein Mockup (`Obsidian/Mudracer/Screenshots/<NAME>_improvements.jpg`), gehen Grundriss und Elemente nach dem Mockup, wie bei EIS Rev 2.

## Was aus Wüste Rev 3, Eis Rev 2 und Vulkan Rev 2 übernommen wird

Vulkan Rev 2 liegt fertig auf dem Branch `vulkan_rev2`, ist aber **noch nicht abgenommen und nicht in `map_pack` gemergt** (ROADMAP 1S10-12). Was dort neu ist (Codes 80/81, Löschstation, Lavaröhre, Glutwolke), gilt hier als Vorbild, aber nicht als vorhandener Code auf `map_pack`.

| Lehre | Herkunft | Gilt für die Reworks |
|---|---|---|
| **Das Thema bestimmt die Form** der Strecke (Pyramide, Berg mit Lift, Vulkankegel), kein Rundkurs mit Deko | alle drei | Jede Strecke bekommt eine Landschaft mit Logik: woher kommt der Fluss, wo ist der Berg, warum führt die Straße so |
| **Größere Karte**, auch hochkant; Rundenzeit steigt mit der Nummer | Wüste 1600×720, Eis 1000×1500, Vulkan 1600×1100 | 1,4 bis 1,7 Mpx; Bauzeit trotzdem **nicht über der Wüste** (Ziel unter 1 s, 1P-1) |
| **Offenes Feld** als eigener Abschnitt: eigener Boden-Code, `T.alt` (kein Zurück-Pfeil, `c.safe` zählt), Hook `wander` breiter, Hook `progress` gegen Index-Sprünge | Wüstenfeld (60), Eiswald (71) | je Strecke ein Feld (Unterholz, Planetenring, Zuckergussfeld, Klemmbausteinplatte, Wolkenfeld) |
| **Gabelungen mit echter Wahl**, beide Zweige sinnvoll; die KI wählt im Hook `target` je Stufe | Wüste (Sprung/dunkel, Skarabäen/Sprung), Vulkan (Höhenweg/Röhre) | mindestens eine Gabelung je Strecke (Grundsatz 6), Wegweiser groß und lesbar (1S8-18, 1S8-21) |
| **Ein Wasch-Konzept als Seitenbucht** neben der Linie, wäscht nicht sofort, KI nur dreckig (Schwellen .4 / .55 / .7, Gas ≤ .6) | Waschbucht Wüste, Fön Eis, Löschstation Vulkan | Kein Waschen mehr mitten auf der Fahrbahn (heute: Luftschleuse Weltall, Limonaden-Becken Süß, Waschstraße Spielzimmer, Regenschauer Regenbogen) |
| **Begrenzung aus einem Guss**: Felsen, Hecken, Wände als geglättete Abstandsfunktion, ausgefranster Umriss, Kreise folgen dem gezeichneten Rand; keine geraden „Spielwände“ | Eis `paintMountains` (1S9-9) | Würgefeigen-Wände, Asteroidenränder, Karamellwälle, Möbelkanten, Wolkenränder |
| **Ereignisse an die Runden gebunden und eskalierend**, räumlich getrennt, Zufall aus `hash` (Zeitfahren wiederholbar) | Schneeball 1S9-17, Treibsand ab dem ersten Auto aus der Pyramide 1S8-17 | Runde 1 ruhig, Runde 2 das Ereignis, letzte Runde Höhepunkt |
| **Ankündigung ohne Text**: Warndreieck am Bildrand über der Stelle, Ton, Schatten, Paukenwirbel im Lied | 1S9-12 (Nutzer wollte keinen Text) | „SCHOKOLADE!“, „SAUGROBOTER!“ u. ä. entfallen oder werden zum Symbol |
| **Lied: Schichten an den Runden**, kein `swap` an der Rundengrenze | Eis E8, Vulkan V6 (1S10-10) | löst 1M-1 für Weltall und Regenbogen und 1S12-2 |
| **Dunkelheit über eine Lichtkarte in Bildschirmgröße**, Lampen als Sprites | Pyramide (Wüste), Lavaröhre (Vulkan) | Tempel (Dschungel), unter dem Bett und Licht aus (Spielzimmer), Gewitter (Regenbogen) |
| **Kontrast**: Straße hebt sich klar ab, Festes anders gefärbt als Befahrbares | Vulkan (Nutzer-Vorgabe) | Grundsatz 10 auf jeder Strecke, besonders Weltall (Plattform gegen All) und Süß (alles bunt) |
| **Sprünge**: kein Dreher nach der Landung, Landepunkt sicher, Rückkehrpunkt im Sprung (`land`), Bäume mit `ground` überfliegbar, Auto in der Luft über `top` (Hook `airTop`) | 1S8-12, Eis E4 | Liane, Trampoline, Kissen, Mondsprung, Regenbogen-Bogen |
| **Belebte Kulisse**, die nur im Sichtfeld animiert wird (`inView`), klar abseits der Fahrbahn | Eis 1S9-13/14 (Yeti, Skifahrer, Berghütte) | je Strecke zwei, drei kleine Szenen |
| **Pakete je Commit**, ab dem ersten Paket spielbar, `check` nach jedem Paket; Abnahme durch den Nutzer bleibt ein eigener Roadmap-Punkt | alle drei | Pakete X1 bis X8 je Plan |

## Reihenfolge

1. **VULKAN Rev 2 abnehmen und mergen** (1S10-12). Grund: DSCHUNGEL muss nach Grundsatz 1 schwerer sein als der Vulkan, und die Boden-Codes 80/81 sowie die Bausteine Seitenbucht, Röhre mit Licht und Glutwolke sollen auf `map_pack` liegen, bevor sie wiederverwendet werden.
2. DSCHUNGEL → WELTALL → SUESS → SPIELZIMMER → **REGENBOGEN zuletzt** (er zitiert die anderen Welten, Strecken.md „Gemeinsame Bausteine“).
3. Zwischen den Strecken: `mudracer.checkAll({ sim: true })` für die Steigerung (Grundsatz 1) und doppelte Codes oder `T.ev`-Felder.

Wer will, kann zwei Strecken parallel in eigenen Worktrees bauen (wie `vulkan_rev2`); dann aber nie zwei, die dieselben gemeinsamen Dateien stark ändern (`draw.js`, `physics.js`, `trackfx.js`), ohne die Reihenfolge der Merges vorher festzulegen.

## Steigerung (Grundsatz 1) und Länge (1P-2)

| Nr | Strecke | Rundenzeit heute | Ziel Rev | Was sie schwerer macht als die davor |
|---|---|---|---|---|
| 8 | WUESTE Rev 3 | 33–43 s | – | Feld, zwei Gabelungen mit Sprüngen, Dunkelheit, Treibsand |
| 9 | EIS Rev 2 | ca. 55 s (mit Lift) | – | Glätte, Serpentinen mit Schneebällen, löchriger See |
| 10 | VULKAN Rev 2 | 31–37 s (Bot SCHWER) | – | Lava überall, Grat, Röhre gegen Glutwolke |
| 11 | DSCHUNGEL | ca. 20 s (800×450) | **40–45 s** | man sieht nicht alles (Laubdach, Tempel), die meisten Entscheidungen, die Strecke füllt sich mit Stämmen |
| 12 | WELTALL | 25–30 s | **45–50 s** | wenig Grip überall plus Kräfte (Planet, Loch), Hindernisse aus allen Richtungen |
| 13 | SUESS | ca. 21 s | **45–50 s** | Kleben bestraft länger, Schokolade bedeckt die Linie, Fließbänder und Presse |
| 14 | SPIELZIMMER | 26–28 s | **50–55 s** | Ebenen mit echtem Fall, Saugroboter, Dunkelheit |
| 15 | REGENBOGEN | ca. 26 s | **55–65 s** | alles zusammen, größter Sprung, Gewitter |

Cup 5 ist laut `Strecken.md` „schwer durch die Menge“. Das steht gegen Grundsatz 9 (nicht zu viel auf einmal). Auflösung für alle drei Fantasy-Pläne: viele **Abschnitte** mit je einer Sache, nicht viele Dinge zugleich.

## Boden-Codes

Vergeben: 0–17 gemeinsam, 30–32 Spielzimmer, 41–48 Regenbogen, 50–52 Strand, 60–61 Wüste, 70–71 Eis, 80–81 Vulkan (Branch `vulkan_rev2`; Code 16 wird dort frei). Für die Reworks reserviert:

| Block | Strecke |
|---|---|
| 90–99 | DSCHUNGEL |
| 100–109 | WELTALL (13 Mondboden und 17 Schwerelos-Plattform bleiben) |
| 110–119 | SUESS |
| 120–129 | SPIELZIMMER (30–32 bleiben) |
| 130–139 | REGENBOGEN (41–48 bleiben; neue nur bei Bedarf) |

Jeder Code kommt in die Liste über `surfOf` (`physics.js`), in den Hook `surf` der Strecke und in die Skills `mechanik` (Abschnitt 3) und `strecke` (Abschnitt 2, „nächster freier Block“).

## Gemeinsame Technik, die vor oder mit dem ersten Rework entsteht

Heute stecken die neuen Bausteine je in einer Strecke (`icemap.js`, `desertmap.js`, `volcanomap.js`). Fünf weitere Strecken werden sie wieder brauchen; darum mit DSCHUNGEL (Paket J1) herauslösen, ohne Wüste, Eis und Vulkan im Verhalten zu ändern (ROADMAP 1T-13):

- **`terrainKit.js`** (Name offen): geglättete Abstandsfunktion für Wände, Massive, Ufer (aus `paintMountains`), Poisson-Verteilung mit freier Gasse (Eiswald), Seitenbucht mit Waschboden (Wüste, Eis, Vulkan), Wegweiser-Schild.
- **Lichtkarte** (`drawDark` der Wüste, Röhre des Vulkans) als gemeinsame Funktion mit Lampen-Sprites.
- **Warndreieck am Bildrand** (`warnSign` aus `ice.js`) als gemeinsame Funktion.
- **Feld-Hilfen**: `T.alt` für ein Polygon, Hook `progress` mit Index-Fenster, `wander` je Abschnitt.

Prüfung nach dem Herauslösen: `check('WUESTE')`, `check('EIS')` (und nach dem Merge `check('VULKAN')`) mit gleichen Werten wie vorher.

## Grundregel

„Spielstände bleiben gültig“: jede Strecke bekommt `rev` + 1 (neue Rekorde, alte bleiben), Namen bleiben, neue Ereignis-Schlüssel kommen mit Standard „an“ in `PREFS.events`, entfallene Schlüssel werden beim Laden ignoriert (wie `frost`, `pinguine` bei EIS).
