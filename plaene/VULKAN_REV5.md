# VULKAN Rev 5 – die Südseite des Vulkans

Stand: 2026-11-19, Branch `map_pack`. Ersetzt Rev 4 (`plaene/VULKAN_REV4.md`) bis auf die Feuerbälle mit Brand, Feuerlöscher und Löschschaum. Vorlage: die Skizze des Nutzers `Obsidian/Mudracer/Mockups/VUlkan_rev_selber.png`. In `ROADMAP.md` steht nur der Block `1S10`.

## Wunsch des Nutzers (2026-11-19), Punkte der Skizze

1. Basecamp: Zelte, Reporter, Blaulicht.
2. Die gerade Strecke mit Ziel und Waschanlage (wie bekannt von der Feuerwehr).
3. Serpentinen die Seite des Vulkans hinauf (nur eine Seite wird befahren), optisch eine Steigung am Hang, unregelmäßig verteilt; die Feuerkugeln mit Feuerlöscher bleiben.
4. Eine Stahlbrücke am Rand des Vulkans unterhalb des Kraters, der Lavastrom darunter; ab Runde 2 Löcher, Slalom; wer herunterfällt, wird von einem Hubschrauber zurückgestellt, mit Purzelanimation.
5. Viele Furchen und Fahrrinnen hinab, von Runde zu Runde andere Wege von Lava durchströmt, viele sich kreuzende Wege, einige nie nutzbar; darf kompliziert aussehen und schwer zu fahren sein (sinngemäß, nicht 1:1).
6. Der Hauptlavastrom ist rein optisch.
7. Eine Nebenstrecke der Lava füllt immer andere Teile der Rinnen.

Dazu: auf Kontraste und eine angenehme, realistische Farbgebung achten, nicht alles rot, braun, schwarz.

## Umsetzung

| Teil | Umsetzung |
|---|---|
| Karte | 1700 × 1100 (Rev 4: 1600 × 1100). Die Karte zeigt die Südseite des Bergs, der Krater oben in der Mitte. Fahrtrichtung: Gerade nach Osten, Serpentinen nach Norden, Brücke nach Westen, Labyrinth nach Süden. `rev: 5` |
| Farben | Höhe aus `hillShade` (Kegel `cone` [880, 150, 1150], in x gestaucht): unter 0,4 Wiese (grün, Büsche, Kiefern, Blumen), bis 0,55 trockenes Gras, bis 0,72 grauer Schotter, darüber schwarze Asche mit rötlicher Schlacke; erkaltete alte Lavaströme dunkelgrau. Helle Schotterstraße, Asphalt auf der Geraden, grüner Stahl, blaugrauer Basalt, Lava meist als Kruste mit glühenden Fugen |
| Gerade (2) | Asphalt mit weißen Rand- und gestrichelten Mittellinien, Start bei x 790, Aufstellung 2°; Leitplanke an der Nordseite (fest); kurze Stahlbrücke über den Hauptstrom hinter dem Ziel |
| Waschanlage (2) | Feuerwehrbucht südlich der Geraden hinter der Brücke (Fliesen, Mauer zur Straße, Löschfahrzeug, Hydrant, zwei Feuerwehrleute), einziges Waschen |
| Basecamp (1) | unter der Geraden westlich des Hauptstroms: Polizeiauto und Rettungswagen mit Blaulicht, Übertragungswagen mit Schüssel, Reporterin und Kameramann, fünf Kuppelzelte, Forscher-Container mit Seismograf, Absperrband |
| Serpentinen (3) | fünf Schenkel (y 880, 790, 695, 595, 495, dann 390), Kehren abwechselnd bei x 1440/1300 und 1630–1640, unterschiedlich lang; Stützmauern aus Trockenstein zwischen den Schenkeln (Mauerfront, Schatten auf dem tieferen Hang), Hanganschnitt auf der Bergseite, Felsrippen als Abschluss nach Westen; Feuerbälle nur hier |
| Stahlbrücke (4) | über die Lava, die aus der Südbresche des Kraters quillt und sich als Fächer unter der Brücke ausbreitet (bis an den Kraterrand, keine Lücke dazwischen); Deck aus Stahlplatten 20 × 20 px, grüne Fachwerkträger (fest), Warnschilder. Ereignis `brueckenloch` (neu): Lochreihen mit je zwei von drei Platten, die heile Spalte wechselt die Seite; Runde 2 Reihen bei 10 % und 64 % der Lavaspanne, Runde 3 dazu 37 % und 91 % (Abstand gut 60 Punkte, sonst schafft die KI den Wechsel nicht). Sturz: Purzeln, Spritzer, Rettungshubschrauber setzt das Auto 24 Punkte vor der Reihe in der heilen Spalte ab |
| Labyrinth (5) | 16 Knoten, 32 Rinnen (halbe Breite 18, Knoten 27), in Basaltfels (Code 80, fest an allen Kanten) am Westhang, leicht gebogen; Mittellinie über A–B2–C3–D2–E3–Z, Fortschritt nach der Höhe (`rowIdx`) |
| Lava (6, 7) | Hauptstrom mäandernd vom Fächer unter der Geraden durch bis zum Kartenrand (nur Kulisse). Nebenstrom West vom Krater nach Westen und an der Westkante hinunter in einen Lavasee; Nebenstrom Ost aus dem Fächer an der Ostkante des Labyrinths hinunter in einen Tümpel an der Geraden. Ereignis `lavastrom`: Lavazungen aus vier Toren (Ost B3, C4; West B1, D1), Runde 1 `[B3–C3]`, `[D1–E1]`; Runde 2 `[C4–D3–E3]`, `[B1–C2]`; Runde 3 `[C4–D3–E3]`, `[B3–C3–D2]`, `[B1–C1]`. Jede Kombination lässt einen Weg von A nach Z (`mazeOpen`), in Runde 3 nur A–B2–C2–D1–E1/E2–Z |
| KI | Wegsuche durch das Labyrinth (Dijkstra, je Auto leicht verschieden), Spaltenwahl auf der Brücke, Feuerbällen ausweichen wie bisher, Bucht wenn dreckig |
| Entfallen | Sprung über den Südstrom, Basaltbrücke, Hornitos auf der Straße, Kratersee-Damm mit Laternen, Lavafurten, Nebenkegel |

## Prüfung (2026-11-19)

`mudracer.check('VULKAN')` auf LEICHT, MITTEL, SCHWER, mit 4 Autos und ohne Ereignisse: alle im Ziel, keine Hinweise, keine Abkürzungen, Start 2°. Bot auf SCHWER 32 / 34–39 / 37–39 s, ohne Ereignisse 31,8 s; auf LEICHT bis 52 s in Runde 3 (Stürze durch die Brücke). Stürze im ganzen Feld: SCHWER 1, MITTEL 3, LEICHT 14. `checkAll`: 0 Hinweise für VULKAN. Bauzeit am Stück 3,0–4,2 s im verborgenen Vorschaufenster (EIS im selben Lauf 1,2–3,1 s), deutlich mehr als Rev 4 (2,1 s); offen (ROADMAP 1S10-14).

Bilder angesehen: Gesamtkarte, Start mit Brücke, Leitplanke und Basecamp, Serpentinen mit Stützmauern und Feuerbällen, Brücke mit Löchern, Sturz mit Hubschrauber, Labyrinth mit laufender Zunge.

Offen: Abnahme durch den Nutzer (1S10-12), Bauzeit (1S10-14), Mobilgröße.
