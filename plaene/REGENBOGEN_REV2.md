# REGENBOGEN Rev 2 – Umsetzungsplan

Stand: 2026-10-31, Branch `map_pack`. Eigener Plan für den Umbau des Regenbogens (Strecke 15, Cup 5, letzte Strecke des Spiels und letztes Rennen des Superdupercups) in das neue Format. Er steht bewusst nicht in `ROADMAP.md`; dort bleibt nur der Block `1S15` mit einem Verweis hierher. Grundlage: Prototyp (Rev 1) in `src/rainbow.js` und `src/rainbowmap.js`, `Strecken.md` Abschnitt 15, ROADMAP 1S15-1 bis 1S15-3, 1M-1, 1M-3, 1P-3, 3D-4, Skills `strecke` und `mechanik`, Streckendesign-Grundsätze in `CLAUDE.md`. Gemeinsamer Rahmen: `plaene/REWORKS_CUP4_CUP5.md`. Vorbild: `plaene/EIS_REV2.md`, `plaene/WUESTE_REV3.md`, `plaene/VULKAN_REV2.md` (Branch `vulkan_rev2`).

**Diese Strecke kommt zuletzt.** Sie zitiert die Welten aller Cups; ihre Inseln zeigen deshalb die überarbeiteten Fassungen (Wüste Rev 3, Eis Rev 2, Vulkan Rev 2, Dschungel Rev 2, Weltall Rev 2 …). Bevor R1 beginnt, sind die Pläne der Strecken 10 bis 14 umgesetzt; einzelne Zitate unten werden dann an den tatsächlichen Stand angepasst.

**Status je Paket** wird hier gepflegt. Erst beim Abschluss (R8) wird `ROADMAP.md` nachgezogen: 1S15, Tabelle, 1M-1, 1M-2, 1M-3, 1P-1, 1P-2, 1P-3.

## Ziel in einem Satz

Der Regenbogen wird zum Finale über den Wolken: eine Ehrenrunde über fünf Münzinseln, auf denen je ein Wahrzeichen der überarbeiteten Strecken steht (Kühe und Pfütze, Zug-Schanze und Kois, Sphinx-Tor und Sessellift, Lavaröhre, Liane und Wurmloch), dazwischen die Regenbogenstraße mit Farbbahnen, der größte Sprung des Spiels und Wolkenwege zur Wahl; die drei Runden erzählen Sonnenaufgang, Gewitter und den Regenbogen in voller Pracht.

## Ausgangslage (Prototyp, Rev 1)

- 1440×810, Runde etwa 26 s, Start auf der Fantasy-Münze (2°), Bau etwa 2 s (über allen anderen, 1P-1, 1P-3).
- Vorhanden und brauchbar: Farbbahnen mit Wirkung (Code 41–48), Münzinseln mit festem Rand, Regenbogen-Bogen mit Lücke (größter Sprung, Einhorn setzt hinter der Lücke ab), Wolkenlöcher mit Einhorn-Rettung, Bronze (Erdweg, Pfütze, Kühe), Silber (Wolkenteich, rote Brücke, Kois), Gold (Kerbs, Kies, Kakteen, Eis-Schanze), Platin (Basalt, kleiner Vulkan, Wurmloch), Spirale mit Boost-Pfeilen, Regenschauer wäscht, Glitzerspur, Ereignisse `einhorn` und `gewitter` (Sonnenaufgang, Gewitter mit Blitzen und Zielkreis, letzte Runde Sonne, doppelter Regenbogen, Feuerwerk), Lied `rainbow` mit `rainbowStorm` und `rainbowFinal`.
- Schwach: Lieder ungehört und Wechsel an der Rundengrenze (1S15-1, 1M-1); Wolken und Löcher als Rauschen, Gewitterwolken sehen wie Steine aus, Münzinseln ohne Glanz, nur eine Parallaxe-Ebene, Wolkenzug und drehendes Podest fehlen (1S15-2); Bauzeit 2 s und zwei Überlagerungen je 4,7 MB (1P-3); Leitmotive der Cups fehlen (1M-3); Runde zu kurz für das Finale (1P-2); zwei Wasch-Arten (Regenschauer auf der Linie und Regen im Gewitter, Grundsatz 13); die Inseln zitieren die alten Strecken (Eis-Schanze, kleiner Vulkan, Kakteen statt Pyramide).

## Entscheidungen (Vorschlag, vom Nutzer zu bestätigen)

| Frage | Vorschlag |
|---|---|
| Umfang | **Umbau im neuen Format**: Konzept, Farbbahnen, Bogen, Gewitter-Geschichte bleiben; die Karte wird größer, die Inseln zeigen die neuen Wahrzeichen, zwischen den Inseln gibt es Wolkenwege zur Wahl |
| Kartengröße | **1800 × 1000** (1,8 Mpx), aber nur, wenn die Bauzeit mit 1P-3 unter die der Wüste fällt; sonst 1600 × 1000. Das Wolkenmeer wird nicht je Pixel gerechnet (siehe Performance) |
| Rundenzeit | Ziel **55–65 s**, längste Runde des Spiels (1P-2) |
| Inseln | Fünf Münzen wie bisher (Fantasy, Bronze, Silber, Gold, Platin), jede mit **zwei Zitaten** aus ihrem Cup (siehe Elemente), klein und ohne neue Regeln; Gold und Platin werden größer, weil ihre Cups drei überarbeitete Strecken haben |
| Wolkenwege | **Zwei Gabelungen** zwischen den Inseln: (1) nach Silber: Regenbogenstraße (sicher) oder Wolkenpfad (kürzer, weich, mit Wolkenlöchern am Rand); (2) die Spirale gegen den doppelten Regenbogen (nur letzte Runde, wie heute) |
| Waschen | **Regenschauer als Seitenbucht** vor dem Ziel (kleine Wolke mit Sonne, wäscht nicht sofort, Glitzerspur danach). Der Regen im Gewitter **wäscht nicht mehr** (er bringt Grau, Grundsatz 13) |
| Ereignisse | `einhorn` (bleibt), `gewitter` (bleibt, Geschichte über drei Runden), `kuehe` und `kois` bleiben Inselschalter. Ankündigung ohne Text („WIEHER!“, „BZZZT!“ werden Ton und Symbol) |
| Lied | `rainbow` mit **Schichten an den Runden** statt `rainbowStorm`/`rainbowFinal` als `swap` (1M-1): Runde 2 Moll-Schicht (Filter, Pauke, dunkler Chor), letzte Runde Dur-Schicht mit vollem Chor. Leitmotive auf den Inseln (1M-3) |
| Name, Rekorde | Name `REGENBOGEN` bleibt, `rev: 2` |

### Offene Fragen an den Nutzer

1. Mockup vorhanden?
2. Welche zwei Wahrzeichen je Insel? Vorschlag unten; der Nutzer kennt die Strecken am besten.
3. Soll die Tonart wirklich nicht mehr wechseln (Moll in Runde 2 als Schicht über demselben Grundton, Vorschlag), oder bleibt der Wechsel nach a-Moll und D-Dur und wird nur an die Taktgrenze gelegt?
4. Siegerpodest dreht sich am Ende des Superdupercups (Vorschlag: ja, als kleine Szene auf der Fantasy-Münze, nur nach dem letzten Rennen)?

## Grundriss

```
 x:  0       300       600       900      1200      1500    1800
 y ┌───────────────────────────────────────────────────────────────┐
  0 │   ╭─(2) BRONZE ─╮    ╭═══(3) BOGEN ═══╮       ╭─(4) SILBER ─╮  │
    │  ╱ Kühe, Pfütze ╲═══╝   Lücke ⇗⇘      ╚═══┬═══╡ Wolkenzug,  │  │
200 │ │  Dusche-Steg   │            Wolkenpfad ╰───╡ Kois, Brücke│  │
    │ │                                         ╰──────┬────────╯  │
400 │ (1) FANTASY 🏁                  ☁ Wolkenschlucht  │ (5) GOLD    │
    │  Wolkentor        ╭── doppelter Regenbogen ──╮   │ Kerbs, Sphinx-│
600 │  Podest           │   (nur letzte Runde)     │   │ Tor, Sessel-  │
    │ │                 ╰────╮        (7) SPIRALE ◄┴─(6) PLATIN    │  │
800 │ │ (8) Regen-Bucht ◄══════╯  Farbbahnen, Boost   Lavaröhre,   │  │
    │ ╰══════════════════════════════════════════   Liane, Wurmloch │
1000└───────────────────────────────────────────────────────────────┘
```

Fahrtrichtung (Uhrzeigersinn) wie heute: Start auf der Fantasy-Münze (1) nach Norden, Bronze (2), Bogen mit Lücke (3), Gabelung zu Silber (4), Gold (5) rechts hinunter, Platin (6) unten rechts, Spirale (7) durch das Wolkenmeer oder in der letzten Runde der doppelte Regenbogen, Regen-Bucht (8), Ziel.

Richtwerte (in R1 festlegen):

| Stelle | Richtwert (Spielpixel) |
|---|---|
| Karte | 1800 × 1000 (oder 1600 × 1000, siehe oben) |
| Fantasy-Münze (1) | (200, 520), r 130; Linie (200, 540), Aufstellung y 560–770 (Fahrt nach Norden) |
| Bronze (2) | (430, 150), r 110 |
| Bogen (3) | x 620–1080, y 60–120; Lücke in der Mitte |
| Silber (4) | (1350, 170), r 120; Wolkenpfad als Abzweig vor der Insel |
| Gold (5) | (1600, 450), r 130 |
| Platin (6) | (1450, 820), r 130 |
| Spirale (7) | x 700–1300, y 450–900 |
| Regen-Bucht (8) | an der unteren Geraden vor der Fantasy-Münze, Südseite |

Rundenzeit-Schätzung: Fantasy und Bronze 8 s, Bogen 6 s, Silber 8 s, Gold 9 s, Platin 9 s, Spirale 12 s, Rückweg 6 s ≈ **58 s**.

## Die Elemente

| # | Element | Umsetzung |
|---|---|---|
| 1 | **Fantasy-Münze** | Start und Ziel. Wolkentor mit Banner und Fähnchen über der Linie (verdeckt sie nicht), Siegerpodest am Rand (dreht sich nach dem letzten Rennen des Superdupercups). Münzrand glänzt (1S15-2) |
| 2 | **Bronze (Cup 1)** | Erdweg mit Pfütze und zwei Kühen auf der Straße (vorhanden, Schalter `kuehe`), dazu ein Strandsteg mit Dusche als kurzer Zweig auf der Insel (Zitat Strand; wäscht **nicht**, nur Optik und Spritzer). Tannen am Rand (Wald) |
| 3 | **Regenbogen-Bogen** | Wie heute: steigt über die Wolkenschlucht, Autos werden größer, Lücke oben (größter Sprung, ab etwa 75 % Tempo), Einhorn setzt hinter der Lücke ab. Weiche Wolken-Banden. Kein Dreher nach der Landung (1S8-12) |
| 4 | **Silber (Cup 2)** | Wolkenteich mit roter Brücke und springenden Kois (vorhanden, Schalter `kois`), dazu ein **Wolkenzug**-Übergang wie ZUG Rev 4: Warnlicht mit Andreaskreuz, Schanze daneben, der Zug fährt einmal je Runde (fehlt heute, 1S15-2). Vor der Insel der **Wolkenpfad** als Gabelung (weißer, weicher Weg, kürzer, Wolkenlöcher am Rand) |
| 5 | **Gold (Cup 3)** | Asphalt-Schikane mit Kerbs und Kies (Rennstrecke, vorhanden), **Sphinx-Tor** in der Mitte der Insel (Wüste, zwei kleine Sphinxe, fest), am Ausgang ein kurzer **Sessellift** über eine Wolkenspalte zurück auf den Regenbogen (Eis, wie `c.iceLift`, etwa 1,5 s, ersetzt die Eis-Schanze) |
| 6 | **Platin (Cup 4)** | Kurze **Lavaröhre** durch einen kleinen Vulkankegel (Vulkan Rev 2, dunkel mit Lavarinne, Lichtkarte nur dort), **Liane** über ein Wolkenloch (Dschungel Rev 2, dieselbe Mechanik) als Wahl gegen einen Bogen außen herum, **Wurmloch** auf einer Plattform innen in der Kurve (Weltall, vorhanden) |
| 7 | **Spirale** | Große Links- und Rechtskurve durch das Wolkenmeer, hier zählen die Farbbahnen am meisten; Boost-Pfeile (vorhanden). Gewitterwolken (Matsch, grau) liegen auf Innen- oder Außenlinie, nie quer (Grundsatz 12). In der letzten Runde kürzt der doppelte Regenbogen ab (ohne Bande, wer ihn verlässt, fällt, Einhorn) |
| 8 | **Regen-Bucht** | Seitenbucht vor dem Ziel: kleine Regenwolke mit Sonne darüber, Regenbogen in der Gischt, wäscht (siehe Waschen) |
| 9 | **Wolkenmeer und Kulisse** | **Mehrere Wolkenebenen** mit Parallaxe (1S15-2), Heißluftballons in Regenbogenfarben, Vogelschwärme, Sonnenstrahlen in Runde 1, Blitze und Regen in Runde 2, Feuerwerk in der letzten Runde. Gewitterwolken auf der Straße sehen aus wie Wolken (weich, grau, mit Blitzflackern), nicht wie Steine (1S15-2) |

Bleibt: Farbbahnen, Münzen, Bogen, Wolkenlöcher, Einhorn-Rettung, Kühe, Kois, Kerbs, Wurmloch, Spirale, Boost-Pfeile, doppelter Regenbogen, Gewitter-Geschichte, Einhörner, Glitzerspur, Lied.
Entfällt: Eis-Schanze (durch den Sessellift ersetzt), Kakteen als Gold-Zitat (Sphinx-Tor), kleiner Vulkan ohne Röhre, Regenschauer auf der Linie (`shower`), Waschen durch den Gewitterregen, `rainbowStorm`/`rainbowFinal` als `swap`, Texte „WIEHER!“, „BZZZT!“.

## Waschen (Grundsatz 13)

Nur die **Regen-Bucht**. Der Gewitterregen macht grau (wie die Gewitterwolken), die Dusche auf Bronze ist Optik. Die Bucht wäscht nicht sofort, kündigt sich an (Wolke mit Sonne, Regenbogen in der Gischt), KI nur dreckig (Schwellen .4 / .55 / .7, Gas ≤ .6). Wer sauber herauskommt, bekommt die Glitzerspur (vorhanden).

## Ereignisse

| Schlüssel | Ablauf | Ankündigung | Ort |
|---|---|---|---|
| `einhorn` | Einhörner galoppieren quer über die Straße und hinterlassen eine Boost-Spur (3 s, vorhanden); Rammen = Dreher wie bei der Kuh. Runde 1 selten, Runde 2 keine (Gewitter), letzte Runde viele (Fest) | Hufgetrappel und Glitzerstaub am Bildrand in ihrer Richtung | Regenbogenstraße zwischen den Inseln, nicht auf den Inseln |
| `gewitter` | Runde 1 Sonnenaufgang (blasse Bahnen). Runde 2: Wolkenfront von rechts, dunkel, Regen (wäscht nicht), mehr Gewitterwolken auf der Straße, Bahnen grau, Blitze alle 4–6 s mit gelbem Zielkreis (nie auf Münzen, nie an der Bogenlücke). Letzte Runde: Sonne bricht durch, Wolken werden Glitzer, Bahnen doppelt, doppelter Regenbogen, Feuerwerk (vorhanden) | Zielkreis 1,5 s (vorhanden), Donnergrollen, Paukenwirbel vor der Front | ganze Strecke außer Münzen |
| `kuehe`, `kois` | Inselschalter wie heute | wie WIESE und GARTEN | Bronze, Silber |

`T.ev`-Felder beginnen mit `rb` (prüfen, wie `rainbow.js` sie heute nennt, mit R1 umbenennen).

## Lied `rainbow`

Schichten an den Runden statt `swap` (1M-1, 1S15-1):
- Runde 1: C-Dur, Synth-Bells, Arpeggios, Four-on-the-floor, Chor-Flächen leise.
- Runde 2 (Gewitter): Filter zu, dunkler Chor, Pauke auf der Eins jedes vierten Taktes, Moll-Färbung als Schicht (Begleitung in a-Moll über denselben Bass, siehe offene Frage 3).
- Letzte Runde: voller Chor, Supersaw, Glocken, Crash zu Beginn jeder Phrase.
- **Leitmotive** (1M-3): auf jeder Insel für zwei Takte der Erkennungs-Hook der Strecke, die sie zitiert (Wiese, Zug, Wüste, Eis, Vulkan, Dschungel, Weltall), in C-Dur, nur wenn der Spieler auf der Insel ist.
- Lied anhören (1M-2).

## Performance (Pflicht, ROADMAP 1P-1, 1P-3)

Bau (heute 2 s, Ziel unter der Wüste, besser unter 1 s):
- **Wolkenmeer nicht je Pixel**: grobe Rauschkarte (jede 8. Spalte/Zeile) hochskaliert, Wolkenlöcher als Formen mit weichem Rand (statt Rauschen, 1S15-2).
- **Überlagerungen nur für die Straßen-Rechtecke** (1P-3), nicht zwei Vollbilder je 4,7 MB.
- `rainbowTerrain`: Schleifen nur über die Bänder der Mittellinie und die Münzen.
- Münzen und Wahrzeichen als vorgerenderte Sprites.

Laufzeit:
- Parallaxe: drei Wolkenkacheln, verschoben gezeichnet.
- Lichtkarte nur in der Lavaröhre und im Gewitter (eine Karte in Bildschirmgröße).
- Einhörner, Ballons, Vögel, Feuerwerk nur im Sichtfeld; Feuerwerk höchstens 6 Raketen zugleich.
- Messen in R8: Bauzeit, Speicher, Frame-Zeit im Gewitter mit 10 Autos und in der letzten Runde mit Feuerwerk, Mobilgröße.

## Technik

- **`TRACK_DEFS`**: `rev: 2`, `W`/`H` neu, neue `poly`; `coins` neu platziert und größer, `arch`, Felder je Insel (`bronze: { cows, puddle, pier }`, `silver: { pond, bridge, cloudTrain }`, `gold: { chicane, sphinx, lift }`, `platinum: { cone, tube, liana, portals }`), `cloudPath` (Gabelung 1), `spiral`, `double`, `rainBay`, `storm`/`stormAt`. Entfallen: `ramp` (Eis-Schanze), `cacti`, `shower` auf der Linie.
- **Wiederverwendung**: Sessellift (`ice.js`), Liane (`jungle.js`), Röhre mit Licht (Vulkan Rev 2), Bahnübergang mit Warnlicht (`draw.js`, ZUG Rev 4), Sphinx (`desertmap.js`) als **gemeinsame Bausteine** aufrufen, nicht kopieren (1T-13); wo das nicht geht, eine schlanke Insel-Fassung.
- **Boden-Codes**: 41–48 bleiben; 130–139 nur, wenn eine Insel etwas Neues braucht (z. B. 130 Wolkenpfad: weich, etwas langsamer, wie Violett).
- **Dateien**: `src/rainbowmap.js` (neu angeordnet, Bau schneller), `src/rainbow.js` (Inseln, Gabelung, Bucht, Lied-Schichten-Daten), `src/tracks.js`, `src/music.js` (Schichten, Leitmotive), `src/audio.js`.
- **Fortschritt**: Hook `progress` (Wolkenpfad neben der Straße, Spirale neben dem doppelten Regenbogen, Wurmloch und Lift setzen `c.idx`).
- **KI**:
  - Farbbahnen wie heute (Rot, wo es sich lohnt; Rechtskurven außen).
  - Bogen: Vollgas, ein paar zu langsam (Fehler sind gewollt).
  - Wolkenpfad: SCHWER oft, LEICHT nie; Liane wie im Dschungel (Pendel voraus rechnen); Wurmloch und doppelter Regenbogen ab MITTEL.
  - Lift: automatisch.
  - Blitzkreise: ausweichen (vorhanden).
  - Bucht: nur dreckig.
- **Prüfung**: `check('REGENBOGEN')`; Ebenen (Bogen) kennt die Prüfung nicht, den Bogen im `checkPic` ansehen. Farbbahnen und Sprung mit Kindern prüfen (1S15-3, 3D-4) bleibt ein eigener Punkt.

## Arbeitspakete

| Paket | Inhalt | Prüfen | Status |
|---|---|---|---|
| R0 Bauzeit | 1P-3 zuerst: Überlagerungen nur für Straßen-Rechtecke, Wolkenmeer grob, `rainbowTerrain` schneller (noch auf der alten Karte, damit der Gewinn messbar ist) | Bauzeit vorher/nachher, `check` unverändert | offen |
| R1 Grundriss | Kartengröße, Mittellinie, Fantasy-Start, Münzen neu, Bogen, Spirale, Wolkenschlucht, Checkpoints, `progress`, `rb`-Namen | `check`: Start gerade, 10/10; Bauzeit | offen |
| R2 Bronze und Silber | Kühe, Pfütze, Steg mit Dusche (Optik), Kois, Wolkenzug-Übergang mit Schanze, Wolkenpfad als Gabelung | `check`, Screenshot | offen |
| R3 Gold | Kerbs, Sphinx-Tor, Sessellift über die Spalte (Baustein aus EIS) | `check`, Lift mit 10 Autos | offen |
| R4 Platin | Lavaröhre mit Licht, Liane über ein Wolkenloch, Wurmloch | `check` alle Stufen, Stürze an der Liane | offen |
| R5 Regen-Bucht und Wolkenmeer | Bucht (Waschen), Regen wäscht nicht mehr, Wolkenebenen mit Parallaxe, Löcher als Formen, Gewitterwolken als Wolken | `check`, Screenshot, Frame-Zeit | offen |
| R6 Ereignisse | Einhörner je Runde, Gewitter-Geschichte angepasst (Blitz nie an der Lücke), Ankündigung ohne Text, Podest | `check` mit und ohne `fx` | offen |
| R7 Lied | Schichten statt `swap`, Leitmotive auf den Inseln, neue Töne | Lied anhören (Nutzer, 1S15-1, 1M-2) | offen |
| R8 Abschluss | Performance, `check` LEICHT/MITTEL/SCHWER mit 3, 5, 10 Autos, Grundsätze 1–14; Doku: ROADMAP (1S15, Tabelle, 1M-1, 1M-2, 1M-3, 1P-1, 1P-2, 1P-3, „Zuletzt abgeglichen“), `Strecken.md` 15 (Rev 2 oben, „Noch nicht“ als umgesetzt markieren), Skills `mechanik` („Regenbogen Rev 2 in Kürze“) und `strecke` | alles | offen |

## Grundsätze-Check (für R8)

1. Steigerung: die schwerste Strecke: alle Mechaniken auf einer Runde, Farbbahnen als eigene Ideallinie, größter Sprung, Gewitter in Runde 2, längste Runde.
2. Nichts Unlogisches: Münzen schweben über Wolken, der Bogen führt über die Schlucht, der Lift über eine Spalte, die Liane über ein Loch, der Regenbogen entsteht aus Sonne und Regen.
3. Gewitterwolken auf Innen- oder Außenlinie, vom Rand her; Pfütze auf Bronze am Rand.
4. Keine Abkürzung: Wolkenschlucht in der Mitte, Münzränder fest; der doppelte Regenbogen ist die gewollte Abkürzung der letzten Runde.
5. Startaufstellung auf der Geraden der Fantasy-Münze.
6. Mehr als ein Kreis: Wolkenpfad, Liane oder Bogen, Wurmloch, doppelter Regenbogen.
7. Ereignisse `einhorn`, `gewitter` (dazu `kuehe`, `kois`).
8. Eigenes Lied `rainbow`.
9. Nicht zu viel auf einmal: keine Einhörner im Gewitter, keine Blitze auf Inseln und an der Lücke, Zitate getrennt je Insel.
10. Münzränder und Banden kräftig, Wolkendeko blass; Gewitterwolken klar als Hindernis erkennbar.
11. Nicht kindgerecht: der Sprung, die Blitze, die Liane.
12. Gewitterwolken als Entscheidung, Rot außen gegen Violett innen.
13. Waschen: nur die Regen-Bucht.
14. Wolkentor, Gewitter und Feuerwerk nie über Ziellinie und Aufstellung.
