# VULKAN Rev 4 – Feuerbälle bergauf, Lavafurten bergab

Stand: 2026-11-15, Branch `vulkan_rev2` (Worktree). Ersetzt die drei Wege aus Rev 3 (`plaene/VULKAN_REV3.md`); Berg, Kratersee, Serpentinen, Sprung, Brücke, Löschstation und die Feuerbälle mit Brand und Löschschaum bleiben (`plaene/VULKAN_REV2.md`). In `ROADMAP.md` steht nur der Block `1S10`.

## Wunsch des Nutzers (2026-11-15)

- Die Idee mit den drei Wegen streichen: in dieser Form zu unausgewogen. Weg von geteilten Strecken.
- Auf dem Weg hinauf kommen die Feuerbälle.
- Löschschaum nicht sofort 100 %, eher 50 %.
- Keine Aschepfützen.
- Die Pfützen entfernen, die wie Weltraum aussehen (das Obsidian-Glas).
- Überweg über den Krater und den Krater selbst schicker, cooler.
- Die Felsen direkt hinter dem Start (Hornitos) und die Trennsteine (Basaltrippen) sehen langweilig aus.
- Für den zweiten Teil nach dem Krater gewählt: **Lavafurten** (Lava quert die Straße in Pulsen: erst Glühen und Grollen, dann Lava, dann Kruste; man passt den Moment ab oder bremst und wartet; mehr Pulse von Runde zu Runde).

## Umsetzung

| Teil | Umsetzung |
|---|---|
| Ein Weg | Lavaröhre, Lavarinne, Pfropfen, Schild an der Gabel, Flutlisten entfallen. Der Nebenkegel bleibt als fester Berg. Die Rippe vom Kraterrand zum Nebenkegel ist wieder die aus Rev 2 (`[466, 640, 690, 553]`) |
| Feuerbälle | Nur noch bergauf: von der Startlinie bis zum Kratersee (`okIdx`: Index 10 bis kurz vor dem Grat), nicht vor der Rampe. Takt wie Rev 3 (2,4–3,2 / 1,5–2,1 / 1–1,5 s) |
| Löschschaum | Dreck mindestens 0,42 (zweite von fünf Stufen der Bilder: etwa halb weiß), beim zweiten Mal +0,15, höchstens 0,62; schon dreckigere Autos bleiben, wie sie sind |
| Asche, Obsidian | Aschewehen und Obsidian-Flüsse entfallen; Boden-Codes 80 und 81 sind wieder frei. Die Glutwolke entfällt auch (sie gehörte zu den Wegen und wäre zusammen mit den Furten zu viel auf einmal, Grundsatz 9); `c.vAsh` ist aus der Physik entfernt |
| Lavafurten | Drei Rinnen aus alter Stricklava (`def.fords`), jede aus einem Schlot (Schlackenkegel, fest): Furt 1 vom Nordwesthang über den Nordwestschenkel in einen Lavasee im Innern der Kurve, Furt 2 und 3 quer über die Westkante bis zum Kartenrand (Furt 3 aus dem Nebenkegel). Kalt sind sie Straße oder Basalt; gelb-schwarze Kante, wo die Rinne den Straßenrand kreuzt; Warnlichter an beiden Seiten 24 px davor |
| Puls | 1 s Vorwarnung (der Schlot spuckt, die Warnlichter blinken wechselnd, Grollen, „LAVA!“ über der Furt, Paukenwirbel im Lied, wenn du nahe bist), dann läuft die Lava die Rinne hinunter und erreicht die Straße nach 2,2 s, bleibt 2,6 s nach dem Überqueren der Straße, dann Kruste (fahrbar, glüht 2,5 s nach, Dampf). Abstand der Pulse je Furt 13–16 s in Runde 1, 9,5–12 s in Runde 2, 7–8,5 s in Runde 3 (deine Runden), versetzt um 4,3 s. Wer in die Lava fährt, fällt (wie überall auf dem Vulkan) und wird davor abgesetzt |
| Computerautos | Warten vor der Furt, wenn sie sonst während der Lava auf der Straße wären (70 / 85 / 95 % je Puls auf LEICHT / MITTEL / SCHWER, die anderen versuchen ihr Glück) |
| Krater | Kratersee aus Krustenplatten mit glühenden Fugen (Zellen), am Ufer und am Damm flüssig und hell; Innenwand in Schichten mit Schwefel; Kraterrand mit Blöcken und Findlingen |
| Überweg | Damm aus Basaltpflaster (Säulenköpfe), helle Bordsteinkante, an der Lava Kruste mit Glut; Laternen auf beiden Seiten alle 60 px (fest, flackern); Dampf über dem See |
| Hornitos und Schlote | Größere Schlackenkegel mit beleuchteter Nordwestseite, Spritzern, erstarrten Glutnasen und pulsierendem Schlund |
| Trennsteine | Basaltrippen aus sechseckigen Säulen mit Deckfläche und Seitenwand, unterschiedlich hoch, leicht versetzt |
| Rekorde | `rev: 4` (Kurs geändert); Name bleibt |

## Prüfung (2026-11-15)

`mudracer.check('VULKAN')` auf LEICHT, MITTEL, SCHWER, mit 4 Autos und ohne Ereignisse: alle im Ziel, keiner hängt fest, keine Abkürzungen, Start 0°. Lavastürze im ganzen Feld: SCHWER 2, MITTEL 0, LEICHT 7, 4 Autos 1. Bot auf SCHWER: 32 / 35 / 42 s, ohne Ereignisse 32 s. Bauzeit 2,1 s am Stück (Rev 3: 1,8 s). Zeichnen etwa 0,5 ms je Bild an einer laufenden Furt und am Krater.

Bilder im Rennen angesehen: Furt mit laufender Lava und Glut, Kruste beim Abkühlen, Vorwarnung mit Lichtern und „LAVA!“, Krater mit Laternen, Feuerball mit Schatten auf den Serpentinen, Löscher.

Offen: Abnahme durch den Nutzer (ROADMAP 1S10-12), Mobilgröße, Grundsatz 6 (ein Kreis ohne Wege zur Wahl, vom Nutzer so gewollt; die Furten sind die Entscheidung: warten oder durch).
