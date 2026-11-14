# VULKAN Rev 3 – drei Wege hinunter, Feuerbälle

Stand: 2026-11-14, Branch `vulkan_rev2` (Worktree; `map_pack` vorher hineingemergt). Baut auf Rev 2 auf (`plaene/VULKAN_REV2.md`): Berg, Kratersee, Grat, Serpentinen, Höhenweg, Lavaröhre, Löschstation und Glutwolke bleiben. In `ROADMAP.md` steht nur der Block `1S10`.

## Wunsch des Nutzers (2026-11-14)

- Drei Wege vom Berg herunter; in Runde 2 sind nur noch zwei fahrbar (Lava), in Runde 3 nur noch einer.
- Die Feuerbälle werden das große Hindernis: deutlich häufiger, bevorzugt in der Nähe von Autos, angekündigt durch Schatten. Nach dem Einschlag brennt es kurz auf der Strecke; wer durchfährt, brennt.
- Brennende Autos sind etwas langsamer; eine Figur lehnt sich aus dem Fenster und löscht mit einem Feuerlöscher. Danach ist das Auto weiß vom Löschschaum (wie Matsch), der normal abgewaschen wird.
- Alle Streckendesign-Grundsätze gelten.

## Entscheidungen (Claude)

| Frage | Entscheidung |
|---|---|
| Dritter Weg | **Alte Lavarinne**: eine erkaltete Rinne aus Stricklava (grau-braun, Seile quer zur Fließrichtung, helle Aschekante), halbe Breite 18, von der Gabel am Westrand gerade zwischen Nebenkegel und Südstrom hinunter bis kurz vor die Ziellinie (550, 990). Der kürzeste Weg (etwa 600 px gegen 960 durch die Röhre und 1700 über den Höhenweg). Natürliche Basaltdämme auf beiden Seiten, eine Aschewehe am Westufer (kürzere Linie durch Asche). Die Rippe vom Nebenkegel zum Kraterrand (Rev 2) entfällt, dafür eine kurze Rippe vom Kegel zur Rinne südlich der Röhrenzufahrt |
| Welcher Weg schließt wann | Runde 2: die Rinne (sie wird aus einer verstopften Bresche im Kraterrand gespeist; der Pfropfen platzt). Runde 3: die Lava in der vollen Rinne steigt und läuft über die Gabel in die Röhre. Übrig bleibt der Höhenweg (die Mittellinie, auch für Zurücksetzen und Fortschritt) |
| Wessen Runde | **Die Runde des Spielers** (ohne Spieler die des Führenden). Mit der Runde des Führenden schloss das erste Auto, das die Rinne nahm (sie endet kurz vor der Linie), sie für alle anderen in Runde 1 |
| Ankündigung | Ab 80 % der Runde davor: der Pfropfen glüht und raucht, Grollen; vor Runde 3 brodelt die Lava oben in der Rinne. Das Schild an der Gabel zeigt drei Pfeile (Höhenweg, Röhre, Rinne): grün offen, orange blinkend kurz davor, rotes Kreuz zu. Beim Bersten Knall, Beben, „LAVA IN DER RINNE!“ / „LAVA IN DER ROEHRE!“ |
| Wie weit die Lava läuft | Die Front läuft mit 70 px/s von oben hinunter und erstarrt dann mit einer dunklen Kruste: Rinne bis 70 % ihrer Länge, Röhre bis zur Hälfte. Nie über die Straße selbst, nie bis zur Ziellinie (Grundsatz 14) |
| Ereignisse | `lavastrom` (neu, Anzeige „LAVASTROEME“): die Wege schließen; aus = alle drei Wege bleiben offen. `ausbruch`: die Feuerbälle (ab Runde 1) und ab Runde 2 roter Himmel, Aschenregen, Hubschrauber. `glutwolke`: nur noch in Runde 2 (in Runde 3 gibt es keinen anderen Weg; bleibt `lavastrom` aus, auch in Runde 3) |
| Feuerbälle | Ab 9 s nach dem Start des Countdowns, alle 2,4–3,2 s in Runde 1, 1,5–2,1 s in Runde 2, 1–1,5 s in Runde 3. Gezielt auf ein Auto (45 % deins), dorthin, wo es nach 1,6 s auf der Mittellinie ist, ±17 px zur Seite. Nicht in Röhre, Rinne und Bucht, nicht auf dem Grat, nicht vor der Rampe, nicht an der Gabel, nicht in der Glutwolke. Ankündigung: ein Schatten wächst und wird dunkler, zuletzt blinkt ein Glutrand; der Ball fällt aus Richtung Krater mit Rauchspur, Pfeifen |
| Einschlag | Wer im Kreis (15 px) ist, wird 90 px/s weggeschoben und brennt. Danach 3 s Feuer am Boden (13 px), wer hineinfährt, brennt |
| Brennen | 1,4 s Flammen auf dem Auto, Tempo × 0,85 (`c.vFire` in `physics.js`), dann 1,1 s Löschen (Kopf und Schulter im Fenster links, roter Feuerlöscher, weißer Strahl), dann Löschschaum: Dreck +0,4 und der zweite Satz Bilder (`goo2: 'foam'`, weiß). Asche macht wieder rußig, sauber wird man wie immer in der Löschstation |
| Computerautos | Wählen an der Gabel (1–18 Indizes davor, einmal je Runde): Rinne (42 %, solange offen), Röhre (bei Glutwolke immer, sonst bis 70 % bzw. 30 % ohne Rinne), sonst Höhenweg; dreckig immer Höhenweg (Löschstation). Bricht die Lava los, bevor ein Auto drin ist, bleibt es auf dem Höhenweg. Feuerbällen und Feuer weichen sie nur manchmal aus (35 / 55 / 75 % je Ball auf LEICHT / MITTEL / SCHWER), damit auch sie brennen; Feuer stehen nicht in `T.ev.obst` |
| Rekorde | `rev: 3` (Kurs geändert); Name bleibt |

## Prüfung (2026-11-14)

`mudracer.check('VULKAN')` auf LEICHT, MITTEL, SCHWER, mit 4 und 10 Autos und ohne Ereignisse: alle im Ziel, keine Stürze, keiner hängt fest, keine Abkürzungen, Start 0°. Wege der Computerautos (SCHWER, 10 Autos): Runde 1 drei Rinne, drei Röhre, drei Höhenweg mit Löschstation; Runde 2 Röhre oder Höhenweg; Runde 3 nur Höhenweg. Etwa 15–40 Brände je Rennen mit 10 Autos. Bot auf SCHWER (Höhenweg): 29–32 s / 33–35 s / 35–39 s, ohne Ereignisse mit der Rinne 26 s. Bauzeit 1,8 s am Stück (Rev 2: 1,4 s).

Bilder im Rennen angesehen: Pfropfen glüht, Rinne läuft voll, Schild an der Gabel in allen drei Runden, Röhre läuft voll, Kruste am Ende der Front, Feuerball mit Schatten, Feuer am Boden, brennendes Auto, Löscher mit Strahl, weißes Auto.

Offen: Abnahme durch den Nutzer (ROADMAP 1S10-12), Mobilgröße.
