# VULKAN Rev 2 – Umsetzungsplan

Stand: 2026-10-24, Branch `vulkan_rev2` (Worktree, abgezweigt von `map_pack` bei `8e4a734`). Eigener Plan für den Komplettumbau der Vulkanstrecke (Strecke 10, Cup 4). Er steht bewusst nicht in `ROADMAP.md`; dort bleibt nur der Block `1S10` mit einem Verweis hierher. Vorbild für Aufbau und Ablauf: `plaene/EIS_REV2.md`, `plaene/WUESTE_REV3.md`.

## Ziel in einem Satz

Der Vulkan wird zum Berg, den man sieht und spürt: Man startet am Fuß, springt über einen Lavastrom, schlängelt sich die Serpentinen der Ostflanke hinauf, fährt auf einem schmalen Basaltgrat mitten durch den brodelnden Kratersee und entscheidet oben am Westrand, ob man den offenen Höhenweg über die Nordwestflanke nimmt (Obsidian-Glas, Löschstation) oder durch die glühende Lavaröhre im Nebenkegel fährt. Ab Runde 2 bricht er aus: Lavabomben im Lavafeld und eine Glutwolke, die den offenen Weg hinunterrollt.

## Entscheidungen

Vom Nutzer vorgegeben (Prompt 2026-10-24):

| Frage | Entscheidung |
|---|---|
| Umfang | **Kompletter Umbau** nach dem Vorbild von Wüste Rev 3 und Eis Rev 2: das Thema bestimmt die Strecke, kein Rundkurs mit Deko |
| Entfällt | **Geysir** (nie verstanden), **Hitze** (Thermometer, 85 %, Feuerwehr kühlt sich), **verschwindende Brücken** (Krustenbrücke, Furt mit zwei überspülten Brücken), die alte Lavaröhre als bloße Deko, der Wasserfall |
| Tunnel | Nur wenn er etwas bedeutet; dann **mit Kontrast**: man muss sehen, wohin man fährt |
| Kontrast | Gerade auf dieser Strecke: die Straße hebt sich klar vom Boden ab, Lava leuchtet, Festes ist anders gefärbt als Befahrbares |
| Name, Rekorde | Name `VULKAN` bleibt, `rev: 2` (neue Rekorde, alte bleiben gültig). Ereignis-Schalter `ausbruch` bleibt, `glutwolke` kommt dazu. Lied `volcano` bleibt, Schichten an die Runden gebunden |

Von Claude festgelegt (der Nutzer hat freie Hand gegeben):

| Frage | Entscheidung |
|---|---|
| Kartengröße | **1600 × 1100** (1,76 Mpx). Ein erster Wurf mit 1440 × 1000 ergab nur 28 s je Runde und ließ die Nordhälfte leer |
| Farben | Boden **schwarzer Basalt** (Stricklava-Ringe um den Krater, oben wärmer braun, Licht von Nordwest auf den Hängen, Rinnen die Flanken hinunter), Straße **rotbraune Lavaschlacke** (Lapilli) mit heller Aschekante, Asche **hellgrau** mit weichem Saum, Lava **leuchtend orange-gelb** mit Glutsaum auf allem in der Nähe, alles Feste **blaugrauer Basalt** mit hellen Kappen und harten Schatten, Obsidian **glänzendes Violett-Schwarz** ohne Rand (flach, befahrbar) |
| Brücken | Nur feste: eine Basaltbrücke über den Südoststrom. Nichts verschwindet |
| Waschen | **Löschstation der Feuerwehr** in einer Bucht neben dem offenen Weg (Grundsatz 13): zwei Feuerwehrleute spritzen über einen gefliesten Boden, das Löschfahrzeug steht daneben; wäscht nicht sofort, die Computerautos fahren nur dreckig hinein (und nehmen dann nicht die Röhre) |
| Wahl | **Höhenweg oder Lavaröhre** (Grundsatz 6): offen, breit, bergab, mit Obsidian-Glas und Waschbucht – oder eng, dunkel, kurvig (Boden 80 etwas langsamer), aber geschützt vor der Glutwolke |
| Ereignisse | `ausbruch`: ab Runde 2 roter Himmel, Aschenregen, Rauchsäule, Hubschrauber, **Lavabomben nur im Lavafeld** (Zielkreis, gezielt etwas vor ein Auto); `glutwolke`: ab Runde 2 rollt alle 14–20 s eine **Glutwolke** den offenen Weg hinunter (Ankündigung: Knall, hellgraue Fahne über dem Westrand, „GLUTWOLKE!“, Warnlampe an der Gabelung, Paukenwirbel im Lied); wer drinsteckt, wird rußig, fährt 60 % und hustet. Beide einzeln ausschaltbar, räumlich getrennt (Grundsatz 9) |
| Boden-Codes | Die Kruste (16) entfällt, Code 16 ist frei. Eigene Codes: **80** Boden der Lavaröhre (rau, 86 %), **81** Obsidian (volles Tempo, kaum Haftung, wie Blankeis etwas gutmütiger) |
| Lied | Keine Tempoänderung mehr in der letzten Runde (`volcanoFast` entfällt, 1S10-10/1M-1): ab Runde 2 Doublebass und Chor, in der letzten Runde spielt das Blech die Melodie mit |

## Grundriss

```
 x:  0  150      420  580          800          1040 1110          1480 1600
 y ┌───────────────────────────────────────────────────────────────────────┐
  0 │ Säulen            Nordstrom ║                                         │
250 │ ╭══════ Höhenweg ══╮        ║                  ══ Nordoststrom ═══════│
    │ ║ (8) Obsidian  ┃   ╲   ╭── Kraterrand (fest) ──╮                     │
440 │ ║        Rippe ┃    ╳(6)═══ GRAT ≈≈ SEE ≈≈ GRAT ═══╮                  │
    │ ║ (9) ╭─NEBEN-──╮  ╲                               ╲                  │
570 │ Lösch-│ KEGEL    │  Rippe      ║        ║            ╰══(4)══════════╮  │
    │ stat. │ Röhre ~~ │      Süd-   ║  Süd-  ║  ═══ Rippe ═══════════════│  │
710 │ ║     │   ~~~    │      strom  ║  ost-  ║ ╭════════(3)══════════════╯  │
    │ ║     ╰──────╮   │             ║  strom ║ ╰══════╮ ═══ Rippe ═════════│
850 │ ║ (8)        ╲   │             ║        ║ ╭═════════(2)═════════════╮  │
    │ ║  Obsidian    ╲               ║        ║  ═══ Rippe ═══════════════│  │
990 │ ╰════(1) Start/Ziel ══⇗Sprung═══▲▲Brücke▲═══ Lavafeld ══════════════╯  │
    │        Station                 ║        ║   Asche                      │
1100└───────────────────────────────────────────────────────────────────────┘
```

Fahrtrichtung: Start unten links nach Osten (1), Lavafeld mit Sprung über den Südstrom, Basaltbrücke über den Südoststrom und zwei Hornitos (Schlackenkegelchen) auf der Fahrbahn, Serpentinen die Ostflanke hinauf (2, 3, 4; bergauf, Asche innen in den Kehren), über den Ostrand auf den Grat durch den Kratersee (5), am Westrand die Gabelung (6): der Höhenweg über die Nordwestflanke und die Westkante hinunter (Obsidian-Glasflüsse quer über die Straße, Löschstation 7) oder die Lavaröhre durch den Nebenkegel; beide münden auf die Startgerade.

Werte (stehen in `TRACK_DEFS`, `src/tracks.js`):

| Stelle | Wert |
|---|---|
| Startlinie | (560, 990), Fahrt nach Osten; Aufstellung auf der Geraden (0°) |
| Kratersee | Ellipse (800, 440), rx 165, ry 112; Kraterrand fest, 26 px außerhalb, Lücken nur für Straße und Ströme |
| Grat | y 440, begehbar etwa 44 px breit (Lava ab 22 px von der Mitte, ausgefranster Rand aus dunkler Kruste) |
| Ströme | Süd (Sprung, `push` 108, `vz` 120), Südost (Brücke), Nord und Nordost (Kulisse; der Nordoststrom sperrt den Weg um den Krater) |
| Serpentinen | Schenkel y 990 / 850 / 710 / 570, Kehren bei x 1480 und 1110 (r 70); Rippen y 920, 780, 640 |
| Nebenkegel | Ellipse (330, 680), rx 140, ry 220, fest; Rippen zum Kraterrand und zum Höhenweg |
| Lavaröhre | halbe Breite 20, Gabel (578, 452), Mündung (432, 988); Lavarinne rechts, Katzenaugen alle 20 px |
| Löschstation | Bucht westlich des Höhenwegs, x ≈ 85, y 548–832 |

## Arbeitspakete

| Paket | Inhalt | Status |
|---|---|---|
| V1 | Grundriss, Kraterrand, Ströme, Grat, Rippen, Nebenkegel; neue Farben und Hangschattierung; Startgerade; `rev: 2` | erledigt |
| V2 | Lavafeld: Sprung über den Südstrom, Hornitos, Basaltbrücke, Asche als Wahl (Grundsatz 12) | erledigt |
| V3 | Lavaröhre: Gang mit Wänden, Lavarinne als Licht, Katzenaugen, Dunkelheit nur innen; KI-Wahl, Fortschritt, Code 80 | erledigt |
| V4 | Löschstation (Bucht, Feuerwehr, Wasserbögen), KI nur dreckig; Obsidian (Code 81) | erledigt |
| V5 | Ereignis `ausbruch` (Bomben nur im Lavafeld) und `glutwolke` (Wolke, Ankündigung, Wirkung, KI-Wahl) | erledigt |
| V6 | Alte Mechaniken raus (Geysir, Hitze, Kruste 16, Furt, Wasserfall); Lied an die Runden, Paukenwirbel vor der Wolke | erledigt |
| V7 | Prüfung (`check` auf allen Stufen, `checkPic`, Bilder), Feinschliff, Doku (ROADMAP 1S10, Strecken.md, Skills) | erledigt (offen bleibt die Abnahme durch den Nutzer, ROADMAP 1S10-12) |
